-- Gate 1: Moodian v2 data-model uplift (idempotent, non-destructive)
-- NOTE: designed to run safely on existing prod data.

-- Payments: enrich with user linkage, currency, gateway artifacts, audit
ALTER TABLE "payments"
  ADD COLUMN IF NOT EXISTS "user_id" TEXT,
  ADD COLUMN IF NOT EXISTS "currency" VARCHAR(10) DEFAULT 'IRR',
  ADD COLUMN IF NOT EXISTS "gateway_payment_url" VARCHAR(500),
  ADD COLUMN IF NOT EXISTS "gateway_response" JSONB,
  ADD COLUMN IF NOT EXISTS "gateway_transaction_id" VARCHAR(100),
  ADD COLUMN IF NOT EXISTS "completed_at" TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "description" VARCHAR(512),
  ADD COLUMN IF NOT EXISTS "created_by" TEXT,
  ADD COLUMN IF NOT EXISTS "updated_by" TEXT;

-- Backfill user_id from orders if possible
UPDATE "payments" p
SET user_id = o.user_id
FROM "orders" o
WHERE p.user_id IS NULL AND p.order_id = o.id;

-- Foreign key for user_id (nullable to avoid failure on legacy rows)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'payments_user_id_fkey'
  ) THEN
    ALTER TABLE "payments"
      ADD CONSTRAINT "payments_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END$$;

-- Payment transactions (ledger for payment/refund/chargeback)
CREATE TABLE IF NOT EXISTS "payment_transactions" (
  "id"                TEXT PRIMARY KEY,
  "payment_id"        TEXT NULL,
  "tenant_id"         TEXT NULL,
  "user_id"           TEXT NOT NULL,
  "order_id"          TEXT NOT NULL,
  "transaction_type"  VARCHAR(20) NOT NULL,
  "gateway"           "PaymentGateway" NOT NULL,
  "authority"         VARCHAR(100) UNIQUE,
  "ref_id"            VARCHAR(100),
  "card_pan"          VARCHAR(30),
  "card_hash"         VARCHAR(100),
  "fee_type"          VARCHAR(30),
  "fee"               DECIMAL(15,2),
  "amount"            DECIMAL(15,2) NOT NULL,
  "description"       VARCHAR(512),
  "mobile"            VARCHAR(20),
  "email"             VARCHAR(255),
  "callback_url"      VARCHAR(500),
  "status"            VARCHAR(30) NOT NULL,
  "error_message"     TEXT,
  "metadata"          JSONB DEFAULT '{}'::jsonb,
  "paid_at"           TIMESTAMP,
  "verified_at"       TIMESTAMP,
  "processed_at"      TIMESTAMP,
  "created_at"        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updated_at"        TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "payment_transactions_payment_id_idx" ON "payment_transactions"("payment_id");
CREATE INDEX IF NOT EXISTS "payment_transactions_order_id_idx" ON "payment_transactions"("order_id");
CREATE INDEX IF NOT EXISTS "payment_transactions_tenant_status_idx" ON "payment_transactions"("tenant_id","status");
CREATE INDEX IF NOT EXISTS "payment_transactions_created_at_idx" ON "payment_transactions"("created_at");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'payment_transactions_payment_id_fkey'
  ) THEN
    ALTER TABLE "payment_transactions"
      ADD CONSTRAINT "payment_transactions_payment_id_fkey"
      FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'payment_transactions_order_id_fkey'
  ) THEN
    ALTER TABLE "payment_transactions"
      ADD CONSTRAINT "payment_transactions_order_id_fkey"
      FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'payment_transactions_user_id_fkey'
  ) THEN
    ALTER TABLE "payment_transactions"
      ADD CONSTRAINT "payment_transactions_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;

-- Invoices: align with Moodian required fields (non-destructive)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'tax_id'
  ) THEN
    ALTER TABLE "invoices" RENAME COLUMN "tax_id" TO "seller_tax_id";
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'reference_number'
  ) THEN
    ALTER TABLE "invoices" RENAME COLUMN "reference_number" TO "moodian_reference_number";
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'discount'
  ) THEN
    ALTER TABLE "invoices" RENAME COLUMN "discount" TO "discount_amount";
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'tax_amount'
  ) THEN
    ALTER TABLE "invoices" RENAME COLUMN "tax_amount" TO "vat_amount";
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'total'
  ) THEN
    ALTER TABLE "invoices" RENAME COLUMN "total" TO "total_amount";
  END IF;
