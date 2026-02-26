# Staging Environment Contract Checklist

هدف: قبل از اجرای `pnpm deploy:go-no-go` تمام قراردادهای immutable artifact، secrets، runtime و connectivity به شکل fail-closed تایید شوند.

## 1) GitHub Secrets Contract

این مقادیر باید در repository/environment secrets تعریف شوند:

| Secret | Required | مصرف |
|---|---|---|
| `ENV_PRODUCTION_FILE` | Yes | مسیر فایل env روی host (مثل `/etc/nextgen/.env.production`) |
| `DATABASE_URL` | Yes | اتصال PostgreSQL برای backup/restore/migrations/sanity |
| `REDIS_URL` | Yes | اتصال Redis برای persistence و health |
| `JWT_SECRET` | Yes | احراز هویت؛ حداقل 32 کاراکتر |
| `API_PORT` | Yes | پورت API runtime |
| `PROCESS_MANAGER` | Yes | `systemd` یا `pm2` |
| `SYSTEMD_UNIT` | If systemd | نام unit مانند `nextgen-api.service` |
| `PM2_APP` | If pm2 | نام اپ در pm2 |
| `PM2_CONFIG` | If pm2 fallback | مسیر ecosystem config |
| `API_BASE_URL` | Recommended | پایه API برای sanity/health |
| `API_HEALTH_LIVE_URL` | Recommended | health live endpoint |
| `API_HEALTH_READY_URL` | Recommended | health ready endpoint |

## 2) Host Runtime Contract (`.env.production`)

در فایل خارج از repo (`ENV_PRODUCTION_FILE`) حداقل این کلیدها باید باشد:

- `DATABASE_URL`
- `REDIS_URL`
- `API_PORT`
- `JWT_SECRET`
- `LOG_FORMAT=json` (structured audit logs always-on)

## 3) Immutable Artifact Contract

- `ARTIFACT_REF` باید یکی از این دو باشد:
- full git sha (40 hex)
- semver tag (مثل `v1.2.3`)
- `ARTIFACT_IMAGE` باید immutable باشد:
- image digest (`@sha256:...`) یا tagged image مشخص

## 4) Preflight Validation (قبل از Go/No-Go)

اسکریپت preflight:

```bash
bash ops/scripts/staging-preflight-contract.sh
```

این اسکریپت fail-closed چک می‌کند:

- `ARTIFACT_REF`
- `ARTIFACT_IMAGE`
- وجود `ENV_PRODUCTION_FILE`
- connectivity برای `DATABASE_URL`
- connectivity برای `REDIS_URL`
- presence/length برای `JWT_SECRET`
- readiness برای `PROCESS_MANAGER`

## 5) Staging Execution Order

1. Export secrets/env روی runner یا host.
2. اجرای preflight:
3. اجرای go/no-go:

```bash
ARTIFACT_REF=<sha-or-tag> \
ARTIFACT_IMAGE=ghcr.io/<org>/<repo>@sha256:<digest> \
ENV_PRODUCTION_FILE=/etc/nextgen/.env.production \
PROCESS_MANAGER=systemd \
SYSTEMD_UNIT=nextgen-api.service \
bash ops/scripts/staging-preflight-contract.sh

ARTIFACT_REF=<sha-or-tag> \
ARTIFACT_IMAGE=ghcr.io/<org>/<repo>@sha256:<digest> \
ENV_PRODUCTION_FILE=/etc/nextgen/.env.production \
PROCESS_MANAGER=systemd \
SYSTEMD_UNIT=nextgen-api.service \
pnpm deploy:go-no-go
```

## 6) Go/No-Go Acceptance

موفقیت نهایی باید شامل همه موارد باشد:

- Artifact immutable: pass
- Backup restore verification: pass
- Redis persistence verification: pass
- Migration status + sanity checks: pass
- Health probes live/ready: pass
- Runtime deterministic contract: pass
- Structured logs + metrics + alerts ready: pass

هر مورد fail شود، نتیجه نهایی `NO-GO` است.

