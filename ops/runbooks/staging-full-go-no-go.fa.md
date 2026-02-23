# Runbook فارسی: Full Staging Go/No-Go (AI + AR)

## مشخصات اجرا
- محیط: `staging`
- سیاست تصمیم: `ANY FAIL => NO-GO (fail-closed)`
- خروجی موردنیاز: لاگ‌ها، snapshot متریک‌ها، وضعیت rollout registry

---

## 1) Preflight

### 1.1 ورودی‌های اجباری
- [ ] `ARTIFACT_REF` تنظیم شده (sha کامل یا tag معتبر)
- [ ] `ARTIFACT_IMAGE` تنظیم شده (digest/tag immutable)
- [ ] `DATABASE_URL` تنظیم شده
- [ ] `REDIS_URL` تنظیم شده
- [ ] `JWT_SECRET` حداقل 32 کاراکتر
- [ ] `PROCESS_MANAGER` یکی از `systemd` یا `pm2`

### 1.2 بررسی Manifest و Digest
- [ ] manifest قابل خواندن است
- [ ] `commit` داخل manifest با `ARTIFACT_REF` برابر است
- [ ] SHA256 فایل artifact با `sha256_file` برابر است

```bash
ARTIFACT_MANIFEST_PATH=artifacts/manifest.json \
ARTIFACT_EXPECT_COMMIT="$ARTIFACT_REF" \
node scripts/ai/verify-artifact-manifest.mjs
```

### 1.3 بررسی Health اولیه
- [ ] `/health/live` = 200
- [ ] `/health/ready` = 200

```bash
curl -fsS http://127.0.0.1:4000/health/live >/dev/null
curl -fsS http://127.0.0.1:4000/health/ready >/dev/null
```

### 1.4 Shadow/Drift gate اولیه
- [ ] shadow gate پاس شد

```bash
node scripts/ai/shadow-eval-gate.mjs
```

---

## 2) Canary Rollout + Shadow Evaluation

### 2.1 فعال‌سازی Canary مدل
- [ ] درصد canary در بازه 5 تا 10 تنظیم شده
- [ ] نسخه canary مشخص شده

```bash
AI_CANARY_MODEL_VERSION=<canary_version> \
AI_CANARY_TRAFFIC_PERCENT=5 \
node scripts/ai/canary-model-rollout.mjs
```

### 2.2 Runtime flags
- [ ] `AI_MODEL_CANARY_PERCENT=5` (یا 10)
- [ ] `AI_SHADOW_DRIFT_THRESHOLD=0.45`
- [ ] `AI_DRIFT_FAIL_CLOSED=true`
- [ ] `AI_AUTO_ROLLBACK_SCRIPT_PATH=scripts/ai/auto-rollback-model.mjs`

---

## 3) Traffic Simulation + RED/AI/AR Metrics

### 3.1 اجرای Full Gate
- [ ] اسکریپت full staging pass شد

```bash
ARTIFACT_REF="$ARTIFACT_REF" \
ARTIFACT_IMAGE="$ARTIFACT_IMAGE" \
CANARY_PERCENT=5 \
API_BASE_URL=http://127.0.0.1:4000 \
bash ops/scripts/staging-full-go-no-go.sh
```

### 3.2 معیارهای متریک
- [ ] RED:
  - [ ] `http_requests_total`
  - [ ] `http_request_duration_seconds`
- [ ] AI:
  - [ ] `ai_inference_total`
  - [ ] `ai_inference_latency_seconds`
  - [ ] `ai_shadow_eval_total`
  - [ ] `ai_drift_score`
- [ ] AR:
  - [ ] `ar_overlay_latency_seconds`
  - [ ] `ar_overlay_guard_events_total`

---

## 4) Rollback Verification واقعی (با breach مصنوعی)

### 4.1 تزریق breach
- [ ] drift مصنوعی بالا اعمال شد (داخل full script)

### 4.2 تایید rollback واقعی
- [ ] نسخه active در rollout registry تغییر کرده
- [ ] rollback log ثبت شده
- [ ] rollback metric افزایش داشته

بررسی registry:
```bash
cat ops/assets/ai/models/rollout.registry.json
```

---

## 5) Alert + Dashboard Check

### 5.1 Alert Rules
- [ ] `AIInferenceLatencySLAExceeded`
- [ ] `AIShadowDriftDetected`
- [ ] `AIAutoRollbackTriggered`
- [ ] `AROverlayLatencySLAExceeded`

### 5.2 Dashboard
- [ ] داشبورد AI/AR SLO در Grafana قابل مشاهده است
- [ ] مسیر فایل داشبورد:
  - `monitoring/grafana/dashboards/nextgen-ai-ar-slo-dashboard.json`

### 5.3 AR Telemetry Path
- [ ] ingest endpoint فعال است: `POST /metrics/ar/telemetry`

---

## 6) Immutable Artifact Verification (قبل از Promotion)

- [ ] digest دوباره تایید شد
- [ ] manifest mismatch وجود ندارد
- [ ] deploy بدون mutation artifact انجام می‌شود

```bash
ARTIFACT_MANIFEST_PATH=artifacts/manifest.json \
ARTIFACT_EXPECT_COMMIT="$ARTIFACT_REF" \
node scripts/ai/verify-artifact-manifest.mjs
```

---

## 7) تصمیم نهایی Go/No-Go

### GO
- [ ] همه موارد مراحل 1 تا 6 پاس شدند
- [ ] rollback test واقعی تایید شد
- [ ] هیچ alert بحرانی unresolved وجود ندارد

### NO-GO
- [ ] هر کدام از موارد بالا fail شد
- [ ] rollout متوقف شد
- [ ] مدل stable حفظ/برگردانده شد
- [ ] incident + evidence (logs/metrics snapshot) ثبت شد

---

## اجرای سریع (On-Call)

```bash
ARTIFACT_REF=<sha> \
ARTIFACT_IMAGE=<image@sha256:...> \
CANARY_PERCENT=5 \
API_BASE_URL=http://127.0.0.1:4000 \
bash ops/scripts/staging-full-go-no-go.sh
```

