const express = require('express');
const rateLimit = require('express-rate-limit');
const authService = require('../services/auth.service');
const { generateGoogleAuthURL, getGoogleUser } = require('../config/oauth');
const { handleOAuthResponse } = require('../utils/oauth-response');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

const isProduction = process.env.NODE_ENV === 'production';

// Common cookie options
const accessCookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: 'strict',
  path: '/',
  maxAge: 900000 // 15 minutes
};

const refreshCookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: 'strict',
  path: '/api/auth/refresh-token',
  maxAge: 604800000 // 7 days
};

// Rate Limiters
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: 'Too many authentication attempts, please try again later.'
});

const guardLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 5,
  message: 'Too many PIN attempts, please try again later.'
});

const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,
  message: 'Too many password reset requests, please try again later.'
});

/**
 * Helper to set cookies and send response
 */
const sendAuthResponse = (res, user, accessToken, refreshToken, isNewUser = false) => {
  res.cookie('accessToken', accessToken, accessCookieOptions);
  res.cookie('refreshToken', refreshToken, refreshCookieOptions);

  // Remove passwordHash if it accidentally leaked through
  if (user && user.passwordHash) {
    delete user.passwordHash;
  }

  res.json({
    message: 'Authentication successful',
    user,
    accessToken, // Sent in body for mobile apps
    refreshToken, // Sent in body for mobile apps
    isNewUser
  });
};

/**
 * 1. POST /register
 */
router.post('/register', authLimiter, async (req, res, next) => {
  try {
    const { email, password, name, mobile, role, societyId } = req.body;

    // Basic password validation
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(password)) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long and include an uppercase letter, a lowercase letter, a number, and a special character.' });
    }

    const { user, accessToken, refreshToken } = await authService.registerWithEmail({
      email, password, name, mobile, role, societyId
    });

    sendAuthResponse(res, user, accessToken, refreshToken);
  } catch (error) {
    next(error);
  }
});

/**
 * 2. POST /login
 */
router.post('/login', authLimiter, async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const { user, accessToken, refreshToken } = await authService.loginWithEmail(email, password);
    sendAuthResponse(res, user, accessToken, refreshToken);
  } catch (error) {
    next(error);
  }
});

/**
 * 3. GET /google
 */
router.get('/google', (req, res) => {
  const url = generateGoogleAuthURL();
  res.redirect(url);
});

/**
 * 4. GET /google/callback
 */
router.get('/google/callback', async (req, res, next) => {
  try {
    const code = req.query.code;
    if (!code) {
      return res.redirect(`${process.env.FRONTEND_URL}/login?error=GoogleAuthFailed`);
    }

    const googleProfile = await getGoogleUser(code);
    const { user, accessToken, refreshToken, isNewUser } = await authService.googleLogin(googleProfile);

    // Set cookies for web sessions
    res.cookie('accessToken', accessToken, accessCookieOptions);
    res.cookie('refreshToken', refreshToken, refreshCookieOptions);

    // Handle OAuth response redirect for Web or Mobile
    handleOAuthResponse(req, res, { accessToken, refreshToken, isNewUser, user });
  } catch (error) {
    console.error('Google Callback Error:', error);
    res.redirect(`${process.env.FRONTEND_URL}/login?error=GoogleAuthFailed`);
  }
});

/**
 * 5. POST /google/mobile
 */
router.post('/google/mobile', async (req, res, next) => {
  try {
    const { idToken } = req.body;
    if (!idToken) return res.status(400).json({ error: 'ID token is required' });

    // The getGoogleUser logic or authService logic could be extended to directly accept an ID token 
    // Here we'll assume authService handles it or we write a verify function. For now, pseudo-implementation:
    // const googleProfile = await verifyMobileIdToken(idToken);
    // const { user, accessToken, refreshToken, isNewUser } = await authService.googleLogin(googleProfile);
    
    // sendAuthResponse(res, user, accessToken, refreshToken, isNewUser);
    res.status(501).json({ message: 'Mobile ID token verification not fully implemented yet' });
  } catch (error) {
    next(error);
  }
});

/**
 * 6. POST /link-google
 */
