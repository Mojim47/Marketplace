# GitHub Environment Secrets Template (Staging/Prod)

این سند naming یکدست و deterministic برای secrets ارائه می‌دهد و mapping کامل به preflight/runtime را مشخص می‌کند.

## Canonical Naming Convention

فرمت کلیدها:

`NG_<ENV>_<DOMAIN>_<KEY>`

- `<ENV>`: `STAGING` یا `PROD`
- `<DOMAIN>`: `RUNTIME` یا `DEPLOY` یا `OBS`
- `<KEY>`: نام کلید

## Required Secret Set (Canonical)

### Runtime
- `NG_<ENV>_RUNTIME_ENV_PRODUCTION_FILE`
- `NG_<ENV>_RUNTIME_DATABASE_URL`
- `NG_<ENV>_RUNTIME_REDIS_URL`
- `NG_<ENV>_RUNTIME_API_PORT`
- `NG_<ENV>_RUNTIME_JWT_SECRET`
- `NG_<ENV>_RUNTIME_LOG_FORMAT` (must be `json`)

### Deploy
- `NG_<ENV>_DEPLOY_PROCESS_MANAGER` (`systemd` or `pm2`)
- `NG_<ENV>_DEPLOY_SYSTEMD_UNIT` (if systemd)
- `NG_<ENV>_DEPLOY_PM2_APP` (if pm2)
- `NG_<ENV>_DEPLOY_PM2_CONFIG` (pm2 fallback)

### Observability / Health
- `NG_<ENV>_OBS_API_BASE_URL`
- `NG_<ENV>_OBS_API_HEALTH_LIVE_URL`
- `NG_<ENV>_OBS_API_HEALTH_READY_URL`

## Mapping to Contract Checks

| Contract Check | Secret |
|---|---|
| `check ARTIFACT_REF` | runtime-provided from workflow (`github.sha` or tag) |
| `check ARTIFACT_IMAGE` | runtime-provided from workflow image ref |
| `check ENV_PRODUCTION_FILE exists` | `NG_<ENV>_RUNTIME_ENV_PRODUCTION_FILE` |
| `check DATABASE_URL connectivity` | `NG_<ENV>_RUNTIME_DATABASE_URL` |
| `check REDIS_URL connectivity` | `NG_<ENV>_RUNTIME_REDIS_URL` |
| `check JWT_SECRET presence` | `NG_<ENV>_RUNTIME_JWT_SECRET` |
| `check PROCESS_MANAGER readiness` | `NG_<ENV>_DEPLOY_PROCESS_MANAGER` + unit/app keys |
| live/ready probes | `NG_<ENV>_OBS_API_HEALTH_LIVE_URL`, `NG_<ENV>_OBS_API_HEALTH_READY_URL` |

## Legacy Compatibility

Workflow فعلی همچنان alias قدیمی را هم قبول می‌کند:

- `ENV_PRODUCTION_FILE`
- `DATABASE_URL`
- `REDIS_URL`
- `API_PORT`
- `JWT_SECRET`
- `LOG_FORMAT`
- `PROCESS_MANAGER`
- `SYSTEMD_UNIT`
- `PM2_APP`
- `PM2_CONFIG`
- `API_BASE_URL`
- `API_HEALTH_LIVE_URL`
- `API_HEALTH_READY_URL`

پیشنهاد: برای deterministic governance فقط canonical keys را نگه دارید و aliasها را به‌تدریج حذف کنید.

## Template Files

- `ops/templates/secrets/staging.github-secrets.template.env`
- `ops/templates/secrets/production.github-secrets.template.env`