END$$;

ALTER TABLE "invoices"
  ADD COLUMN IF NOT EXISTS "payment_id" TEXT,
  ADD COLUMN IF NOT EXISTS "invoice_type" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "invoice_pattern" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "buyer_tax_id" TEXT,
  ADD COLUMN IF NOT EXISTS "buyer_postal_code" TEXT,
  ADD COLUMN IF NOT EXISTS "moodian_confirmation_reference" TEXT,
  ADD COLUMN IF NOT EXISTS "error_message" TEXT,
  ADD COLUMN IF NOT EXISTS "retry_count" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "last_retry_at" TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "invoice_date" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "jalali_date" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "electronic_sign" TEXT,
  ADD COLUMN IF NOT EXISTS "signed_at" TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "qr_code" TEXT; -- ensure present even if previously absent

-- Backfill SUID for legacy rows, then enforce NOT NULL
UPDATE "invoices"
SET suid = CONCAT('LEGACY-', replace(cast(gen_random_uuid() as text),'-',''))
WHERE suid IS NULL;

ALTER TABLE "invoices" ALTER COLUMN "suid" SET NOT NULL;

-- Foreign key from invoice to payment
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'invoices_payment_id_fkey'
  ) THEN
    ALTER TABLE "invoices"
      ADD CONSTRAINT "invoices_payment_id_fkey"
      FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END$$;

-- Invoice items (snapshot of lines)
CREATE TABLE IF NOT EXISTS "invoice_items" (
  "id"               TEXT PRIMARY KEY,
  "invoice_id"       TEXT NOT NULL,
  "product_id"       TEXT NOT NULL,
  "service_goods_id" VARCHAR(20) NOT NULL DEFAULT '001',
  "title"            TEXT NOT NULL,
  "quantity"         INTEGER NOT NULL,
  "unit_price"       DECIMAL(15,2) NOT NULL,
  "discount_amount"  DECIMAL(15,2) NOT NULL DEFAULT 0,
  "total_amount"     DECIMAL(15,2) NOT NULL,
  "vat_rate"         INTEGER NOT NULL DEFAULT 9,
  "vat_amount"       DECIMAL(15,2) NOT NULL DEFAULT 0,
  "tax_code"         VARCHAR(30),
  "created_at"       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updated_at"       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "invoice_items_invoice_id_idx" ON "invoice_items"("invoice_id");
CREATE INDEX IF NOT EXISTS "invoice_items_product_id_idx" ON "invoice_items"("product_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'invoice_items_invoice_id_fkey'
  ) THEN
    ALTER TABLE "invoice_items"
      ADD CONSTRAINT "invoice_items_invoice_id_fkey"
      FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;

-- Unique constraints (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Invoice_invoice_number_tenant_unique'
  ) THEN
    ALTER TABLE "invoices" ADD CONSTRAINT "Invoice_invoice_number_tenant_unique" UNIQUE ("invoice_number","tenant_id");
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Invoice_suid_unique'
  ) THEN
    ALTER TABLE "invoices" ADD CONSTRAINT "Invoice_suid_unique" UNIQUE ("suid");
  END IF;
END$$;

-- Backfill jalali_date roughly; downstream job can recompute precisely
UPDATE "invoices"
SET jalali_date = COALESCE(jalali_date, 0)
WHERE jalali_date IS NULL;

-- Enforce exactly-one invoice per order (idempotent issuance)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'order_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'invoices_order_unique'
  ) THEN
    ALTER TABLE "invoices" ADD CONSTRAINT "invoices_order_unique" UNIQUE ("order_id");
  END IF;
END$$;

-- Append-only audit trail with hash chaining (tamper-evident, 10y retention)
CREATE TABLE IF NOT EXISTS "invoice_audits" (
  "id"            TEXT PRIMARY KEY,
  "invoice_id"    TEXT NOT NULL,
  "event"         VARCHAR(50) NOT NULL,
  "payload"       JSONB NOT NULL,
  "prev_hash"     VARCHAR(128),
  "hash"          VARCHAR(128) NOT NULL,
  "created_at"    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "invoice_audits_invoice_id_idx" ON "invoice_audits"("invoice_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'invoice_audits_invoice_id_fkey'
  ) THEN
    ALTER TABLE "invoice_audits"
      ADD CONSTRAINT "invoice_audits_invoice_id_fkey"
      FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;

-- Row-level security policies remain unchanged (no DROP)
