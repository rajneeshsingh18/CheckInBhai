const { ForbiddenError } = require('../middleware/auth');

/**
 * Single source of truth for Role-Based Access Control (RBAC) in Rakshak.
 * Defines granular permissions for each role per resource.
 * 
 * Permission Strings:
 * - 'all': Unrestricted access.
 * - 'own': Access to the user's specific record.
 * - 'own_society': Access to any record belonging to the user's societyId.
 * - 'own_flat': Access to any record belonging to the user's flatId.
 * - 'create': Permission to create a new record.
 * - 'create_exit': Permission to create an entry or update an exit time (Guards).
 * - 'approve_reject': Permission to change status to APPROVED/REJECTED (Residents).
 * - 'pre_approve': Permission to create an entry with PRE_APPROVED status (Residents).
 * - 'acknowledge': Permission to acknowledge an alert.
 * - 'resolve_only': Permission to resolve an alert.
 * - 'pickup': Permission to change delivery status to PICKED_UP.
 * - 'none': Access completely denied.
 */
const ACCESS_RULES = {
  SUPER_ADMIN: {
    societies: { read: 'all', write: 'all' },
    towers: { read: 'all', write: 'all' },
    flats: { read: 'all', write: 'all' },
    users: { read: 'all', write: 'all' },
    residents: { read: 'all', write: 'all' },
    guards: { read: 'all', write: 'all' },
    visitors: { read: 'all', write: 'all' },
    visitorEntries: { read: 'all', write: 'all' },
    deliveries: { read: 'all', write: 'all' },
    staff: { read: 'all', write: 'all' },
    staffAttendance: { read: 'all', write: 'all' },
    vehicles: { read: 'all', write: 'all' },
    sosAlerts: { read: 'all', write: 'all' },
    subscriptions: { read: 'all', write: 'all' }
  },
  
  SOCIETY_ADMIN: {
    societies: { read: 'own', write: 'own' },
    towers: { read: 'own_society', write: 'own_society' },
    flats: { read: 'own_society', write: 'own_society' },
    users: { read: 'own_society', write: 'own_society' },
    residents: { read: 'own_society', write: 'own_society' },
    guards: { read: 'own_society', write: 'own_society' },
    visitors: { read: 'own_society', write: 'own_society' },
    visitorEntries: { read: 'own_society', write: 'none' }, // Logs are read-only for admins
    deliveries: { read: 'own_society', write: 'none' }, // Logs are read-only for admins
    staff: { read: 'own_society', write: 'own_society' },
    staffAttendance: { read: 'own_society', write: 'none' }, // Logs are read-only
    vehicles: { read: 'own_society', write: 'own_society' },
    sosAlerts: { read: 'own_society', write: 'resolve_only' },
    subscriptions: { read: 'own', write: 'none' }
  },
  
  GUARD: {
    societies: { read: 'own', write: 'none' },
    towers: { read: 'own_society', write: 'none' },
    flats: { read: 'own_society', write: 'none' }, // Needs to read flats to verify entry
    users: { read: 'own_society', write: 'none' },
    residents: { read: 'own_society', write: 'none' }, // Needs to read residents for verification
    guards: { read: 'own', write: 'own' }, // Can view/update own profile
    visitors: { read: 'own_society', write: 'create' },
    visitorEntries: { read: 'own_society', write: 'create_exit' },
    deliveries: { read: 'own_society', write: 'create' },
    staff: { read: 'own_society', write: 'none' },
    staffAttendance: { read: 'own_society', write: 'create' },
    vehicles: { read: 'own_society', write: 'none' },
    sosAlerts: { read: 'own_society', write: 'acknowledge' },
    subscriptions: { read: 'none', write: 'none' }
  },
  
  RESIDENT: {
    societies: { read: 'own', write: 'none' },
    towers: { read: 'own_society', write: 'none' },
    flats: { read: 'own', write: 'none' },
    users: { read: 'own', write: 'own' },
    residents: { read: 'own_flat', write: 'none' },
    guards: { read: 'own_society', write: 'none' },
    visitors: { read: 'own_society', write: 'create' }, // Can register familiar visitors
    visitorEntries: { read: 'own_flat', write: 'approve_reject' }, // Can approve/reject incoming, or create pre_approve
    deliveries: { read: 'own_flat', write: 'pickup' },
    staff: { read: 'own_flat', write: 'own_flat' }, // Can register personal staff
    staffAttendance: { read: 'own_flat', write: 'none' },
    vehicles: { read: 'own_flat', write: 'own_flat' }, // Can register personal vehicles
    sosAlerts: { read: 'own_flat', write: 'create' },
    subscriptions: { read: 'none', write: 'none' }
  }
};

