# Gate 1 – Data Model & Persistence (Payments ↔ Invoices ↔ Moodian)  
_Status: In-progress (local branch)_  

## Scope  
- Add first-class Prisma models for `PaymentTransaction`, rich `Invoice` (Moodian-compliant) and `InvoiceItem`.  
- Enrich `Payment` with user linkage, currency, gateway metadata, and audit fields.  
- Unblock compilation/runtime by aligning service code with new schema (snake_case fields, gateway enum).  

## Acceptance Checklist  
- [ ] Prisma schema defines `PaymentTransaction` with tenant/order/user linkage, authority/ref_id, card masking fields, fee, status, metadata, timestamps.  
- [ ] Prisma schema defines `Invoice` with required SUID, invoice_type/pattern, party tax IDs, VAT amounts, retry/error fields, Jalali date, and signature slots.  
- [ ] Prisma schema defines `InvoiceItem` with VAT rate/amount, discount, and tax code.  
- [ ] Payment model links to user + retains gateway artifacts and audit.  
- [ ] Seed data updated to satisfy new required fields.  
- [ ] Payment service compiles against new schema (no camel/snake mismatches).  

## Evidence (this commit set)  
- Schema: `prisma/schema.prisma` (Payment/PaymentTransaction/Invoice/InvoiceItem)  
- Service alignment: `apps/api/src/payment/payment.service.ts` (snake_case fields, gateway enum)  
- Seed update: `prisma/seed.ts` (`user_id` backfill)  
- Migration SQL (idempotent, no drops): `prisma/migrations/20260209_gate1_moodian_v2/migration.sql`  
- Commands executed:  
  - `pnpm prisma migrate diff --from-empty --to-schema-datamodel ./prisma/schema.prisma --script > prisma/migrations/20260209_gate1_moodian_v2/migration.sql` (non-interactive env workaround)  
  - `pnpm prisma generate` (DATABASE_URL=postgresql://postgres:postgres@localhost:5544/nextgen_moodian?schema=public)  
  - Temp Postgres container `tmp-moodian-pg` spun on port 5544 and cleaned up.  
  - Note: `prisma migrate dev` in non-interactive CI is blocked; use `prisma migrate deploy` with the generated SQL for rollout.  
- Backfill safety baked into migration:  
  - `payments.user_id` auto-filled from orders when missing.  
  - `invoices.suid` legacy fill `LEGACY-<uuid>` then set NOT NULL.  
  - Column renames preserve amounts (`tax_amount`→`vat_amount`, `total`→`total_amount`, etc.).  
  - No tables dropped; new constraints added iff missing.  

## Next (before PR out)  
- Run migration in CI with PR note to use `prisma migrate deploy` (non-interactive).  
- Wire Payment→Invoice creation & SUID generation (Gate 2).  
- Add archival/RLS policies + tamper-evident storage plan.  
