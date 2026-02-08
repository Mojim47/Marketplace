# گزارش نهایی ممیزی فنی و امنیتی — Nextgen Marketplace

تاریخ: 2025-11-14
مخاطب: تیم مهندسی و ذی‌نفعان محصول
دامنه: کل مونو‌ریپو (apps/*, libs/*) با تمرکز بر امنیت، احراز هویت، وب و API

## خلاصه اجرایی
- وضعیت بیلد و کیفیت کد:
  - Typecheck (tsc --noEmit): PASS (اجرای واقعی در این نشست)
  - Lint (eslint .): PASS (اجرای واقعی در این نشست)
  - Tests (vitest run --coverage): PASS — 60 فایل تست، 189 تست همگی سبز (اجرای واقعی)
  - Build: PASS (بر اساس ops/reports/deployment-readiness.json تاریخ 2025-11-13)
- پوشش‌دهی کل (Aggregated از خروجی Vitest در readiness):
  - Statements: 98.92%
  - Branches: 96.76%
  - Functions: 96.74%
  - Lines: 98.92%
- امنیت: PASS
  - «security-auditor-final»: بدون آسیب‌پذیری ثبت‌شده، همه یافته‌های طراحی امنیت/احراز هویت «pass»
- انطباق: هم‌راستا با ISO 27001، PCI-DSS v4، NIST 800-207 (ZTMM) در کنترل‌های هسته
- موارد باز: API Validation در گزارش readiness وضعیت ok: false (بدون خروجی)، چند شکاف پوشش‌دهی هدفمند در وب و یک فایل types در invoice

## نمای معماری و ابزارها
- Monorepo با Workspaces (npm)
  - apps/web (Next.js) — تست‌ها با vitest + jsdom
  - apps/api (Node/NestJS با شیم‌های تست) — vitest پیکربندی مجزا (`vitest.api.config.ts`)
  - libs/* شامل ماژول‌های Security, Auth, Payment, Invoice, Tax, Cooperation, AI, UI, Types
- TypeScript 5.6، ماژول ES2022، moduleResolution: Bundler
- تست و پوشش: Vitest v2.1.9 با provider: v8 و گزارش‌های text/lcov/html/json-summary
- اسکن/ممیزی امنیتی: اسکریپت داخلی security-auditor-final.mjs با خروجی JSON/MD

## درگاه‌های کیفیت (Quality Gates)
- Typecheck: PASS
- Lint: PASS
- Tests: PASS (60 فایل، 189 تست)
- Coverage Gate: نزدیک به 100%، اما در «deployment-readiness.json» وضعیت coverage.ok: false به دلیل «no-summary» برای API — نیاز به تضمین تولید summary برای اپ API

## نتایج تست و پوشش‌دهی
منبع داده: vitest خروجی در «deployment-readiness.json» و اجرای واقعی vitest در این نشست
- مجموع کل فایل‌ها: Statements 98.92% | Branches 96.76% | Functions 96.74% | Lines 98.92%
- نکات شاخص:
  - libs/security/src: 100% در تمام معیارها (auditor, crypto, hashing, rbac, secrets, token, rbac/model)
  - libs/auth/src: 100% (شامل core/* با یک مورد Branch 95% در token-manager.ts خط 20)
  - apps/web (بخش‌هایی از مسیر fa): چند آیتم زیر 100%
    - layout.tsx: Branch 50% | Func 50% (خطوط 17–19)
    - offline-client.tsx: Statements 78.94% | Func 50% (خطوط 16–18,22)
    - persian-date-picker.tsx: Branch 57.14%
  - libs/invoice/src/types.ts: 0% (در حال حاضر بدون پوشش)
  - libs/payment: عمدتاً 100%، یک فایل adapter با Branch 96.77% (خط 14)
- خروجی HTML/LCOV موجود:
  - libs/auth/coverage/index.html و lcov-report
  - libs/security/coverage/index.html و lcov-report
  - (گزارش‌های summary JSON در فایل‌سیستم حاضر دیده نشد — اما اعداد تجمیعی در readiness موجود است.)

## امنیت و انطباق
- security-auditor-final.json
  - vulnerabilities: [] (هیچ موردی)
  - designFindings: همه بخش‌ها pass (token exp check, refresh rotation, session inactivity, device-binding timing-safe)
  - Compliance Mapping:
    - ISO27001: A_9_4_2، A_8_23 — aligned (با شواهد در کد: device-binding, session-store, crypto, hashing, token)
    - PCI-DSS v4: 8.2, 8.3, 3.5, 3.6 — aligned
- security-validation-final.md (دایره libs/security)
  - پوشش 100%، بدون الگوهای خطرناک (eval, MD5, Math.random)، استفاده از AES-256-GCM، HMAC-SHA256، scrypt
  - کنترل‌های RBAC، انقضای توکن، خزانه اسرار (secrets vault) ✅
- auth-report.json
  - نگاشت کنترل‌ها به ISO/PCI، شامل Device Binding، Session Rotation، Audit Trail

## استانداردها و قابلیت اتکا
- WCAG 2.2 AAA: وضعیت «partially-automated»
  - نیاز به بررسی دستی برای Contrast (1.4.3)، Keyboard (2.1.1)، Reading Level (3.1.5)
- NIST 800-207 (ZTMM): کنترل‌های محوری حاضر (mTLS، Rate Limiting، Idempotency، Device Binding، Token Rotation، RBAC)
- PCI-DSS v4.0.1: نگاشت مهندسی حاضر؛ اسکن آسیب‌پذیری به‌صورت استاتیک داخلی انجام می‌شود

## ریسک‌ها و شکاف‌ها (اولویت‌بندی‌شده)
1) API Validation: وضعیت ok: false (بدون خروجی)
   - اثر: مبهم بودن انطباق قرارداد API/سرویس
   - اقدام پیشنهادی: فعال‌سازی تست‌های قراردادی و خروجی summary در apps/api/coverage (به‌روزرسانی vitest.api.config.ts و اسکریپت‌ها)
2) پوشش وب (fa/*): چند فایل با Branch/Func زیر 100%
   - اقدام: افزودن تست‌های هدفمند برای مسیرهای شاخه‌ای (layout.tsx, offline-client.tsx) و تعاملات UI (persian-date-picker)
3) libs/invoice/src/types.ts با 0% پوشش
   - اقدام: یا تست حداقلی (type-level usage) یا استثناسازی در config coverage در صورت عدم نیاز
4) اطمینان از تولید coverage-summary.json برای ریشه و API
   - اقدام: افزودن reporter json-summary با مسیر reportsDirectory پایدار و جمع‌آوری در CI
5) گسترش ممیزی امنیتی به ابزارهای صنعتی (اختیاری میان‌مدت)
   - اقدام: یکپارچه‌سازی Semgrep (پروفایل ci) و Snyk/GHAS جهت وابستگی‌ها

## پیشنهادهای عملی کوتاه‌مدت
- API Coverage: تنظیم `vitest.api.config.ts` برای `reporter: ['text', 'json-summary']` و `reportsDirectory: 'apps/api/coverage'` (موجود است) — بررسی اینکه مسیر خروجی در CI جمع‌آوری می‌شود و وضعیت «no-summary» رفع شود.
- Root Coverage: در `vitest.config.ts`، `reporter: ['text','lcov','html','json-summary']` و `reportsDirectory: 'coverage'` وجود دارد — اطمینان از تولید و آرشیو فایل‌های summary در آرتیفکت‌های CI.
- تست‌های تکمیلی UI:
  - پوشش شاخه‌ها برای layout.tsx (مسیرهای شرطی) و offline-client.tsx (مسیرهای خطا/آفلاین)
  - افزایش سناریوهای keyboard-only برای تطابق WCAG 2.1.1
- invoice/types.ts: یک تست اسموک که typeها را مصرف کند یا استثناسازی فایل از coverage در صورت utility-only بودن.

## وضعیت دروازه‌های کیفی (گزارش پایانی)
- Build: PASS (بر اساس readiness.json آخرین اجرا)
- Typecheck: PASS (اجرای واقعی)
- Lint: PASS (اجرای واقعی)
- Tests: PASS (اجرای واقعی)
- Coverage: ALMOST PASS (Root ~99%; نیاز به رفع «no-summary» برای API)
- Security Audit: PASS (0 آسیب‌پذیری، کنترل‌های کلیدی حاضر)
- Compliance: Aligned (ISO 27001, PCI-DSS v4, NIST 800-207)، WCAG نیازمند تکمیل بررسی‌های دستی

## گام‌های بعدی (CI/CD و مستندسازی)
- افزودن مرحله «API coverage summary check» به پایپ‌لاین و شکست در صورت نبود summary
- خروجی گرفتن از lcov/html به‌عنوان آرتیفکت و لینک در گزارش‌های PR
- اجرای «security-auditor-final-md.mjs» برای خلاصه مدیریتی قابل‌نمایش در ویکی داخلی
- برنامه آزمایش دستی WCAG: Contrast، Keyboard، Reading Level (AAA)

---
این گزارش بر مبنای اجرای واقعی در همین ریپو تهیه شد: tsc, eslint, vitest --coverage، و security-auditor-final. اعداد پوشش‌دهی از خروجی متنی Vitest در «deployment-readiness.json» استخراج شده‌اند.
