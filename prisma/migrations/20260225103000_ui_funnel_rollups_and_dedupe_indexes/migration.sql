-- UI telemetry hardening: dedupe-friendly indexes + rollup tables for admin analytics

CREATE INDEX IF NOT EXISTS "idx_system_events_ui_surface_time"
ON "system_events" ("tenant_id", "event_type", "entity_id", "occurred_at" DESC)
WHERE "event_type" LIKE 'ui:%';

CREATE INDEX IF NOT EXISTS "idx_system_events_ui_session_dedupe_time"
ON "system_events" (
  "tenant_id",
  "event_type",
  "occurred_at" DESC,
  (COALESCE("data"->>'sessionId', '')),
  (COALESCE("data"->>'dedupeKey', ''))
)
WHERE "event_type" LIKE 'ui:%';

CREATE TABLE IF NOT EXISTS "ui_funnel_event_rollups" (
  "bucket_date" DATE NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "surface" TEXT NOT NULL,
  "event_type" TEXT NOT NULL,
  "event_count" BIGINT NOT NULL DEFAULT 0,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ui_funnel_event_rollups_pkey"
    PRIMARY KEY ("bucket_date", "tenant_id", "surface", "event_type")
);

CREATE TABLE IF NOT EXISTS "ui_funnel_surface_sessions" (
  "bucket_date" DATE NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "surface" TEXT NOT NULL,
  "session_id" TEXT NOT NULL,
  "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ui_funnel_surface_sessions_pkey"
    PRIMARY KEY ("bucket_date", "tenant_id", "surface", "session_id")
);

CREATE INDEX IF NOT EXISTS "idx_ui_funnel_rollups_surface_date"
ON "ui_funnel_event_rollups" ("surface", "bucket_date" DESC);

CREATE INDEX IF NOT EXISTS "idx_ui_funnel_rollups_tenant_date"
ON "ui_funnel_event_rollups" ("tenant_id", "bucket_date" DESC);

CREATE INDEX IF NOT EXISTS "idx_ui_funnel_sessions_surface_date"
ON "ui_funnel_surface_sessions" ("surface", "bucket_date" DESC);

CREATE INDEX IF NOT EXISTS "idx_ui_funnel_sessions_tenant_date"
ON "ui_funnel_surface_sessions" ("tenant_id", "bucket_date" DESC);
