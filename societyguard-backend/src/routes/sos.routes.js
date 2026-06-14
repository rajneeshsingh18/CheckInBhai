const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const sosService = require('../services/sos.service');
const emergencyContactsService = require('../services/emergency-contacts.service');
const { getIO } = require('../config/socket-instance');
const rateLimit = require('express-rate-limit');

const router = express.Router();

const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Rate limit: 3 SOS per resident per hour
const sosLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: { error: 'Too many SOS alerts raised. Please contact security directly if this is not a mistake.' }
});

// All routes require authentication
router.use(authenticate);

/**
 * 1. POST /
 * Resident raises SOS alert.
 */
router.post(
  '/',
  authorize('RESIDENT'),
  sosLimiter,
  asyncHandler(async (req, res) => {
    const alert = await sosService.raiseSOS(
      req.user.userId,
      req.user.flatId,
      req.user.societyId,
      req.body
    );

    // Emit Socket.io event with HIGH PRIORITY
    const io = getIO();
    io.to(`society:${req.user.societyId}:emergency`).emit('sos:raised', {
      priority: 'HIGH',
      alert: {
        id: alert.id,
        type: alert.type,
        location: alert.location,
        raisedBy: alert.raisedUser.name,
        mobile: alert.raisedUser.mobile,
        time: alert.createdAt
      }
    });

    res.status(201).json({
      message: 'SOS Alert raised successfully. Responders have been notified.',
      data: alert
    });
  })
);

/**
 * 2. POST /:alertId/acknowledge
 * Responder acknowledges the alert.
 */
router.post(
  '/:alertId/acknowledge',
  authorize('GUARD', 'SOCIETY_ADMIN'),
  asyncHandler(async (req, res) => {
    const { alertId } = req.params;
    const alert = await sosService.acknowledgeAlert(req.user.userId, alertId);

    // Emit Socket.io event
    const io = getIO();
    io.to(`society:${req.user.societyId}:emergency`).emit('sos:acknowledged', {
      alertId: alert.id,
      acknowledgedBy: alert.acknowledgedUser.name,
      timestamp: new Date()
    });

    res.json({
      message: 'Alert acknowledged',
      data: alert
    });
  })
);

/**
 * 3. POST /:alertId/resolve
 * Admin resolves the alert.
 */
router.post(
  '/:alertId/resolve',
  authorize('SOCIETY_ADMIN', 'SUPER_ADMIN'),
  asyncHandler(async (req, res) => {
    const { alertId } = req.params;
    const { resolutionNotes } = req.body;
    const alert = await sosService.resolveAlert(req.user.userId, alertId, resolutionNotes);

    // Emit Socket.io event
    const io = getIO();
    io.to(`society:${req.user.societyId}:emergency`).emit('sos:resolved', {
      alertId: alert.id,
      resolvedAt: alert.resolvedAt,
      notes: resolutionNotes
    });

    res.json({
      message: 'Alert resolved successfully',
      data: alert
    });
  })
);

/**
 * 4. GET /active
 * Get active alerts for society.
 */
router.get(
  '/active',
  asyncHandler(async (req, res) => {
    const alerts = await sosService.getActiveAlerts(req.user.societyId);
    res.json({ data: alerts });
  })
);

/**
 * 5. GET /history
 * Alert history with filters.
 */
router.get(
  '/history',
  authorize('SOCIETY_ADMIN', 'SUPER_ADMIN'),
  asyncHandler(async (req, res) => {
    const filters = {
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 20,
      type: req.query.type,
      status: req.query.status,
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo
    };

    const result = await sosService.getAlertHistory(req.user.societyId, filters);
    res.json({ data: result });
  })
);

/**
 * 6. GET /stats
 * Alert analytics.
 */
router.get(
  '/stats',
  authorize('SOCIETY_ADMIN'),
  asyncHandler(async (req, res) => {
    const days = parseInt(req.query.days) || 30;
    const stats = await sosService.getAlertStats(req.user.societyId, days);
    res.json({ data: stats });
  })
);

/**
 * 7. POST /test
 * Admin tests SOS system.
 */
router.post(
  '/test',
  authorize('SOCIETY_ADMIN'),
  asyncHandler(async (req, res) => {
    const result = await sosService.testAlertSystem(req.user.societyId);
    res.json({
      message: 'SOS Test initiated. You should receive a test notification.',
      data: result
    });
  })
);

/**
 * 8. GET /contacts
 * Get emergency contact numbers.
 */
router.get(
  '/contacts',
  asyncHandler(async (req, res) => {
    const contacts = await emergencyContactsService.getEmergencyContacts(req.user.societyId);
    res.json({ data: contacts });
  })
);

/**
 * 9. PUT /contacts
 * Update society emergency contacts.
 */
router.put(
  '/contacts',
  authorize('SOCIETY_ADMIN'),
  asyncHandler(async (req, res) => {
    const contacts = await emergencyContactsService.updateEmergencyContacts(req.user.societyId, req.body.contacts);
    res.json({
      message: 'Emergency contacts updated successfully',
      data: contacts
    });
  })
);

/**
 * 10. GET /instructions/:type
 * Get emergency instructions.
 */
router.get(
  '/instructions/:type',
  asyncHandler(async (req, res) => {
    const { type } = req.params;
    const instructions = emergencyContactsService.getEmergencyInstructions(type);
    res.json({ data: instructions });
  })
);

/**
 * 11. GET /:alertId
 * Single alert details.
 */
router.get(
  '/:alertId',
  asyncHandler(async (req, res) => {
    const { alertId } = req.params;
    const alert = await sosService.getAlertById(alertId, req.user);
    res.json({ data: alert });
  })
);

module.exports = router;
