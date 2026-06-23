const webpush = require('web-push');
const { prisma } = require('../config/database');

const publicVapidKey = process.env.VAPID_PUBLIC_KEY;
const privateVapidKey = process.env.VAPID_PRIVATE_KEY;
const subject = process.env.VAPID_SUBJECT || 'mailto:test@test.com';

webpush.setVapidDetails(subject, publicVapidKey, privateVapidKey);

const pushService = {
  /**
   * Send a push notification to a specific user
   */
  async sendToUser(userId, payload) {
    try {
      const subscriptions = await prisma.pushSubscription.findMany({
        where: { userId }
      });

      if (subscriptions.length === 0) {
        return; // No subscriptions found
      }

      const stringifiedPayload = JSON.stringify(payload);

      const pushPromises = subscriptions.map(async (sub) => {
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: sub.keys
        };

        try {
          await webpush.sendNotification(pushSubscription, stringifiedPayload);
        } catch (error) {
          if (error.statusCode === 404 || error.statusCode === 410) {
            // Subscription has expired or is no longer valid
            console.log('Subscription expired. Deleting from DB:', sub.endpoint);
            await prisma.pushSubscription.delete({ where: { endpoint: sub.endpoint } });
          } else {
            console.error('Error sending push notification:', error);
          }
        }
      });

      await Promise.all(pushPromises);
    } catch (error) {
      console.error('Failed to send push notification to user:', error);
    }
  },

  /**
   * Save a subscription for a user
   */
  async saveSubscription(userId, subscription) {
    // We upsert based on the endpoint to avoid duplicates
    return prisma.pushSubscription.upsert({
      where: { endpoint: subscription.endpoint },
      update: {
        userId,
        keys: subscription.keys
      },
      create: {
        userId,
        endpoint: subscription.endpoint,
        keys: subscription.keys
      }
    });
  },

  /**
   * Remove a subscription
   */
  async removeSubscription(endpoint) {
    try {
      await prisma.pushSubscription.delete({
        where: { endpoint }
      });
    } catch (error) {
      // Might already be deleted, ignore
    }
  }
};

module.exports = pushService;
