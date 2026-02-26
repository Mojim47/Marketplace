#!/usr/bin/env bash
set -euo pipefail

log() { echo "[staging-go-no-go] $*"; }
fail() { echo "[staging-go-no-go][fatal] $*" >&2; exit 1; }
require_cmd() { command -v "$1" >/dev/null 2>&1 || fail "missing required command: $1"; }
resolve_cmd() {
  local base="$1"
  if command -v "$base" >/dev/null 2>&1; then
    echo "$base"
    return 0
  fi
  if command -v "${base}.exe" >/dev/null 2>&1; then
    echo "${base}.exe"
    return 0
  fi
  return 1
}
NODE_BIN="${NODE_BIN:-$(resolve_cmd node || true)}"

ARTIFACT_REF="${ARTIFACT_REF:-}"
ARTIFACT_IMAGE="${ARTIFACT_IMAGE:-}"
ARTIFACT_MANIFEST_PATH="${ARTIFACT_MANIFEST_PATH:-artifacts/manifest.json}"
API_BASE_URL="${API_BASE_URL:-http://127.0.0.1:4000}"
METRICS_URL="${METRICS_URL:-${API_BASE_URL}/metrics}"
CANARY_PERCENT="${CANARY_PERCENT:-5}"
CANARY_MODEL_VERSION="${CANARY_MODEL_VERSION:-2026.02.23-canary}"
TRAFFIC_USERS="${TRAFFIC_USERS:-12}"
REQUESTS_PER_USER="${REQUESTS_PER_USER:-25}"
AI_SHADOW_DRIFT_THRESHOLD="${AI_SHADOW_DRIFT_THRESHOLD:-0.45}"
ROLLOUT_REGISTRY_PATH="${ROLLOUT_REGISTRY_PATH:-ops/assets/ai/models/rollout.registry.json}"
SHADOW_REPORT_PATH="${SHADOW_REPORT_PATH:-ops/assets/ai/models/shadow-eval.report.json}"

assert_canary_percent() {
  [[ "$CANARY_PERCENT" =~ ^[0-9]+$ ]] || fail "CANARY_PERCENT must be an integer"
  if [ "$CANARY_PERCENT" -lt 5 ] || [ "$CANARY_PERCENT" -gt 10 ]; then
    fail "CANARY_PERCENT must be between 5 and 10 for staging full go/no-go"
  fi
}

run_preflight_contract() {
  require_cmd bash
  log "running staging preflight contract gate"
  ARTIFACT_REF="$ARTIFACT_REF" \
  ARTIFACT_IMAGE="$ARTIFACT_IMAGE" \
  ARTIFACT_MANIFEST_PATH="$ARTIFACT_MANIFEST_PATH" \
  ARTIFACT_MANIFEST_REQUIRED="true" \
  bash ops/scripts/staging-preflight-contract.sh
}

enable_canary_rollout() {
  log "enabling AI canary rollout at ${CANARY_PERCENT}%"
  [ -n "$NODE_BIN" ] || fail "missing required command: node"
  AI_CANARY_MODEL_VERSION="$CANARY_MODEL_VERSION" \
  AI_CANARY_TRAFFIC_PERCENT="$CANARY_PERCENT" \
  AI_MODEL_ROLLOUT_REGISTRY="$ROLLOUT_REGISTRY_PATH" \
  "$NODE_BIN" scripts/ai/canary-model-rollout.mjs
}

generate_real_traffic() {
  log "generating staging traffic users=${TRAFFIC_USERS} requests_per_user=${REQUESTS_PER_USER}"
  local pids=()
  for user in $(seq 1 "$TRAFFIC_USERS"); do
    (
      for req in $(seq 1 "$REQUESTS_PER_USER"); do
        trace_id="staging-u${user}-r${req}-$(date +%s%N)"
        curl -fsS "${API_BASE_URL}/health/live" \
          -H "x-trace-id: ${trace_id}" >/dev/null || true
        curl -fsS "${API_BASE_URL}/api/ai-search?query=laptop" \
          -H "x-trace-id: ${trace_id}" >/dev/null || true
        curl -fsS "${API_BASE_URL}/api/ai-search?query=watch" \
          -H "x-trace-id: ${trace_id}" >/dev/null || true
      done
    ) &
    pids+=("$!")
  done
  for pid in "${pids[@]}"; do
    wait "$pid"
  done
}

collect_metrics_snapshot() {
  local out_file="$1"
  curl -fsS "$METRICS_URL" > "$out_file"
  log "metrics snapshot written: $out_file"
}

