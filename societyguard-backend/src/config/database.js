const { PrismaClient, Prisma } = require('@prisma/client');

/**
 * 1. Prisma Client Singleton
 * Prevents multiple instances during hot-reloads in development.
 */
const globalForPrisma = globalThis;
const prismaBase = globalForPrisma.prisma || new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
});

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prismaBase;
}

/**
 * 2. Extend Prisma Client with Modern Prisma Extensions
 * This replaces the older `$use` middleware.
 */
const prisma = prismaBase.$extends({
  query: {
    // a. Soft Delete Extension
    user: {
      async delete({ args, query }) {
        args.data = { isActive: false };
        return prismaBase.user.update({
          where: args.where,
          data: { isActive: false }
        });
      },
      async deleteMany({ args, query }) {
        if (args.data !== undefined) {
          args.data.isActive = false;
        } else {
          args.data = { isActive: false };
        }
        return prismaBase.user.updateMany({
          where: args.where,
          data: { isActive: false }
        });
      }
    },
    staff: {
      async delete({ args, query }) {
        return prismaBase.staff.update({
          where: args.where,
          data: { isActive: false }
        });
      },
      async deleteMany({ args, query }) {
        return prismaBase.staff.updateMany({
          where: args.where,
          data: { isActive: false }
        });
      }
    },
    // b. Query Logging (Slow Queries)
    $allModels: {
      async $allOperations({ operation, model, args, query }) {
        const start = performance.now();
        const result = await query(args);
        const end = performance.now();
        const duration = end - start;
        
        if (duration > 500) {
          console.warn(`[SLOW QUERY WARNING] ${model}.${operation} took ${duration.toFixed(2)}ms`);
        }
        return result;
      }
    }
  }
});

/**
 * Graceful Disconnect
 */
process.on('SIGINT', async () => {
  await prismaBase.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await prismaBase.$disconnect();
  process.exit(0);
});

/**
 * 3. Multi-Tenancy Helper
 * Returns a new Prisma client instance scoped to a specific user's access level.
 * It forces `{ societyId: user.societyId }` onto queries so developers can't accidentally leak data.
 */
const getPrismaClientForUser = (user) => {
  if (!user || user.role === 'SUPER_ADMIN') {
    // Super admins see everything
    return prisma;
  }

  // Define which models strictly belong to a society
  const societyScopedModels = [
    'tower', 'flat', 'guard', 'vehicle', 'visitorEntry', 
    'delivery', 'sosAlert', 'subscription', 'staff'
  ];

  // Extend the base prisma client dynamically for this specific request
  return prisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ operation, model, args, query }) {
          const modelName = model.charAt(0).toLowerCase() + model.slice(1);
          
          // Only append conditions to read/update/delete queries (not create)
          const readWriteOperations = ['findUnique', 'findFirst', 'findMany', 'update', 'updateMany', 'delete', 'deleteMany', 'count', 'aggregate', 'groupBy'];
          
          if (readWriteOperations.includes(operation)) {
            args.where = args.where || {};

            if (user.role === 'SOCIETY_ADMIN' || user.role === 'GUARD') {
              // Ensure they only touch their society's data
              if (societyScopedModels.includes(modelName)) {
                args.where.societyId = user.societyId;
              }
              // For Users (since societyId is optional on User model, we secure it here)
              if (modelName === 'user' && user.role === 'SOCIETY_ADMIN') {
                 args.where.societyId = user.societyId;
              }
            } else if (user.role === 'RESIDENT') {
              // Residents are strictly scoped to their flat for things like Visitors & Deliveries
              if (['visitorEntry', 'delivery', 'staffAttendance', 'vehicle'].includes(modelName)) {
                args.where.flatId = user.flatId;
              } else if (['tower', 'flat', 'society'].includes(modelName)) {
                // They can *read* their society/flat, but this stops them modifying others
                if (modelName === 'flat') args.where.id = user.flatId;
                if (modelName === 'society') args.where.id = user.societyId;
              }
            }
          }
          return query(args);
        }
      }
    }
  });
};

/**
 * 4. Transaction Helper with Deadlock Retry
 */
const runTransaction = async (callback, maxRetries = 3) => {
  let attempt = 0;
  while (attempt < maxRetries) {
    try {
      const start = performance.now();
      const result = await prismaBase.$transaction(callback);
      const end = performance.now();
      
      if (process.env.NODE_ENV === 'development') {
        console.log(`[Transaction] Completed in ${(end - start).toFixed(2)}ms`);
      }
      return result;
    } catch (error) {
      // Prisma Error Code P2034 corresponds to Deadlocks
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
        attempt++;
        console.warn(`[Transaction] Deadlock detected. Retrying... (${attempt}/${maxRetries})`);
        if (attempt === maxRetries) throw new Error('Transaction failed after maximum retries due to deadlocks.');
        
        // Wait a short random time before retrying
        await new Promise(res => setTimeout(res, Math.random() * 50));
      } else {
        throw error;
      }
    }
  }
};

module.exports = {
  prisma,
  getPrismaClientForUser,
  runTransaction
};
