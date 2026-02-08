# Localization Certification

Date: 2025-11-12

## Goals
- Default language: fa-IR
- Direction: rtl
- Jalali dates (date-fns-jalali)
- Currency: IRR with Persian digits
- Offline translations via JSON (no external services)
- Global variant via (en) route

## Implementation Summary
- Locale detection in `libs/ui/src/i18n/config.ts` with single-line `globalMode` switch.
- Persian home and seller dashboard pages under `(fa)` using Jalali and IRR.
- English variant `(en)` mirrors layout.
- Messages in `apps/web/src/messages/fa-IR/common.json` ready for i18next consumption.

## Verification
- Unit tests cover locale detection, date and currency formatting, and Farsi text presence.
- All Persian UI text uses correct script; no mixed writing.

## Next Steps
- Wire i18next provider at app root to load messages JSON and switch by locale.
- Expand message catalogs for all pages.

Signed: Localization Automation
