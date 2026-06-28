const express = require('express');
const bcrypt = require('bcryptjs');
const { authenticate, authorize } = require('../middleware/auth');
const { prisma } = require('../config/database');

const router = express.Router();

const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// All admin routes require authenticate and authorize('SOCIETY_ADMIN', 'SUPER_ADMIN')
router.use(authenticate);
router.use(authorize('SOCIETY_ADMIN', 'SUPER_ADMIN'));

/**
 * Helper to get the start of the current day
 */
const getStartOfDay = () => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return start;
};

/**
 * Helper to generate random 4-digit PIN
 */
const generateRandomPin = () => {
  return Math.floor(1000 + Math.random() * 9000).toString();
};

/**
 * 1. GET /overview-stats
 * Detailed statistics for the Society Admin dashboard
 */
router.get(
  '/overview-stats',
  asyncHandler(async (req, res) => {
    const societyId = req.user.societyId;
    const startOfDay = getStartOfDay();

    const [
      totalFlats,
      totalResidents,
      activeGuards,
      todayVisitors,
      pendingApprovals,
      todayDeliveries,
      staffCheckIns,
      activeSOSAlerts
    ] = await Promise.all([
      // Total Flats
      prisma.flat.count({ where: { societyId } }),
      // Total Residents
      prisma.resident.count({ where: { flat: { societyId } } }),
      // Total Guards (On Duty)
      prisma.guard.count({ where: { societyId, isOnDuty: true } }),
      // Today's Visitors
      prisma.visitorEntry.count({ where: { societyId, createdAt: { gte: startOfDay } } }),
      // Pending Approvals
      prisma.visitorEntry.count({ where: { societyId, status: 'PENDING' } }),
      // Today's Deliveries
      prisma.delivery.count({ where: { societyId, createdAt: { gte: startOfDay } } }),
      // Staff Check-ins Today (Currently inside the society)
      prisma.staffAttendance.count({
        where: { flat: { societyId }, checkInTime: { gte: startOfDay }, checkOutTime: null }
      }),
      // Active SOS Alerts
      prisma.sOSAlert.findMany({
        where: { societyId, status: { in: ['ACTIVE', 'ACKNOWLEDGED'] } },
        orderBy: { createdAt: 'desc' },
        include: {
          flat: true,
          raisedUser: { select: { name: true, mobile: true } }
        }
      })
    ]);

    res.json({
      data: {
        totalFlats,
        totalResidents,
        activeGuards,
        todayVisitors,
        pendingApprovals,
        todayDeliveries,
        staffCheckIns,
        activeSOSAlerts
      }
    });
  })
);

/**
 * 2. GET /visitor-analytics
 * Visitor analytics for charts (Last 7 Days)
 */
router.get(
  '/visitor-analytics',
  asyncHandler(async (req, res) => {
    const societyId = req.user.societyId;
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    // Fetch entries from last 7 days
    const entries = await prisma.visitorEntry.findMany({
      where: {
        societyId,
        createdAt: { gte: sevenDaysAgo }
      },
      select: {
        purpose: true,
        createdAt: true,
        entryTime: true
      }
    });

    // 1. Line chart: Daily visitor count
    const dailyCount = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      dailyCount[dateStr] = 0;
    }

    entries.forEach(entry => {
      const dateStr = new Date(entry.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      if (dailyCount[dateStr] !== undefined) {
        dailyCount[dateStr]++;
      }
    });

    const dailyVisitorChart = Object.keys(dailyCount).map(date => ({
      date,
      visitors: dailyCount[date]
    }));

    // 2. Bar chart: count by purpose
    const purposeCounts = {};
    entries.forEach(entry => {
      const purpose = entry.purpose || 'Personal';
      purposeCounts[purpose] = (purposeCounts[purpose] || 0) + 1;
    });

    const purposeChart = Object.keys(purposeCounts).map(purpose => ({
      purpose,
      count: purposeCounts[purpose]
    }));

    // 3. Peak hours heatmap: Group by hour of day (0-23)
    const hourlyCounts = Array.from({ length: 24 }, (_, i) => ({ hour: i, count: 0 }));
    entries.forEach(entry => {
      const time = entry.entryTime ? new Date(entry.entryTime) : new Date(entry.createdAt);
      const hour = time.getHours();
      hourlyCounts[hour].count++;
    });

    res.json({
      data: {
        dailyVisitors: dailyVisitorChart,
        byPurpose: purposeChart,
        peakHours: hourlyCounts
      }
    });
  })
);

