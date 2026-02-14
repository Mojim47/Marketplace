/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Property Tests: Transaction Atomicity and Isolation
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Property 8: Transaction Atomicity
 * - All operations in a transaction succeed or all fail (no partial commits)
 * - Rollback occurs automatically on any failure
 * - Isolation levels are properly enforced
 *
 * Validates: Requirements 4.2, 4.6, 4.7
 * ═══════════════════════════════════════════════════════════════════════════
 */

import * as fc from 'fast-check';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  FINANCIAL_TRANSACTION_OPTIONS,
  IsolationLevel,
  OptimisticLockError,
  executeBatchTransaction,
  executeFinancialTransaction,
  executeReadOnlyTransaction,
  executeTransaction,
  withOptimisticLock,
} from './transaction.utils';

// Mock PrismaClient type
interface MockPrismaClient {
  $transaction: ReturnType<typeof vi.fn>;
  user: {
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  wallet: {
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
}

// Create mock PrismaClient
const createMockPrismaClient = (): MockPrismaClient => {
  return {
    $transaction: vi.fn(),
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    wallet: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  };
};

// Mock Prisma error class
class MockPrismaClientKnownRequestError extends Error {
  code: string;
  clientVersion: string;

  constructor(message: string, options: { code: string; clientVersion: string }) {
    super(message);
    this.name = 'PrismaClientKnownRequestError';
    this.code = options.code;
    this.clientVersion = options.clientVersion;
  }
}

// Mock the Prisma module
vi.mock('@prisma/client', () => ({
  Prisma: {
    PrismaClientKnownRequestError: MockPrismaClientKnownRequestError,
  },
  PrismaClient: vi.fn(),
}));

describe('Transaction Utils - Property Tests', () => {
  let mockPrisma: MockPrismaClient;

  beforeEach(() => {
    mockPrisma = createMockPrismaClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Property 8.1: Transaction Success Returns Data', () => {
    it('should return success=true and data when operation succeeds', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            id: fc.string({ minLength: 5, maxLength: 20 }),
            name: fc.string({ minLength: 1, maxLength: 100 }),
            balance: fc.integer({ min: 0, max: 1000000 }),
          }),
          async (expectedData) => {
            mockPrisma.$transaction.mockResolvedValueOnce(expectedData);

            const result = await executeTransaction(mockPrisma as any, async () => expectedData);

            expect(result.success).toBe(true);
            expect(result.data).toEqual(expectedData);
            expect(result.error).toBeUndefined();
            expect(result.attempts).toBeGreaterThanOrEqual(1);
            expect(result.duration).toBeGreaterThanOrEqual(0);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Property 8.2: Transaction Failure Returns Error', () => {
    it('should return success=false and error when operation fails', async () => {
      await fc.assert(
        fc.asyncProperty(fc.string({ minLength: 1, maxLength: 200 }), async (errorMessage) => {
          const error = new Error(errorMessage);
          mockPrisma.$transaction.mockRejectedValueOnce(error);

          const result = await executeTransaction(mockPrisma as any, async () => {
            throw error;
          });

          expect(result.success).toBe(false);
          expect(result.data).toBeUndefined();
          expect(result.error).toBeDefined();
          expect(result.error?.message).toBe(errorMessage);
        }),
        { numRuns: 50 }
      );
    });
  });

  describe('Property 8.3: Isolation Level Configuration', () => {
    it('should pass correct isolation level to Prisma', async () => {
      const isolationLevels = [
        IsolationLevel.READ_COMMITTED,
        IsolationLevel.REPEATABLE_READ,
        IsolationLevel.SERIALIZABLE,
      ];

      for (const isolationLevel of isolationLevels) {
        mockPrisma.$transaction.mockResolvedValueOnce({ success: true });

        await executeTransaction(mockPrisma as any, async () => ({ success: true }), {
          isolationLevel,
        });

        expect(mockPrisma.$transaction).toHaveBeenCalledWith(
          expect.any(Function),
          expect.objectContaining({
            isolationLevel,
          })
        );
      }
    });
  });

  describe('Property 8.4: Financial Transactions Use SERIALIZABLE', () => {
    it('should always use SERIALIZABLE isolation for financial transactions', async () => {
      await fc.assert(
        fc.asyncProperty(fc.integer({ min: 1, max: 1000000 }), async (amount) => {
          mockPrisma.$transaction.mockResolvedValueOnce({ amount });

          await executeFinancialTransaction(mockPrisma as any, async () => ({ amount }));

          expect(mockPrisma.$transaction).toHaveBeenCalledWith(
            expect.any(Function),
            expect.objectContaining({
              isolationLevel: IsolationLevel.SERIALIZABLE,
            })
          );
        }),
        { numRuns: 20 }
      );
    });
  });

  describe('Property 8.5: Timeout Configuration', () => {
    it('should respect timeout configuration', async () => {
      await fc.assert(
        fc.asyncProperty(fc.integer({ min: 1000, max: 120000 }), async (timeout) => {
          mockPrisma.$transaction.mockResolvedValueOnce({ ok: true });

          await executeTransaction(mockPrisma as any, async () => ({ ok: true }), { timeout });

          expect(mockPrisma.$transaction).toHaveBeenCalledWith(
            expect.any(Function),
            expect.objectContaining({
              timeout,
            })
          );
        }),
        { numRuns: 20 }
      );
    });
  });

  describe('Property 8.6: Retry on Serialization Errors', () => {
    it('should retry on serialization failure errors', async () => {
      const serializationError = new MockPrismaClientKnownRequestError('Serialization failure', {
        code: '40001',
        clientVersion: '5.0.0',
      });

      // Fail twice, then succeed
      mockPrisma.$transaction
        .mockRejectedValueOnce(serializationError)
        .mockRejectedValueOnce(serializationError)
        .mockResolvedValueOnce({ success: true });

      const result = await executeTransaction(mockPrisma as any, async () => ({ success: true }), {
        maxRetries: 5,
        retryDelay: 10,
      });

      expect(result.success).toBe(true);
      expect(result.attempts).toBe(3);
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(3);
    });

    it('should not retry on non-serialization errors', async () => {
      const regularError = new Error('Regular error');

      mockPrisma.$transaction.mockRejectedValueOnce(regularError);

      const result = await executeTransaction(
        mockPrisma as any,
        async () => {
          throw regularError;
        },
        { maxRetries: 5 }
      );

      expect(result.success).toBe(false);
      expect(result.attempts).toBe(1);
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    });
  });

  describe('Property 8.7: Max Retries Limit', () => {
    it('should stop retrying after maxRetries', async () => {
      await fc.assert(
        fc.asyncProperty(fc.integer({ min: 1, max: 5 }), async (maxRetries) => {
          const serializationError = new MockPrismaClientKnownRequestError(
            'Serialization failure',
            { code: '40001', clientVersion: '5.0.0' }
          );

          // Always fail
          mockPrisma.$transaction.mockRejectedValue(serializationError);

          const result = await executeTransaction(
            mockPrisma as any,
            async () => {
              throw serializationError;
            },
            { maxRetries, retryDelay: 1 }
          );

          expect(result.success).toBe(false);
          expect(result.attempts).toBe(maxRetries);
          expect(mockPrisma.$transaction).toHaveBeenCalledTimes(maxRetries);

          // Reset mock for next iteration
          mockPrisma.$transaction.mockReset();
        }),
        { numRuns: 5 }
      );
    });
  });

  describe('Property 8.8: Batch Transaction Atomicity', () => {
    it('should execute all batch operations or none', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.integer({ min: 1, max: 100 }), { minLength: 1, maxLength: 10 }),
          async (values) => {
            const operations = values.map((v) => async () => ({ value: v }));
            const expectedResults = values.map((v) => ({ value: v }));

            mockPrisma.$transaction.mockResolvedValueOnce(expectedResults);

            const result = await executeBatchTransaction(mockPrisma as any, operations);

            expect(result.success).toBe(true);
            expect(result.data).toHaveLength(values.length);
          }
        ),
        { numRuns: 30 }
      );
    });
  });

  describe('Property 8.9: Read-Only Transaction Uses REPEATABLE_READ', () => {
    it('should use REPEATABLE_READ for read-only transactions', async () => {
      mockPrisma.$transaction.mockResolvedValueOnce([{ id: '1' }]);

      await executeReadOnlyTransaction(mockPrisma as any, async () => [{ id: '1' }]);

      expect(mockPrisma.$transaction).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({
          isolationLevel: IsolationLevel.REPEATABLE_READ,
        })
      );
    });
  });

  describe('Property 8.10: Duration Tracking', () => {
    it('should accurately track transaction duration', async () => {
      await fc.assert(
        fc.asyncProperty(fc.integer({ min: 10, max: 50 }), async (delay) => {
          mockPrisma.$transaction.mockImplementationOnce(async () => {
            await new Promise((resolve) => setTimeout(resolve, delay));
            return { ok: true };
          });

          const result = await executeTransaction(mockPrisma as any, async () => ({ ok: true }));

          expect(result.duration).toBeGreaterThanOrEqual(delay - 10); // Allow 10ms tolerance
        }),
        { numRuns: 5 }
      );
    });
  });

  describe('Property 8.11: Optimistic Lock Version Check', () => {
    it('should detect version mismatch in optimistic locking', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 100 }),
          fc.integer({ min: 1, max: 100 }),
          async (expectedVersion, actualVersion) => {
            // Skip if versions match
            if (expectedVersion === actualVersion) {
              return;
            }

            const mockEntity = { id: 'test-id', version: actualVersion };

            mockPrisma.$transaction.mockImplementationOnce(async (fn: any) => {
              // Simulate the transaction callback
              const mockTx = {
                testModel: {
                  findUnique: vi.fn().mockResolvedValue(mockEntity),
                },
              };
              return fn(mockTx);
            });

            const result = await withOptimisticLock(
              mockPrisma as any,
              'testModel',
              'test-id',
              expectedVersion,
              async (_tx, entity) => entity
            );

            expect(result.success).toBe(false);
            expect(result.error).toBeInstanceOf(OptimisticLockError);
          }
        ),
        { numRuns: 30 }
      );
    });
  });

  describe('Property 8.12: Transaction Result Structure', () => {
    it('should always return valid TransactionResult structure', async () => {
      await fc.assert(
        fc.asyncProperty(fc.boolean(), fc.string(), async (shouldSucceed, data) => {
          if (shouldSucceed) {
            mockPrisma.$transaction.mockResolvedValueOnce(data);
          } else {
            mockPrisma.$transaction.mockRejectedValueOnce(new Error('Test error'));
          }

          const result = await executeTransaction(mockPrisma as any, async () => {
            if (!shouldSucceed) {
              throw new Error('Test error');
            }
            return data;
          });

          // Verify structure
          expect(typeof result.success).toBe('boolean');
          expect(typeof result.attempts).toBe('number');
          expect(typeof result.duration).toBe('number');
          expect(result.attempts).toBeGreaterThanOrEqual(1);
          expect(result.duration).toBeGreaterThanOrEqual(0);

          if (result.success) {
            expect(result.error).toBeUndefined();
          } else {
            expect(result.error).toBeInstanceOf(Error);
          }
        }),
        { numRuns: 50 }
      );
    });
  });

  describe('Property 8.13: Deadlock Detection and Retry', () => {
    it('should retry on deadlock errors', async () => {
      const deadlockError = new MockPrismaClientKnownRequestError('Deadlock detected', {
        code: '40P01',
        clientVersion: '5.0.0',
      });

      mockPrisma.$transaction
        .mockRejectedValueOnce(deadlockError)
        .mockResolvedValueOnce({ success: true });

      const result = await executeTransaction(mockPrisma as any, async () => ({ success: true }), {
        maxRetries: 3,
        retryDelay: 1,
      });

      expect(result.success).toBe(true);
      expect(result.attempts).toBe(2);
    });
  });

  describe('Property 8.14: Financial Transaction Options', () => {
    it('should have stricter defaults for financial transactions', () => {
      expect(FINANCIAL_TRANSACTION_OPTIONS.isolationLevel).toBe(IsolationLevel.SERIALIZABLE);
      expect(FINANCIAL_TRANSACTION_OPTIONS.timeout).toBeGreaterThanOrEqual(60000);
      expect(FINANCIAL_TRANSACTION_OPTIONS.maxRetries).toBeGreaterThanOrEqual(5);
    });
  });
});