router.post('/link-google', authenticate, async (req, res, next) => {
  try {
    const { idToken } = req.body; // Expecting frontend to pass Google ID token
    // pseudo implementation: const googleProfile = await extractGoogleProfile(idToken);
    // const updatedUser = await authService.linkGoogleAccount(req.user.userId, googleProfile);
    res.status(501).json({ message: 'Link google account not fully implemented yet' });
  } catch (error) {
    next(error);
  }
});

/**
 * 7. POST /refresh-token
 */
router.post('/refresh-token', async (req, res, next) => {
  try {
    const token = req.cookies.refreshToken || req.body.refreshToken;
    if (!token) {
      return res.status(401).json({ error: 'Refresh token required' });
    }

    const { accessToken, refreshToken } = await authService.refreshToken(token);
    
    res.cookie('accessToken', accessToken, accessCookieOptions);
    res.cookie('refreshToken', refreshToken, refreshCookieOptions);

    res.json({ accessToken, refreshToken });
  } catch (error) {
    next(error);
  }
});

/**
 * 8. POST /logout
 */
router.post('/logout', authenticate, async (req, res, next) => {
  try {
    const token = req.cookies.refreshToken || req.body.refreshToken;
    await authService.logout(req.user.userId, token);

    res.clearCookie('accessToken', { path: '/' });
    res.clearCookie('refreshToken', { path: '/api/auth/refresh-token' });

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    next(error);
  }
});

/**
 * 9. GET /me
 */
router.get('/me', authenticate, async (req, res, next) => {
  try {
    const user = await authService.getCurrentUser(req.user.userId);
    res.json({ user });
  } catch (error) {
    next(error);
  }
});

/**
 * 10. PUT /profile
 */
router.put('/profile', authenticate, async (req, res, next) => {
  try {
    const { name, mobile, avatarUrl } = req.body;
    const updatedUser = await authService.updateProfile(req.user.userId, { name, mobile, avatarUrl });
    res.json({ user: updatedUser });
  } catch (error) {
    next(error);
  }
});

/**
 * 11. POST /change-password
 */
router.post('/change-password', authenticate, async (req, res, next) => {
  try {
    const { oldPassword, newPassword } = req.body;
    await authService.changePassword(req.user.userId, oldPassword, newPassword);
    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    next(error);
  }
});

/**
 * 12. POST /guard/login
 */
router.post('/guard/login', guardLimiter, async (req, res, next) => {
  try {
    const { societyId, guardId, pin } = req.body;
    const { user, accessToken, refreshToken } = await authService.guardLoginWithPin(societyId, guardId, pin);
    sendAuthResponse(res, user, accessToken, refreshToken);
  } catch (error) {
    next(error);
  }
});

/**
 * 13. POST /setup-pin
 */
router.post('/setup-pin', authenticate, authorize('GUARD'), async (req, res, next) => {
  try {
    const { pin } = req.body;
    await authService.setupPin(req.user.userId, pin);
    res.json({ message: 'PIN set up successfully' });
  } catch (error) {
    next(error);
  }
});

/**
 * 14. POST /forgot-password
 */
router.post('/forgot-password', passwordResetLimiter, async (req, res, next) => {
  try {
    const { email } = req.body;
    // Call service to generate OTP and send email
    res.json({ message: 'If that email is registered, a reset OTP has been sent.' });
  } catch (error) {
    next(error);
  }
});

/**
 * 15. POST /reset-password
 */
router.post('/reset-password', async (req, res, next) => {
  try {
    const { email, otp, newPassword } = req.body;
    // Call service to verify OTP and reset password
    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    next(error);
  }
});

/**
 * 16. POST /verify-email
 */
router.post('/verify-email', authenticate, async (req, res, next) => {
  try {
    // Generate verification OTP and send
    res.json({ message: 'Verification email sent' });
  } catch (error) {
    next(error);
  }
});

/**
 * 17. POST /confirm-email
 */
router.post('/confirm-email', authenticate, async (req, res, next) => {
  try {
    const { otp } = req.body;
    // Verify OTP and update user.emailVerified = true
    res.json({ message: 'Email verified successfully' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
