const cron = require('node-cron');
const { prisma } = require('../config/database');
const notificationService = require('../services/notification.service');
const sosService = require('../services/sos.service');

/**
 * SOS Emergency Alert Background Jobs
 */

const initializeSOSJobs = () => {
  /**
   * 1. Unresolved Alert Escalation (Every 15 minutes)
   * Escalates alerts that haven't been acknowledged.
   */
  cron.schedule('*/15 * * * *', async () => {
    console.log('[CRON] Running SOS Escalation job...');
    try {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);

      // Find unacknowledged alerts older than 5 minutes
      const pendingAlerts = await prisma.sOSAlert.findMany({
        where: {
          status: 'ACTIVE',
          createdAt: { lt: fiveMinutesAgo }
        },
        include: {
          raisedUser: true,
          society: {
            include: {
              users: {
                where: { role: { in: ['GUARD', 'SOCIETY_ADMIN'] }, isActive: true },
                select: { id: true, name: true, mobile: true, role: true }
              }
            }
          }
        }
      });

      for (const alert of pendingAlerts) {
        console.log(`[CRON] Escalating unresolved SOS alert ${alert.id}`);
        
        // 1a. Re-send emergency notifications (escalation)
        notificationService.sendEmergencyAlert(alert.society.users, alert, alert.raisedUser)
          .catch(err => console.error(`[ESCALATION ERROR] Failed to re-notify for alert ${alert.id}:`, err));

        // 1b. If alert is 15+ minutes old, escalate to Super Admin
        if (alert.createdAt < fifteenMinutesAgo) {
          const superAdmins = await prisma.user.findMany({
            where: { role: 'SUPER_ADMIN', isActive: true },
            select: { id: true, name: true, mobile: true }
          });

          notificationService.sendEmergencyAlert(superAdmins, alert, alert.raisedUser)
            .catch(err => console.error(`[CRITICAL ESCALATION ERROR] Failed to notify Super Admins for alert ${alert.id}:`, err));

          await prisma.sOSAlert.update({
            where: { id: alert.id },
            data: { description: alert.description ? `${alert.description}\n[ESCALATED to Super Admin]` : '[ESCALATED to Super Admin]' }
          });
        }
      }

      console.log(`[CRON] SOS Escalation check complete. Processed ${pendingAlerts.length} alerts.`);
    } catch (error) {
      console.error('[CRON ERROR] SOS Escalation failed:', error);
    }
  });

  /**
   * 2. Daily SOS Summary (Daily at 11 PM)
   */
  cron.schedule('0 23 * * *', async () => {
    console.log('[CRON] Generating Daily SOS Summary...');
    try {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      // Find societies with SOS activity today
      const societiesWithActivity = await prisma.society.findMany({
        where: {
          sosAlerts: {
            some: { createdAt: { gte: startOfDay } }
          }
        },
        include: {
          users: { where: { role: 'SOCIETY_ADMIN', isActive: true } }
        }
      });

      for (const society of societiesWithActivity) {
        const stats = await sosService.getAlertStats(society.id, 1);
        
        const summaryMsg = `Daily SOS Summary for ${society.name}:\nTotal: ${stats.totalAlerts}\nActive: ${stats.activeCount}\nAvg. Resolution: ${stats.averageResolutionMinutes} min.`;

        // Notify admins
        for (const admin of society.users) {
          notificationService.sendSMS(admin.mobile, summaryMsg)
            .catch(err => console.error(`[SUMMARY ERROR] Failed to send daily summary to admin ${admin.id}:`, err));
        }
      }
    } catch (error) {
      console.error('[CRON ERROR] Daily SOS Summary failed:', error);
    }
  });

  /**
   * 3. Monthly SOS Analytics (1st of month at 6 AM)
   */
  cron.schedule('0 6 1 * *', async () => {
    console.log('[CRON] Generating Monthly SOS Analytics...');
    try {
      const societies = await prisma.society.findMany({
        include: { users: { where: { role: 'SOCIETY_ADMIN', isActive: true } } }
      });

      for (const society of societies) {
        const stats = await sosService.getAlertStats(society.id, 30);
        
        // In a real app, we might store this in a 'Reports' table
        // For now, we notify admin and log
        console.log(`[MONTHLY REPORT] Society: ${society.name}`, stats);

        for (const admin of society.users) {
          notificationService.sendSMS(admin.mobile, `Monthly safety report for ${society.name} is ready. Total alerts: ${stats.totalAlerts}. Most frequent: ${stats.mostFrequentType}.`)
            .catch(err => console.error(`[MONTHLY REPORT ERROR] Failed to notify admin ${admin.id}:`, err));
        }
      }
    } catch (error) {
      console.error('[CRON ERROR] Monthly SOS Analytics failed:', error);
    }
  });
};

module.exports = {
  initializeSOSJobs
};
