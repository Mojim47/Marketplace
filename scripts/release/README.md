# Release Blueprint Contracts and Gates

This folder implements a file-only integration of the production blueprint:

- Baseline deterministic launch graph: `ops/contracts/launch-integration-graph.json`
- Immutable release contract: `ops/contracts/release-contract.json`
- Full preflight fail-closed contract: `ops/contracts/preflight-go-no-go-contract.json`
- State-machine hard-fail contract: `ops/contracts/state-machine-contract.json`

## Commands

Validate deterministic launch graph:

```bash
node scripts/release/validate-launch-graph.mjs
```

Validate hard-fail state-machine contract:

```bash
node scripts/release/validate-state-machine-contract.mjs
```

Build immutable per-module artifacts + manifest:

```bash
RELEASE_COMMIT=<40-char-sha> \
PREVIOUS_RELEASE_REF=<previous tag or sha> \
ROLLBACK_VERIFIED_AT=<ISO8601 timestamp> \
node scripts/release/build-immutable-artifacts.mjs
```

Verify release contract and manifest integrity:

```bash
RELEASE_MANIFEST_PATH=artifacts/release/manifest.json \
node scripts/release/verify-release-contract.mjs
```

Run full preflight go/no-go fail-closed gate:

```bash
PREFLIGHT_MODE=staging \
ENV_PRODUCTION_FILE=/etc/nextgen/.env.production \
DATABASE_URL=<postgres-url> \
REDIS_URL=<redis-url> \
JWT_SECRET=<min-32-chars> \
PROCESS_MANAGER=systemd \
AI_CANARY_MODEL_VERSION=<model-version> \
AI_MODEL_CANARY_PERCENT=5 \
AI_SHADOW_EVAL_REPORT_PATH=ops/assets/ai/models/shadow-eval.report.json \
node scripts/release/full-preflight-go-no-go.mjs
```

Run synthetic chaos rollback drill (expects policy failures and verifies fail-closed behavior):

```bash
node scripts/release/chaos-rollback-drill.mjs
```

Notes:
- Scripts are fail-closed: first failed check exits with non-zero.
- `build-immutable-artifacts.mjs` refuses dirty worktree unless `RELEASE_ENFORCE_CLEAN_WORKTREE=false`.
