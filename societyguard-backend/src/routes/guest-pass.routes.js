const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const guestPassService = require('../services/guest-pass.service');
const { getIO } = require('../config/socket-instance');

const router = express.Router();

const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// All routes require authentication
router.use(authenticate);

/**
 * 1. POST /
 * Resident generates a new QR guest pass.
 */
router.post(
  '/',
  authorize('RESIDENT'),
  asyncHandler(async (req, res) => {
    const result = await guestPassService.generatePass(
      req.user.userId,
      req.user.flatId,
      req.user.societyId,
      req.body
    );

    res.status(201).json({
      message: 'Guest pass generated successfully',
      data: result
    });
  })
);

/**
 * 2. POST /validate
 * Guard scans and validates a QR pass.
 */
router.post(
  '/validate',
  authorize('GUARD'),
  asyncHandler(async (req, res) => {
    const { qrToken } = req.body;
    
    const result = await guestPassService.validateQRPass(
      req.user.userId,
      req.user.societyId,
      qrToken
    );

    // Notify resident that their guest has arrived
    const io = getIO();
    io.to(`flat:${req.user.flatId}:residents`).emit('guest:arrived', {
      message: `${result.visitorName} has scanned their pass and entered.`,
      visitorName: result.visitorName,
      entryTime: result.entryTime
    });

    res.json({
      message: 'QR Pass validated. Access granted.',
      data: result
    });
  })
);

/**
 * 3. GET /
 * Resident views their generated passes.
 */
router.get(
  '/',
  authorize('RESIDENT'),
  asyncHandler(async (req, res) => {
    const filters = {
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 20,
      status: req.query.status
    };

    const result = await guestPassService.getResidentPasses(
      req.user,
      req.user.flatId,
      filters
    );

    res.json({ data: result });
  })
);

/**
 * 4. POST /:passId/cancel
 * Resident cancels a pass.
 */
router.post(
  '/:passId/cancel',
  authorize('RESIDENT'),
  asyncHandler(async (req, res) => {
    const { passId } = req.params;
    const result = await guestPassService.cancelPass(req.user, passId);

    res.json({
      message: 'Pass cancelled successfully',
      data: result
    });
  })
);

/**
 * 5. POST /:passId/renew
 * Resident renews/extends a pass.
 */
router.post(
  '/:passId/renew',
  authorize('RESIDENT'),
  asyncHandler(async (req, res) => {
    const { passId } = req.params;
    const { validTill } = req.body;
    
    const result = await guestPassService.renewPass(req.user, passId, validTill);

    res.json({
      message: 'Pass renewed successfully',
      data: result
    });
  })
);

/**
 * 6. GET /stats
 * Resident dashboard stats.
 */
router.get(
  '/stats',
  authorize('RESIDENT'),
  asyncHandler(async (req, res) => {
    const stats = await guestPassService.getPassStats(req.user.flatId);
    res.json({ data: stats });
  })
);

/**
 * 7. GET /:passId
 * Single pass details.
 */
router.get(
  '/:passId',
  asyncHandler(async (req, res) => {
    const { passId } = req.params;
    const pass = await guestPassService.getPassById(passId, req.user);
    res.json({ data: pass });
  })
);

module.exports = router;
