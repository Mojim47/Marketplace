// ═══════════════════════════════════════════════════════════════════════════
// PRISMA READ/WRITE SPLIT MIDDLEWARE
// ═══════════════════════════════════════════════════════════════════════════
// Purpose: Route read queries to read replicas, writes to primary
// Performance: Distribute load across multiple database instances
// ═══════════════════════════════════════════════════════════════════════════

import { PrismaClient } from '@prisma/client';

// Database connection configuration
const DATABASE_CONFIG = {
  primary: {
    url: process.env.DATABASE_URL_PRIMARY || process.env.DATABASE_URL,
    pool: {
      min: 5,
      max: 20,
      acquireTimeoutMillis: 30000,
      createTimeoutMillis: 30000,
      destroyTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
      reapIntervalMillis: 1000,
      createRetryIntervalMillis: 200,
    },
  },
  readReplica1: {
    url: process.env.DATABASE_URL_READ_REPLICA_1,
    pool: {
      min: 10,
      max: 50,
      acquireTimeoutMillis: 15000,
      createTimeoutMillis: 15000,
      destroyTimeoutMillis: 5000,
      idleTimeoutMillis: 60000,
      reapIntervalMillis: 1000,
      createRetryIntervalMillis: 200,
    },
  },
  readReplica2: {
    url: process.env.DATABASE_URL_READ_REPLICA_2,
    pool: {
      min: 10,
      max: 50,
      acquireTimeoutMillis: 15000,
      createTimeoutMillis: 15000,
      destroyTimeoutMillis: 5000,
      idleTimeoutMillis: 60000,
      reapIntervalMillis: 1000,
      createRetryIntervalMillis: 200,
    },
  },
};

// Initialize Prisma clients
const primaryClient = new PrismaClient({
  datasources: {
    db: { url: DATABASE_CONFIG.primary.url },
  },
  log: process.env.NODE_ENV === 'development' ? ['query', 'error'] : ['error'],
});

const readReplica1 = DATABASE_CONFIG.readReplica1.url
  ? new PrismaClient({
      datasources: {
        db: { url: DATABASE_CONFIG.readReplica1.url },
      },
      log: ['error'],
    })
  : null;

const readReplica2 = DATABASE_CONFIG.readReplica2.url
  ? new PrismaClient({
      datasources: {
        db: { url: DATABASE_CONFIG.readReplica2.url },
      },
      log: ['error'],
    })
  : null;

// Read replica pool
const readReplicas = [readReplica1, readReplica2].filter(Boolean);
let currentReplicaIndex = 0;

// Get next read replica (round-robin)
function getReadReplica(): PrismaClient {
  if (readReplicas.length === 0) {
    return primaryClient; // Fallback to primary if no replicas
  }

  const replica = readReplicas[currentReplicaIndex];
  currentReplicaIndex = (currentReplicaIndex + 1) % readReplicas.length;
  return replica;
}

// Read operations that should use read replicas
const READ_OPERATIONS = new Set([
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'findUnique',
  'findUniqueOrThrow',
  'count',
  'aggregate',
  'groupBy',
]);

// Write operations that must use primary
const WRITE_OPERATIONS = new Set([
  'create',
  'createMany',
  'update',
  'updateMany',
  'upsert',
  'delete',
  'deleteMany',
  'executeRaw',
  'queryRaw',
]);

// Tables that should always use primary (real-time consistency required)
const PRIMARY_ONLY_TABLES = new Set([
  'sessions',
  'otp_verifications',
  'payment_transactions',
  'transactions',
  'cart_items',
  'inventory_logs',
]);

// Read/Write Split Middleware
primaryClient.$use(async (params, next) => {
  const { model, action } = params;

  // Always use primary for write operations
  if (WRITE_OPERATIONS.has(action)) {
    return next(params);
  }

  // Always use primary for real-time consistency tables
  if (model && PRIMARY_ONLY_TABLES.has(model.toLowerCase())) {
    return next(params);
  }

  // Use read replica for read operations
  if (READ_OPERATIONS.has(action)) {
    const readClient = getReadReplica();

    if (readClient !== primaryClient) {
      try {
        // Execute query on read replica
        return await (readClient as any)[model!][action](params.args);
      } catch (error) {
        // Fallback to primary on read replica failure
        console.warn(`Read replica failed for ${model}.${action}, falling back to primary:`, error);
        return next(params);
      }
    }
  }

  // Default to primary
  return next(params);
});

// Connection health monitoring
async function checkConnectionHealth() {
  const results = {
    primary: false,
    readReplica1: false,
    readReplica2: false,
  };

  try {
    await primaryClient.$queryRaw`SELECT 1`;
    results.primary = true;
  } catch (error) {
    console.error('Primary database connection failed:', error);
  }

  if (readReplica1) {
    try {
      await readReplica1.$queryRaw`SELECT 1`;
      results.readReplica1 = true;
    } catch (error) {
      console.error('Read replica 1 connection failed:', error);
    }
  }

  if (readReplica2) {
    try {
      await readReplica2.$queryRaw`SELECT 1`;
      results.readReplica2 = true;
    } catch (error) {
      console.error('Read replica 2 connection failed:', error);
    }
  }

  return results;
}

// Graceful shutdown
async function gracefulShutdown() {
  console.log('Shutting down database connections...');

  await Promise.all(
    [primaryClient.$disconnect(), readReplica1?.$disconnect(), readReplica2?.$disconnect()].filter(
      Boolean
    )
  );

  console.log('Database connections closed');
}

// Health check interval (every 30 seconds)
setInterval(checkConnectionHealth, 30000);

// Handle process termination
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Export the enhanced primary client
export { primaryClient as prisma, checkConnectionHealth, gracefulShutdown };

// Export individual clients for advanced use cases
export { primaryClient, readReplica1, readReplica2 };

// ═══════════════════════════════════════════════════════════════════════════
// USAGE EXAMPLES
// ═══════════════════════════════════════════════════════════════════════════

/*
// Standard usage (automatic routing)
import { prisma } from './read-write-split'

// This will use read replica
const products = await prisma.product.findMany({
  where: { status: 'ACTIVE' }
})

// This will use primary database
const newOrder = await prisma.order.create({
  data: { ... }
})

// Force primary for critical reads
import { primaryClient } from './read-write-split'

const criticalData = await primaryClient.session.findFirst({
  where: { token: userToken }
})
*/