/**
 * 3. GET /guard-performance
 * Guard leaderboard sorted by activity logged today
 */
router.get(
  '/guard-performance',
  asyncHandler(async (req, res) => {
    const societyId = req.user.societyId;
    const startOfDay = getStartOfDay();

    // Fetch guards in the society
    const guards = await prisma.guard.findMany({
      where: { societyId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            mobile: true,
            isActive: true
          }
        }
      }
    });

    const performance = await Promise.all(
      guards.map(async (guard) => {
        const userId = guard.user.id;

        const [entriesLogged, deliveriesLogged, checkinsRecorded] = await Promise.all([
          // Visitor entries logged by this guard today
          prisma.visitorEntry.count({
            where: { societyId, createdBy: userId, createdAt: { gte: startOfDay } }
          }),
          // Deliveries logged today
          prisma.delivery.count({
            where: { societyId, receivedByGuardId: userId, createdAt: { gte: startOfDay } }
          }),
          // Staff attendance check-ins recorded today
          prisma.staffAttendance.count({
            where: { flat: { societyId }, recordedById: userId, createdAt: { gte: startOfDay } }
          })
        ]);

        const totalActivity = entriesLogged + deliveriesLogged + checkinsRecorded;

        return {
          id: guard.id,
          name: guard.user.name,
          email: guard.user.email,
          mobile: guard.user.mobile,
          isOnDuty: guard.isOnDuty,
          shiftStart: guard.shiftStart,
          shiftEnd: guard.shiftEnd,
          isActive: guard.user.isActive,
          entriesLogged,
          deliveriesLogged,
          checkinsRecorded,
          totalActivity
        };
      })
    );

    // Sort by totalActivity descending
    performance.sort((a, b) => b.totalActivity - a.totalActivity);

    res.json({ data: performance });
  })
);

/**
 * 4. GET /guards
 * List all guards (active/inactive)
 */
router.get(
  '/guards',
  asyncHandler(async (req, res) => {
    const societyId = req.user.societyId;
    const guards = await prisma.guard.findMany({
      where: { societyId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            mobile: true,
            isActive: true
          }
        }
      }
    });

    const data = guards.map(g => ({
      id: g.id,
      userId: g.user.id,
      name: g.user.name,
      email: g.user.email,
      mobile: g.user.mobile,
      isActive: g.user.isActive,
      isOnDuty: g.isOnDuty,
      shiftStart: g.shiftStart,
      shiftEnd: g.shiftEnd
    }));

    res.json({ data });
  })
);

/**
 * 5. POST /guards
 * Add a new guard
 */
router.post(
  '/guards',
  asyncHandler(async (req, res) => {
    const societyId = req.user.societyId;
    const { name, email, mobile, shiftStart, shiftEnd, password } = req.body;

    // Check if email already registered
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(400).json({ error: 'Email already exists' });
    }

    const defaultPassword = password || 'Guard@1234';
    const passwordHash = await bcrypt.hash(defaultPassword, 12);
    
    // Generate secure hashed PIN (standard 4-digit code)
    const rawPin = generateRandomPin();
    const pinHash = await bcrypt.hash(rawPin, 12);

    const newUser = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name,
        mobile,
        role: 'GUARD',
        societyId,
        isActive: true,
        guard: {
          create: {
            societyId,
            pinCode: pinHash,
            shiftStart: shiftStart ? new Date(shiftStart) : null,
            shiftEnd: shiftEnd ? new Date(shiftEnd) : null,
            isOnDuty: false
          }
        }
      },
      include: {
        guard: true
      }
    });

    res.status(201).json({
      message: 'Guard added successfully',
      data: {
        id: newUser.guard.id,
        userId: newUser.id,
        name: newUser.name,
        email: newUser.email,
        mobile: newUser.mobile,
        pin: rawPin, // Return plain text pin code to show to the admin once
        shiftStart: newUser.guard.shiftStart,
        shiftEnd: newUser.guard.shiftEnd
      }
    });
  })
);

