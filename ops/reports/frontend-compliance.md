# Frontend Compliance Report (Iran Production)

## RTL & Typography
- Global `html` direction: rtl.
- Font stack includes Vazirmatn/Vazir with fallback system UI.
- Persian digits enforced in date picker via mapping 0-9 -> ۰-۹.

## Jalali Dates
- `date-fns-jalali` used for formatting in `PersianDatePicker`.
- ISO conversion preserved for API submission.

## Offline Mode
- Service Worker `sw.js` caches same-origin GET requests opportunistically.
- IndexedDB `nextgen-seller` created with `kv` objectStore for seller cached data.

## Accessibility
- Date picker input has `aria-label='انتخاب تاریخ'`.
- High-contrast text: default browser + can be audited with Lighthouse (future).

## Internationalization
- `fa-IR/common.json` provides base strings for Farsi UI.
- Structure supports extension to other locales via additional resource files.

## Security
- Service Worker scope limited to root; no external fetch hijacking.
- No inline dangerous HTML; React escapes content.
- Future mTLS integration on auth pages (placeholder).

## Testing & Quality Gates
- Vitest + React Testing Library for component tests; coverage enforced to 100%.
- Lint (next lint) must pass with 0 errors before commit.

## Bundle Optimization (Planned)
- Code splitting via Next.js App Router dynamic segments.
- Lazy loading images via `next/image` in future pages.
- Monitoring bundle size (<2MB) using `next build --analyze` (not yet added).

## AR & Extended Pages
- AR page to integrate with WebXR strategy (pending implementation in later task).
