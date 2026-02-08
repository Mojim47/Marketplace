/**
 * ═══════════════════════════════════════════════════════════════════════════
 * NextGen Marketplace - Financial Transaction Manager
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Enterprise-grade ACID transaction management for financial operations.
 * Ensures atomicity, consistency, isolation, and durability for all
 * financial transactions including payments, refunds, and transfers.
 *
 * Features:
 * - ACID compliance with PostgreSQL transactions
 * - Automatic rollback on failure
 * - Balance validation before operations
 * - Audit trail for all transactions
 * - Idempotency support
 *
 * @module @nextgen/payment
 */

import { v4 as uuidv4 } from 'uuid';
import { PaymentInvariantEnforcer } from '@nextgen/errors';

// ═══════════════════════════════════════════════════════════════════════════
// Types and Interfaces
// ═══════════════════════════════════════════════════════════════════════════

export type TransactionType =
  | 'PAYMENT'
  | 'REFUND'
  | 'TRANSFER'
  | 'CREDIT_ADJUSTMENT'
  | 'DEBIT_ADJUSTMENT'
  | 'COMMISSION'
  | 'WITHDRAWAL';

export type TransactionStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'ROLLED_BACK';

export interface Account {
  id: string;
  balance: number;
  currency: string;
  type: 'USER' | 'VENDOR' | 'PLATFORM' | 'ESCROW';
  ownerId: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface TransactionEntry {
  accountId: string;
  amount: number;
  type: 'DEBIT' | 'CREDIT';
  description: string;
}

export interface FinancialTransaction {
  id: string;
  type: TransactionType;
  status: TransactionStatus;
  entries: TransactionEntry[];
  totalAmount: number;
  currency: string;
  referenceId?: string;
  referenceType?: string;
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
  errorMessage?: string;
  createdAt: Date;
  completedAt?: Date;
  rolledBackAt?: Date;
}

export interface CreateTransactionDto {
  type: TransactionType;
  entries: TransactionEntry[];
  currency: string;
  referenceId?: string;
  referenceType?: string;
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
}

export interface TransactionResult {
  success: boolean;
  transaction: FinancialTransaction;
  error?: string;
  balancesBefore?: Map<string, number>;
  balancesAfter?: Map<string, number>;
}

export interface PrismaClient {
  $queryRaw<T = unknown>(query: TemplateStringsArray, ...values: unknown[]): Promise<T>;
  $executeRaw(query: TemplateStringsArray, ...values: unknown[]): Promise<number>;
  $transaction<T>(
    fn: (tx: PrismaTransaction) => Promise<T>,
    options?: { isolationLevel?: string }
  ): Promise<T>;
}

export interface PrismaTransaction {
  $queryRaw<T = unknown>(query: TemplateStringsArray, ...values: unknown[]): Promise<T>;
  $executeRaw(query: TemplateStringsArray, ...values: unknown[]): Promise<number>;
}

// ═══════════════════════════════════════════════════════════════════════════
// Transaction Manager
// ═══════════════════════════════════════════════════════════════════════════

export class TransactionManager {
  constructor(private prisma: PrismaClient) {}

