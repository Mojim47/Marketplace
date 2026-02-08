-- â•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گ
-- Payment & Moodian Integration Migration
-- â•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گ

-- Add payment-related columns to existing tables
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "payment_status" TEXT DEFAULT 'PENDING';
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "payment_method" TEXT;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "buyer_tax_id" TEXT;

-- Create Payment table
CREATE TABLE IF NOT EXISTS "payments" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'IRR',
    "gateway" TEXT NOT NULL DEFAULT 'zarinpal',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "description" TEXT NOT NULL,
    "gateway_transaction_id" TEXT,
    "gateway_reference_id" TEXT,
    "gateway_payment_url" TEXT,
    "gateway_response" JSONB,
    "error_message" TEXT,
    "generate_invoice" BOOLEAN NOT NULL DEFAULT false,
    "invoice_data" JSONB,
    "metadata" JSONB,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT NOT NULL,
    "updated_by" TEXT NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- Ensure payments table has required columns when it already exists
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "user_id" TEXT;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "currency" TEXT DEFAULT 'IRR';
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "description" TEXT DEFAULT '';
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "gateway_transaction_id" TEXT;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "gateway_reference_id" TEXT;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "gateway_payment_url" TEXT;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "gateway_response" JSONB;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "error_message" TEXT;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "generate_invoice" BOOLEAN DEFAULT false;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "invoice_data" JSONB;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "completed_at" TIMESTAMP(3);

-- Create Invoice table for Moodian integration
CREATE TABLE IF NOT EXISTS "invoices" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "payment_id" TEXT,
    "order_id" TEXT NOT NULL,
    "invoice_number" TEXT NOT NULL,
    "suid" TEXT NOT NULL, -- Systematic Unique Invoice Identifier
    "invoice_type" INTEGER NOT NULL DEFAULT 1, -- 1=Sale, 2=Purchase, etc.
    "invoice_pattern" INTEGER NOT NULL DEFAULT 1, -- 1=Normal, 2=Draft, etc.
    "seller_tax_id" TEXT NOT NULL,
    "buyer_tax_id" TEXT,
    "buyer_postal_code" TEXT,
    "total_amount" INTEGER NOT NULL,
    "vat_amount" INTEGER NOT NULL DEFAULT 0,
    "discount_amount" INTEGER NOT NULL DEFAULT 0,
    "invoice_date" TIMESTAMP(3) NOT NULL,
    "jalali_date" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT', -- DRAFT, SENT, CONFIRMED, REJECTED
    "moodian_reference_number" TEXT,
    "moodian_fiscal_id" TEXT,
    "moodian_confirmation_reference" TEXT,
    "moodian_response" JSONB,
    "error_message" TEXT,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "last_retry_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT NOT NULL,
    "updated_by" TEXT NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- Create InvoiceItem table
CREATE TABLE IF NOT EXISTS "invoice_items" (
    "id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "service_goods_id" TEXT NOT NULL DEFAULT '001',
    "title" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_price" INTEGER NOT NULL,
    "discount_amount" INTEGER NOT NULL DEFAULT 0,
    "total_amount" INTEGER NOT NULL,
    "vat_rate" INTEGER NOT NULL DEFAULT 9, -- 9% VAT
    "vat_amount" INTEGER NOT NULL DEFAULT 0,
    "tax_code" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvoiceItem_pkey" PRIMARY KEY ("id")
);

