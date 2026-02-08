// Verified under Mnemosyne Protocol v3.2.1 — Ω-Moji Sovereign Build

# FRONTEND_AUDIT

## Executive Snapshot
- **Current state**: apps/web cannot complete `next build` because `libs/ui` imports point to `.js` files that do not exist (only `.ts` sources ship). apps/admin has no package manifest or bundler; even `tsc --noEmit` fails due to conflicting compiler switches. Without a clean production build, Lighthouse cannot run, so no trustworthy UX scores exist today.
- **Priority gaps**: fix `libs/ui` import paths, introduce a real admin build target, and add bundle analysis tooling (Next.js analyzer or migrate to Vite) before layering AI/AR features.
- **Readiness**: Service worker + COEP/COOP headers already land in apps/web, so Web Worker hosting is achievable once builds pass. HTTPS/TLS 1.3 is enforced via response headers in production but not in local dev; WebXR will remain blocked until dev HTTPS is provisioned.

## UI/UX Assessment
### Lighthouse Scores
| Surface | Result | Evidence |
| --- | --- | --- |
| apps/web | **Blocked** – `npm --workspace @nextgen/web run build` exits with `Module not found: Can't resolve '../../theme/royal-theme.js'` coming from `libs/ui/src/components/layout/Header.tsx`. Without a successful production build, LHCI (`lighthouse-ci-config.js`) cannot start the app and therefore cannot emit performance/accessibility scores. | `next build` log captures the stack (`Import trace for requested module: ./src/app/components/site-shell.client.tsx`). |
| apps/admin | **Blocked** – there is no package.json or dev server. Running `npx tsc -p apps/admin/tsconfig.json --noEmit` fails immediately: `TS5069: Option 'declarationMap' cannot be specified without specifying option 'declaration' or option 'composite'.` With compilation broken, Lighthouse has nothing to audit. | Terminal run on 2025-11-15 (see log above). |

### WCAG 2.1 AA Compliance Gaps
1. **Focus visible (2.4.7) regressions in admin UI** – the admin `button` defined in `apps/admin/src/app/page.tsx` uses inline styles without any `:focus-visible` treatment, so keyboard users receive no visual cue.
2. **Contrast assurance still “future”** – `ops/reports/frontend-compliance.md` explicitly lists "High-contrast text ... can be audited with Lighthouse (future)", meaning criterion 1.4.3 lacks objective evidence.
3. **Landmark semantics missing on admin page** – the root `<main>` has no `lang` attribute, heading hierarchy is a single `<h1>`, and there is no skip link equivalent, violating 2.4.1 and 2.4.3 guidance.
4. **Form controls with implicit behavior** – the admin `button` omits `type="button"`; if any form wrappers are added later this will trigger accidental submissions (WCAG 3.2.2 consistency risk).

### React Anti-Patterns
- **validateDOMNesting warnings** – `npm run coverage --silent` repeatedly logs `Warning: validateDOMNesting(...): <html> cannot appear as a child of <div>. at RootLayout (apps/web/src/app/(fa)/layout.tsx:7:23)`. Tests render the server layout component inside a jsdom `<div>`, so React inserts `<html>` in the wrong context. Until tests mount through Next’s Document wrapper or mock the shell, real DOM parity and hydration checks remain noisy.

## Build & Bundle Analysis
### Current Bundle Size (`vite build --report`)
- **Not measurable**. The repo has no `vite.config.*`, and apps/web relies on Next.js. Running the requested `vite build --report` command would fail immediately because neither app is a Vite project. To fulfill this requirement we must either introduce Vite configs (recommended for apps/admin) or enable Next’s built-in analyzer via `ANALYZE=1 next build` once the `libs/ui` import issue is fixed.

### Tree-shaking Efficacy for `libs/ui`
- `libs/ui/src/index.ts` re-exports entire modules with wildcard (`export * from ...`) and injects runtime `<style>` tags inside components such as `Header`. Because apps/web imports `Footer`/`Header` through deep relative paths, Next.js cannot rely on package `module`/`exports` fields for tree-shaking, and every component-level side effect (inline `<style>` injection) keeps modules in the bundle even if only one widget is consumed. Fix by publishing `@nextgen/ui` with proper ESM entrypoints, removing `export *`, and referencing the package alias from apps/web instead of deep paths.

### Build Failures Blocking Shipping
1. **Missing `.js` artifacts** – Next build halts with:
   ```
   Module not found: Can't resolve '../../theme/royal-theme.js'
   Import trace for requested module:
   ./src/app/components/site-shell.client.tsx
   ```
   Only `.ts` sources exist under `libs/ui/src/theme`. Either emit `.js` outputs before bundling or update all imports to `.ts`.
2. **Admin TypeScript pipeline misconfigured** – `tsconfig` disables declarations yet leaves `declarationMap` true, causing TS5069. Without a package manifest, there is no `npm run build` target to drive bundling or tree-shaking.

## Integration Readiness
### Web Worker & AI Hosting Potential
- **Positive**: `apps/web/next.config.mjs` sets `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp`, enabling `SharedArrayBuffer`—a prerequisite for `onnxruntime-web` WebAssembly and WebLLM web workers. `OfflineClient` already bootstraps service workers and IndexedDB, confirming worker APIs are allowed once the build passes.
- **Gaps**: SiteShell imports UI components via relative paths, so once workers are introduced the same module-resolution issue will surface unless fixed globally.

### HTTPS/TLS 1.3 for WebXR
- **Production**: `next.config.mjs` emits `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`, so browsers hitting the deployed domain will enforce HTTPS.
- **Development**: `package.json` only exposes `next dev` (plain HTTP://localhost:3000). Without self-signed certificates or a reverse proxy, WebXR (which checks for secure contexts) remains blocked locally. Action: add a `dev:https` script wired to `next dev --hostname 0.0.0.0 --experimental-https` or front the app with `mkcert` + Vite preview.

## Evidence Log
1. `npm --workspace @nextgen/web run prebuild`
2. `npm --workspace @nextgen/web run build` → failed with missing `royal-theme.js`
3. `npx tsc -p apps/admin/tsconfig.json --noEmit` → TS5069
4. `npm run coverage --silent` (earlier run) → `validateDOMNesting` warnings
5. Repository inspection: `apps/web/src/app/(fa)/layout.tsx`, `apps/admin/src/app/page.tsx`, `libs/ui/src/index.ts`