assert_runtime_metrics() {
  local metrics_file="$1"
  grep -q "ai_inference_total" "$metrics_file" || fail "missing ai_inference_total metric"
  grep -q "ai_shadow_eval_total" "$metrics_file" || fail "missing ai_shadow_eval_total metric"
  grep -q "ai_drift_score_bucket" "$metrics_file" || fail "missing ai_drift_score histogram"
  grep -q "ar_overlay_latency_seconds_bucket" "$metrics_file" || fail "missing ar_overlay_latency histogram"
}

verify_shadow_gate() {
  log "running shadow eval gate with threshold=${AI_SHADOW_DRIFT_THRESHOLD}"
  [ -n "$NODE_BIN" ] || fail "missing required command: node"
  AI_SHADOW_EVAL_REPORT_PATH="$SHADOW_REPORT_PATH" \
  AI_SHADOW_DRIFT_THRESHOLD="$AI_SHADOW_DRIFT_THRESHOLD" \
  AI_AUTO_ROLLBACK_ON_DRIFT="false" \
  "$NODE_BIN" scripts/ai/shadow-eval-gate.mjs
}

verify_real_rollback_on_breach() {
  [ -n "$NODE_BIN" ] || fail "missing required command: node"
  [ -f "$ROLLOUT_REGISTRY_PATH" ] || fail "rollout registry missing: $ROLLOUT_REGISTRY_PATH"
  [ -f "$SHADOW_REPORT_PATH" ] || fail "shadow report missing: $SHADOW_REPORT_PATH"

  log "verifying real rollback path with synthetic breach"
  local tmp_registry tmp_report
  tmp_registry="$(mktemp)"
  tmp_report="$(mktemp)"
  cp "$ROLLOUT_REGISTRY_PATH" "$tmp_registry"
  cp "$SHADOW_REPORT_PATH" "$tmp_report"

  cleanup() {
    cp "$tmp_registry" "$ROLLOUT_REGISTRY_PATH" || true
    cp "$tmp_report" "$SHADOW_REPORT_PATH" || true
    rm -f "$tmp_registry" "$tmp_report"
  }
  trap cleanup EXIT

  "$NODE_BIN" -e "const fs=require('fs');const p='$SHADOW_REPORT_PATH';const j=JSON.parse(fs.readFileSync(p,'utf8'));j.averageDrift=0.91;j.maxDrift=0.97;fs.writeFileSync(p,JSON.stringify(j,null,2));"

  local before after
  before="$("$NODE_BIN" -e "const fs=require('fs');const j=JSON.parse(fs.readFileSync('$ROLLOUT_REGISTRY_PATH','utf8'));console.log(j.activeModelVersion)")"
  set +e
  AI_SHADOW_EVAL_REPORT_PATH="$SHADOW_REPORT_PATH" \
  AI_AUTO_ROLLBACK_ON_DRIFT="true" \
  AI_AUTO_ROLLBACK_SCRIPT_PATH="scripts/ai/auto-rollback-model.mjs" \
  AI_MODEL_ROLLOUT_REGISTRY="$ROLLOUT_REGISTRY_PATH" \
  "$NODE_BIN" scripts/ai/shadow-eval-gate.mjs
  local gate_exit=$?
  set -e
  [ "$gate_exit" -ne 0 ] || fail "shadow gate must fail on synthetic drift breach"

  after="$("$NODE_BIN" -e "const fs=require('fs');const j=JSON.parse(fs.readFileSync('$ROLLOUT_REGISTRY_PATH','utf8'));console.log(j.activeModelVersion)")"
  if [ "$before" = "$after" ]; then
    fail "rollback verification failed: activeModelVersion did not change on breach"
  fi
  log "rollback verified: ${before} -> ${after}"
}

main() {
  require_cmd curl
  require_cmd node

  [ -n "$ARTIFACT_REF" ] || fail "ARTIFACT_REF is required"
  [ -n "$ARTIFACT_IMAGE" ] || fail "ARTIFACT_IMAGE is required"
  assert_canary_percent

  run_preflight_contract
  enable_canary_rollout
  collect_metrics_snapshot "/tmp/metrics-before.prom"
  generate_real_traffic
  collect_metrics_snapshot "/tmp/metrics-after.prom"
  assert_runtime_metrics "/tmp/metrics-after.prom"
  verify_shadow_gate
  verify_real_rollback_on_breach

  log "FULL STAGING GO/NO-GO PASSED"
}

main "$@"
