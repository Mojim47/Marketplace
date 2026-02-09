/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Transaction Utilities - Enterprise-Grade Database Transaction Management
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Features:
 * - Configurable isolation levels (SERIALIZABLE for financial operations)
 * - Automatic rollback on failure
 * - Transaction timeout limits
 * - Optimistic locking support
 * - Retry logic with exponential backoff
 *
 * Security Requirements:
 * - REQ 4.2: Transaction isolation for concurrent operations
 * - REQ 4.6: Automatic rollback on failure
 * - REQ 4.7: Transaction timeout limits
 * ═══════════════════════════════════════════════════════════════════════════
 */
import { Logger } from '@nestjs/common';
/**
 * PostgreSQL Transaction Isolation Levels
 * @see https://www.postgresql.org/docs/current/transaction-iso.html
 */
export let IsolationLevel;
((IsolationLevel) => {
  /** Default - Prevents dirty reads */
  IsolationLevel.READ_COMMITTED = 'ReadCommitted';
  /** Prevents non-repeatable reads */
  IsolationLevel.REPEATABLE_READ = 'RepeatableRead';
  /** Highest isolation - Prevents phantom reads (use for financial operations) */
  IsolationLevel.SERIALIZABLE = 'Serializable';
})(IsolationLevel || (IsolationLevel = {}));
/**
 * Default transaction options
 */
const DEFAULT_OPTIONS = {
  isolationLevel: IsolationLevel.READ_COMMITTED,
  timeout: 30000, // 30 seconds
  maxRetries: 3,
  retryDelay: 100, // 100ms base delay
};
/**
 * Financial transaction options (stricter defaults)
 */
export const FINANCIAL_TRANSACTION_OPTIONS = {
  isolationLevel: IsolationLevel.SERIALIZABLE,
  timeout: 60000, // 60 seconds for complex financial operations
  maxRetries: 5,
  retryDelay: 200,
};
/**
 * Error codes that indicate serialization failures (retryable)
 */
const SERIALIZATION_ERROR_CODES = [
  '40001', // serialization_failure
  '40P01', // deadlock_detected
];
/**
 * Check if an error is a serialization failure that can be retried
 */
function isSerializationError(error) {
  // Check for Prisma error by duck typing (avoids direct import)
  if (error && typeof error === 'object' && 'code' in error && typeof error.code === 'string') {
    return SERIALIZATION_ERROR_CODES.includes(error.code);
  }
  return false;
}
/**
 * Calculate exponential backoff delay with jitter
 */
function calculateBackoffDelay(attempt, baseDelay) {
  const exponentialDelay = baseDelay * 2 ** attempt;
  const jitter = Math.random() * exponentialDelay * 0.1; // 10% jitter
  return Math.min(exponentialDelay + jitter, 10000); // Cap at 10 seconds
}
const logger = new Logger('TransactionUtils');
/**
 * Execute a database operation within a transaction with proper isolation
 *
 * @param prisma - PrismaClient instance
 * @param operation - Async function containing database operations
 * @param options - Transaction configuration options
 * @returns TransactionResult with success status and data/error
 *
 * @example
 * ```typescript
 * // Basic transaction
 * const result = await executeTransaction(prisma, async (tx) => {
 *   const user = await tx.user.create({ data: { email: 'test@example.com' } });
 *   const wallet = await tx.wallet.create({ data: { userId: user.id } });
 *   return { user, wallet };
 * });
 *
 * // Financial transaction with SERIALIZABLE isolation
 * const result = await executeTransaction(
 *   prisma,
 *   async (tx) => {
 *     const wallet = await tx.wallet.findUnique({ where: { id: walletId } });
 *     if (wallet.balance < amount) throw new Error('موجودی کافی نیست');
 *     return tx.wallet.update({
 *       where: { id: walletId },
 *       data: { balance: { decrement: amount } },
 *     });
 *   },
 *   FINANCIAL_TRANSACTION_OPTIONS
 * );
 * ```
 */