/**
 * Returns a Prisma where clause for strict data isolation based on user role.
 * Useful for findMany/findFirst operations.
 * 
 * @param {Object} user - Decoded JWT user payload
 * @param {string} resource - Model name (e.g., 'users', 'visitorEntries')
 * @returns {Object} Prisma 'where' clause condition
 */
function getReadFilter(user, resource) {
  if (!user || !user.role) {
    throw new ForbiddenError('User identity not found for filter generation');
  }

  // SUPER_ADMIN gets no filters (sees all)
  if (user.role === 'SUPER_ADMIN') {
    return {};
  }

  // Society Admins and Guards are isolated to their own society
  if (user.role === 'SOCIETY_ADMIN' || user.role === 'GUARD') {
    if (!user.societyId) throw new ForbiddenError('Society ID missing on user');
    return { societyId: user.societyId };
  }

  // Residents are isolated to their specific flat for most transactional data
  if (user.role === 'RESIDENT') {
    if (!user.flatId) throw new ForbiddenError('Flat ID missing on user');
    
    const flatScopedResources = [
      'visitorEntries', 'deliveries', 'staff', 'staffAttendance', 'vehicles', 'sosAlerts', 'residents'
    ];

    if (flatScopedResources.includes(resource)) {
      return { flatId: user.flatId };
    }

    // For reading society-level lookup data (towers, guards, users)
    if (user.societyId) {
      return { societyId: user.societyId };
    }
  }

  // Safe fallback
  return { id: 'invalid_access' };
}

/**
 * Checks if a user has permission to perform an action on a resource.
 * Throws a ForbiddenError if access is denied.
 * 
 * @param {Object} user - Decoded JWT user payload
 * @param {string} resource - Model name (e.g., 'visitorEntries')
 * @param {string} action - 'read' or 'write' (or specific permission string to verify)
 * @param {string} [specificPermission] - Optional specific permission to check against the write rule (e.g. 'approve_reject')
 * @returns {boolean} True if allowed
 * @throws {ForbiddenError} If access is denied
 */
function canAccess(user, resource, action, specificPermission = null) {
  if (!user || !user.role) {
    throw new ForbiddenError('User identity required for authorization');
  }

  const roleRules = ACCESS_RULES[user.role];
  if (!roleRules) {
    throw new ForbiddenError(`No rules defined for role: ${user.role}`);
  }

  const resourceRules = roleRules[resource];
  if (!resourceRules) {
    throw new ForbiddenError(`No rules defined for resource: ${resource}`);
  }

  const allowedAction = resourceRules[action];

  if (allowedAction === 'none' || allowedAction === undefined) {
    throw new ForbiddenError(`Access denied: ${user.role} cannot ${action} ${resource}`);
  }

  // If we are checking for a very specific capability (e.g. resident trying to approve an entry)
  if (specificPermission && action === 'write') {
    // If they have 'all' or 'own', they generally have full write rights over that scope
    if (['all', 'own', 'own_society', 'own_flat'].includes(allowedAction)) {
      return true;
    }
    // If they have a specific string, it must match
    if (allowedAction !== specificPermission) {
      throw new ForbiddenError(`Access denied: ${user.role} lacks '${specificPermission}' capability on ${resource}`);
    }
  }

  return true;
}

module.exports = {
  ACCESS_RULES,
  getReadFilter,
  canAccess
};