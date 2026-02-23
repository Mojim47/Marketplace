-- Taxonomy L1/L2/L3 metadata and search suggestions persistence

ALTER TABLE "categories"
  ADD COLUMN IF NOT EXISTS "level" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "sort_order" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "is_featured" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "categories_parent_id_level_sort_order_idx"
  ON "categories"("parent_id", "level", "sort_order");

UPDATE "categories" c
SET "level" = CASE
  WHEN c."parent_id" IS NULL THEN 1
  WHEN p."parent_id" IS NULL THEN 2
  ELSE 3
END
FROM "categories" p
LEFT JOIN "categories" gp ON gp."id" = p."parent_id"
WHERE c."parent_id" = p."id";

UPDATE "categories"
SET "level" = 1
WHERE "parent_id" IS NULL;

CREATE TABLE IF NOT EXISTS "search_suggestion_history" (
  "id" TEXT NOT NULL,
  "visitor_id" VARCHAR(64) NOT NULL,
  "query" VARCHAR(120) NOT NULL,
  "normalized_query" VARCHAR(120) NOT NULL,
  "category_id" TEXT,
  "searched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "search_suggestion_history_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "search_suggestion_trends" (
  "id" TEXT NOT NULL,
  "query" VARCHAR(120) NOT NULL,
  "normalized_query" VARCHAR(120) NOT NULL,
  "category_id" TEXT,
  "hits" INTEGER NOT NULL DEFAULT 1,
  "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "search_suggestion_trends_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "search_suggestion_history_visitor_id_searched_at_idx"
  ON "search_suggestion_history"("visitor_id", "searched_at");

CREATE INDEX IF NOT EXISTS "search_suggestion_history_normalized_query_idx"
  ON "search_suggestion_history"("normalized_query");

CREATE INDEX IF NOT EXISTS "search_suggestion_history_category_id_idx"
  ON "search_suggestion_history"("category_id");

CREATE UNIQUE INDEX IF NOT EXISTS "search_suggestion_trends_normalized_query_category_id_key"
  ON "search_suggestion_trends"("normalized_query", "category_id");

CREATE INDEX IF NOT EXISTS "search_suggestion_trends_hits_last_seen_at_idx"
  ON "search_suggestion_trends"("hits", "last_seen_at");

CREATE INDEX IF NOT EXISTS "search_suggestion_trends_category_id_last_seen_at_idx"
  ON "search_suggestion_trends"("category_id", "last_seen_at");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'search_suggestion_history_category_id_fkey'
  ) THEN
    ALTER TABLE "search_suggestion_history"
      ADD CONSTRAINT "search_suggestion_history_category_id_fkey"
      FOREIGN KEY ("category_id") REFERENCES "categories"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'search_suggestion_trends_category_id_fkey'
  ) THEN
    ALTER TABLE "search_suggestion_trends"
      ADD CONSTRAINT "search_suggestion_trends_category_id_fkey"
      FOREIGN KEY ("category_id") REFERENCES "categories"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