  /**
   * Execute a financial transaction with ACID guarantees
   *
   * Property 8: Financial Transaction ACID
   * For any financial transaction, if any step fails, the entire transaction
   * should be rolled back and account balances should remain unchanged.
   */
  async executeTransaction(dto: CreateTransactionDto): Promise<TransactionResult> {
    // Check idempotency
    if (dto.idempotencyKey) {
      const existing = await this.findByIdempotencyKey(dto.idempotencyKey);
      if (existing) {
        return {
          success: existing.status === 'COMPLETED',
          transaction: existing,
          error: existing.status === 'FAILED' ? existing.errorMessage : undefined,
        };
      }
    }

    // Validate entries
    const validationError = this.validateEntries(dto.entries);
    if (validationError) {
      const failedTx = await this.createFailedTransaction(dto, validationError);
      return {
        success: false,
        transaction: failedTx,
        error: validationError,
      };
    }

    const transactionId = uuidv4();
    const balancesBefore = new Map<string, number>();
    const balancesAfter = new Map<string, number>();

    try {
      // Execute within a serializable transaction for maximum isolation
      const result = await this.prisma.$transaction(
        async (tx) => {
          // 1. Create transaction record in PROCESSING state
          const now = new Date();
          const totalAmount = dto.entries
            .filter((e) => e.type === 'DEBIT')
            .reduce((sum, e) => sum + e.amount, 0);

          await tx.$executeRaw`
          INSERT INTO financial_transactions (
            id, type, status, total_amount, currency,
            reference_id, reference_type, idempotency_key,
            metadata, created_at, updated_at
          ) VALUES (
            ${transactionId}::uuid,
            ${dto.type},
            'PROCESSING',
            ${totalAmount},
            ${dto.currency},
            ${dto.referenceId ?? null},
            ${dto.referenceType ?? null},
            ${dto.idempotencyKey ?? null},
            ${JSON.stringify(dto.metadata ?? {})}::jsonb,
            ${now},
            ${now}
          )
        `;

          // 2. Lock and validate all accounts (SELECT FOR UPDATE)
          const accountIds = [...new Set(dto.entries.map((e) => e.accountId))];

          for (const accountId of accountIds) {
            const accounts = await tx.$queryRaw<Account[]>`
            SELECT id, balance, currency, type, owner_id as "ownerId", version,
                   created_at as "createdAt", updated_at as "updatedAt"
            FROM accounts
            WHERE id = ${accountId}::uuid
            FOR UPDATE
          `;

            if (accounts.length === 0) {
              throw new Error(`حساب با شناسه ${accountId} یافت نشد`);
            }

            const account = accounts[0];
            balancesBefore.set(accountId, account.balance);

            // Validate currency matches
            if (account.currency !== dto.currency) {
              throw new Error(`ارز حساب ${accountId} با ارز تراکنش مطابقت ندارد`);
            }
          }

          // 3. Validate sufficient balance for debits
          for (const entry of dto.entries) {
            if (entry.type === 'DEBIT') {
              const currentBalance = balancesBefore.get(entry.accountId) ?? 0;
              if (currentBalance < entry.amount) {
                throw new Error(
                  `موجودی حساب ${entry.accountId} کافی نیست. موجودی: ${currentBalance}، مبلغ درخواستی: ${entry.amount}`
                );
              }
            }
          }

          // 4. Apply all entries atomically
          for (const entry of dto.entries) {
            const delta = entry.type === 'CREDIT' ? entry.amount : -entry.amount;

            await tx.$executeRaw`
            UPDATE accounts
            SET balance = balance + ${delta},
                version = version + 1,
                updated_at = NOW()
            WHERE id = ${entry.accountId}::uuid
          `;

            // Record entry
            await tx.$executeRaw`
            INSERT INTO transaction_entries (
              id, transaction_id, account_id, amount, type, description, created_at
            ) VALUES (
              ${uuidv4()}::uuid,
              ${transactionId}::uuid,
              ${entry.accountId}::uuid,
              ${entry.amount},
              ${entry.type},
              ${entry.description},
              NOW()
            )
          `;
          }

          // 5. Verify final balances and record them
          for (const accountId of accountIds) {
            const accounts = await tx.$queryRaw<Account[]>`
            SELECT id, balance FROM accounts WHERE id = ${accountId}::uuid
          `;

            if (accounts.length > 0) {
              balancesAfter.set(accountId, accounts[0].balance);

              // Verify no negative balance
              if (accounts[0].balance < 0) {
                throw new Error(`موجودی حساب ${accountId} منفی شده است`);
              }
            }
          }

          // 6. Mark transaction as completed
          await tx.$executeRaw`
          UPDATE financial_transactions
          SET status = 'COMPLETED',
              completed_at = NOW(),
              updated_at = NOW()
          WHERE id = ${transactionId}::uuid
        `;

          // 7. Log audit event
          await this.logAudit(tx, transactionId, 'COMPLETED', {
            type: dto.type,
            totalAmount,
            entries: dto.entries.length,
          });

          return {
            id: transactionId,
            type: dto.type,
            status: 'COMPLETED' as TransactionStatus,
            entries: dto.entries,
            totalAmount,
            currency: dto.currency,
            referenceId: dto.referenceId,
            referenceType: dto.referenceType,
            idempotencyKey: dto.idempotencyKey,
            metadata: dto.metadata,
            createdAt: now,
            completedAt: new Date(),
          };
        },
        { isolationLevel: 'Serializable' }
      );

      return {
        success: true,
        transaction: result,
        balancesBefore,
        balancesAfter,
      };
    } catch (error) {
      // Transaction automatically rolled back by Prisma
      const errorMessage = error instanceof Error ? error.message : 'خطای ناشناخته';

      // Record failed transaction
      const failedTx = await this.recordFailedTransaction(transactionId, dto, errorMessage);

      return {
        success: false,
        transaction: failedTx,
        error: errorMessage,
        balancesBefore,
        balancesAfter: balancesBefore, // Balances unchanged due to rollback
      };
    }
  }

