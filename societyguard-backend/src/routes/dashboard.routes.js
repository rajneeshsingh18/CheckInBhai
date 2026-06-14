const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const { prisma } = require('../config/database');

const router = express.Router();

const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Ensure all dashboard routes are authenticated
router.use(authenticate);

/**
 * Helper to get the start of the current day
 */
const getStartOfDay = () => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return start;
};

/**
 * 1. GET /guard
 * Aggregated data for Guard Dashboard
 */
router.get(
  '/guard',
  authorize('GUARD'),
  asyncHandler(async (req, res) => {
    const societyId = req.user.societyId;
    const startOfDay = getStartOfDay();

    // Use Promise.all to fetch all dashboard aggregates in parallel for performance
    const [
      pendingVisitors,
      todayVisitors,
      todayDeliveries,
      staffCheckIns,
      activeAlerts,
      guardDetails,
      currentlyCheckedInStaff,
      recentStaffActivity
    ] = await Promise.all([
      // 1. Pending Approvals
      prisma.visitorEntry.count({
        where: { societyId, status: 'PENDING', createdAt: { gte: startOfDay } }
      }),
      // 2. Total Visitors Today
      prisma.visitorEntry.count({
        where: { societyId, createdAt: { gte: startOfDay } }
      }),
      // 3. Today's Deliveries
      prisma.delivery.count({
        where: { societyId, createdAt: { gte: startOfDay } }
      }),
      // 4. Staff Check-Ins Today
      prisma.staffAttendance.count({
        where: { flat: { societyId }, checkInTime: { gte: startOfDay } }
      }),
      // 5. Active SOS Alerts
      prisma.sOSAlert.count({
        where: { societyId, status: 'ACTIVE' }
      }),
      // 6. Guard Shift Info
      prisma.guard.findUnique({
        where: { userId: req.user.userId },
        select: { isOnDuty: true, shiftStart: true }
      }),
      // 7. Currently Checked In Staff
      prisma.staffAttendance.count({
        where: { flat: { societyId }, checkInTime: { gte: startOfDay }, checkOutTime: null }
      }),
      // 8. Recent Staff Activity (Last 5)
      prisma.staffAttendance.findMany({
        where: { flat: { societyId }, createdAt: { gte: startOfDay } },
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: { staff: { select: { name: true, type: true } } }
      })
    ]);

    res.json({
      data: {
        stats: {
          pendingVisitors,
          todayVisitors,
          todayDeliveries,
          staffCheckIns,
          activeAlerts
        },
        staff: {
          todayCheckIns: staffCheckIns,
          currentlyCheckedIn: currentlyCheckedInStaff,
          pendingCheckOuts: currentlyCheckedInStaff,
          recentActivity: recentStaffActivity
        },
        shift: guardDetails
      }
    });
  })
);

/**
 * 2. GET /society-admin
 * Aggregated data for Society Admin Dashboard
 */
router.get(
  '/society-admin',
  authorize('SOCIETY_ADMIN'),
  asyncHandler(async (req, res) => {
    const societyId = req.user.societyId;
    const startOfDay = getStartOfDay();

    const [
      totalFlats,
      totalResidents,
      activeGuards,
      todayVisitors,
      activeAlerts,
      recentEntries,
      staffStats
    ] = await Promise.all([
      // Society Stats
      prisma.flat.count({ where: { societyId } }),
      prisma.resident.count({ where: { flat: { societyId } } }),
      prisma.guard.count({ where: { societyId, isOnDuty: true } }),
      // Activity
      prisma.visitorEntry.count({ where: { societyId, createdAt: { gte: startOfDay } } }),
      prisma.sOSAlert.findMany({ where: { societyId, status: 'ACTIVE' }, include: { flat: true } }),
      // Recent Entries
      prisma.visitorEntry.findMany({
        where: { societyId },
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: { visitor: true, flat: true }
      }),
      // Staff Stats
      prisma.staff.groupBy({
        by: ['type'],
        where: { flat: { societyId }, isActive: true },
        _count: { _all: true }
      })
    ]);

    // Complex staff aggregates
    const [totalRegisteredStaff, todayStaffCheckIns, todayStaffAbsents] = await Promise.all([
      prisma.staff.count({ where: { flat: { societyId }, isActive: true } }),
      prisma.staffAttendance.count({ where: { flat: { societyId }, checkInTime: { gte: startOfDay } } }),
      prisma.staffAttendance.count({ where: { flat: { societyId }, status: 'ABSENT', createdAt: { gte: startOfDay } } })
    ]);

    const staffByType = staffStats.reduce((acc, curr) => {
      acc[curr.type] = curr._count._all;
      return acc;
    }, {});

    res.json({
      data: {
        overview: { totalFlats, totalResidents, activeGuards },
        today: { todayVisitors, activeAlertsCount: activeAlerts.length },
        staff: {
          totalRegistered: totalRegisteredStaff,
          todayCheckIns: todayStaffCheckIns,
          absentToday: todayStaffAbsents,
          byType: staffByType
        },
        activeAlerts,
        recentEntries
      }
    });
  })
);

/**
 * 3. GET /resident
 * Aggregated data for Resident Dashboard
 */
router.get(
  '/resident',
  authorize('RESIDENT'),
  asyncHandler(async (req, res) => {
    const flatId = req.user.flatId;
    const startOfDay = getStartOfDay();

    const [
      pendingApprovals,
      todayDeliveries,
      staffAttendance,
      recentVisitors,
      residentStaff
    ] = await Promise.all([
      // Pending actions for their specific flat
      prisma.visitorEntry.findMany({
        where: { flatId, status: 'PENDING' },
        include: { visitor: true }
      }),
      // Deliveries today
      prisma.delivery.findMany({
        where: { flatId, createdAt: { gte: startOfDay } }
      }),
      // Staff arrivals today
      prisma.staffAttendance.findMany({
        where: { flatId, createdAt: { gte: startOfDay } },
        include: { staff: true }
      }),
      // Recent visitors
      prisma.visitorEntry.findMany({
        where: { flatId },
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: { visitor: true }
      }),
      // Resident's staff list with today's status
      prisma.staff.findMany({
        where: { flatId, isActive: true },
        include: {
          staffAttendances: {
            where: { createdAt: { gte: startOfDay } },
            take: 1,
            orderBy: { createdAt: 'desc' }
          }
        }
      })
    ]);

    const staffTodayStatus = residentStaff.map(s => {
      const attendance = s.staffAttendances[0];
      let status = 'NOT_ARRIVED';
      let time = null;
      if (attendance) {
        if (attendance.status === 'ABSENT') status = 'ABSENT';
        else if (attendance.checkOutTime) status = 'CHECKED_OUT';
        else if (attendance.checkInTime) {
          status = 'CHECKED_IN';
          time = attendance.checkInTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
        }
      }
      return { name: s.name, type: s.type, status, time };
    });

    res.json({
      data: {
        actionRequired: {
          pendingVisitorCount: pendingApprovals.length,
          pendingApprovals
        },
        todayActivity: {
          deliveriesCount: todayDeliveries.length,
          deliveries: todayDeliveries,
          staffPresent: staffAttendance
        },
        staff: {
          totalStaff: residentStaff.length,
          todayStatus: staffTodayStatus
        },
        recentVisitors
      }
    });
  })
);

module.exports = router;
