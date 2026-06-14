const { z } = require('zod');
const { prisma, runTransaction } = require('../config/database');
const { ValidationError, NotFoundError, ForbiddenError } = require('../utils/errors');
const notificationService = require('./notification.service');
const { getReadFilter, canAccess } = require('../config/access-control');

const raiseSOSSchema = z.object({
  type: z.enum(['MEDICAL', 'FIRE', 'SECURITY', 'OTHER']),
  description: z.string().max(500).optional()
});

const sosService = {
  /**
   * 1. Raise SOS (Resident)
   */
  async raiseSOS(residentId, flatId, societyId, data) {
    // Basic RBAC check
    const tempUser = { id: residentId, role: 'RESIDENT', flatId, societyId };
    canAccess(tempUser, 'sosAlerts', 'write', 'create');

    const parsedData = raiseSOSSchema.parse(data);

    return runTransaction(async (tx) => {
      // Get resident details for location info
      const resident = await tx.user.findUnique({
        where: { id: residentId },
        include: {
          resident: {
            include: {
              flat: { include: { tower: true } }
            }
          }
        }
      });

      if (!resident || !resident.resident) {
        throw new NotFoundError("Resident profile not found");
      }

      const towerName = resident.resident.flat.tower.name;
      const flatNumber = resident.resident.flat.number;
      const location = `Tower ${towerName}, Flat ${flatNumber}`;

      // Get ALL responders (Guards and Admins) for the society
      const responders = await tx.user.findMany({
        where: {
          societyId,
          role: { in: ['GUARD', 'SOCIETY_ADMIN'] },
          isActive: true
        },
        select: { id: true, name: true, mobile: true, role: true }
      });

      // Create SOS Alert record
      const alert = await tx.sOSAlert.create({
        data: {
          type: parsedData.type,
          description: parsedData.description,
          location,
          raisedById: residentId,
          status: 'ACTIVE',
          societyId,
          flatId
        },
        include: {
          raisedUser: { select: { name: true, mobile: true } },
          flat: { include: { tower: true } }
        }
      });

      // Send EMERGENCY notifications (non-blocking)
      notificationService.sendEmergencyAlert(responders, alert, resident)
        .catch(err => console.error("[SOS NOTIFICATION ERROR]", err));

      return alert;
    });
  },

  /**
   * 2. Acknowledge Alert (Guard/Admin)
   */
  async acknowledgeAlert(userId, alertId) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundError("User not found");
    
    canAccess(user, 'sosAlerts', 'write', 'acknowledge');

    return runTransaction(async (tx) => {
      const alert = await tx.sOSAlert.findUnique({ where: { id: alertId } });
      
      if (!alert) throw new NotFoundError("SOS Alert not found");
      if (alert.status !== 'ACTIVE') {
        throw new ValidationError(`Alert is already ${alert.status}`);
      }
      if (alert.societyId !== user.societyId) {
        throw new ForbiddenError("Alert belongs to a different society");
      }

      return tx.sOSAlert.update({
        where: { id: alertId },
        data: {
          status: 'ACKNOWLEDGED',
          acknowledgedById: userId
        },
        include: {
          raisedUser: { select: { name: true, mobile: true } },
          acknowledgedUser: { select: { name: true } },
          flat: { include: { tower: true } }
        }
      });
    });
  },

  /**
   * 3. Resolve Alert (Admin)
   */
  async resolveAlert(userId, alertId, resolutionNotes) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundError("User not found");

    canAccess(user, 'sosAlerts', 'write', 'resolve_only');

    return runTransaction(async (tx) => {
      const alert = await tx.sOSAlert.findUnique({ where: { id: alertId } });
      
      if (!alert) throw new NotFoundError("SOS Alert not found");
      if (alert.status === 'RESOLVED') {
        throw new ValidationError("Alert is already resolved");
      }

      let updatedDescription = alert.description;
      if (resolutionNotes) {
        updatedDescription = updatedDescription 
          ? `${updatedDescription}\n\nResolution: ${resolutionNotes}`
          : `Resolution: ${resolutionNotes}`;
      }

      return tx.sOSAlert.update({
        where: { id: alertId },
        data: {
          status: 'RESOLVED',
          resolvedAt: new Date(),
          description: updatedDescription
        },
        include: {
          raisedUser: { select: { name: true, mobile: true } },
          acknowledgedUser: { select: { name: true } },
          flat: { include: { tower: true } }
        }
      });
    });
  },

  /**
   * 4. Get Active Alerts (Dashboard)
   */
  async getActiveAlerts(societyId) {
    return prisma.sOSAlert.findMany({
      where: {
        societyId,
        status: { in: ['ACTIVE', 'ACKNOWLEDGED'] }
      },
      include: {
        raisedUser: { select: { name: true, mobile: true } },
        acknowledgedUser: { select: { name: true } },
        flat: { include: { tower: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
  },

  /**
   * 5. Get Alert History (Admin)
   */
  async getAlertHistory(societyId, filters = {}) {
    const { page = 1, limit = 20, type, status, dateFrom, dateTo } = filters;
    const skip = (page - 1) * limit;

    const where = { societyId };

    if (type) where.type = type;
    if (status) where.status = status;
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo);
    }

    const [alerts, total] = await Promise.all([
      prisma.sOSAlert.findMany({
        where,
        include: {
          raisedUser: { select: { name: true, mobile: true } },
          acknowledgedUser: { select: { name: true } },
          flat: { include: { tower: true } }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: Number(limit)
      }),
      prisma.sOSAlert.count({ where })
    ]);

    return { alerts, total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / limit) };
  },

  /**
   * 6. Get Alert By ID
   */
  async getAlertById(alertId, user) {
    const alert = await prisma.sOSAlert.findUnique({
      where: { id: alertId },
      include: {
        raisedUser: { select: { name: true, mobile: true } },
        acknowledgedUser: { select: { name: true } },
        flat: { include: { tower: true } }
      }
    });

    if (!alert) throw new NotFoundError("SOS Alert not found");

    // Dynamic Access Check
    const isSuperAdmin = user.role === 'SUPER_ADMIN';
    const isSocietyMatch = (user.role === 'SOCIETY_ADMIN' || user.role === 'GUARD') && alert.societyId === user.societyId;
    const isFlatMatch = user.role === 'RESIDENT' && alert.flatId === user.flatId;

    if (!isSuperAdmin && !isSocietyMatch && !isFlatMatch) {
      throw new ForbiddenError("You do not have access to view this alert");
    }

    return alert;
  },

  /**
   * 7. Get Alert Stats (Analytics)
   */
  async getAlertStats(societyId, days = 30) {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() - days);

    const alerts = await prisma.sOSAlert.findMany({
      where: {
        societyId,
        createdAt: { gte: targetDate }
      }
    });

    const stats = {
      totalAlerts: alerts.length,
      byType: { MEDICAL: 0, FIRE: 0, SECURITY: 0, OTHER: 0 },
      activeCount: alerts.filter(a => a.status !== 'RESOLVED').length,
      averageResolutionMinutes: 0,
      alertsByHour: {},
      mostFrequentType: 'NONE'
    };

    let totalResTime = 0;
    let resCount = 0;

    alerts.forEach(a => {
      stats.byType[a.type] = (stats.byType[a.type] || 0) + 1;
      
      if (a.resolvedAt && a.createdAt) {
        const diff = (new Date(a.resolvedAt) - new Date(a.createdAt)) / 60000;
        totalResTime += diff;
        resCount++;
      }

      const hour = new Date(a.createdAt).getHours();
      stats.alertsByHour[hour] = (stats.alertsByHour[hour] || 0) + 1;
    });

    if (resCount > 0) {
      stats.averageResolutionMinutes = Math.floor(totalResTime / resCount);
    }

    // Determine most frequent type
    let max = 0;
    for (const [type, count] of Object.entries(stats.byType)) {
      if (count > max) {
        max = count;
        stats.mostFrequentType = type;
      }
    }

    return stats;
  },

  /**
   * 8. Test Alert System
   */
  async testAlertSystem(societyId) {
    const admin = await prisma.user.findFirst({
      where: { societyId, role: 'SOCIETY_ADMIN' }
    });

    if (!admin) throw new NotFoundError("Society admin not found for testing");

    const testAlert = await prisma.sOSAlert.create({
      data: {
        type: 'OTHER',
        description: '[TEST] SOS system test - Please ignore',
        location: 'Society Management Office',
        raisedById: admin.id,
        status: 'ACTIVE',
        societyId
      }
    });

    const report = await notificationService.sendTestNotification(admin, ['wa', 'sms']);

    // Auto-resolve after 1 min (mocked as immediate for this service return)
    setTimeout(async () => {
      try {
        await prisma.sOSAlert.update({
          where: { id: testAlert.id },
          data: { status: 'RESOLVED', resolvedAt: new Date(), description: '[TEST] Auto-resolved' }
        });
      } catch (err) {
        console.error("Test auto-resolve error:", err);
      }
    }, 60000);

    return { alert: testAlert, notificationReport: report };
  }
};

module.exports = sosService;