/**
 * 6. PUT /guards/:id
 * Update a guard's details or shift
 */
router.put(
  '/guards/:id',
  asyncHandler(async (req, res) => {
    const { id } = req.params; // Guard ID
    const { name, email, mobile, shiftStart, shiftEnd, isActive } = req.body;

    const guard = await prisma.guard.findUnique({
      where: { id },
      include: { user: true }
    });

    if (!guard || guard.societyId !== req.user.societyId) {
      return res.status(404).json({ error: 'Guard not found' });
    }

    // Update User details
    await prisma.user.update({
      where: { id: guard.userId },
      data: {
        name,
        email,
        mobile,
        isActive: isActive !== undefined ? isActive : undefined
      }
    });

    // Update Guard shift details
    const updatedGuard = await prisma.guard.update({
      where: { id },
      data: {
        shiftStart: shiftStart ? new Date(shiftStart) : null,
        shiftEnd: shiftEnd ? new Date(shiftEnd) : null
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            mobile: true,
            isActive: true
          }
        }
      }
    });

    res.json({
      message: 'Guard updated successfully',
      data: {
        id: updatedGuard.id,
        userId: updatedGuard.user.id,
        name: updatedGuard.user.name,
        email: updatedGuard.user.email,
        mobile: updatedGuard.user.mobile,
        isActive: updatedGuard.user.isActive,
        isOnDuty: updatedGuard.isOnDuty,
        shiftStart: updatedGuard.shiftStart,
        shiftEnd: updatedGuard.shiftEnd
      }
    });
  })
);

/**
 * 7. POST /guards/:id/reset-pin
 * Generate/Reset guard PIN
 */
router.post(
  '/guards/:id/reset-pin',
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const guard = await prisma.guard.findUnique({
      where: { id }
    });

    if (!guard || guard.societyId !== req.user.societyId) {
      return res.status(404).json({ error: 'Guard not found' });
    }

    const rawPin = generateRandomPin();
    const pinHash = await bcrypt.hash(rawPin, 12);

    await prisma.guard.update({
      where: { id },
      data: { pinCode: pinHash }
    });

    res.json({
      message: 'Guard PIN reset successful',
      pin: rawPin // Return plain text pin
    });
  })
);

/**
 * 8. GET /guards/:id/activity
 * View activity logs for a specific guard
 */
router.get(
  '/guards/:id/activity',
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const guard = await prisma.guard.findUnique({
      where: { id }
    });

    if (!guard || guard.societyId !== req.user.societyId) {
      return res.status(404).json({ error: 'Guard not found' });
    }

    const userId = guard.userId;

    // Fetch entries, deliveries, check-ins logged by this guard user
    const [entries, deliveries, attendances] = await Promise.all([
      prisma.visitorEntry.findMany({
        where: { createdBy: userId },
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: { visitor: true, flat: true }
      }),
      prisma.delivery.findMany({
        where: { receivedByGuardId: userId },
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: { flat: true }
      }),
      prisma.staffAttendance.findMany({
        where: { recordedById: userId },
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: { staff: true, flat: true }
      })
    ]);

    // Map to a common activity structure
    const activities = [
      ...entries.map(e => ({
        id: e.id,
        type: 'VISITOR_ENTRY',
        description: `Logged entry for visitor ${e.visitor.name} to flat ${e.flat.number}`,
        timestamp: e.createdAt
      })),
      ...deliveries.map(d => ({
        id: d.id,
        type: 'DELIVERY',
        description: `Logged delivery package (${d.category}) to flat ${d.flat.number}`,
        timestamp: d.createdAt
      })),
      ...attendances.map(a => ({
        id: a.id,
        type: 'STAFF_ATTENDANCE',
        description: `Recorded check-in for staff ${a.staff.name} at flat ${a.flat.number}`,
        timestamp: a.createdAt
      }))
    ];

    // Sort by timestamp desc
    activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    res.json({ data: activities.slice(0, 30) });
  })
);

