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
      guardDetails
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
        where: { flat: { societyId }, createdAt: { gte: startOfDay } }
      }),
      // 5. Active SOS Alerts
      prisma.sOSAlert.count({
        where: { societyId, status: 'ACTIVE' }
      }),
      // 6. Guard Shift Info
      prisma.guard.findUnique({
        where: { userId: req.user.userId },
        select: { isOnDuty: true, shiftStart: true }
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
      recentEntries
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
      })
    ]);

    res.json({
      data: {
        overview: { totalFlats, totalResidents, activeGuards },
        today: { todayVisitors, activeAlertsCount: activeAlerts.length },
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
      recentVisitors
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
      })
    ]);

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
        recentVisitors
      }
    });
  })
);

module.exports = router;
