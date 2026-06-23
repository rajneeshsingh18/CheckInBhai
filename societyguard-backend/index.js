require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const cron = require('node-cron');
const path = require('path');

// Utilities
const { initializeSocket } = require('./src/config/socket');
const { otpService } = require('./src/services/otp.service');
const { initializeStaffJobs } = require('./src/jobs/staff-jobs');
const { initializeSOSJobs } = require('./src/jobs/sos-jobs');
const { AppError } = require('./src/utils/errors');

// Routes
const authRoutes = require('./src/routes/auth.routes');
const visitorRoutes = require('./src/routes/visitor.routes');
const dashboardRoutes = require('./src/routes/dashboard.routes');
const deliveryRoutes = require('./src/routes/delivery.routes');
const staffRoutes = require('./src/routes/staff.routes');
const attendanceRoutes = require('./src/routes/attendance.routes');
const sosRoutes = require('./src/routes/sos.routes');
const guestPassRoutes = require('./src/routes/guest-pass.routes');
const notificationRoutes = require('./src/routes/notification.routes');

const app = express();
const server = http.createServer(app);

// 1. Initialize WebSockets
initializeSocket(server);

// 2. Middlewares
app.use(helmet({ crossOriginResourcePolicy: false })); // Allow cross-origin for uploaded images
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
}));
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Serve uploaded visitor photos statically (development)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 3. API Routes
app.use('/api/auth', authRoutes);
app.use('/api/visitors', visitorRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/deliveries', deliveryRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/sos', sosRoutes);
app.use('/api/guest-passes', guestPassRoutes);
app.use('/api/notifications', notificationRoutes);

// Health Check
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date() });
});

// 4. Global Error Handler
app.use((err, req, res, next) => {
  console.error('[Error]', err);

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  res.status(statusCode).json({
    error: {
      message,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    }
  });
});

// 5. Background Cron Jobs
// Clean up expired OTPs every 15 minutes
cron.schedule('*/15 * * * *', async () => {
  await otpService.cleanupExpiredOTPs();
});

// Initialize background jobs
initializeStaffJobs();
initializeSOSJobs();

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
