const { z } = require('zod');
const { prisma, runTransaction } = require('../config/database');
const { ValidationError, NotFoundError, ForbiddenError } = require('../utils/errors');
const notificationService = require('./notification.service');
const { getReadFilter, canAccess } = require('../config/access-control');

const staffScheduleSchema = z.object({
  days: z.array(z.enum(['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'])),
  checkInWindow: z.object({
    start: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid time format (HH:mm)"),
    end: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid time format (HH:mm)")
  }),
  checkOutWindow: z.object({
    start: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid time format (HH:mm)"),
    end: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid time format (HH:mm)")
  })
});

const registerStaffSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100),
  type: z.enum(['MAID', 'DRIVER', 'COOK', 'NANNY', 'OTHER']),
  mobile: z.string().regex(/^[6-9]\d{9}$/, "Invalid Indian mobile number").optional(),
  schedule: staffScheduleSchema,
  validTill: z.string().datetime().optional().or(z.date().optional()),
  monthlySalary: z.number().nonnegative().optional(),
  hourlyRate: z.number().nonnegative().optional()
});

const staffService = {
  /**
   * 1. Register Staff (Resident)
   */
  async registerStaff(residentUser, flatId, data) {
    // RBAC check
    canAccess(residentUser, 'staff', 'write', 'own_flat');

    if (residentUser.flatId !== flatId && residentUser.role !== 'SUPER_ADMIN') {
      throw new ForbiddenError("You can only register staff for your own flat");
    }

    const parsedData = registerStaffSchema.parse(data);

    // Check for existing staff with same name + type for this flat
    const existing = await prisma.staff.findFirst({
      where: {
        flatId,
        name: parsedData.name,
        type: parsedData.type,
        isActive: true
      }
    });

    if (existing) {
      console.warn(`Staff member ${parsedData.name} (${parsedData.type}) already exists for flat ${flatId}`);
    }

    const staff = await prisma.staff.create({
      data: {
        name: parsedData.name,
        type: parsedData.type,
        mobile: parsedData.mobile,
        schedule: parsedData.schedule,
        flatId,
        validFrom: new Date(),
        validTill: parsedData.validTill ? new Date(parsedData.validTill) : null,
        monthlySalary: parsedData.monthlySalary || null,
        hourlyRate: parsedData.hourlyRate || null,
        isActive: true
      },
      include: { flat: true }
    });

    return staff;
  },

  /**
   * 2. Check In (Guard)
   */
  async checkIn(guardUser, staffId) {
    canAccess(guardUser, 'staffAttendance', 'write', 'create');

    return runTransaction(async (tx) => {
      const staff = await tx.staff.findUnique({
        where: { id: staffId },
        include: { 
          flat: { include: { residents: { include: { user: true } } } }
        }
      });

      if (!staff) throw new NotFoundError("Staff member not found");
      if (staff.flat.societyId !== guardUser.societyId) {
        throw new ForbiddenError("Staff belongs to a different society");
      }
      if (!staff.isActive) throw new ValidationError("Staff member is inactive");
      if (staff.validTill && staff.validTill < new Date()) {
        throw new ValidationError("Staff registration has expired");
      }

      // Check if already checked in today
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      const existingAttendance = await tx.staffAttendance.findFirst({
        where: {
          staffId,
          createdAt: { gte: startOfDay },
          checkOutTime: null
        }
      });

      if (existingAttendance) {
        throw new ValidationError("Staff is already checked in");
      }

      // Determine status based on schedule
      let status = 'ON_TIME';
      if (staff.schedule && staff.schedule.checkInWindow) {
        const now = new Date();
        const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        
        if (currentTime > staff.schedule.checkInWindow.end) {
          status = 'LATE';
        }
      }

      const attendance = await tx.staffAttendance.create({
        data: {
          staffId,
          flatId: staff.flatId,
          checkInTime: new Date(),
          status,
          recordedById: guardUser.id
        },
        include: { staff: true }
      });

      // Notify residents
      const residents = staff.flat.residents;
      residents.forEach(res => {
        if (res.user) {
          notificationService.sendStaffArrivalNotification(res.user, staff, attendance)
            .catch(err => console.error("Staff Arrival Notification Error:", err));
        }
      });

      return attendance;
    });
  },

  /**
   * 3. Check Out (Guard)
   */
  async checkOut(guardUser, staffId) {
    canAccess(guardUser, 'staffAttendance', 'write', 'create');

    return runTransaction(async (tx) => {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      const attendance = await tx.staffAttendance.findFirst({
        where: {
          staffId,
          createdAt: { gte: startOfDay },
          checkOutTime: null
        },
        include: { 
          staff: true,
          flat: { include: { residents: { include: { user: true } } } }
        }
      });

      if (!attendance) {
        throw new ValidationError('No active check-in found for today');
      }

      const checkOutTime = new Date();
      const diffMs = checkOutTime - attendance.checkInTime;
      const hoursWorked = parseFloat((diffMs / (1000 * 60 * 60)).toFixed(2));

      const updatedAttendance = await tx.staffAttendance.update({
        where: { id: attendance.id },
        data: {
          checkOutTime,
          hoursWorked
        },
        include: { staff: true }
      });

      // Notify residents
      const residents = attendance.flat.residents;
      residents.forEach(res => {
        if (res.user) {
          notificationService.sendStaffDepartureNotification(res.user, attendance.staff, updatedAttendance)
            .catch(err => console.error("Staff Departure Notification Error:", err));
        }
      });

      return updatedAttendance;
    });
  },

  /**
   * 4. Get Staff by Flat (Resident)
   */
  async getStaffByFlat(residentUser, flatId) {
    canAccess(residentUser, 'staff', 'read', 'own_flat');

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const staffList = await prisma.staff.findMany({
      where: {
        flatId,
        isActive: true
      },
      include: {
        staffAttendances: {
          where: { createdAt: { gte: startOfDay } },
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    });

    return staffList.map(s => {
      const todayAttendance = s.staffAttendances[0];
      let status = 'NOT_ARRIVED';
      if (todayAttendance) {
        if (todayAttendance.checkOutTime) {
          status = 'CHECKED_OUT';
        } else if (todayAttendance.checkInTime) {
          status = 'CHECKED_IN';
        } else if (todayAttendance.status === 'ABSENT') {
          status = 'ABSENT';
        }
      }
      delete s.staffAttendances;
      return { ...s, todayStatus: status, todayAttendance };
    });
  },

  /**
   * 5. Get Today's Attendance (Guard/Admin)
   */
  async getTodayAttendance(user) {
    canAccess(user, 'staffAttendance', 'read', 'own_society');

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const activeStaff = await prisma.staff.findMany({
      where: {
        flat: { societyId: user.societyId },
        isActive: true
      },
      include: {
        flat: { include: { tower: true } },
        staffAttendances: {
          where: { createdAt: { gte: startOfDay } },
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    });

    const result = {
      checkedIn: [],
      checkedOut: [],
      notArrived: [],
      absent: []
    };

    activeStaff.forEach(s => {
      const todayAttendance = s.staffAttendances[0];
      const staffInfo = {
        id: s.id,
        name: s.name,
        type: s.type,
        flatNumber: s.flat.number,
        towerName: s.flat.tower.name,
        todayAttendance
      };

      if (!todayAttendance) {
        result.notArrived.push(staffInfo);
      } else if (todayAttendance.status === 'ABSENT') {
        result.absent.push(staffInfo);
      } else if (todayAttendance.checkOutTime) {
        result.checkedOut.push(staffInfo);
      } else {
        result.checkedIn.push(staffInfo);
      }
    });

    return result;
  },

  /**
   * 6. Get Attendance Report (Resident/Admin)
   */
  async getAttendanceReport(user, flatId, month, year) {
    const isResident = user.role === 'RESIDENT';
    if (isResident && user.flatId !== flatId) {
      throw new ForbiddenError("Access denied to this flat's reports");
    }

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const staffList = await prisma.staff.findMany({
      where: { flatId },
      include: {
        staffAttendances: {
          where: {
            createdAt: { gte: startDate, lte: endDate }
          },
          orderBy: { createdAt: 'asc' }
        }
      }
    });

    const report = staffList.map(staff => {
      const attendance = staff.staffAttendances;
      const presentDays = attendance.filter(a => a.checkInTime).length;
      const absentDays = attendance.filter(a => a.status === 'ABSENT').length;
      const lateDays = attendance.filter(a => a.status === 'LATE').length;
      const totalHours = attendance.reduce((sum, a) => sum + (a.hoursWorked || 0), 0);

      // Simple calculation for expected days based on schedule
      // This could be more complex (counting actual weekdays in month)
      const scheduledDaysCount = staff.schedule?.days?.length || 0;
      const weeksInMonth = 4.345; // average
      const expectedWorkingDays = Math.round(scheduledDaysCount * weeksInMonth);

      // Salary Calculation Logic
      let estimatedSalary = 0;
      let salaryBasis = 'None';
      if (staff.monthlySalary) {
        salaryBasis = 'Monthly';
        const perDaySalary = staff.monthlySalary / (expectedWorkingDays || 30);
        // Estimate based on present days minus late penalty (e.g. 0.5 day for late)
        const latePenalty = lateDays * 0.5 * perDaySalary;
        estimatedSalary = Math.max(0, (presentDays * perDaySalary) - latePenalty);
      } else if (staff.hourlyRate) {
        salaryBasis = 'Hourly';
        estimatedSalary = totalHours * staff.hourlyRate;
      }

      return {
        staffId: staff.id,
        name: staff.name,
        type: staff.type,
        monthlySalary: staff.monthlySalary,
        hourlyRate: staff.hourlyRate,
        summary: {
          presentDays,
          absentDays,
          lateDays,
          totalHours: parseFloat(totalHours.toFixed(2)),
          expectedWorkingDays,
          estimatedSalary: Math.round(estimatedSalary),
          salaryBasis
        },
        dailyBreakdown: attendance
      };
    });

    return report;
  },

  /**
   * 7. Update Staff (Resident)
   */
  async updateStaff(residentUser, staffId, data) {
    canAccess(residentUser, 'staff', 'write', 'own_flat');

    const staff = await prisma.staff.findUnique({ where: { id: staffId } });
    if (!staff) throw new NotFoundError("Staff member not found");
    if (staff.flatId !== residentUser.flatId && residentUser.role !== 'SUPER_ADMIN') {
      throw new ForbiddenError("You can only update staff for your own flat");
    }

    const updateSchema = registerStaffSchema.partial();
    const parsedData = updateSchema.parse(data);

    return prisma.staff.update({
      where: { id: staffId },
      data: parsedData
    });
  },

  /**
   * 8. Deactivate Staff (Resident)
   */
  async deactivateStaff(residentUser, staffId) {
    canAccess(residentUser, 'staff', 'write', 'own_flat');

    const staff = await prisma.staff.findUnique({ where: { id: staffId } });
    if (!staff) throw new NotFoundError("Staff member not found");
    if (staff.flatId !== residentUser.flatId && residentUser.role !== 'SUPER_ADMIN') {
      throw new ForbiddenError("You can only deactivate staff for your own flat");
    }

    return prisma.staff.update({
      where: { id: staffId },
      data: { isActive: false }
    });
  },

  /**
   * 9. Get Staff by ID
   */
  async getStaffById(user, staffId) {
    const staff = await prisma.staff.findUnique({
      where: { id: staffId },
      include: {
        flat: { include: { tower: true } },
        staffAttendances: {
          take: 10,
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!staff) throw new NotFoundError("Staff member not found");

    // RBAC check
    const isSuperAdmin = user.role === 'SUPER_ADMIN';
    const isSocietyAdmin = user.role === 'SOCIETY_ADMIN' && staff.flat.societyId === user.societyId;
    const isResident = user.role === 'RESIDENT' && staff.flatId === user.flatId;
    const isGuard = user.role === 'GUARD' && staff.flat.societyId === user.societyId;

    if (!isSuperAdmin && !isSocietyAdmin && !isResident && !isGuard) {
      throw new ForbiddenError("Access denied to this staff record");
    }

    return staff;
  }
};

module.exports = staffService;
