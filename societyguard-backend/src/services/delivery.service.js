const { z } = require('zod');
const { prisma, runTransaction } = require('../config/database');
const { ValidationError, NotFoundError, ForbiddenError } = require('../utils/errors');
const { otpService } = require('./otp.service');
const notificationService = require('./notification.service');
const { getReadFilter, canAccess } = require('../config/access-control');

const logDeliverySchema = z.object({
  flatId: z.string().cuid("Invalid Flat ID"),
  category: z.enum(['AMAZON', 'FLIPKART', 'SWIGGY', 'ZOMATO', 'COURIER', 'OTHER']),
  deliveryPersonName: z.string().min(2, "Name must be at least 2 characters"),
  deliveryPersonMobile: z.string().regex(/^[6-9]\d{9}$/, "Invalid Indian mobile number").optional(),
  packageCount: z.number().min(1).max(50).default(1),
  notes: z.string().max(200).optional(),
  photoUrl: z.string().url().optional()
});

const deliveryService = {
  /**
   * 1. Log Delivery (Guard)
   */
  async logDelivery(guardUser, data) {
    canAccess(guardUser, 'deliveries', 'write', 'create');

    const parsedData = logDeliverySchema.parse(data);
    
    // Auto-flag urgent food deliveries in notes
    if (['SWIGGY', 'ZOMATO'].includes(parsedData.category)) {
      parsedData.notes = parsedData.notes 
        ? `[URGENT: Perishable] ${parsedData.notes}`
        : '[URGENT: Perishable]';
    }

    return runTransaction(async (tx) => {
      // Verify Flat exists and belongs to Guard's society
      const flat = await tx.flat.findUnique({
        where: { id: parsedData.flatId },
        include: { residents: { include: { user: true } } }
      });

      if (!flat || flat.societyId !== guardUser.societyId) {
        throw new NotFoundError("Flat not found in your society");
      }

      // Create Delivery
      const delivery = await tx.delivery.create({
        data: {
          societyId: guardUser.societyId,
          flatId: flat.id,
          category: parsedData.category,
          deliveryPersonName: parsedData.deliveryPersonName,
          deliveryPersonMobile: parsedData.deliveryPersonMobile,
          packageCount: parsedData.packageCount,
          status: 'RECEIVED',
          receivedAt: new Date(),
          notes: parsedData.notes,
          photoUrl: parsedData.photoUrl,
          receivedByGuardId: guardUser.id
        }
      });

      // Generate OTP and Notify Primary Resident
      const primaryResident = flat.residents[0]?.user;
      let otpValue = null;

      if (primaryResident) {
        otpValue = await otpService.generateOTP(primaryResident.id, 'DELIVERY_PICKUP', { deliveryId: delivery.id });
        
        notificationService.sendDeliveryNotification(primaryResident, delivery, otpValue)
          .catch(err => console.error("Delivery Notification Error:", err));
      }

      return {
        delivery,
        _devOtp: process.env.NODE_ENV === 'development' ? otpValue : undefined
      };
    });
  },

  /**
   * 2. Pickup Delivery (Resident)
   */
  async pickupDelivery(residentUser, deliveryId, otp) {
    canAccess(residentUser, 'deliveries', 'write', 'pickup');

    return runTransaction(async (tx) => {
      const validOtp = await otpService.verifyOTP(residentUser.id, otp, 'DELIVERY_PICKUP');

      if (validOtp.metadata?.deliveryId && validOtp.metadata.deliveryId !== deliveryId) {
        throw new ValidationError("OTP does not match this specific delivery");
      }

      const delivery = await tx.delivery.findUnique({
        where: { id: deliveryId },
        include: { flat: true }
      });

      if (!delivery) throw new NotFoundError("Delivery not found");
      if (delivery.flatId !== residentUser.flatId) throw new ForbiddenError("You can only pickup deliveries for your own flat");
      if (delivery.status !== 'RECEIVED') throw new ValidationError(`Cannot pickup. Status is currently ${delivery.status}`);

      const updatedDelivery = await tx.delivery.update({
        where: { id: deliveryId },
        data: {
          status: 'PICKED_UP',
          pickedUpAt: new Date(),
          pickedUpById: residentUser.id
        },
        include: { flat: { include: { tower: true } } }
      });

      await otpService.invalidateOTP(validOtp.id);

      return updatedDelivery;
    });
  },

  /**
   * 3. Get Today's Deliveries (Dashboard)
   */
  async getTodayDeliveries(user, filters = {}) {
    const { status, category, page = 1, limit = 20 } = filters;
    const skip = (page - 1) * limit;

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const where = {
      ...getReadFilter(user, 'deliveries'),
      createdAt: { gte: startOfDay }
    };

    if (status) where.status = status;
    if (category) where.category = category;

    const [deliveries, total] = await Promise.all([
      prisma.delivery.findMany({
        where,
        include: {
          flat: { include: { tower: true } },
          receivedGuard: { select: { name: true } }
        },
        orderBy: [
          // Prisma doesn't support complex case ordering natively in findMany, 
          // but we prioritize receivedAt DESC as primary order for today
          { receivedAt: 'desc' }
        ],
        skip,
        take: Number(limit)
      }),
      prisma.delivery.count({ where })
    ]);

    // Memory sort to bubble up food deliveries if needed, or rely strictly on time
    const sortedDeliveries = deliveries.sort((a, b) => {
      const aIsFood = ['SWIGGY', 'ZOMATO'].includes(a.category);
      const bIsFood = ['SWIGGY', 'ZOMATO'].includes(b.category);
      if (aIsFood && !bIsFood) return -1;
      if (!aIsFood && bIsFood) return 1;
      return 0; // fallback to DB receivedAt ordering
    });

    return { deliveries: sortedDeliveries, total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / limit) };
  },

  /**
   * 4. Get Resident Deliveries (History)
   */
  async getResidentDeliveries(user, filters = {}) {
    const { page = 1, limit = 20, status } = filters;
    const skip = (page - 1) * limit;

    const where = getReadFilter(user, 'deliveries'); // Resolves to flatId

    if (status) where.status = status;

    const [deliveries, total] = await Promise.all([
      prisma.delivery.findMany({
        where,
        orderBy: { receivedAt: 'desc' },
        skip,
        take: Number(limit)
      }),
      prisma.delivery.count({ where })
    ]);

    return { deliveries, total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / limit) };
  },

  /**
   * 5. Get Pending Count (For Dashboard Badges)
   */
  async getPendingCount(user) {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const baseWhere = {
      ...getReadFilter(user, 'deliveries'),
      createdAt: { gte: startOfDay }
    };

    const [pendingPickup, todayTotal] = await Promise.all([
      prisma.delivery.count({ where: { ...baseWhere, status: 'RECEIVED' } }),
      prisma.delivery.count({ where: baseWhere })
    ]);

    return { pendingPickup, todayTotal };
  },

  /**
   * 6. Get Delivery Stats (Admin Analytics)
   */
  async getDeliveryStats(societyId, days = 7) {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() - days);

    const deliveries = await prisma.delivery.findMany({
      where: {
        societyId,
        createdAt: { gte: targetDate }
      },
      select: {
        category: true,
        receivedAt: true,
        pickedUpAt: true
      }
    });

    const stats = {
      totalDeliveries: deliveries.length,
      byCategory: {
        AMAZON: 0, FLIPKART: 0, SWIGGY: 0, ZOMATO: 0, COURIER: 0, OTHER: 0
      },
      averagePickupTimeMinutes: 0,
      peakHours: {} // format: { '14': count } for 2PM
    };

    let totalPickupTimeMinutes = 0;
    let pickedUpCount = 0;

    deliveries.forEach(d => {
      // Category Count
      if (stats.byCategory[d.category] !== undefined) {
        stats.byCategory[d.category]++;
      } else {
        stats.byCategory.OTHER++;
      }

      // Pickup Time Calculation
      if (d.pickedUpAt && d.receivedAt) {
        const diffMinutes = Math.floor((new Date(d.pickedUpAt) - new Date(d.receivedAt)) / 60000);
        totalPickupTimeMinutes += diffMinutes;
        pickedUpCount++;
      }

      // Peak Hours
      const hour = new Date(d.receivedAt).getHours();
      stats.peakHours[hour] = (stats.peakHours[hour] || 0) + 1;
    });

    if (pickedUpCount > 0) {
      stats.averagePickupTimeMinutes = Math.floor(totalPickupTimeMinutes / pickedUpCount);
    }

    return stats;
  },

  /**
   * 7. Mark as Returned (Guard)
   */
  async markAsReturned(guardUser, deliveryId) {
    canAccess(guardUser, 'deliveries', 'write', 'create');

    const delivery = await prisma.delivery.findUnique({ where: { id: deliveryId } });
    if (!delivery) throw new NotFoundError("Delivery not found");
    if (delivery.societyId !== guardUser.societyId) throw new ForbiddenError("Delivery belongs to a different society");
    if (delivery.status !== 'RECEIVED') throw new ValidationError(`Cannot return delivery. Status is ${delivery.status}`);

    // Optional Check: Is it > 72 hours old?
    // const seventyTwoHoursAgo = new Date(Date.now() - 72 * 60 * 60 * 1000);
    // if (delivery.receivedAt > seventyTwoHoursAgo) throw new ValidationError("Delivery must be 72 hours old to mark as returned");

    return prisma.delivery.update({
      where: { id: deliveryId },
      data: { status: 'RETURNED' }
    });
  },

  /**
   * 8. Get Delivery By ID
   */
  async getDeliveryById(user, deliveryId) {
    const delivery = await prisma.delivery.findUnique({
      where: { id: deliveryId },
      include: {
        flat: { include: { tower: true } },
        receivedGuard: { select: { name: true, mobile: true } },
        pickedUpUser: { select: { name: true } }
      }
    });

    if (!delivery) throw new NotFoundError("Delivery not found");

    // Dynamic Access Check
    const isSuperAdmin = user.role === 'SUPER_ADMIN';
    const isSocietyMatch = (user.role === 'SOCIETY_ADMIN' || user.role === 'GUARD') && delivery.societyId === user.societyId;
    const isFlatMatch = user.role === 'RESIDENT' && delivery.flatId === user.flatId;

    if (!isSuperAdmin && !isSocietyMatch && !isFlatMatch) {
      throw new ForbiddenError("You do not have access to view this delivery");
    }

    return delivery;
  }
};

module.exports = deliveryService;
