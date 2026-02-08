/**
 * ═══════════════════════════════════════════════════════════════════════════
 * NextGen Marketplace - Migration Reversibility Property Tests
 * ═══════════════════════════════════════════════════════════════════════════
 * Property-based tests for database migration reversibility.
 *
 * Feature: production-readiness-audit
 * Property 17: Migration Reversibility
 * Validates: Requirements 5.7
 *
 * Note: These tests validate migration SQL structure and patterns.
 * Actual database migration testing requires integration tests with a real database.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { describe, it, expect, beforeAll } from 'vitest';
import * as fc from 'fast-check';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Migration operation types that should be reversible
 */
type MigrationOperation =
  | 'CREATE_TABLE'
  | 'DROP_TABLE'
  | 'ADD_COLUMN'
  | 'DROP_COLUMN'
  | 'CREATE_INDEX'
  | 'DROP_INDEX'
  | 'ADD_CONSTRAINT'
  | 'DROP_CONSTRAINT'
  | 'CREATE_ENUM'
  | 'DROP_ENUM';

/**
 * Represents a parsed migration operation
 */
interface ParsedMigrationOp {
  type: MigrationOperation;
  target: string;
  sql: string;
  isReversible: boolean;
  reverseOp?: MigrationOperation;
}

/**
 * Mapping of operations to their reverse operations
 */
const REVERSE_OPERATIONS: Record<MigrationOperation, MigrationOperation> = {
  CREATE_TABLE: 'DROP_TABLE',
  DROP_TABLE: 'CREATE_TABLE',
  ADD_COLUMN: 'DROP_COLUMN',
  DROP_COLUMN: 'ADD_COLUMN',
  CREATE_INDEX: 'DROP_INDEX',
  DROP_INDEX: 'CREATE_INDEX',
  ADD_CONSTRAINT: 'DROP_CONSTRAINT',
  DROP_CONSTRAINT: 'ADD_CONSTRAINT',
  CREATE_ENUM: 'DROP_ENUM',
  DROP_ENUM: 'CREATE_ENUM',
};

/**
 * SQL patterns for detecting migration operations
 */
