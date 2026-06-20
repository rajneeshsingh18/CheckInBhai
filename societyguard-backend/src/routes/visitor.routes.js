const express = require('express');
const { authenticate } = require('../middleware/auth');
const visitorService = require('../services/visitor.service');
const { uploadPhoto, processVisitorPhoto } = require('../middleware/upload');
const { getIO } = require('../config/socket-instance');

const router = express.Router();

// Utility wrapper to catch async errors and pass them to Express error handler
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// All visitor routes require authentication
router.use(authenticate);

/**
 * 1. POST /entry
 * Guard creates a new visitor entry.
 */
router.post(
  '/entry',
  uploadPhoto,
  processVisitorPhoto,
  asyncHandler(async (req, res) => {
    const data = {
      ...req.body,
      photoUrl: req.processedPhotoUrl // from processVisitorPhoto middleware
    };

    const result = await visitorService.createEntry(req.user, data);

    // Emit real-time socket event to the resident's specific flat room
    const io = getIO();
    io.to(`flat:${data.flatId}:residents`).emit('visitor:new-entry', {
      message: 'New visitor at the gate',
      visitor: result.visitor,
      entry: result.entry
    });

    res.status(201).json({
      message: 'Visitor entry created. Waiting for resident approval.',
      data: result
    });
  })
);

/**
 * 2. POST /approve
 * Resident approves a pending visitor using OTP.
 */
router.post(
  '/approve',
  asyncHandler(async (req, res) => {
    const { entryId, otp } = req.body;
    
    const updatedEntry = await visitorService.approveEntry(req.user, entryId, otp);

    // Notify Guards in the society that the visitor is approved to enter
    const io = getIO();
    io.to(`society:${req.user.societyId}:guards`).emit('visitor:approved', {
      entryId: updatedEntry.id,
      visitorName: updatedEntry.visitor.name,
      flatNumber: updatedEntry.flat.number
    });

    res.json({
      message: 'Visitor approved successfully',
      data: updatedEntry
    });
  })
);

/**
 * 3. POST /reject
 * Resident rejects a pending visitor using OTP.
 */
router.post(
  '/reject',
  asyncHandler(async (req, res) => {
    const { entryId, otp, reason } = req.body;

    const updatedEntry = await visitorService.rejectEntry(req.user, entryId, otp, reason);

    // Notify Guards
    const io = getIO();
    io.to(`society:${req.user.societyId}:guards`).emit('visitor:rejected', {
      entryId: updatedEntry.id,
      visitorName: updatedEntry.visitor?.name,
      reason: updatedEntry.notes
    });

    res.json({
      message: 'Visitor rejected',
      data: updatedEntry
    });
  })
);

/**
 * 4. POST /exit/:entryId
 * Guard records the exit of an approved visitor.
 */
router.post(
  '/exit/:entryId',
  asyncHandler(async (req, res) => {
    const { entryId } = req.params;

    const updatedEntry = await visitorService.exitVisitor(req.user, entryId);

    // Notify society (all) that the visitor has left
    const io = getIO();
    io.to(`society:${req.user.societyId}:all`).emit('visitor:exited', {
      entryId: updatedEntry.id,
      visitorName: updatedEntry.visitor?.name
    });

    res.json({
      message: 'Visitor exit recorded successfully',
      data: updatedEntry
    });
  })
);

/**
 * 5. GET /today
 * Get paginated entries for today.
 */
router.get(
  '/today',
  asyncHandler(async (req, res) => {
    const filters = {
      status: req.query.status,
      search: req.query.search,
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 20
    };

    const result = await visitorService.getTodayEntries(req.user, filters);
    res.json({ data: result });
  })
);

/**
 * 6. GET /search
 * Global search for visitors within a society.
 */
router.get(
  '/search',
  asyncHandler(async (req, res) => {
    const query = req.query.q;
    const result = await visitorService.searchVisitors(req.user, query);
    res.json({ data: result });
  })
);

/**
 * 7. GET /history
 * Resident fetches historical entries for their flat.
 */
router.get(
  '/history',
  asyncHandler(async (req, res) => {
    const filters = {
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 20,
      status: req.query.status,
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo
    };

    const result = await visitorService.getResidentHistory(req.user, filters);
    res.json({ data: result });
  })
);

/**
 * 8. GET /pending-count
 * Gets the count of pending and total today entries for dashboard widgets.
 */
router.get(
  '/pending-count',
  asyncHandler(async (req, res) => {
    const result = await visitorService.getPendingCount(req.user);
    res.json({ data: result });
  })
);

/**
 * 9. GET /:entryId
 * Fetch a specific entry by ID (respecting access controls).
 */
router.get(
  '/:entryId',
  asyncHandler(async (req, res) => {
    const { entryId } = req.params;
    const result = await visitorService.getEntryById(req.user, entryId);
    res.json({ data: result });
  })
);

/**
 * 10. GET /flats
 * Get all flats in the guard's/user's society.
 */
router.get(
  '/flats',
  asyncHandler(async (req, res) => {
    const flats = await visitorService.getSocietyFlats(req.user);
    res.json({ data: flats });
  })
);

module.exports = router;