-- Create PaymentTransaction table for detailed transaction tracking
CREATE TABLE IF NOT EXISTS "payment_transactions" (
    "id" TEXT NOT NULL,
    "payment_id" TEXT NOT NULL,
    "transaction_type" TEXT NOT NULL, -- PAYMENT, REFUND, CHARGEBACK
    "amount" INTEGER NOT NULL,
    "gateway" TEXT NOT NULL,
    "gateway_transaction_id" TEXT,
    "gateway_reference_id" TEXT,
    "status" TEXT NOT NULL,
    "gateway_response" JSONB,
    "processed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentTransaction_pkey" PRIMARY KEY ("id")
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS "Payment_tenant_id_idx" ON "payments"("tenant_id");
CREATE INDEX IF NOT EXISTS "Payment_user_id_idx" ON "payments"("user_id");
CREATE INDEX IF NOT EXISTS "Payment_order_id_idx" ON "payments"("order_id");
CREATE INDEX IF NOT EXISTS "Payment_status_idx" ON "payments"("status");
CREATE INDEX IF NOT EXISTS "Payment_gateway_transaction_id_idx" ON "payments"("gateway_transaction_id");
CREATE INDEX IF NOT EXISTS "Payment_created_at_idx" ON "payments"("created_at");

CREATE INDEX IF NOT EXISTS "Invoice_tenant_id_idx" ON "invoices"("tenant_id");
CREATE INDEX IF NOT EXISTS "Invoice_payment_id_idx" ON "invoices"("payment_id");
CREATE INDEX IF NOT EXISTS "Invoice_order_id_idx" ON "invoices"("order_id");
CREATE INDEX IF NOT EXISTS "Invoice_suid_idx" ON "invoices"("suid");
CREATE INDEX IF NOT EXISTS "Invoice_status_idx" ON "invoices"("status");
CREATE INDEX IF NOT EXISTS "Invoice_moodian_reference_number_idx" ON "invoices"("moodian_reference_number");
CREATE INDEX IF NOT EXISTS "Invoice_created_at_idx" ON "invoices"("created_at");

CREATE INDEX IF NOT EXISTS "InvoiceItem_invoice_id_idx" ON "invoice_items"("invoice_id");
CREATE INDEX IF NOT EXISTS "InvoiceItem_product_id_idx" ON "invoice_items"("product_id");

CREATE INDEX IF NOT EXISTS "PaymentTransaction_payment_id_idx" ON "payment_transactions"("payment_id");
CREATE INDEX IF NOT EXISTS "PaymentTransaction_status_idx" ON "payment_transactions"("status");
CREATE INDEX IF NOT EXISTS "PaymentTransaction_created_at_idx" ON "payment_transactions"("created_at");

-- Add foreign key constraints
ALTER TABLE "payments" ADD CONSTRAINT "Payment_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payments" ADD CONSTRAINT "Payment_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payments" ADD CONSTRAINT "Payment_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "invoices" ADD CONSTRAINT "Invoice_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "invoices" ADD CONSTRAINT "Invoice_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "invoices" ADD CONSTRAINT "Invoice_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "invoice_items" ADD CONSTRAINT "InvoiceItem_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "invoice_items" ADD CONSTRAINT "InvoiceItem_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payment_transactions" ADD CONSTRAINT "PaymentTransaction_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add unique constraints
ALTER TABLE "payments" ADD CONSTRAINT "Payment_gateway_transaction_id_unique" UNIQUE ("gateway_transaction_id");
ALTER TABLE "invoices" ADD CONSTRAINT "Invoice_suid_unique" UNIQUE ("suid");
ALTER TABLE "invoices" ADD CONSTRAINT "Invoice_invoice_number_tenant_unique" UNIQUE ("invoice_number", "tenant_id");

-- Add check constraints
ALTER TABLE "payments" ADD CONSTRAINT "Payment_amount_positive" CHECK ("amount" > 0);
ALTER TABLE "payments" ADD CONSTRAINT "Payment_status_valid" CHECK ("status" IN ('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED'));
ALTER TABLE "payments" ADD CONSTRAINT "Payment_gateway_valid" CHECK ("gateway" IN ('zarinpal', 'mellat', 'parsian', 'saderat'));

ALTER TABLE "invoices" ADD CONSTRAINT "Invoice_total_amount_positive" CHECK ("total_amount" > 0);
ALTER TABLE "invoices" ADD CONSTRAINT "Invoice_status_valid" CHECK ("status" IN ('DRAFT', 'SENT', 'CONFIRMED', 'REJECTED', 'CANCELLED'));
ALTER TABLE "invoices" ADD CONSTRAINT "Invoice_invoice_type_valid" CHECK ("invoice_type" IN (1, 2, 3, 4, 5, 6, 7, 8, 9));

ALTER TABLE "invoice_items" ADD CONSTRAINT "InvoiceItem_quantity_positive" CHECK ("quantity" > 0);
ALTER TABLE "invoice_items" ADD CONSTRAINT "InvoiceItem_unit_price_positive" CHECK ("unit_price" > 0);
ALTER TABLE "invoice_items" ADD CONSTRAINT "InvoiceItem_total_amount_positive" CHECK ("total_amount" > 0);

ALTER TABLE "payment_transactions" ADD CONSTRAINT "PaymentTransaction_transaction_type_valid" CHECK ("transaction_type" IN ('PAYMENT', 'REFUND', 'CHARGEBACK'));
ALTER TABLE "payment_transactions" ADD CONSTRAINT "PaymentTransaction_status_valid" CHECK ("status" IN ('PENDING', 'COMPLETED', 'FAILED', 'CANCELLED'));

-- Add RLS policies for multi-tenant security
ALTER TABLE "payments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "invoices" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "invoice_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payment_transactions" ENABLE ROW LEVEL SECURITY;

-- Payment RLS policies
CREATE POLICY "payment_tenant_isolation" ON "payments"
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true));

CREATE POLICY "payment_user_access" ON "payments"
    FOR SELECT USING (
        tenant_id = current_setting('app.current_tenant_id', true) AND
        (user_id = current_setting('app.current_user_id', true) OR 
         current_setting('app.current_user_roles', true)::text[] && ARRAY['ADMIN', 'SELLER'])
    );

-- Invoice RLS policies
CREATE POLICY "invoice_tenant_isolation" ON "invoices"
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true));

-- InvoiceItem RLS policies
CREATE POLICY "invoice_item_tenant_isolation" ON "invoice_items"
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM "invoices" 
            WHERE "invoices"."id" = "invoice_items"."invoice_id" 
            AND "invoices"."tenant_id" = current_setting('app.current_tenant_id', true)
        )
    );

-- PaymentTransaction RLS policies
CREATE POLICY "payment_transaction_tenant_isolation" ON "payment_transactions"
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM "payments" 
            WHERE "payments"."id" = "payment_transactions"."payment_id" 
            AND "payments"."tenant_id" = current_setting('app.current_tenant_id', true)
        )
    );

-- Add triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_payment_updated_at BEFORE UPDATE ON "payments"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_invoice_updated_at BEFORE UPDATE ON "invoices"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_invoice_item_updated_at BEFORE UPDATE ON "invoice_items"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE "payments" IS 'Payment transactions for orders with gateway integration';
COMMENT ON TABLE "invoices" IS 'Electronic invoices for Moodian tax authority integration';
COMMENT ON TABLE "invoice_items" IS 'Line items for invoices with tax calculations';
COMMENT ON TABLE "payment_transactions" IS 'Detailed transaction log for payments and refunds';

COMMENT ON COLUMN "invoices"."suid" IS 'Systematic Unique Invoice Identifier for Moodian';
COMMENT ON COLUMN "invoices"."jalali_date" IS 'Invoice date in Jalali calendar format (YYYYMMDD)';
COMMENT ON COLUMN "invoices"."moodian_reference_number" IS 'Reference number returned by Moodian tax authority';
COMMENT ON COLUMN "invoice_items"."vat_rate" IS 'VAT rate in percentage (e.g., 9 for 9%)';

-- Insert initial data for testing (only in development)
-- This would be handled by seed scripts in production
