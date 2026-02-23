#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is required" >&2
  exit 1
fi

echo "[db-drift-runtime] comparing live DB against prisma/schema.prisma"
pnpm exec prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel prisma/schema.prisma --exit-code

echo "[db-drift-runtime] no drift detected"
