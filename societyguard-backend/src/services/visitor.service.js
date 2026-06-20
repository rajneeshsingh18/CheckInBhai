const { z } = require('zod');
const { prisma, runTransaction } = require('../config/database');
const { ValidationError, NotFoundError, ForbiddenError } = require('../utils/errors');
const { otpService } = require('./otp.service');
const notificationService = require('./notification.service');
const { getReadFilter, canAccess } = require('../config/access-control');

const createEntrySchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  mobile: z.string().regex(/^[6-9]\d{9}$/, "Invalid Indian mobile number"),
  purpose: z.string().optional(),
  flatId: z.string().cuid("Invalid Flat ID"),
  vehicleNumber: z.string().optional(),
  notes: z.string().optional(),
  photoUrl: z.string().url().optional()
});

const visitorService = {
  /**
   * 1. Create Visitor Entry (Guard)
   */
  async createEntry(guardUser, data) {
    // RBAC Check
    canAccess(guardUser, 'visitorEntries', 'write', 'create_exit');

    const parsedData = createEntrySchema.parse(data);
    const { name, mobile, purpose, flatId, vehicleNumber, notes, photoUrl } = parsedData;

    return runTransaction(async (tx) => {
      // Verify Flat exists and belongs to Guard's society
      const flat = await tx.flat.findUnique({
        where: { id: flatId },
        include: { residents: { include: { user: true } } }
      });

      if (!flat || flat.societyId !== guardUser.societyId) {
        throw new NotFoundError("Flat not found in your society");
      }

      // Upsert Visitor
      const visitor = await tx.visitor.upsert({
        where: { mobile },
        update: { name, photoUrl: photoUrl || undefined },
        create: { name, mobile, photoUrl }
      });

      // Check for existing active entries to prevent spam
      const existingEntry = await tx.visitorEntry.findFirst({
        where: {
          visitorId: visitor.id,
          flatId: flat.id,
          status: { in: ['PENDING', 'APPROVED'] }
        }
      });

      if (existingEntry) {
        throw new ValidationError("An active entry already exists for this visitor at this flat.");
      }

      // Create Entry
      const entry = await tx.visitorEntry.create({
        data: {
          visitorId: visitor.id,
          flatId: flat.id,
          societyId: guardUser.societyId,
          purpose,
          status: 'PENDING',
          entryTime: new Date(),
          notes,
          createdBy: guardUser.id
        }
      });

      // Handle Vehicle if provided
      if (vehicleNumber) {
        await tx.vehicle.upsert({
          where: { societyId_number: { societyId: guardUser.societyId, number: vehicleNumber } },
          update: { flatId: flat.id, isResident: false },
          create: { number: vehicleNumber, societyId: guardUser.societyId, flatId: flat.id, isResident: false }
        });
      }

      // Generate OTP and Notify Resident (Non-blocking notification)
      const primaryResident = flat.residents[0]?.user;
      let otpValue = null;

      if (primaryResident) {
        otpValue = await otpService.generateOTP(primaryResident.id, 'VISITOR_APPROVAL', { entryId: entry.id });
        
        // Fire and forget notification
        notificationService.sendVisitorApprovalRequest(primaryResident, visitor, entry, otpValue)
          .catch(err => console.error("Notification Error:", err));
      }

      // In development, we return the OTP for easy testing
      return {
        entry,
        visitor,
        _devOtp: process.env.NODE_ENV === 'development' ? otpValue : undefined
      };
    });
  },

  /**
   * 2. Approve Entry (Resident)
   */
  async approveEntry(residentUser, entryId, otp) {
    canAccess(residentUser, 'visitorEntries', 'write', 'approve_reject');

    return runTransaction(async (tx) => {
      // Verify OTP strictly
      const validOtp = await otpService.verifyOTP(residentUser.id, otp, 'VISITOR_APPROVAL');
      
      if (validOtp.metadata?.entryId && validOtp.metadata.entryId !== entryId) {
        throw new ValidationError("OTP does not match this specific visitor entry");
      }

      // Fetch entry and verify ownership
      const entry = await tx.visitorEntry.findUnique({
        where: { id: entryId },
        include: { visitor: true, flat: true }
      });

      if (!entry) throw new NotFoundError("Entry not found");
      if (entry.flatId !== residentUser.flatId) throw new ForbiddenError("You can only approve visitors for your own flat");
      if (entry.status !== 'PENDING') throw new ValidationError(`Cannot approve. Entry is currently ${entry.status}`);

      // Update state
      const updatedEntry = await tx.visitorEntry.update({
        where: { id: entryId },
        data: {
          status: 'APPROVED',
          approvedBy: residentUser.id,
          approvedAt: new Date()
        },
        include: { visitor: true, flat: { include: { tower: true } } }
      });

      await otpService.invalidateOTP(validOtp.id);

      return updatedEntry;
    });
  },

  /**
   * 3. Reject Entry (Resident)
   */
  async rejectEntry(residentUser, entryId, otp, reason) {
    canAccess(residentUser, 'visitorEntries', 'write', 'approve_reject');

    return runTransaction(async (tx) => {
      const validOtp = await otpService.verifyOTP(residentUser.id, otp, 'VISITOR_APPROVAL');

      const entry = await tx.visitorEntry.findUnique({ where: { id: entryId } });
      if (!entry) throw new NotFoundError("Entry not found");
      if (entry.flatId !== residentUser.flatId) throw new ForbiddenError("You can only reject visitors for your own flat");
      if (entry.status !== 'PENDING') throw new ValidationError(`Cannot reject. Entry is currently ${entry.status}`);

      const updatedEntry = await tx.visitorEntry.update({
        where: { id: entryId },
        data: {
          status: 'REJECTED',
          approvedBy: residentUser.id,
          approvedAt: new Date(),
          notes: reason ? `Rejected: ${reason}` : 'Rejected by resident'
        }
      });

      await otpService.invalidateOTP(validOtp.id);

      return updatedEntry;
    });
  },

  /**
   * 4. Exit Visitor (Guard)
   */
  async exitVisitor(guardUser, entryId) {
    canAccess(guardUser, 'visitorEntries', 'write', 'create_exit');

    const entry = await prisma.visitorEntry.findUnique({ where: { id: entryId } });
    if (!entry) throw new NotFoundError("Entry not found");
    if (entry.societyId !== guardUser.societyId) throw new ForbiddenError("Entry belongs to a different society");
    if (entry.status !== 'APPROVED') throw new ValidationError(`Cannot exit visitor. Status is ${entry.status}`);

    return prisma.visitorEntry.update({
      where: { id: entryId },
      data: {
        status: 'EXITED',
        exitTime: new Date()
      },
      include: { visitor: true, flat: true }
    });
  },

  /**
   * 5. Get Today's Entries (Paginated)
   */
  async getTodayEntries(user, filters = {}) {
    const { status, search, page = 1, limit = 20 } = filters;
    const skip = (page - 1) * limit;

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const where = {
      ...getReadFilter(user, 'visitorEntries'),
      createdAt: { gte: startOfDay }
    };

    if (status) where.status = status;
    
    if (search) {
      where.visitor = {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { mobile: { contains: search } }
        ]
      };
    }

    const [entries, total] = await Promise.all([
      prisma.visitorEntry.findMany({
        where,
        include: { visitor: true, flat: { include: { tower: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: Number(limit)
      }),
      prisma.visitorEntry.count({ where })
    ]);

    return { entries, total, pages: Math.ceil(total / limit) };
  },

  /**
   * 6. Search Visitors (Global Society Search)
   */
  async searchVisitors(user, query) {
    if (!query || query.length < 2) throw new ValidationError("Search query must be at least 2 characters");

    const where = {
      societyId: user.societyId, // Specific to society scoped users (Admins/Guards)
      OR: [
        { name: { contains: query, mode: 'insensitive' } },
        { mobile: { contains: query } }
      ]
    };

    return prisma.visitor.findMany({
      where,
      take: 20,
      include: {
        visitorEntries: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { flat: { include: { tower: true } } }
        }
      }
    });
  },

  /**
   * 7. Get Resident History
   */
  async getResidentHistory(user, filters = {}) {
    const { page = 1, limit = 20, status, dateFrom, dateTo } = filters;
    const skip = (page - 1) * limit;

    const where = getReadFilter(user, 'visitorEntries'); // Forces flatId

    if (status) where.status = status;
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo);
    }

    const [entries, total] = await Promise.all([
      prisma.visitorEntry.findMany({
        where,
        include: { visitor: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: Number(limit)
      }),
      prisma.visitorEntry.count({ where })
    ]);

    return { entries, total, pages: Math.ceil(total / limit) };
  },

  /**
   * 8. Get Pending Count (For Dashboard)
   */
  async getPendingCount(user) {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const baseWhere = {
      ...getReadFilter(user, 'visitorEntries'),
      createdAt: { gte: startOfDay }
    };

    const [pending, todayTotal] = await Promise.all([
      prisma.visitorEntry.count({ where: { ...baseWhere, status: 'PENDING' } }),
      prisma.visitorEntry.count({ where: baseWhere })
    ]);

    return { pending, todayTotal };
  },

  /**
   * 9. Get Single Entry by ID
   */
  async getEntryById(user, entryId) {
    const entry = await prisma.visitorEntry.findUnique({
      where: { id: entryId },
      include: { visitor: true, flat: { include: { tower: true } } }
    });

    if (!entry) throw new NotFoundError("Entry not found");

    // Dynamic Access Check
    const isSuperAdmin = user.role === 'SUPER_ADMIN';
    const isSocietyMatch = (user.role === 'SOCIETY_ADMIN' || user.role === 'GUARD') && entry.societyId === user.societyId;
    const isFlatMatch = user.role === 'RESIDENT' && entry.flatId === user.flatId;

    if (!isSuperAdmin && !isSocietyMatch && !isFlatMatch) {
      throw new ForbiddenError("You do not have access to view this entry");
    }

    return entry;
  },

  /**
   * 10. Get all flats in a society (For dropdown/combobox search)
   */
  async getSocietyFlats(user) {
    const societyId = user.societyId;
    if (!societyId) throw new ValidationError("User has no associated society");

    return prisma.flat.findMany({
      where: { societyId },
      include: {
        tower: {
          select: { name: true }
        }
      },
      orderBy: [
        { tower: { name: 'asc' } },
        { number: 'asc' }
      ]
    });
  }
};

module.exports = visitorService;

