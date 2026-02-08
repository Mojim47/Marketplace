# Deployment Readiness & Compliance
Date: 2025-11-13T18:04:34.686Z
## Standards snapshot
### WCAG 2.2 AAA
- [ ] 1.4.3 Contrast (Minimum) — manual/CI-lighthouse (tests/accessibility.spec.ts (axe serious/critical))
- [x] 2.4.6 Headings and Labels — automated (aria-label present in layout)
- [ ] 1.3.1 Info and Relationships — automated/partial (jest-axe unit assertions)
- [ ] 2.1.1 Keyboard — manual ()
- [ ] 3.1.5 Reading Level (AAA) — manual ()
### NIST 800-207 (ZTMM)
- [x] mTLS — present (apps/api/src/middleware/mtls.guard.ts, libs/auth/src/mtls.ts)
- [x] RateLimiting — present (apps/api/src/middleware/rate-limiter.network.ts)
- [x] Idempotency — present (apps/api/src/middleware/idempotency.guard.ts)
- [x] DeviceBinding — present (libs/auth/src/core/device-binding.ts)
- [x] TokenRotation — present (libs/auth/src/rotation.ts, libs/auth/src/core/session-store.ts)
- [x] RBAC — present (libs/security/src/rbac.ts)
### PCI-DSS v4.0.1
- [x] 6.2 Secure coding — tests/coverage 100% (vitest + security-auditor)
- [x] 8.2 AuthN/AuthZ — present (libs/auth tokens, RBAC)
- [x] 2.2.4 Strict services — present/infra (ops/scripts/post-deploy-security-check.mjs)
- [x] 4.2 Strong cryptography — present (libs/security/src/crypto.ts, hashing.ts)
- [ ] 11.3 Vulnerability scanning — static code scan (ops/reports/security-auditor-final.mjs)