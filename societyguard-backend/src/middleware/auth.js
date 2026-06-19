const jwt = require('jsonwebtoken');
const { prisma } = require('../config/database');

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

class AuthError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.name = 'AuthError';
    this.statusCode = statusCode;
  }
}

class ForbiddenError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ForbiddenError';
    this.statusCode = 403;
  }
}

/**
 * 1. authenticate middleware
 */
const authenticate = async (req, res, next) => {
  try {
    let token;

    // Extract token
    if (req.cookies && req.cookies.accessToken) {
      token = req.cookies.accessToken;
    } else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.query && req.query.token) {
      token = req.query.token;
    }

    if (!token) {
      throw new AuthError(401, 'Authentication required');
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      
      // We do a quick DB check to ensure user is active and exists
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { id: true, role: true, societyId: true, email: true, authProvider: true, emailVerified: true, isActive: true }
      });

      if (!user || !user.isActive) {
        throw new AuthError(401, 'User account is inactive or deleted');
      }

      req.user = {
        userId: user.id,
        role: user.role,
        societyId: user.societyId,
        flatId: decoded.flatId || null,
        email: user.email,
        authProvider: user.authProvider,
        emailVerified: user.emailVerified
      };

      next();
    } catch (err) {
      throw new AuthError(401, 'Invalid or expired token');
    }
  } catch (error) {
    next(error);
  }
};

/**
 * 2. authorize middleware
 */
const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    try {
      if (!req.user || !req.user.role) {
        throw new AuthError(401, 'Authentication required');
      }

      if (!allowedRoles.includes(req.user.role)) {
        throw new ForbiddenError(`Role ${req.user.role} not authorized. Required: ${allowedRoles.join(', ')}`);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * 3. requireSocietyAccess middleware
 */
const requireSocietyAccess = (req, res, next) => {
  try {
    const { user } = req;
    
    if (user.role === 'SUPER_ADMIN') {
      return next();
    }

    const requestedSocietyId = req.params.societyId || req.body.societyId || req.query.societyId;

    if (!requestedSocietyId) {
      throw new ForbiddenError('Society ID is required to verify access');
    }

    if (user.societyId !== requestedSocietyId) {
      throw new ForbiddenError('Access denied to this society');
    }

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * 4. requireFlatAccess middleware
 */
const requireFlatAccess = async (req, res, next) => {
  try {
    const { user } = req;

    if (user.role === 'SUPER_ADMIN' || user.role === 'SOCIETY_ADMIN') {
      return next();
    }

    const requestedFlatId = req.params.flatId || req.body.flatId;

    if (!requestedFlatId) {
      throw new ForbiddenError('Flat ID is required to verify access');
    }

    if (user.role === 'RESIDENT') {
      if (user.flatId !== requestedFlatId) {
        throw new ForbiddenError('Access denied to this flat');
      }
      return next();
    }

    if (user.role === 'GUARD') {
      // Check if flat belongs to Guard's society
      const flat = await prisma.flat.findUnique({
        where: { id: requestedFlatId },
        select: { societyId: true }
      });

      if (!flat || flat.societyId !== user.societyId) {
        throw new ForbiddenError('Access denied to this flat');
      }
      return next();
    }

    throw new ForbiddenError('Access denied');
  } catch (error) {
    next(error);
  }
};

/**
 * 5. requireResourceOwnership middleware
 * Generic ownership check. If `modelName` is provided, it looks up the resource.
 * Otherwise, it compares the param directly with req.user.
 */
const requireResourceOwnership = (modelName, resourceField = 'id', userField = 'userId') => {
  return async (req, res, next) => {
    try {
      const { user } = req;
      
      if (user.role === 'SUPER_ADMIN') {
        return next();
      }

      // If there's no model name, just do a direct parameter check (e.g., param is userId)
      if (!modelName) {
        const targetId = req.params[resourceField] || req.body[resourceField];
        if (targetId && user[userField] === targetId) {
          return next();
        }
        if (user.role === 'SOCIETY_ADMIN') {
          // Additional checks for SOCIETY_ADMIN might go here if applicable
          return next();
        }
        throw new ForbiddenError('You can only modify your own resources');
      }

      // DB Lookup logic
      const resourceId = req.params[resourceField] || req.body[resourceField];
      if (!resourceId) {
        throw new ForbiddenError('Resource ID not found in request');
      }

      const resource = await prisma[modelName].findUnique({
        where: { id: resourceId }
      });

      if (!resource) {
        throw new Error('Resource not found'); // Or 404
      }

      if (resource[userField] === user.userId) {
        return next();
      }

      if (user.role === 'SOCIETY_ADMIN' && resource.societyId === user.societyId) {
        return next();
      }

      throw new ForbiddenError('You can only modify your own resources');
    } catch (error) {
      next(error);
    }
  };
};

/**
 * 6. createAccessFilter helper
 */
const createAccessFilter = (user, model) => {
  if (user.role === 'SUPER_ADMIN') {
    return {};
  }

  if (user.role === 'SOCIETY_ADMIN' || user.role === 'GUARD') {
    return { societyId: user.societyId };
  }

  if (user.role === 'RESIDENT') {
    if (model === 'visitorEntry' || model === 'delivery') {
      return { flatId: user.flatId };
    }
    // Default resident filter
    return { flatId: user.flatId };
  }

  return { id: 'invalid' }; // safe fallback
};

/**
 * 7. requireEmailVerified middleware
 */
const requireEmailVerified = (req, res, next) => {
  try {
    if (!req.user.emailVerified && req.user.authProvider === 'local') {
      throw new ForbiddenError('Email verification required');
    }
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = {
  authenticate,
  authorize,
  requireSocietyAccess,
  requireFlatAccess,
  requireResourceOwnership,
  createAccessFilter,
  requireEmailVerified,
  AuthError,
  ForbiddenError
};
