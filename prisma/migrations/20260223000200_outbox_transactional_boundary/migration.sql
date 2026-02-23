CREATE TABLE IF NOT EXISTS outbox_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aggregate_type TEXT NOT NULL,
  aggregate_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  dedup_key VARCHAR(191) NOT NULL UNIQUE,
  trace_id VARCHAR(128) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 5,
  available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ NULL,
  last_error TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS outbox_messages_status_available_at_idx
  ON outbox_messages (status, available_at);

CREATE INDEX IF NOT EXISTS outbox_messages_trace_id_idx
  ON outbox_messages (trace_id);

