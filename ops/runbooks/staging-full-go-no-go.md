# Full Staging Go/No-Go Runbook

## Scope
- Environment: `staging`
- Goal: deterministic validation of AI/AR rollout with fail-closed gates
- Decision rule: `ANY FAIL => NO-GO`

## 1. Preflight
1. Set required env vars:
```bash
export ARTIFACT_REF=<git_sha_or_tag>
export ARTIFACT_IMAGE=<image:tag_or_digest>
export DATABASE_URL=<...>
export REDIS_URL=<...>
export JWT_SECRET=<min_32_chars>
export PROCESS_MANAGER=<systemd|pm2>
```
2. Verify immutable artifact manifest:
```bash
ARTIFACT_MANIFEST_PATH=artifacts/manifest.json \
ARTIFACT_EXPECT_COMMIT="$ARTIFACT_REF" \
node scripts/ai/verify-artifact-manifest.mjs
```
3. Verify health probes:
```bash
curl -fsS http://127.0.0.1:4000/health/live >/dev/null
curl -fsS http://127.0.0.1:4000/health/ready >/dev/null
```
4. Verify initial shadow/drift gate:
```bash
node scripts/ai/shadow-eval-gate.mjs
```

## 2. Canary Deployment
1. Enable model canary (5-10% only):
```bash
AI_CANARY_MODEL_VERSION=<canary_version> \
AI_CANARY_TRAFFIC_PERCENT=5 \
node scripts/ai/canary-model-rollout.mjs
```
2. Ensure runtime canary/shadow envs are set in staging app:
```bash
AI_MODEL_CANARY_PERCENT=5
AI_SHADOW_DRIFT_THRESHOLD=0.45
AI_DRIFT_FAIL_CLOSED=true
AI_AUTO_ROLLBACK_SCRIPT_PATH=scripts/ai/auto-rollback-model.mjs
```

## 3. Traffic Simulation
1. Run full staging gate (includes synthetic real traffic):
```bash
ARTIFACT_REF="$ARTIFACT_REF" \
ARTIFACT_IMAGE="$ARTIFACT_IMAGE" \
CANARY_PERCENT=5 \
API_BASE_URL=http://127.0.0.1:4000 \
bash ops/scripts/staging-full-go-no-go.sh
```
2. Metrics to validate after run:
- RED rate: `http_requests_total`, `http_request_duration_seconds`
- AI: `ai_inference_total`, `ai_inference_latency_seconds`, `ai_shadow_eval_total`, `ai_drift_score`
- AR: `ar_overlay_latency_seconds`, `ar_overlay_guard_events_total`

## 4. Rollback Verification
1. Force synthetic drift breach:
- `staging-full-go-no-go.sh` already performs this check.
2. Confirm rollback changed active version:
```bash
cat ops/assets/ai/models/rollout.registry.json
```
3. Confirm rollback logs/metrics:
- `ai.search.auto.rollback.executed` in logs
- `increase(ai_auto_rollback_total[10m]) > 0`

## 5. Metrics + Alerts Check
1. Check alert rules exist and are loaded:
- `AIInferenceLatencySLAExceeded`
- `AIShadowDriftDetected`
- `AIAutoRollbackTriggered`
- `AROverlayLatencySLAExceeded`
2. Validate Grafana dashboard:
- `monitoring/grafana/dashboards/nextgen-ai-ar-slo-dashboard.json`
3. Confirm telemetry ingest path (AR):
- `POST /metrics/ar/telemetry`

## 6. Immutable Artifact Check
1. Re-verify digest + manifest before promotion:
```bash
ARTIFACT_MANIFEST_PATH=artifacts/manifest.json \
ARTIFACT_EXPECT_COMMIT="$ARTIFACT_REF" \
node scripts/ai/verify-artifact-manifest.mjs
```
2. Ensure deploy references immutable artifact only:
- image digest/tag pinned
- no fallback artifact path

## 7. Final Decision
1. `GO` only if all below are green:
- Preflight pass
- Canary pass (5-10%)
- Traffic simulation pass
- Rollback verification pass
- Metrics/alerts pass
- Immutable artifact verification pass
2. `NO-GO` on any failed check:
- stop rollout
- keep/restore stable model
- open incident + attach logs/metrics snapshot

## Quick Command
```bash
ARTIFACT_REF=<sha> \
ARTIFACT_IMAGE=<image@sha256:...> \
CANARY_PERCENT=5 \
API_BASE_URL=http://127.0.0.1:4000 \
bash ops/scripts/staging-full-go-no-go.sh
```
