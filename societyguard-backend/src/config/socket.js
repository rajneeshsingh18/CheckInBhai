const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { setIO } = require('./socket-instance');
const { prisma } = require('./database');

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

let io;

/**
 * Initializes the Socket.io WebSocket server attached to the HTTP server.
 * Ensures strict authentication and routes users to appropriate broadcast rooms.
 * 
 * @param {import('http').Server} httpServer 
 */
function initializeSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL || '*',
      methods: ['GET', 'POST'],
      credentials: true
    }
  });

  // Expose to the rest of the application
  setIO(io);

  // 1. Socket Authentication Middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      
      if (!token) {
        return next(new Error('Authentication error: Token missing'));
      }

      const decoded = jwt.verify(token, JWT_SECRET);
      
      // Verify user is active
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { isActive: true }
      });

      if (!user || !user.isActive) {
        return next(new Error('Authentication error: User inactive'));
      }

      // Attach decoded payload to socket instance
      socket.user = decoded;
      next();
    } catch (err) {
      next(new Error('Authentication error: Invalid token'));
    }
  });

  // 2. Connection and Room Joining Logic
  io.on('connection', (socket) => {
    console.log(`[Socket.io] User connected: ${socket.user.userId} (${socket.user.role})`);
    
    const { role, societyId, flatId } = socket.user;

    // Join Global Society Room
    if (societyId) {
      socket.join(`society:${societyId}:all`);
    }

    // Role-specific routing
    if (role === 'SUPER_ADMIN') {
      socket.join('emergency:global'); // Specialized room for super admins
      // Optionally join all existing society emergency rooms if feasible, 
      // but 'emergency:global' is safer for now.
    }

    if (role === 'GUARD' || role === 'SOCIETY_ADMIN') {
      socket.join(`society:${societyId}:guards`);
      socket.join(`society:${societyId}:emergency`);
      console.log(`[Socket.io] Joined rooms: society:${societyId}:guards, society:${societyId}:emergency`);
    }

    if (role === 'RESIDENT' && flatId) {
      socket.join(`flat:${flatId}:residents`);
      socket.join(`society:${societyId}:emergency`); // Residents also need to receive SOS alerts
      console.log(`[Socket.io] Joined rooms: flat:${flatId}:residents, society:${societyId}:emergency`);
    }

    // --- SOS EMERGENCY EVENT HANDLERS (HIGH PRIORITY) ---

    // 1. sos:raised
    socket.on('sos:raised', (data) => {
      console.log(`[SOS HIGH PRIORITY] Alert raised in society ${societyId} by ${socket.user.userId}`);
      io.to(`society:${societyId}:emergency`).to('emergency:global').emit('sos:raised', {
        priority: 'HIGH',
        alert: {
          ...data.alert,
          raisedBy: socket.user.userId,
          timestamp: new Date()
        }
      });
    });

    // 2. sos:acknowledged
    socket.on('sos:acknowledged', (data) => {
      console.log(`[SOS] Alert ${data.alertId} acknowledged by ${socket.user.userId}`);
      io.to(`society:${societyId}:emergency`).to('emergency:global').emit('sos:acknowledged', {
        alertId: data.alertId,
        acknowledgedBy: {
          userId: socket.user.userId,
          role: socket.user.role
        },
        timestamp: new Date()
      });
    });

    // 3. sos:resolved
    socket.on('sos:resolved', (data) => {
      console.log(`[SOS] Alert ${data.alertId} resolved by ${socket.user.userId}`);
      io.to(`society:${societyId}:emergency`).to('emergency:global').emit('sos:resolved', {
        alertId: data.alertId,
        resolvedAt: new Date(),
        notes: data.notes
      });
    });

    // 5. Heartbeat check for emergency responders
    const heartbeatInterval = setInterval(async () => {
      if (role === 'GUARD' && !socket.connected) {
        // This won't run if disconnected, but logic for monitoring presence:
        // In a real app, we'd check against a redis/db presence set.
      }
    }, 30000);

    // Handle Disconnects
    socket.on('disconnect', () => {
      console.log(`[Socket.io] User disconnected: ${socket.user.userId}`);
      clearInterval(heartbeatInterval);
      
      // If guard disconnects during active SOS: log warning
      // (Implementation requires checking DB for active alerts in that society)
    });
  });

  return io;
}

module.exports = {
  initializeSocket
};
