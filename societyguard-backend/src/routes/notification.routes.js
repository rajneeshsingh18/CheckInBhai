const express = require('express');
const { authenticate } = require('../middleware/auth');
const pushService = require('../services/push.service');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

/**
 * 1. POST /subscribe
 * Save push subscription for the authenticated user
 */
router.post('/subscribe', async (req, res, next) => {
  try {
    const subscription = req.body;
    
    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({ error: 'Invalid subscription object' });
    }

    await pushService.saveSubscription(req.user.userId || req.user.id, subscription);
    
    res.status(201).json({ message: 'Subscription saved successfully' });
  } catch (error) {
    next(error);
  }
});

/**
 * 2. DELETE /unsubscribe
 * Remove push subscription
 */
router.delete('/unsubscribe', async (req, res, next) => {
  try {
    const { endpoint } = req.body;
    
    if (!endpoint) {
      return res.status(400).json({ error: 'Endpoint is required' });
    }

    await pushService.removeSubscription(endpoint);
    
    res.json({ message: 'Subscription removed successfully' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
