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
export interface TransactionClient {
  [key: string]: any;
}
export interface PrismaClientLike {
  $transaction<T>(
    fn: (tx: TransactionClient) => Promise<T>,
    options?: {
      isolationLevel?: string;
      timeout?: number;
    }
  ): Promise<T>;
}
/**
 * PostgreSQL Transaction Isolation Levels
 * @see https://www.postgresql.org/docs/current/transaction-iso.html
 */
export declare enum IsolationLevel {
  /** Default - Prevents dirty reads */
  READ_COMMITTED = 'ReadCommitted',
  /** Prevents non-repeatable reads */
  REPEATABLE_READ = 'RepeatableRead',
  /** Highest isolation - Prevents phantom reads (use for financial operations) */
  SERIALIZABLE = 'Serializable',
}
/**
 * Transaction configuration options
 */
export interface TransactionOptions {
  /** Isolation level for the transaction */
  isolationLevel?: IsolationLevel;
  /** Maximum time in milliseconds before transaction times out */
  timeout?: number;
  /** Maximum number of retry attempts for serialization failures */
  maxRetries?: number;
  /** Base delay in milliseconds for exponential backoff */
  retryDelay?: number;
}
/**
 * Financial transaction options (stricter defaults)
 */
export declare const FINANCIAL_TRANSACTION_OPTIONS: TransactionOptions;
/**
 * Transaction result wrapper
 */
export interface TransactionResult<T> {
  success: boolean;
  data?: T;
  error?: Error;
  attempts: number;
  duration: number;
}
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
export declare function executeTransaction<T>(
  prisma: PrismaClientLike,
  operation: (tx: TransactionClient) => Promise<T>,
  options?: TransactionOptions
): Promise<TransactionResult<T>>;
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
export declare function withOptimisticLock<
  T extends {
    version: number;
  },
>(
  prisma: PrismaClientLike,
  modelName: string,
  id: string,
  expectedVersion: number,
  operation: (tx: TransactionClient, entity: T) => Promise<T>,
  options?: TransactionOptions
): Promise<TransactionResult<T>>;
/**
 * Custom error for optimistic locking failures
 */
export declare class OptimisticLockError extends Error {
  constructor(message: string);
}
/**
 * Transaction timeout error
 */
export declare class TransactionTimeoutError extends Error {
  constructor(timeout: number);
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
export declare function executeBatchTransaction<T>(
  prisma: PrismaClientLike,
  operations: Array<(tx: TransactionClient) => Promise<T>>,
  options?: TransactionOptions
): Promise<TransactionResult<T[]>>;
/**
 * Execute a read-only transaction with REPEATABLE_READ isolation
 *
 * Ensures consistent reads across multiple queries
 */
export declare function executeReadOnlyTransaction<T>(
  prisma: PrismaClientLike,
  operation: (tx: TransactionClient) => Promise<T>,
  options?: Omit<TransactionOptions, 'isolationLevel'>
): Promise<TransactionResult<T>>;
/**
 * Execute a financial transaction with SERIALIZABLE isolation
 *
 * Use for operations involving money, inventory, or other critical resources
 */
export declare function executeFinancialTransaction<T>(
  prisma: PrismaClientLike,
  operation: (tx: TransactionClient) => Promise<T>,
  options?: Omit<TransactionOptions, 'isolationLevel'>
): Promise<TransactionResult<T>>;
//# sourceMappingURL=transaction.utils.d.ts.map