/**
 * 9. GET /towers
 * Tower list with expandable flats and residents list
 */
router.get(
  '/towers',
  asyncHandler(async (req, res) => {
    const societyId = req.user.societyId;

    const towers = await prisma.tower.findMany({
      where: { societyId },
      orderBy: { name: 'asc' },
      include: {
        flats: {
          orderBy: { number: 'asc' },
          include: {
            residents: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                    mobile: true
                  }
                }
              }
            }
          }
        }
      }
    });

    res.json({ data: towers });
  })
);

/**
 * 10. POST /towers
 * Create a new tower
 */
router.post(
  '/towers',
  asyncHandler(async (req, res) => {
    const societyId = req.user.societyId;
    const { name } = req.body;

    const existing = await prisma.tower.findUnique({
      where: {
        societyId_name: {
          societyId,
          name
        }
      }
    });

    if (existing) {
      return res.status(400).json({ error: 'Tower already exists in this society' });
    }

    const tower = await prisma.tower.create({
      data: {
        name,
        societyId
      }
    });

    res.status(201).json({ data: tower });
  })
);

/**
 * 11. PUT /towers/:id
 * Update tower name
 */
router.put(
  '/towers/:id',
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { name } = req.body;
    const societyId = req.user.societyId;

    const tower = await prisma.tower.findUnique({ where: { id } });
    if (!tower || tower.societyId !== societyId) {
      return res.status(404).json({ error: 'Tower not found' });
    }

    const updated = await prisma.tower.update({
      where: { id },
      data: { name }
    });

    res.json({ data: updated });
  })
);

/**
 * 12. DELETE /towers/:id
 * Delete a tower
 */
router.delete(
  '/towers/:id',
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const societyId = req.user.societyId;

    const tower = await prisma.tower.findUnique({ where: { id } });
    if (!tower || tower.societyId !== societyId) {
      return res.status(404).json({ error: 'Tower not found' });
    }

    await prisma.tower.delete({ where: { id } });

    res.json({ message: 'Tower deleted successfully' });
  })
);

/**
 * 13. POST /flats
 * Create a flat
 */
router.post(
  '/flats',
  asyncHandler(async (req, res) => {
    const societyId = req.user.societyId;
    const { number, floor, towerId } = req.body;

    const tower = await prisma.tower.findUnique({ where: { id: towerId } });
    if (!tower || tower.societyId !== societyId) {
      return res.status(404).json({ error: 'Tower not found' });
    }

    const existing = await prisma.flat.findUnique({
      where: {
        towerId_number: {
          towerId,
          number
        }
      }
    });

    if (existing) {
      return res.status(400).json({ error: 'Flat already exists in this tower' });
    }

    const flat = await prisma.flat.create({
      data: {
        number,
        floor: floor ? parseInt(floor) : null,
        societyId,
        towerId
      }
    });

    res.status(201).json({ data: flat });
  })
);

/**
 * 14. PUT /flats/:id
 * Update flat details
 */
router.put(
  '/flats/:id',
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { number, floor } = req.body;
    const societyId = req.user.societyId;

    const flat = await prisma.flat.findUnique({ where: { id } });
    if (!flat || flat.societyId !== societyId) {
      return res.status(404).json({ error: 'Flat not found' });
    }

    const updated = await prisma.flat.update({
      where: { id },
      data: {
        number,
        floor: floor ? parseInt(floor) : null
      }
    });

    res.json({ data: updated });
  })
);

/**
 * 15. DELETE /flats/:id
 * Delete flat
 */