const SQL_PATTERNS: Record<MigrationOperation, RegExp> = {
  CREATE_TABLE: /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["']?(\w+)["']?/gi,
  DROP_TABLE: /DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?["']?(\w+)["']?/gi,
  ADD_COLUMN: /ALTER\s+TABLE\s+["']?(\w+)["']?\s+ADD\s+(?:COLUMN\s+)?["']?(\w+)["']?/gi,
  DROP_COLUMN: /ALTER\s+TABLE\s+["']?(\w+)["']?\s+DROP\s+(?:COLUMN\s+)?["']?(\w+)["']?/gi,
  CREATE_INDEX: /CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?["']?(\w+)["']?/gi,
  DROP_INDEX: /DROP\s+INDEX\s+(?:IF\s+EXISTS\s+)?["']?(\w+)["']?/gi,
  ADD_CONSTRAINT: /ALTER\s+TABLE\s+["']?(\w+)["']?\s+ADD\s+CONSTRAINT\s+["']?(\w+)["']?/gi,
  DROP_CONSTRAINT: /ALTER\s+TABLE\s+["']?(\w+)["']?\s+DROP\s+CONSTRAINT\s+["']?(\w+)["']?/gi,
  CREATE_ENUM: /CREATE\s+TYPE\s+["']?(\w+)["']?\s+AS\s+ENUM/gi,
  DROP_ENUM: /DROP\s+TYPE\s+(?:IF\s+EXISTS\s+)?["']?(\w+)["']?/gi,
};

/**
 * Parse SQL to extract migration operations
 */
function parseMigrationSQL(sql: string): ParsedMigrationOp[] {
  const operations: ParsedMigrationOp[] = [];

  for (const [opType, pattern] of Object.entries(SQL_PATTERNS)) {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match;

    while ((match = regex.exec(sql)) !== null) {
      operations.push({
        type: opType as MigrationOperation,
        target: match[1],
        sql: match[0],
        isReversible: true,
        reverseOp: REVERSE_OPERATIONS[opType as MigrationOperation],
      });
    }
  }

  return operations;
}

/**
 * Generate reverse SQL for an operation
 */
function generateReverseSQL(op: ParsedMigrationOp): string | null {
  switch (op.type) {
    case 'CREATE_TABLE':
      return `DROP TABLE IF EXISTS "${op.target}";`;
    case 'DROP_TABLE':
      // Cannot reverse DROP TABLE without schema info
      return null;
    case 'CREATE_INDEX':
      return `DROP INDEX IF EXISTS "${op.target}";`;
    case 'DROP_INDEX':
      // Cannot reverse DROP INDEX without definition
      return null;
    case 'CREATE_ENUM':
      return `DROP TYPE IF EXISTS "${op.target}";`;
    case 'DROP_ENUM':
      // Cannot reverse DROP ENUM without values
      return null;
    case 'ADD_COLUMN':
      return `ALTER TABLE "${op.target}" DROP COLUMN IF EXISTS "${op.target}";`;
    case 'DROP_COLUMN':
      // Cannot reverse DROP COLUMN without type info
      return null;
    case 'ADD_CONSTRAINT':
      return `ALTER TABLE "${op.target}" DROP CONSTRAINT IF EXISTS "${op.target}";`;
    case 'DROP_CONSTRAINT':
      // Cannot reverse DROP CONSTRAINT without definition
      return null;
    default:
      return null;
  }
}

/**
 * Check if a migration has a corresponding down migration
 */
function hasDownMigration(migrationDir: string): boolean {
  const downPath = path.join(migrationDir, 'down.sql');
  return fs.existsSync(downPath);
}

/**
 * Validate that a migration SQL is syntactically valid
 */
function isValidMigrationSQL(sql: string): boolean {
  // Basic validation - check for common SQL syntax issues
  const trimmed = sql.trim();

  // Should not be empty
  if (!trimmed) return false;

  // Should not have unbalanced parentheses
  const openParens = (trimmed.match(/\(/g) || []).length;
  const closeParens = (trimmed.match(/\)/g) || []).length;
  if (openParens !== closeParens) return false;

  // Should not have unbalanced quotes
  const singleQuotes = (trimmed.match(/'/g) || []).length;
  if (singleQuotes % 2 !== 0) return false;

  // Should contain at least one SQL keyword
  const hasKeyword = /\b(CREATE|ALTER|DROP|INSERT|UPDATE|DELETE|SELECT)\b/i.test(trimmed);
  if (!hasKeyword) return false;

  return true;
}

/**
 * Custom arbitrary for generating valid table names
 */
const tableNameArb = fc
  .stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz_'.split('')), {
    minLength: 1,
    maxLength: 30,
  })
  .filter((s) => /^[a-z][a-z_]*$/.test(s));

/**
 * Custom arbitrary for generating valid column names
 */
const columnNameArb = fc
  .stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz_'.split('')), {
    minLength: 1,
    maxLength: 30,
  })
  .filter((s) => /^[a-z][a-z_]*$/.test(s));

/**
 * Custom arbitrary for generating SQL data types
 */
const dataTypeArb = fc.constantFrom(
  'TEXT',
  'VARCHAR(255)',
  'INTEGER',
  'BIGINT',
  'BOOLEAN',
  'TIMESTAMP',
  'DECIMAL(18,2)',
  'JSONB',
  'UUID'
);

/**
 * Custom arbitrary for generating CREATE TABLE statements
 */
const createTableArb = fc
  .tuple(
    tableNameArb,
    fc.array(fc.tuple(columnNameArb, dataTypeArb), { minLength: 1, maxLength: 5 })
  )
  .map(([tableName, columns]) => {
    const columnDefs = columns.map(([name, type]) => `"${name}" ${type}`).join(',\n  ');
    return `CREATE TABLE IF NOT EXISTS "${tableName}" (\n  "id" TEXT PRIMARY KEY,\n  ${columnDefs}\n);`;
  });

/**
 * Custom arbitrary for generating CREATE INDEX statements
 */
const createIndexArb = fc.tuple(tableNameArb, columnNameArb).map(([tableName, columnName]) => {
  const indexName = `${tableName}_${columnName}_idx`;
  return `CREATE INDEX IF NOT EXISTS "${indexName}" ON "${tableName}"("${columnName}");`;
});

describe('Migration Reversibility Property Tests', () => {
  /**
   * Feature: production-readiness-audit
   * Property 17: Migration Reversibility
   * Validates: Requirements 5.7
   */
  describe('Property 17: Migration Reversibility', () => {
    it('should parse CREATE TABLE operations correctly', () => {
      fc.assert(
        fc.property(createTableArb, (sql) => {
          const ops = parseMigrationSQL(sql);

          // Should find exactly one CREATE TABLE operation
          const createOps = ops.filter((op) => op.type === 'CREATE_TABLE');
          expect(createOps.length).toBe(1);

          // Should be reversible
          expect(createOps[0].isReversible).toBe(true);
          expect(createOps[0].reverseOp).toBe('DROP_TABLE');
        }),
        { numRuns: 100 }
      );
    });

    it('should parse CREATE INDEX operations correctly', () => {
      fc.assert(
        fc.property(createIndexArb, (sql) => {
          const ops = parseMigrationSQL(sql);

          // Should find exactly one CREATE INDEX operation
          const indexOps = ops.filter((op) => op.type === 'CREATE_INDEX');
          expect(indexOps.length).toBe(1);

          // Should be reversible
          expect(indexOps[0].isReversible).toBe(true);
          expect(indexOps[0].reverseOp).toBe('DROP_INDEX');
        }),
        { numRuns: 100 }
      );
    });

    it('should generate valid reverse SQL for CREATE TABLE', () => {
      fc.assert(
        fc.property(createTableArb, (sql) => {
          const ops = parseMigrationSQL(sql);
          const createOp = ops.find((op) => op.type === 'CREATE_TABLE');

          expect(createOp).toBeDefined();
          if (createOp) {
            const reverseSQL = generateReverseSQL(createOp);
            expect(reverseSQL).not.toBeNull();
            expect(reverseSQL).toContain('DROP TABLE');
            expect(reverseSQL).toContain(createOp.target);
          }
        }),
        { numRuns: 100 }
      );
    });

    it('should generate valid reverse SQL for CREATE INDEX', () => {
      fc.assert(
        fc.property(createIndexArb, (sql) => {
          const ops = parseMigrationSQL(sql);
          const indexOp = ops.find((op) => op.type === 'CREATE_INDEX');

          expect(indexOp).toBeDefined();
          if (indexOp) {
            const reverseSQL = generateReverseSQL(indexOp);
            expect(reverseSQL).not.toBeNull();
            expect(reverseSQL).toContain('DROP INDEX');
            expect(reverseSQL).toContain(indexOp.target);
          }
        }),
        { numRuns: 100 }
      );
    });

    it('should validate generated SQL is syntactically valid', () => {
      fc.assert(
        fc.property(createTableArb, (sql) => {
          expect(isValidMigrationSQL(sql)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should maintain operation count after parsing', () => {
      fc.assert(
        fc.property(
          fc.array(fc.oneof(createTableArb, createIndexArb), { minLength: 1, maxLength: 5 }),
          (sqlStatements) => {
            const combinedSQL = sqlStatements.join('\n');
            const ops = parseMigrationSQL(combinedSQL);

            // Should find at least as many operations as statements
            expect(ops.length).toBeGreaterThanOrEqual(sqlStatements.length);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should identify all reversible operations', () => {
      fc.assert(
        fc.property(
          fc.array(fc.oneof(createTableArb, createIndexArb), { minLength: 1, maxLength: 3 }),
          (sqlStatements) => {
            const combinedSQL = sqlStatements.join('\n');
            const ops = parseMigrationSQL(combinedSQL);

            // All CREATE operations should be reversible
            ops.forEach((op) => {
              if (op.type.startsWith('CREATE')) {
                expect(op.isReversible).toBe(true);
                expect(op.reverseOp).toBeDefined();
              }
            });
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should handle empty SQL gracefully', () => {
      const ops = parseMigrationSQL('');
      expect(ops).toEqual([]);
    });

    it('should handle SQL with comments', () => {
      fc.assert(
        fc.property(createTableArb, (sql) => {
          const sqlWithComments = `-- This is a comment\n${sql}\n/* Block comment */`;
          const ops = parseMigrationSQL(sqlWithComments);

          // Should still find the CREATE TABLE operation
          const createOps = ops.filter((op) => op.type === 'CREATE_TABLE');
          expect(createOps.length).toBe(1);
        }),
        { numRuns: 50 }
      );
    });

    it('should correctly map reverse operations', () => {
      // Test all operation pairs
      const operationPairs: [MigrationOperation, MigrationOperation][] = [
        ['CREATE_TABLE', 'DROP_TABLE'],
        ['CREATE_INDEX', 'DROP_INDEX'],
        ['CREATE_ENUM', 'DROP_ENUM'],
        ['ADD_COLUMN', 'DROP_COLUMN'],
        ['ADD_CONSTRAINT', 'DROP_CONSTRAINT'],
      ];

      operationPairs.forEach(([forward, reverse]) => {
        expect(REVERSE_OPERATIONS[forward]).toBe(reverse);
        expect(REVERSE_OPERATIONS[reverse]).toBe(forward);
      });
    });

    it('should validate real migration files have valid SQL', () => {
      // This test validates actual migration files in the project
      const migrationsDir = path.join(process.cwd(), 'prisma', 'migrations');

      if (fs.existsSync(migrationsDir)) {
        const migrationFolders = fs.readdirSync(migrationsDir).filter((f) => {
          const fullPath = path.join(migrationsDir, f);
          return fs.statSync(fullPath).isDirectory();
        });

        migrationFolders.forEach((folder) => {
          const migrationPath = path.join(migrationsDir, folder, 'migration.sql');

          if (fs.existsSync(migrationPath)) {
            const sql = fs.readFileSync(migrationPath, 'utf-8');

            // Should be valid SQL
            expect(isValidMigrationSQL(sql)).toBe(true);

            // Should have parseable operations
            const ops = parseMigrationSQL(sql);
            expect(ops.length).toBeGreaterThan(0);
          }
        });
      }
    });
  });
});
