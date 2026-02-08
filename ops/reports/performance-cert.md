# Performance & Accessibility Certification

Date: 2025-11-12

## Targets
- Performance >= 95
- Accessibility >= 95
- LCP < 1.0s
- INP < 100ms
- CLS < 0.05

## Methodology
Measured with Lighthouse CI (desktop profile) against production build. Single-run thresholds asserted via `lighthouse-ci-config.js`.

## Current Status
Pending final CI execution. Local smoke tests pass without fatal errors. Service Worker provides offline shell & API JSON caching; manifest ensures installability (PWA). Axe-core unit test reports no serious/critical violations in core layout.

## PWA Verification Checklist
- [x] Service Worker registered (`/sw.js`).
- [x] Manifest with icons & start_url.
- [x] Offline fallback content served.
- [x] IndexedDB used for JSON persistence.

## Next Steps
1. Run full LHCI in CI with network throttling.
2. Attach generated `lhci` artifacts to release.
3. Update this certificate with actual numeric scores from report summary.

---
Signed: Performance Layer Automation
