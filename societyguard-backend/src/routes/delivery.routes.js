const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const deliveryService = require('../services/delivery.service');
const { uploadPhoto, processVisitorPhoto } = require('../middleware/upload');
const { getIO } = require('../config/socket-instance');

const router = express.Router();

const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// All delivery routes require authentication
router.use(authenticate);

/**
 * 1. POST /log
 * Guard logs a new delivery package.
 */
router.post(
  '/log',
  authorize('GUARD'),
  uploadPhoto,
  processVisitorPhoto,
  asyncHandler(async (req, res) => {
    const data = {
      ...req.body,
      packageCount: req.body.packageCount ? parseInt(req.body.packageCount) : 1,
      photoUrl: req.processedPhotoUrl // from processVisitorPhoto middleware
    };

    const result = await deliveryService.logDelivery(req.user, data);

    // Emit Socket.io event to resident's flat room
    const io = getIO();
    io.to(`flat:${data.flatId}:residents`).emit('delivery:received', {
      message: `New ${data.category} delivery received at the gate.`,
      delivery: result.delivery
    });

    res.status(201).json({
      message: 'Delivery logged successfully. Resident notified.',
      data: result
    });
  })
);

/**
 * 2. POST /pickup
 * Resident confirms pickup of a delivery using OTP.
 */
router.post(
  '/pickup',
  authorize('RESIDENT'),
  asyncHandler(async (req, res) => {
    const { deliveryId, otp } = req.body;

    const updatedDelivery = await deliveryService.pickupDelivery(req.user, deliveryId, otp);

    // Emit Socket.io event to Guards
    const io = getIO();
    io.to(`society:${req.user.societyId}:guards`).emit('delivery:picked-up', {
      message: `Delivery picked up for Flat ${updatedDelivery.flat.number}`,
      deliveryId: updatedDelivery.id,
      flatNumber: updatedDelivery.flat.number
    });

    res.json({
      message: 'Delivery pickup confirmed successfully',
      data: updatedDelivery
    });
  })
);

/**
 * 3. GET /today
 * Guard/Admin dashboard showing today's deliveries.
 */
router.get(
  '/today',
  authorize('GUARD', 'SOCIETY_ADMIN'),
  asyncHandler(async (req, res) => {
    const filters = {
      status: req.query.status,
      category: req.query.category,
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 20
    };

    const result = await deliveryService.getTodayDeliveries(req.user, filters);
    res.json({ data: result });
  })
);

/**
 * 4. GET /history
 * Resident views their delivery history.
 */
router.get(
  '/history',
  authorize('RESIDENT'),
  asyncHandler(async (req, res) => {
    const filters = {
      status: req.query.status,
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 20
    };

    const result = await deliveryService.getResidentDeliveries(req.user, filters);
    res.json({ data: result });
  })
);

/**
 * 5. GET /pending-count
 * Badge count for guard/admin dashboard.
 */
router.get(
  '/pending-count',
  authorize('GUARD', 'SOCIETY_ADMIN'),
  asyncHandler(async (req, res) => {
    const result = await deliveryService.getPendingCount(req.user);
    res.json({ data: result });
  })
);

/**
 * 6. GET /stats
 * Admin analytics - delivery breakdown.
 */
router.get(
  '/stats',
  authorize('SOCIETY_ADMIN'),
  asyncHandler(async (req, res) => {
    const days = parseInt(req.query.days) || 7;
    const stats = await deliveryService.getDeliveryStats(req.user.societyId, days);
    res.json({ data: stats });
  })
);

/**
 * 7. POST /:deliveryId/return
 * Guard marks an uncollected delivery as returned.
 */
router.post(
  '/:deliveryId/return',
  authorize('GUARD'),
  asyncHandler(async (req, res) => {
    const { deliveryId } = req.params;
    const updatedDelivery = await deliveryService.markAsReturned(req.user, deliveryId);

    // Notify flat that the package was returned
    const io = getIO();
    io.to(`flat:${updatedDelivery.flatId}:residents`).emit('delivery:returned', {
      message: 'A delivery package was marked as returned by the guard.',
      deliveryId: updatedDelivery.id
    });

    res.json({
      message: 'Delivery marked as returned',
      data: updatedDelivery
    });
  })
);

/**
 * 8. GET /:deliveryId
 * Single delivery details with access control.
 */
router.get(
  '/:deliveryId',
  asyncHandler(async (req, res) => {
    const { deliveryId } = req.params;
    const result = await deliveryService.getDeliveryById(req.user, deliveryId);
    res.json({ data: result });
  })
);

module.exports = router;