router.delete(
  '/flats/:id',
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const societyId = req.user.societyId;

    const flat = await prisma.flat.findUnique({ where: { id } });
    if (!flat || flat.societyId !== societyId) {
      return res.status(404).json({ error: 'Flat not found' });
    }

    await prisma.flat.delete({ where: { id } });

    res.json({ message: 'Flat deleted successfully' });
  })
);

/**
 * 16. POST /residents/assign
 * Assign resident to a flat (assign user by email, create them if they do not exist)
 */
router.post(
  '/residents/assign',
  asyncHandler(async (req, res) => {
    const societyId = req.user.societyId;
    const { email, name, mobile, flatId } = req.body;

    const flat = await prisma.flat.findUnique({ where: { id: flatId } });
    if (!flat || flat.societyId !== societyId) {
      return res.status(404).json({ error: 'Flat not found' });
    }

    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      // Create user
      const passwordHash = await bcrypt.hash('Resident@123', 12);
      user = await prisma.user.create({
        data: {
          email,
          name,
          mobile,
          passwordHash,
          role: 'RESIDENT',
          societyId,
          isActive: true
        }
      });
    } else {
      // If user exists, check if they are already resident of this flat
      const existingResident = await prisma.resident.findFirst({
        where: { userId: user.id, flatId }
      });
      if (existingResident) {
        return res.status(400).json({ error: 'User is already assigned to this flat' });
      }

      // Check role/society
      await prisma.user.update({
        where: { id: user.id },
        data: {
          role: 'RESIDENT',
          societyId
        }
      });
    }

    // Create resident association
    const resident = await prisma.resident.create({
      data: {
        userId: user.id,
        flatId
      },
      include: {
        user: true,
        flat: true
      }
    });

    res.status(201).json({
      message: 'Resident assigned successfully',
      data: resident
    });
  })
);

/**
 * 17. POST /flats/import-bulk
 * Bulk flat import
 */
router.post(
  '/flats/import-bulk',
  asyncHandler(async (req, res) => {
    const societyId = req.user.societyId;
    const { rows } = req.body; // Expect array of { towerName, flatNumber, floor }

    if (!Array.isArray(rows)) {
      return res.status(400).json({ error: 'Invalid rows format. Expected an array.' });
    }

    const logs = [];
    let successCount = 0;

    for (const row of rows) {
      const { towerName, flatNumber, floor } = row;
      if (!towerName || !flatNumber) {
        logs.push(`Skipped row: Missing Tower Name or Flat Number.`);
        continue;
      }

      try {
        // Find or create Tower
        let tower = await prisma.tower.findUnique({
          where: {
            societyId_name: {
              societyId,
              name: towerName.toString().trim()
            }
          }
        });

        if (!tower) {
          tower = await prisma.tower.create({
            data: {
              name: towerName.toString().trim(),
              societyId
            }
          });
        }

        // Check if flat already exists
        const existingFlat = await prisma.flat.findUnique({
          where: {
            towerId_number: {
              towerId: tower.id,
              number: flatNumber.toString().trim()
            }
          }
        });

        if (existingFlat) {
          logs.push(`Tower ${towerName} Flat ${flatNumber} already exists. Skipped.`);
          continue;
        }

        // Create Flat
        await prisma.flat.create({
          data: {
            number: flatNumber.toString().trim(),
            floor: floor ? parseInt(floor) : null,
            societyId,
            towerId: tower.id
          }
        });

        successCount++;
      } catch (err) {
        logs.push(`Error creating flat ${flatNumber} in tower ${towerName}: ${err.message}`);
      }
    }

    res.json({
      message: `Bulk import completed. Successfully imported ${successCount} flats.`,
      successCount,
      logs
    });
  })
);

/**
 * 18. GET /reports/visitors
 * Visitor Report data
 */
