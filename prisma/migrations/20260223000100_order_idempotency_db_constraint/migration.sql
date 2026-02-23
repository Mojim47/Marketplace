-- Elite Level 3: DB-level idempotency for order creation
ALTER TABLE "orders"
ADD COLUMN IF NOT EXISTS "idempotency_key" VARCHAR(128);

CREATE UNIQUE INDEX IF NOT EXISTS "orders_user_id_idempotency_key_key"
ON "orders"("user_id", "idempotency_key")
WHERE "idempotency_key" IS NOT NULL;
