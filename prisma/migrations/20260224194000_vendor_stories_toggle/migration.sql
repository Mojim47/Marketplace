-- Vendor Stories + Per-Vendor Story Capability Toggle

CREATE TABLE IF NOT EXISTS "vendors" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT,
  "phone" TEXT,
  "commission_rate" DECIMAL(5,2) NOT NULL DEFAULT 10,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "stories_enabled" BOOLEAN NOT NULL DEFAULT true,
  "story_rollout_percent" INTEGER NOT NULL DEFAULT 100,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "vendors_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "vendors"
  ADD COLUMN IF NOT EXISTS "stories_enabled" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "vendors"
  ADD COLUMN IF NOT EXISTS "story_rollout_percent" INTEGER NOT NULL DEFAULT 100;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'vendors_story_rollout_percent_range'
  ) THEN
    ALTER TABLE "vendors"
      ADD CONSTRAINT "vendors_story_rollout_percent_range"
      CHECK ("story_rollout_percent" >= 0 AND "story_rollout_percent" <= 100);
  END IF;
END $$;

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

CREATE TABLE IF NOT EXISTS "vendor_story_events" (
  "id" TEXT NOT NULL,
  "story_id" TEXT NOT NULL,
  "vendor_id" TEXT NOT NULL,
  "event_type" TEXT NOT NULL,
  "session_id" TEXT NOT NULL,
  "trace_id" TEXT,
  "meta" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "vendor_story_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "vendor_story_events_story_id_event_type_created_at_idx"
  ON "vendor_story_events" ("story_id", "event_type", "created_at");

CREATE INDEX IF NOT EXISTS "vendor_story_events_vendor_id_event_type_created_at_idx"
  ON "vendor_story_events" ("vendor_id", "event_type", "created_at");

CREATE INDEX IF NOT EXISTS "vendor_story_events_session_id_created_at_idx"
  ON "vendor_story_events" ("session_id", "created_at");

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

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'vendor_story_events_story_id_fkey'
  ) THEN
    ALTER TABLE "vendor_story_events"
      ADD CONSTRAINT "vendor_story_events_story_id_fkey"
      FOREIGN KEY ("story_id") REFERENCES "vendor_stories"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'vendor_story_events_vendor_id_fkey'
  ) THEN
    ALTER TABLE "vendor_story_events"
      ADD CONSTRAINT "vendor_story_events_vendor_id_fkey"
      FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