router.get(
  '/reports/visitors',
  asyncHandler(async (req, res) => {
    const societyId = req.user.societyId;
    const { dateFrom, dateTo, status } = req.query;

    const where = { societyId };

    if (dateFrom && dateTo) {
      where.createdAt = {
        gte: new Date(dateFrom),
        lte: new Date(dateTo)
      };
    }
    if (status) {
      where.status = status;
    }

    const data = await prisma.visitorEntry.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        visitor: true,
        flat: { include: { tower: true } }
      }
    });

    res.json({ data });
  })
);

/**
 * 19. GET /reports/deliveries
 * Delivery Report data
 */
router.get(
  '/reports/deliveries',
  asyncHandler(async (req, res) => {
    const societyId = req.user.societyId;
    const { dateFrom, dateTo, category } = req.query;

    const where = { societyId };

    if (dateFrom && dateTo) {
      where.createdAt = {
        gte: new Date(dateFrom),
        lte: new Date(dateTo)
      };
    }
    if (category) {
      where.category = category;
    }

    const data = await prisma.delivery.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        flat: { include: { tower: true } }
      }
    });

    res.json({ data });
  })
);

/**
 * 20. GET /reports/staff-attendance
 * Staff Attendance Report data
 */
router.get(
  '/reports/staff-attendance',
  asyncHandler(async (req, res) => {
    const societyId = req.user.societyId;
    const { dateFrom, dateTo, staffId } = req.query;

    const where = {
      flat: { societyId }
    };

    if (dateFrom && dateTo) {
      where.createdAt = {
        gte: new Date(dateFrom),
        lte: new Date(dateTo)
      };
    }
    if (staffId) {
      where.staffId = staffId;
    }

    const data = await prisma.staffAttendance.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        staff: true,
        flat: { include: { tower: true } }
      }
    });

    res.json({ data });
  })
);

/**
 * 21. GET /reports/sos-alerts
 * SOS Alert Report data
 */
router.get(
  '/reports/sos-alerts',
  asyncHandler(async (req, res) => {
    const societyId = req.user.societyId;
    const { dateFrom, dateTo } = req.query;

    const where = { societyId };

    if (dateFrom && dateTo) {
      where.createdAt = {
        gte: new Date(dateFrom),
        lte: new Date(dateTo)
      };
    }

    const data = await prisma.sOSAlert.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        flat: { include: { tower: true } },
        raisedUser: { select: { name: true, mobile: true } },
        acknowledgedUser: { select: { name: true } }
      }
    });

    res.json({ data });
  })
);

/**
 * 22. GET /reports/guard-activity
 * Guard Activity Report
 */
router.get(
  '/reports/guard-activity',
  asyncHandler(async (req, res) => {
    const societyId = req.user.societyId;
    const { dateFrom, dateTo, guardId } = req.query;

    // Fetch guards
    const guardsWhere = { societyId };
    if (guardId) {
      guardsWhere.id = guardId;
    }

    const guards = await prisma.guard.findMany({
      where: guardsWhere,
      include: { user: true }
    });

    const report = await Promise.all(
      guards.map(async (guard) => {
        const userId = guard.user.id;
        const queryRange = dateFrom && dateTo ? { gte: new Date(dateFrom), lte: new Date(dateTo) } : undefined;

        const [visitorCount, deliveryCount, attendanceCount] = await Promise.all([
          prisma.visitorEntry.count({
            where: { societyId, createdBy: userId, ...(queryRange && { createdAt: queryRange }) }
          }),
          prisma.delivery.count({
            where: { societyId, receivedByGuardId: userId, ...(queryRange && { createdAt: queryRange }) }
          }),
          prisma.staffAttendance.count({
            where: { flat: { societyId }, recordedById: userId, ...(queryRange && { createdAt: queryRange }) }
          })
        ]);

        return {
          guardId: guard.id,
          name: guard.user.name,
          email: guard.user.email,
          mobile: guard.user.mobile,
          isOnDuty: guard.isOnDuty,
          visitorsLogged: visitorCount,
          deliveriesLogged: deliveryCount,
          staffCheckinsRecorded: attendanceCount,
          totalActions: visitorCount + deliveryCount + attendanceCount
        };
      })
    );

    res.json({ data: report });
  })
);

module.exports = router;
