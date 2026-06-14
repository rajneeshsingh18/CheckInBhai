const crypto = require('crypto');
const { prisma } = require('../config/database');
const { AuthError } = require('../middleware/auth'); // Reusing error structure for consistency

class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
    this.statusCode = 400;
  }
}

/**
 * Generates a cryptographically secure 6-digit OTP.
 */
function generateSecureOTP() {
  const min = 100000;
  const max = 999999;
  return Math.floor(crypto.randomInt(max - min + 1) + min).toString();
}

const otpService = {
  /**
   * 1. Generate OTP
   * @param {string} userId - The target user's ID
   * @param {string} purpose - Purpose of OTP (e.g., 'VISITOR_APPROVAL', 'LOGIN')
   * @param {Object} metadata - Optional JSON metadata attached to the OTP
   */
  async generateOTP(userId, purpose, metadata = {}) {
    // 1a. Rate limit check: max 5 OTPs per user per purpose per hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    
    const recentOTPsCount = await prisma.oTP.count({
      where: {
        userId,
        purpose,
        createdAt: { gte: oneHourAgo }
      }
    });

    if (recentOTPsCount >= 5) {
      throw new ValidationError(`Rate limit exceeded: Maximum 5 OTPs per hour for ${purpose}. Please try again later.`);
    }

    // 1b. Delete unused OTPs for the same user + purpose to invalidate old pending ones
    await prisma.oTP.deleteMany({
      where: {
        userId,
        purpose,
        usedAt: null
      }
    });

    // 1c. Set Expiry
    const expiresInMinutes = (purpose === 'LOGIN' || purpose === 'PASSWORD_RESET') ? 10 : 5;
    const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);

    // 1d. Generate and Store
    const otpValue = generateSecureOTP();

    await prisma.oTP.create({
      data: {
        userId,
        purpose,
        otp: otpValue,
        expiresAt,
        metadata
      }
    });

    return otpValue;
  },

  /**
   * 2. Verify OTP (Reads and validates, but does NOT mark as used)
   * @param {string} userId 
   * @param {string} otpValue 
   * @param {string} purpose 
   * @returns {Object} The valid OTP record
   */
  async verifyOTP(userId, otpValue, purpose) {
    const otpRecord = await prisma.oTP.findFirst({
      where: {
        userId,
        purpose,
        otp: otpValue,
        usedAt: null,
        expiresAt: { gt: new Date() } // Must not be expired
      }
    });

    if (!otpRecord) {
      throw new ValidationError('Invalid or expired OTP');
    }

    return otpRecord;
  },

  /**
   * 3. Invalidate OTP (Marks it as used)
   * @param {string} otpId 
   * @returns {Object} The updated record
   */
  async invalidateOTP(otpId) {
    return prisma.oTP.update({
      where: { id: otpId },
      data: { usedAt: new Date() }
    });
  },

  /**
   * 4. Cleanup Expired OTPs
   * Called by cron job every 15 minutes.
   */
  async cleanupExpiredOTPs() {
    try {
      const result = await prisma.oTP.deleteMany({
        where: {
          expiresAt: { lt: new Date() }
        }
      });
      console.log(`[CRON] Cleanup Expired OTPs: Deleted ${result.count} records.`);
    } catch (error) {
      console.error('[CRON ERROR] Failed to cleanup expired OTPs:', error);
    }
  }
};

module.exports = {
  otpService,
  ValidationError
};