export async function executeTransaction(prisma, operation, options = {}) {
  const config = { ...DEFAULT_OPTIONS, ...options };
  const startTime = Date.now();
  let attempts = 0;
  while (attempts < config.maxRetries) {
    attempts++;
    try {
      const data = await Promise.race([
        prisma.$transaction(operation, {
          isolationLevel: config.isolationLevel,
          timeout: config.timeout,
        }),
        createTimeoutPromise(config.timeout),
      ]);
      const duration = Date.now() - startTime;
      logger.debug(`تراکنش با موفقیت انجام شد - تلاش: ${attempts}, مدت: ${duration}ms`);
      return {
        success: true,
        data,
        attempts,
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      // Check if error is retryable
      if (isSerializationError(error) && attempts < config.maxRetries) {
        const delay = calculateBackoffDelay(attempts, config.retryDelay);
        logger.warn(`خطای سریال‌سازی - تلاش مجدد ${attempts}/${config.maxRetries} پس از ${delay}ms`);
        await sleep(delay);
        continue;
      }
      // Non-retryable error or max retries exceeded
      logger.error(
        `تراکنش ناموفق - تلاش: ${attempts}, مدت: ${duration}ms`,
        error instanceof Error ? error.stack : String(error)
      );
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
        attempts,
        duration,
      };
    }
  }
  // Should not reach here, but handle edge case
  return {
    success: false,
    error: new Error('حداکثر تعداد تلاش‌ها به پایان رسید'),
    attempts,
    duration: Date.now() - startTime,
  };
}
/**
 * Create a timeout promise that rejects after specified duration
 */
function createTimeoutPromise(timeout) {
  return new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error(`تراکنش پس از ${timeout}ms منقضی شد`));
    }, timeout);
  });
}
/**
 * Sleep utility for retry delays
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
/**
 * Optimistic locking helper for concurrent updates
 *
 * Uses version field to detect concurrent modifications
 *
 * @example
 * ```typescript
 * const result = await withOptimisticLock(
 *   prisma,
 *   'product',
 *   productId,
 *   currentVersion,
 *   async (tx, product) => {
 *     return tx.product.update({
 *       where: { id: productId, version: currentVersion },
 *       data: { stock: product.stock - quantity, version: { increment: 1 } },
 *     });
 *   }
 * );
 * ```
 */
export async function withOptimisticLock(
  prisma,
  modelName,
  id,
  expectedVersion,
  operation,
  options = {}
) {
  return executeTransaction(
    prisma,
    async (tx) => {
      // Fetch current entity
      const model = tx[modelName];
      const entity = await model.findUnique({ where: { id } });
      if (!entity) {
        throw new Error(`موجودیت با شناسه ${id} یافت نشد`);
      }
      // Check version
      if (entity.version !== expectedVersion) {
        throw new OptimisticLockError(
          `تغییر همزمان شناسایی شد - نسخه مورد انتظار: ${expectedVersion}, نسخه فعلی: ${entity.version}`
        );
      }
      // Execute operation
      return operation(tx, entity);
    },
    { ...FINANCIAL_TRANSACTION_OPTIONS, ...options }
  );
}
/**
 * Custom error for optimistic locking failures
 */
export class OptimisticLockError extends Error {
  constructor(message) {
    super(message);
    this.name = 'OptimisticLockError';
  }
}
/**
 * Transaction timeout error
 */
export class TransactionTimeoutError extends Error {
  constructor(timeout) {
    super(`تراکنش پس از ${timeout}ms منقضی شد`);
    this.name = 'TransactionTimeoutError';
  }
}
/**
 * Execute multiple independent operations in parallel within a single transaction
 *
 * Useful for batch operations that need atomicity
 *
 * @example
 * ```typescript
 * const results = await executeBatchTransaction(prisma, [
 *   (tx) => tx.user.update({ where: { id: '1' }, data: { balance: 100 } }),
 *   (tx) => tx.user.update({ where: { id: '2' }, data: { balance: 200 } }),
 * ]);
 * ```
 */
export async function executeBatchTransaction(prisma, operations, options = {}) {
  return executeTransaction(
    prisma,
    async (tx) => {
      return Promise.all(operations.map((op) => op(tx)));
    },
    options
  );
}
/**
 * Execute a read-only transaction with REPEATABLE_READ isolation
 *
 * Ensures consistent reads across multiple queries
 */
export async function executeReadOnlyTransaction(prisma, operation, options = {}) {
  return executeTransaction(prisma, operation, {
    ...options,
    isolationLevel: IsolationLevel.REPEATABLE_READ,
  });
}
/**
 * Execute a financial transaction with SERIALIZABLE isolation
 *
 * Use for operations involving money, inventory, or other critical resources
 */
export async function executeFinancialTransaction(prisma, operation, options = {}) {
  return executeTransaction(prisma, operation, {
    ...FINANCIAL_TRANSACTION_OPTIONS,
    ...options,
    isolationLevel: IsolationLevel.SERIALIZABLE,
  });
}
//# sourceMappingURL=transaction.utils.js.map
