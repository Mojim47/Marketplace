-- Add index for payments.order_id
CREATE INDEX IF NOT EXISTS "payments_order_id_idx" ON "payments" ("order_id");
