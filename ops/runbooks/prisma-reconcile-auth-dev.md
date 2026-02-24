# Prisma Reconcile Runbook (auth_dev)

## Scope
This runbook recovers Prisma migration history drift for local/staging-style databases like `auth_dev` without destructive schema reset.

Incident baseline used for this runbook: February 22, 2026.

## Preconditions
- You have DB access (`psql`, `pg_dump`, `pg_restore`) and valid `DATABASE_URL`.
- Application schema is already functionally aligned with current code (only migration history is broken/drifted).
- You are **not** in a production incident where emergency writes are active.
- You can store backup files outside git workspace.

## Why Drift Happens
History drift usually means schema and migration metadata diverged. Common causes:
- migration files were force-pushed/rebased after being applied on DB
- manual DB reset or manual SQL outside Prisma flow
- bad branch merge with conflicting migration folders
- partial/failed migration attempt left `_prisma_migrations.finished_at = NULL`

## Backup Procedure
1. Create backup directory outside repository root:
```powershell
New-Item -ItemType Directory -Force C:\Users\moji\db-backups | Out-Null
```
2. Take full compressed dump:
```powershell
$ts = Get-Date -Format 'yyyyMMdd_HHmmss'
$backup = "C:\Users\moji\db-backups\auth_dev_pre_reconcile_$ts.dump"
pg_dump "postgresql://<user>:<pass>@localhost:5432/auth_dev" -Fc -f $backup
```
3. Verify backup file exists and size is non-zero.

## Drift Detection
1. Check Prisma status:
```powershell
pnpm prisma migrate status
```
2. Inspect migration table:
```sql
SELECT migration_name, started_at, finished_at, rolled_back_at, logs
FROM _prisma_migrations
ORDER BY migration_name;
```
3. Flag conditions:
- local migrations missing from DB history
- DB migrations missing from repo
- any row with `finished_at IS NULL`

## Manual Cleanup (_prisma_migrations)
Only edit metadata table, never drop business tables here.

1. Remove known drifted/foreign/failed metadata rows:
```sql
DELETE FROM _prisma_migrations
WHERE migration_name IN (
  '<foreign_or_broken_migration_1>',
  '<foreign_or_broken_migration_2>'
);
```
2. Confirm table state:
```sql
SELECT migration_name, finished_at, rolled_back_at
FROM _prisma_migrations
ORDER BY migration_name;
```

## `resolve --applied` Strategy
Use this when schema objects already exist and you only need to align history.

Run for each migration present in repo baseline:
```powershell
pnpm prisma migrate resolve --applied 20241229000001_ultra_fast_7_layer_init
pnpm prisma migrate resolve --applied 20241230000001_payment_moodian_integration
pnpm prisma migrate resolve --applied 20241230000002_add_performance_indexes
pnpm prisma migrate resolve --applied 20260207_add_payment_order_id_index
```

Important:
- `resolve --applied` marks metadata only, it does not execute SQL migration scripts.
- Do not use this if schema is truly missing required objects.

## Validation Commands
Run all:
```powershell
pnpm prisma migrate status
pnpm db:migrate:deploy
pnpm prisma:generate:prod
pnpm build:ci
```

Expected:
- `Database schema is up to date!`
- `No pending migrations to apply.`
- CI/build pipeline green.

## Rollback Strategy
If reconcile result is wrong:
1. Stop app processes writing to DB.
2. Drop and recreate target DB:
```sql
DROP DATABASE auth_dev;
CREATE DATABASE auth_dev;
```
3. Restore backup:
```powershell
pg_restore -d "postgresql://<user>:<pass>@localhost:5432/auth_dev" "C:\Users\moji\db-backups\auth_dev_pre_reconcile_<timestamp>.dump"
```
4. Re-run drift detection and validate.

## Red Flags
- Running `prisma migrate deploy` directly while drift is unresolved.
- Using `--dry-run` with `prisma migrate deploy` (unsupported option).
- Deleting migration folders from repo after they were applied somewhere.
- Committing DB dumps into git.
- Using `prisma migrate reset` on shared/non-ephemeral environments.

