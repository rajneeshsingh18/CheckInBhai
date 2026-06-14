const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const staffService = require('../services/staff.service');
const { z } = require('zod');

const router = express.Router();

const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// All staff routes require authentication
router.use(authenticate);

/**
 * 1. POST /
 * Resident registers a new staff member.
 */
router.post(
  '/',
  authorize('RESIDENT'),
  asyncHandler(async (req, res) => {
    const staff = await staffService.registerStaff(req.user, req.user.flatId, req.body);
    res.status(201).json({
      message: 'Staff registered successfully',
      data: staff
    });
  })
);

/**
 * 2. GET /
 * Resident gets all staff for their flat.
 */
router.get(
  '/',
  authorize('RESIDENT'),
  asyncHandler(async (req, res) => {
    const staffList = await staffService.getStaffByFlat(req.user, req.user.flatId);
    res.json({ data: staffList });
  })
);

/**
 * 3. GET /:staffId
 * Get specific staff details.
 */
router.get(
  '/:staffId',
  authorize('RESIDENT', 'SOCIETY_ADMIN', 'GUARD'),
  asyncHandler(async (req, res) => {
    const { staffId } = req.params;
    const staff = await staffService.getStaffById(req.user, staffId);
    res.json({ data: staff });
  })
);

/**
 * 4. PUT /:staffId
 * Resident updates staff details.
 */
router.put(
  '/:staffId',
  authorize('RESIDENT'),
  asyncHandler(async (req, res) => {
    const { staffId } = req.params;
    const staff = await staffService.updateStaff(req.user, staffId, req.body);
    res.json({
      message: 'Staff updated successfully',
      data: staff
    });
  })
);

/**
 * 5. DELETE /:staffId
 * Resident deactivates a staff member.
 */
router.delete(
  '/:staffId',
  authorize('RESIDENT'),
  asyncHandler(async (req, res) => {
    const { staffId } = req.params;
    const staff = await staffService.deactivateStaff(req.user, staffId);
    res.json({
      message: 'Staff deactivated successfully',
      data: staff
    });
  })
);

module.exports = router;
