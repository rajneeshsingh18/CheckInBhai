const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { prisma } = require('../config/database');

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';
const REFRESH_SECRET = process.env.REFRESH_SECRET || 'fallback_refresh_secret';

/**
 * Helper to generate tokens.
 */
const generateTokens = (user) => {
  const payload = {
    userId: user.id,
    role: user.role,
    societyId: user.societyId,
    flatId: user.resident?.flatId || null,
  };

  const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: '15m' });
  const refreshToken = jwt.sign({ userId: user.id }, REFRESH_SECRET, { expiresIn: '7d' });

  return { accessToken, refreshToken };
};

/**
 * Helper to create a refresh token in the database.
 */
const saveRefreshToken = async (userId, token) => {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7 days from now

  await prisma.refreshToken.create({
    data: {
      userId,
      token,
      expiresAt,
    },
  });
};

const authService = {
  /**
   * 1. Register with Email/Password
   */
  async registerWithEmail(data) {
    const { email, password, name, mobile, role, societyId } = data;

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw new Error('Email is already registered');
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name,
        mobile,
        role,
        societyId,
        authProvider: 'local',
      },
    });

    const { accessToken, refreshToken } = generateTokens(user);
    await saveRefreshToken(user.id, refreshToken);

    return { user, accessToken, refreshToken };
  },

  /**
   * 2. Login with Email/Password
   */
  async loginWithEmail(email, password) {
    const user = await prisma.user.findUnique({
      where: { email },
      include: { resident: true },
    });

    if (!user || user.authProvider !== 'local') {
      throw new Error('Invalid email or password');
    }

    if (!user.passwordHash) {
      throw new Error('Please login with your social provider');
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      throw new Error('Invalid email or password');
    }

    if (!user.isActive) {
      throw new Error('Account is inactive. Please contact your society admin.');
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const { accessToken, refreshToken } = generateTokens(user);
    await saveRefreshToken(user.id, refreshToken);

    return { user, accessToken, refreshToken };
  },

  /**
   * 3. Login or Signup with Google
   */
  async googleLogin(googleProfile) {
    const { googleId, email, name, avatarUrl, emailVerified } = googleProfile;

    let user = await prisma.user.findUnique({
      where: { email },
      include: { resident: true },
    });

    let isNewUser = false;

    if (user) {
      // User exists. Link account if authProvider is local
      if (user.authProvider === 'local' && !user.googleId) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            googleId,
            avatarUrl: user.avatarUrl || avatarUrl, // keep existing if present
            emailVerified: true,
          },
          include: { resident: true },
        });
      }
    } else {
      // Create new Google user
      isNewUser = true;
      user = await prisma.user.create({
        data: {
          email,
          googleId,
          name,
          avatarUrl,
          authProvider: 'google',
          emailVerified,
          role: 'RESIDENT', // default role
        },
        include: { resident: true },
      });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const { accessToken, refreshToken } = generateTokens(user);
    await saveRefreshToken(user.id, refreshToken);

    return { user, accessToken, refreshToken, isNewUser };
  },

  /**
   * 4. Link Google Account
   */
  async linkGoogleAccount(userId, googleProfile) {
    const { googleId, avatarUrl, emailVerified } = googleProfile;

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        googleId,
        avatarUrl,
        emailVerified,
      },
    });

    return updatedUser;
  },

  /**
   * 5. Refresh Token
   */
  async refreshToken(oldRefreshToken) {
    let decoded;
    try {
      decoded = jwt.verify(oldRefreshToken, REFRESH_SECRET);
    } catch (err) {
      throw new Error('Invalid or expired refresh token');
    }

    const tokenRecord = await prisma.refreshToken.findUnique({
      where: { token: oldRefreshToken },
    });

    if (!tokenRecord) {
      throw new Error('Refresh token not found in database');
    }

    // Delete the old token (rotation)
    await prisma.refreshToken.delete({
      where: { id: tokenRecord.id },
    });

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: { resident: true },
    });

    if (!user || !user.isActive) {
      throw new Error('User not found or inactive');
    }

    const { accessToken, refreshToken: newRefreshToken } = generateTokens(user);
    await saveRefreshToken(user.id, newRefreshToken);

    return { accessToken, refreshToken: newRefreshToken };
  },

  /**
   * 6. Logout
   */
  async logout(userId, refreshTokenString) {
    if (refreshTokenString) {
      await prisma.refreshToken.deleteMany({
        where: {
          userId,
          token: refreshTokenString,
        },
      });
    }
    // Any other session clearance logic can be added here
  },

  /**
   * 7. Get Current User Profile
   */
  async getCurrentUser(userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        society: true,
        resident: {
          include: {
            flat: {
              include: { tower: true },
            },
          },
        },
        guard: true,
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Remove sensitive data before returning
    delete user.passwordHash;
    return user;
  },

  /**
   * 8. Update Profile
   */
  async updateProfile(userId, data) {
    const { name, mobile, avatarUrl } = data;

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { name, mobile, avatarUrl },
    });

    delete updatedUser.passwordHash;
    return updatedUser;
  },

  /**
   * 9. Change Password
   */
  async changePassword(userId, oldPassword, newPassword) {
    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      throw new Error('User not found');
    }

    if (user.authProvider !== 'local') {
      throw new Error('Password changes are only allowed for local accounts');
    }

    const isValid = await bcrypt.compare(oldPassword, user.passwordHash);
    if (!isValid) {
      throw new Error('Incorrect old password');
    }

    const newPasswordHash = await bcrypt.hash(newPassword, 12);

    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newPasswordHash },
    });

    return true;
  },

  /**
   * 10. Setup Guard PIN
   */
  async setupPin(userId, pin) {
    if (!pin || pin.length !== 6) {
      throw new Error('PIN must be exactly 6 characters');
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { guard: true },
    });

    if (!user || user.role !== 'GUARD' || !user.guard) {
      throw new Error('Only guards can set up a PIN');
    }

    const pinHash = await bcrypt.hash(pin, 12);

    await prisma.guard.update({
      where: { id: user.guard.id },
      data: { pinCode: pinHash },
    });

    return true;
  },

  /**
   * 11. Guard Login with PIN
   */
  async guardLoginWithPin(societyId, guardId, pin) {
    const guard = await prisma.guard.findUnique({
      where: { id: guardId },
      include: { user: true },
    });

    if (!guard || guard.societyId !== societyId) {
      throw new Error('Invalid guard or society details');
    }

    if (!guard.pinCode) {
      throw new Error('PIN not set up for this guard');
    }

    const isValid = await bcrypt.compare(pin, guard.pinCode);
    if (!isValid) {
      throw new Error('Invalid PIN');
    }

    if (!guard.user.isActive) {
      throw new Error('Guard account is inactive');
    }

    // Mark as on-duty and log the time
    await prisma.guard.update({
      where: { id: guard.id },
      data: {
        isOnDuty: true,
        shiftStart: new Date(),
      },
    });

    await prisma.user.update({
      where: { id: guard.user.id },
      data: { lastLoginAt: new Date() },
    });

    const { accessToken, refreshToken } = generateTokens(guard.user);
    await saveRefreshToken(guard.user.id, refreshToken);

    // Remove sensitive data before returning
    delete guard.user.passwordHash;
    return { user: guard.user, accessToken, refreshToken };
  },
};

module.exports = authService;
