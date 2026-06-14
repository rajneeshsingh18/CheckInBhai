const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const staffService = require('../services/staff.service');
const { getIO } = require('../config/socket-instance');

const router = express.Router();

const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// All attendance routes require authentication
router.use(authenticate);

/**
 * 1. POST /check-in/:staffId
 * Guard marks staff arrival.
 */
router.post(
  '/check-in/:staffId',
  authorize('GUARD'),
  asyncHandler(async (req, res) => {
    const { staffId } = req.params;
    const attendance = await staffService.checkIn(req.user, staffId);

    // Emit Socket.io event to resident's flat room
    const io = getIO();
    io.to(`flat:${attendance.flatId}:residents`).emit('staff:check-in', {
      staffName: attendance.staff.name,
      staffType: attendance.staff.type,
      checkInTime: attendance.checkInTime,
      status: attendance.status
    });

    res.status(201).json({
      message: 'Staff check-in recorded',
      data: attendance
    });
  })
);

/**
 * 2. POST /check-out/:staffId
 * Guard marks staff departure.
 */
router.post(
  '/check-out/:staffId',
  authorize('GUARD'),
  asyncHandler(async (req, res) => {
    const { staffId } = req.params;
    const attendance = await staffService.checkOut(req.user, staffId);

    // Emit Socket.io event to resident's flat room
    const io = getIO();
    io.to(`flat:${attendance.flatId}:residents`).emit('staff:check-out', {
      staffName: attendance.staff.name,
      staffType: attendance.staff.type,
      checkOutTime: attendance.checkOutTime,
      hoursWorked: attendance.hoursWorked
    });

    res.json({
      message: 'Staff check-out recorded',
      data: attendance
    });
  })
);

/**
 * 3. GET /today
 * Today's attendance for the whole society.
 */
router.get(
  '/today',
  authorize('GUARD', 'SOCIETY_ADMIN'),
  asyncHandler(async (req, res) => {
    const result = await staffService.getTodayAttendance(req.user);
    res.json({ data: result });
  })
);

/**
 * 4. GET /report
 * Monthly attendance report for the resident's flat.
 */
router.get(
  '/report',
  authorize('RESIDENT'),
  asyncHandler(async (req, res) => {
    const { month, year } = req.query;
    if (!month || !year) {
      return res.status(400).json({ error: 'Month and year are required' });
    }

    const report = await staffService.getAttendanceReport(
      req.user, 
      req.user.flatId, 
      parseInt(month), 
      parseInt(year)
    );

    res.json({ data: report });
  })
);

/**
 * 5. GET /report/:staffId
 * Detailed report for a specific staff member.
 */
router.get(
  '/report/:staffId',
  authorize('RESIDENT', 'SOCIETY_ADMIN'),
  asyncHandler(async (req, res) => {
    const { staffId } = req.params;
    const { month, year } = req.query;
    
    if (!month || !year) {
      return res.status(400).json({ error: 'Month and year are required' });
    }

    // We can reuse getAttendanceReport and filter for the specific staff member
    // In a more complex app, we might have a dedicated service method
    const allReports = await staffService.getAttendanceReport(
      req.user,
      req.user.flatId || req.user.societyId, // Logic inside service handles RBAC
      parseInt(month),
      parseInt(year)
    );

    const staffReport = allReports.find(r => r.staffId === staffId);
    
    if (!staffReport) {
      throw new NotFoundError("Staff report not found");
    }

    res.json({ data: staffReport });
  })
);

module.exports = router;
