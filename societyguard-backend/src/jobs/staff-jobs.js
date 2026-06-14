const cron = require('node-cron');
const { prisma } = require('../config/database');
const notificationService = require('../services/notification.service');

/**
 * Staff Attendance and Lifecycle Background Jobs
 */

const initializeStaffJobs = () => {
  /**
   * 1. Auto-Mark Absent (Daily at 10:00 AM)
   * Marks staff members as ABSENT if they are scheduled for today but haven't checked in by 10 AM.
   */
  cron.schedule('0 10 * * *', async () => {
    console.log('[CRON] Running Auto-Mark Absent job...');
    try {
      const days = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
      const today = days[new Date().getDay()];
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      // Find all active staff scheduled for today
      const staffScheduledToday = await prisma.staff.findMany({
        where: {
          isActive: true,
          schedule: {
            path: ['days'],
            array_contains: today
          }
        },
        include: {
          flat: { include: { residents: { include: { user: true } } } },
          staffAttendances: {
            where: { createdAt: { gte: startOfDay } }
          }
        }
      });

      let absentCount = 0;

      for (const staff of staffScheduledToday) {
        // If no attendance record exists for today
        if (staff.staffAttendances.length === 0) {
          try {
            await prisma.staffAttendance.create({
              data: {
                staffId: staff.id,
                flatId: staff.flatId,
                status: 'ABSENT'
              }
            });

            // Notify residents
            for (const res of staff.flat.residents) {
              if (res.user) {
                notificationService.sendStaffAbsentNotification(res.user, staff)
                  .catch(err => console.error("Staff Absent Notification Error:", err));
              }
            }
            absentCount++;
          } catch (err) {
            console.error(`Failed to mark staff ${staff.id} as absent:`, err);
          }
        }
      }

      console.log(`[CRON] Auto-Mark Absent complete. Marked ${absentCount} staff members as absent.`);
    } catch (error) {
      console.error('[CRON ERROR] Auto-Mark Absent failed:', error);
    }
  });

  /**
   * 2. Staff Expiry Check (Daily at midnight)
   * Deactivates staff members whose registration has reached its validTill date.
   */
  cron.schedule('0 0 * * *', async () => {
    console.log('[CRON] Running Staff Expiry Check job...');
    try {
      const expiredStaff = await prisma.staff.findMany({
        where: {
          isActive: true,
          validTill: { lt: new Date() }
        },
        include: {
          flat: { include: { residents: { include: { user: true } } } }
        }
      });

      for (const staff of expiredStaff) {
        try {
          await prisma.staff.update({
            where: { id: staff.id },
            data: { isActive: false }
          });

          // Notify residents
          for (const res of staff.flat.residents) {
            if (res.user) {
              notificationService.sendSMS(res.user.mobile, `${staff.name}'s registration has expired and they have been deactivated.`)
                .catch(err => console.error("Staff Expiry Notification Error:", err));
            }
          }
        } catch (err) {
          console.error(`Failed to deactivate expired staff ${staff.id}:`, err);
        }
      }

      console.log(`[CRON] Staff Expiry Check complete. Deactivated ${expiredStaff.length} staff members.`);
    } catch (error) {
      console.error('[CRON ERROR] Staff Expiry Check failed:', error);
    }
  });

  /**
   * 3. Weekly Attendance Summary (Every Monday at 9 AM)
   * Sends a summary of the previous week's attendance to residents.
   */
  cron.schedule('0 9 * * 1', async () => {
    console.log('[CRON] Running Weekly Attendance Summary job...');
    try {
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

      const activeStaff = await prisma.staff.findMany({
        where: { isActive: true },
        include: {
          flat: { include: { residents: { include: { user: true } } } },
          staffAttendances: {
            where: { createdAt: { gte: oneWeekAgo } }
          }
        }
      });

      for (const staff of activeStaff) {
        const attendance = staff.staffAttendances;
        const presentCount = attendance.filter(a => a.checkInTime).length;
        const lateCount = attendance.filter(a => a.status === 'LATE').length;
        const totalHours = attendance.reduce((sum, a) => sum + (a.hoursWorked || 0), 0);
        const scheduledCount = staff.schedule?.days?.length || 0;

        const summary = {
          presentCount,
          lateCount,
          totalHours: parseFloat(totalHours.toFixed(2)),
          scheduledCount
        };

        // Notify residents
        for (const res of staff.flat.residents) {
          if (res.user) {
            notificationService.sendWeeklyAttendanceSummary(res.user, staff, summary)
              .catch(err => console.error("Weekly Summary Notification Error:", err));
          }
        }
      }

      console.log(`[CRON] Weekly Attendance Summary complete.`);
    } catch (error) {
      console.error('[CRON ERROR] Weekly Attendance Summary failed:', error);
    }
  });
};

module.exports = {
  initializeStaffJobs
};