  /**
   * Get account balance
   */
  async getAccountBalance(accountId: string): Promise<number | null> {
    const accounts = await this.prisma.$queryRaw<Account[]>`
      SELECT balance FROM accounts WHERE id = ${accountId}::uuid
    `;

    return accounts.length > 0 ? accounts[0].balance : null;
  }

  /**
   * Get transaction by ID
   */
  async getTransaction(transactionId: string): Promise<FinancialTransaction | null> {
    const transactions = await this.prisma.$queryRaw<
      Array<{
        id: string;
        type: TransactionType;
        status: TransactionStatus;
        total_amount: number;
        currency: string;
        reference_id: string | null;
        reference_type: string | null;
        idempotency_key: string | null;
        metadata: Record<string, unknown>;
        error_message: string | null;
        created_at: Date;
        completed_at: Date | null;
        rolled_back_at: Date | null;
      }>
    >`
      SELECT * FROM financial_transactions WHERE id = ${transactionId}::uuid
    `;

    if (transactions.length === 0) return null;

    const tx = transactions[0];
    const entries = await this.getTransactionEntries(transactionId);

    return {
      id: tx.id,
      type: tx.type,
      status: tx.status,
      entries,
      totalAmount: tx.total_amount,
      currency: tx.currency,
      referenceId: tx.reference_id ?? undefined,
      referenceType: tx.reference_type ?? undefined,
      idempotencyKey: tx.idempotency_key ?? undefined,
      metadata: tx.metadata,
      errorMessage: tx.error_message ?? undefined,
      createdAt: tx.created_at,
      completedAt: tx.completed_at ?? undefined,
      rolledBackAt: tx.rolled_back_at ?? undefined,
    };
  }

