#!/usr/bin/env bash
set -euo pipefail

if [[ "${FREEZE_MODE:-true}" != "true" ]]; then
  echo "[freeze] FREEZE_MODE=false, skipping freeze enforcement."
  exit 0
fi

if [[ "${FREEZE_OVERRIDE:-false}" == "true" ]]; then
  echo "[freeze] FREEZE_OVERRIDE=true, skipping freeze enforcement."
  exit 0
fi

BASE_REF="${1:-origin/main}"

if ! git rev-parse --verify "${BASE_REF}" >/dev/null 2>&1; then
  echo "[freeze] base ref ${BASE_REF} not found. fetching..."
  git fetch origin main --depth=1
fi

changed="$(git diff --name-only "${BASE_REF}"...HEAD)"
if [[ -z "${changed}" ]]; then
  echo "[freeze] no changed files."
  exit 0
fi

blocked_regex='^(package\.json|pnpm-lock\.yaml|prisma/schema\.prisma|prisma/migrations/)'
blocked="$(echo "${changed}" | grep -E "${blocked_regex}" || true)"

if [[ -n "${blocked}" ]]; then
  echo "[freeze] blocked files changed during freeze:"
  echo "${blocked}"
  exit 1
fi

echo "[freeze] passed."
