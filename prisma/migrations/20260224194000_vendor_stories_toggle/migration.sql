-- Vendor Stories + Per-Vendor Story Capability Toggle

CREATE TABLE IF NOT EXISTS "vendors" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT,
  "phone" TEXT,
  "commission_rate" DECIMAL(5,2) NOT NULL DEFAULT 10,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "stories_enabled" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "vendors_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "vendors"
  ADD COLUMN IF NOT EXISTS "stories_enabled" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS "vendor_stories" (
  "id" TEXT NOT NULL,
  "vendor_id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "media_url" TEXT NOT NULL,
  "caption" TEXT,
  "cta_label" TEXT,
  "cta_url" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "vendor_stories_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "vendor_stories_vendor_id_is_active_expires_at_idx"
  ON "vendor_stories" ("vendor_id", "is_active", "expires_at");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'vendor_stories_vendor_id_fkey'
  ) THEN
    ALTER TABLE "vendor_stories"
      ADD CONSTRAINT "vendor_stories_vendor_id_fkey"
      FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