  /**
   * Verify transaction integrity - check that debits equal credits
   */
  verifyTransactionBalance(entries: TransactionEntry[]): boolean {
    const totalDebits = entries
      .filter((e) => e.type === 'DEBIT')
      .reduce((sum, e) => sum + e.amount, 0);

    const totalCredits = entries
      .filter((e) => e.type === 'CREDIT')
      .reduce((sum, e) => sum + e.amount, 0);

    return Math.abs(totalDebits - totalCredits) < 0.01;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Private Methods
  // ═══════════════════════════════════════════════════════════════════════════

  private validateEntries(entries: TransactionEntry[]): string | null {
    if (!entries || entries.length === 0) {
      return 'تراکنش باید حداقل یک ورودی داشته باشد';
    }

    for (const entry of entries) {
      if (!entry.accountId) {
        return 'شناسه حساب الزامی است';
      }
      // INV-PAY-004: Amount Positivity
      try {
        PaymentInvariantEnforcer.verifyAmountPositivity(entry.amount);
      } catch {
        return 'مبلغ باید بزرگتر از صفر باشد';
      }
      if (!['DEBIT', 'CREDIT'].includes(entry.type)) {
        return 'نوع ورودی باید DEBIT یا CREDIT باشد';
      }
    }

    // INV-PAY-001: Verify double-entry balance
    try {
      PaymentInvariantEnforcer.verifyDoubleEntryBalance(entries);
    } catch {
      return 'مجموع بدهکار و بستانکار باید برابر باشد';
    }

    return null;
  }

  private async findByIdempotencyKey(key: string): Promise<FinancialTransaction | null> {
    const transactions = await this.prisma.$queryRaw<
      Array<{
        id: string;
        type: TransactionType;
        status: TransactionStatus;
        total_amount: number;
        currency: string;
        reference_id: string | null;
        reference_type: string | null;
        idempotency_key: string | null;
        metadata: Record<string, unknown>;
        error_message: string | null;
        created_at: Date;
        completed_at: Date | null;
        rolled_back_at: Date | null;
      }>
    >`
      SELECT * FROM financial_transactions WHERE idempotency_key = ${key}
    `;

    if (transactions.length === 0) return null;

    const tx = transactions[0];
    const entries = await this.getTransactionEntries(tx.id);

    return {
      id: tx.id,
      type: tx.type,
      status: tx.status,
      entries,
      totalAmount: tx.total_amount,
      currency: tx.currency,
      referenceId: tx.reference_id ?? undefined,
      referenceType: tx.reference_type ?? undefined,
      idempotencyKey: tx.idempotency_key ?? undefined,
      metadata: tx.metadata,
      errorMessage: tx.error_message ?? undefined,
      createdAt: tx.created_at,
      completedAt: tx.completed_at ?? undefined,
      rolledBackAt: tx.rolled_back_at ?? undefined,
    };
  }

  private async getTransactionEntries(transactionId: string): Promise<TransactionEntry[]> {
    const entries = await this.prisma.$queryRaw<
      Array<{
        account_id: string;
        amount: number;
        type: 'DEBIT' | 'CREDIT';
        description: string;
      }>
    >`
      SELECT account_id, amount, type, description
      FROM transaction_entries
      WHERE transaction_id = ${transactionId}::uuid
    `;

    return entries.map((e) => ({
      accountId: e.account_id,
      amount: e.amount,
      type: e.type,
      description: e.description,
    }));
  }

  private async createFailedTransaction(
    dto: CreateTransactionDto,
    errorMessage: string
  ): Promise<FinancialTransaction> {
    const transactionId = uuidv4();
    const now = new Date();
    const totalAmount = dto.entries
      .filter((e) => e.type === 'DEBIT')
      .reduce((sum, e) => sum + e.amount, 0);

    await this.prisma.$executeRaw`
      INSERT INTO financial_transactions (
        id, type, status, total_amount, currency,
        reference_id, reference_type, idempotency_key,
        metadata, error_message, created_at, updated_at
      ) VALUES (
        ${transactionId}::uuid,
        ${dto.type},
        'FAILED',
        ${totalAmount},
        ${dto.currency},
        ${dto.referenceId ?? null},
        ${dto.referenceType ?? null},
        ${dto.idempotencyKey ?? null},
        ${JSON.stringify(dto.metadata ?? {})}::jsonb,
        ${errorMessage},
        ${now},
        ${now}
      )
    `;

    return {
      id: transactionId,
      type: dto.type,
      status: 'FAILED',
      entries: dto.entries,
      totalAmount,
      currency: dto.currency,
      referenceId: dto.referenceId,
      referenceType: dto.referenceType,
      idempotencyKey: dto.idempotencyKey,
      metadata: dto.metadata,
      errorMessage,
      createdAt: now,
    };
  }

  private async recordFailedTransaction(
    transactionId: string,
    dto: CreateTransactionDto,
    errorMessage: string
  ): Promise<FinancialTransaction> {
    const now = new Date();
    const totalAmount = dto.entries
      .filter((e) => e.type === 'DEBIT')
      .reduce((sum, e) => sum + e.amount, 0);

    // Try to update existing or create new
    try {
      await this.prisma.$executeRaw`
        UPDATE financial_transactions
        SET status = 'FAILED',
            error_message = ${errorMessage},
            rolled_back_at = NOW(),
            updated_at = NOW()
        WHERE id = ${transactionId}::uuid
      `;
    } catch {
      // If update fails, create new record
      await this.prisma.$executeRaw`
        INSERT INTO financial_transactions (
          id, type, status, total_amount, currency,
          reference_id, reference_type, idempotency_key,
          metadata, error_message, created_at, updated_at
        ) VALUES (
          ${transactionId}::uuid,
          ${dto.type},
          'FAILED',
          ${totalAmount},
          ${dto.currency},
          ${dto.referenceId ?? null},
          ${dto.referenceType ?? null},
          ${dto.idempotencyKey ?? null},
          ${JSON.stringify(dto.metadata ?? {})}::jsonb,
          ${errorMessage},
          ${now},
          ${now}
        )
      `;
    }

    return {
      id: transactionId,
      type: dto.type,
      status: 'FAILED',
      entries: dto.entries,
      totalAmount,
      currency: dto.currency,
      referenceId: dto.referenceId,
      referenceType: dto.referenceType,
      idempotencyKey: dto.idempotencyKey,
      metadata: dto.metadata,
      errorMessage,
      createdAt: now,
      rolledBackAt: now,
    };
  }

  private async logAudit(
    tx: PrismaTransaction,
    transactionId: string,
    action: string,
    data: Record<string, unknown>
  ): Promise<void> {
    try {
      await tx.$executeRaw`
        INSERT INTO audit_logs (action, resource, resource_id, new_value, created_at)
        VALUES ('FINANCIAL_TX_${action}', 'financial_transaction', ${transactionId}, ${JSON.stringify(data)}::jsonb, NOW())
      `;
    } catch (error) {
      console.error('Failed to log audit event:', error);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Factory Function
// ═══════════════════════════════════════════════════════════════════════════

export function createTransactionManager(prisma: PrismaClient): TransactionManager {
  return new TransactionManager(prisma);
}

// ═══════════════════════════════════════════════════════════════════════════
// Pure Functions for Testing (No Database Dependencies)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Calculate new balances after applying transaction entries
 * Pure function for property-based testing
 */
export function calculateBalancesAfterTransaction(
  initialBalances: Map<string, number>,
  entries: TransactionEntry[]
): Map<string, number> {
  const newBalances = new Map(initialBalances);

  for (const entry of entries) {
    const currentBalance = newBalances.get(entry.accountId) ?? 0;
    const delta = entry.type === 'CREDIT' ? entry.amount : -entry.amount;
    newBalances.set(entry.accountId, currentBalance + delta);
  }

  return newBalances;
}

/**
 * Check if a transaction would result in negative balances
 * Pure function for property-based testing
 */
export function wouldResultInNegativeBalance(
  initialBalances: Map<string, number>,
  entries: TransactionEntry[]
): boolean {
  const newBalances = calculateBalancesAfterTransaction(initialBalances, entries);

  for (const [, balance] of newBalances) {
    if (balance < 0) return true;
  }

  return false;
}

/**
 * Verify that total debits equal total credits
 * Pure function for property-based testing
 */
export function verifyDoubleEntry(entries: TransactionEntry[]): boolean {
  const totalDebits = entries
    .filter((e) => e.type === 'DEBIT')
    .reduce((sum, e) => sum + e.amount, 0);

  const totalCredits = entries
    .filter((e) => e.type === 'CREDIT')
    .reduce((sum, e) => sum + e.amount, 0);

  return Math.abs(totalDebits - totalCredits) < 0.01;
}

/**
 * Simulate a transaction and return the result
 * Pure function for property-based testing
 */
export function simulateTransaction(
  initialBalances: Map<string, number>,
  entries: TransactionEntry[]
): {
  success: boolean;
  finalBalances: Map<string, number>;
  error?: string;
} {
  // Validate double-entry
  if (!verifyDoubleEntry(entries)) {
    return {
      success: false,
      finalBalances: initialBalances,
      error: 'مجموع بدهکار و بستانکار باید برابر باشد',
    };
  }

  // Check for negative balances
  if (wouldResultInNegativeBalance(initialBalances, entries)) {
    return {
      success: false,
      finalBalances: initialBalances,
      error: 'موجودی کافی نیست',
    };
  }

  // Calculate new balances
  const finalBalances = calculateBalancesAfterTransaction(initialBalances, entries);

  return {
    success: true,
    finalBalances,
  };
}

export default {
  TransactionManager,
  createTransactionManager,
  calculateBalancesAfterTransaction,
  wouldResultInNegativeBalance,
  verifyDoubleEntry,
  simulateTransaction,
};
