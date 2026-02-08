# AI Embedding Setup (Production-Ready)

این راهنما برای راه‌اندازی موتور Embedding محلی (بدون ارسال داده به سرویس خارجی) است.

**پیش‌نیازها**
1. Node.js >= 18
2. نصب وابستگی‌ها (`pnpm install` یا معادل آن)

**گام‌ها**
1. دانلود مدل و tokenizer:
   ```bash
   EXPECTED_ONNX_SHA256=<sha256> EXPECTED_TOKENIZER_SHA256=<sha256> EXPECTED_TOKENIZER_CONFIG_SHA256=<sha256> node scripts/prepare-ai-deps.mjs
   ```
2. تنظیم متغیرهای محیطی:
   ```
   AI_EMBEDDING_ENABLED=true
  AI_EMBEDDING_MODEL_PATH=public/models/ai/all-MiniLM-L6-v2.onnx
  AI_EMBEDDING_TOKENIZER_PATH=public/models/ai/tokenizer.json
  AI_EMBEDDING_TOKENIZER_CONFIG_PATH=public/models/ai/tokenizer_config.json
  AI_EMBEDDING_MAX_LEN=128
   ```

**تست سریع**
- اجرای تست‌های AI:
  ```bash
  npx vitest run --coverage.enabled=false libs/ai/src/core/ai.service.test.ts libs/ai/src/iran/demand-prediction.strategy.test.ts apps/api/src/search/ai-search.service.test.ts
  ```

**نکته**
- در صورت عدم وجود فایل‌های مدل/توکنایزر، API در شروع خطا می‌دهد تا از اجرای ناقص جلوگیری شود.
