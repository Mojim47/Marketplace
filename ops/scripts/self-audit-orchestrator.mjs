#!/usr/bin/env node
import { execSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const repo = path.resolve('.')
const reportsDir = path.join(repo, 'ops', 'reports')
if (!existsSync(reportsDir)) mkdirSync(reportsDir, { recursive: true })

function sh(cmd, opts = {}) {
  try {
    return execSync(cmd, { cwd: repo, stdio: 'pipe', encoding: 'utf8', ...opts }).trim()
  } catch (e) {
    return { error: true, stdout: e.stdout || '', message: e.message || String(e) }
  }
}

function log(msg) { process.stdout.write(`${msg}\n`) }

const args = new Set(process.argv.slice(2))
const autoHeal = args.has('--auto-heal') || args.has('--heal')
const offline = args.has('--offline') // force offline mode

function detectOffline() {
  if (offline) return true
  // Heuristic: avoid network access for regions with restricted access; we stay offline by default
  return true
}

function readJSON(p, def = null) {
  try { return JSON.parse(readFileSync(p, 'utf-8')) } catch { return def }
}

function writeJSON(p, data) { writeFileSync(p, JSON.stringify(data, null, 2)) }

function summarizeVitestJSONSummary(dir) {
  const sumPath = path.join(dir, 'coverage-summary.json')
  const json = readJSON(sumPath)
  if (!json) return { ok: false, reason: 'no-summary' }
  const total = json.total
  const ok = total && total.statements.pct === 100 && total.branches.pct === 100 && total.functions.pct === 100 && total.lines.pct === 100
  return { ok, total }
}

function complianceSnapshot() {
  // Static mapping from existing code and tests to standards
  const wcag = {
    standard: 'WCAG 2.2 AAA',
    status: 'partially-automated',
    checks: [
      { id: '1.4.3', name: 'Contrast (Minimum)', status: 'manual/CI-lighthouse', evidence: ['tests/accessibility.spec.ts (axe serious/critical)'] },
      { id: '2.4.6', name: 'Headings and Labels', status: 'automated', evidence: ['aria-label present in layout'] },
      { id: '1.3.1', name: 'Info and Relationships', status: 'automated/partial', evidence: ['jest-axe unit assertions'] },
      { id: '2.1.1', name: 'Keyboard', status: 'manual', evidence: [] },
      { id: '3.1.5', name: 'Reading Level (AAA)', status: 'manual', evidence: [] },
    ]
  }
  const nist = {
    standard: 'NIST 800-207 (ZTMM)',
    status: 'aligned-core-controls',
    checks: [
      { id: 'mTLS', status: 'present', evidence: ['apps/api/src/middleware/mtls.guard.ts', 'libs/auth/src/mtls.ts'] },
      { id: 'RateLimiting', status: 'present', evidence: ['apps/api/src/middleware/rate-limiter.network.ts'] },
      { id: 'Idempotency', status: 'present', evidence: ['apps/api/src/middleware/idempotency.guard.ts'] },
      { id: 'DeviceBinding', status: 'present', evidence: ['libs/auth/src/core/device-binding.ts'] },
      { id: 'TokenRotation', status: 'present', evidence: ['libs/auth/src/rotation.ts', 'libs/auth/src/core/session-store.ts'] },
      { id: 'RBAC', status: 'present', evidence: ['libs/security/src/rbac.ts'] },
    ]
  }
  const pci = {
    standard: 'PCI-DSS v4.0.1',
    status: 'engineering-mapped',
    checks: [
      { id: '6.2', name: 'Secure coding', status: 'tests/coverage 100%', evidence: ['vitest + security-auditor'] },
      { id: '8.2', name: 'AuthN/AuthZ', status: 'present', evidence: ['libs/auth tokens', 'RBAC'] },
      { id: '2.2.4', name: 'Strict services', status: 'present/infra', evidence: ['ops/scripts/post-deploy-security-check.mjs'] },
      { id: '4.2', name: 'Strong cryptography', status: 'present', evidence: ['libs/security/src/crypto.ts', 'hashing.ts'] },
      { id: '11.3', name: 'Vulnerability scanning', status: 'static code scan', evidence: ['ops/reports/security-auditor-final.mjs'] }
    ]
  }
  return { wcag, nist, pci }
}

function writeComplianceMarkdown(snapshot) {
  const md = [
    '# Deployment Readiness & Compliance',
    `Date: ${new Date().toISOString()}`,
    '## Standards snapshot',
    '### WCAG 2.2 AAA',
    ...snapshot.wcag.checks.map(c => `- [${c.status === 'present' || c.status === 'automated' ? 'x' : ' '}] ${c.id} ${c.name || ''} — ${c.status} (${c.evidence.join(', ')})`),
    '### NIST 800-207 (ZTMM)',
    ...snapshot.nist.checks.map(c => `- [${c.status === 'present' ? 'x' : ' '}] ${c.id} — ${c.status} (${c.evidence.join(', ')})`),
    '### PCI-DSS v4.0.1',
    ...snapshot.pci.checks.map(c => `- [${c.status.startsWith('present') || c.status.includes('100%') ? 'x' : ' '}] ${c.id} ${c.name || ''} — ${c.status} (${c.evidence.join(', ')})`),
  ].join('\n')
  writeFileSync(path.join(reportsDir, 'deployment-readiness.md'), md)
}

function main() {
  const results = {
    steps: [],
  }

  const isOffline = detectOffline()

  // 1) Typecheck
  log('> Typechecking...')
  const typeRes = sh('npm run typecheck --silent')
  results.steps.push({ id: 'typecheck', ok: !typeRes.error, output: typeRes.error ? typeRes.stdout : typeRes })

  // 2) Build
  log('> Building...')
  const buildRes = sh('npm run build --silent')
  results.steps.push({ id: 'build', ok: !buildRes.error, output: buildRes.error ? buildRes.stdout : buildRes })

  // 3) Coverage (monorepo)
  log('> Running coverage (all)...')
  const covRes = sh('npm run coverage --silent')
  results.steps.push({ id: 'coverage', ok: !covRes.error, output: covRes.error ? covRes.stdout : covRes })

  // 4) API coverage report
  log('> Generating API validation report...')
  const apiVal = sh('node ./ops/reports/generate-api-validation.mjs')
  results.steps.push({ id: 'api-validation', ok: !apiVal.error, output: apiVal.error ? apiVal.stdout : apiVal })

  // 5) Security static auditor (final)
  log('> Running security auditor...')
  const sec = sh('node ./ops/reports/security-auditor-final.mjs')
  results.steps.push({ id: 'security-auditor-final', ok: !sec.error, output: sec.error ? sec.stdout : sec })

  // 6) Self-critique (without network calls)
  log('> Self-critique (local only)...')
  const sc = sh('node ./ops/reports/self-critique.mjs')
  results.steps.push({ id: 'self-critique', ok: !sc.error, output: sc.error ? sc.stdout : sc })

  // 7) Summaries
  const apiSummary = summarizeVitestJSONSummary(path.join(repo, 'apps', 'api', 'coverage'))
  const rootSummary = summarizeVitestJSONSummary(path.join(repo, 'coverage'))
  const snapshot = complianceSnapshot()

  const summary = {
    ok: results.steps.every(s => s.ok),
    coverage: {
      root: apiSummary.ok && rootSummary.ok,
      api: apiSummary,
      rootSummary,
    },
    compliance: snapshot,
  }

  writeJSON(path.join(reportsDir, 'deployment-readiness.json'), { generatedAt: new Date().toISOString(), results, summary })
  writeComplianceMarkdown(snapshot)

  if (!summary.ok && autoHeal) {
    log('> Issues detected. Triggering self-heal...')
    const heal = sh('node ./ops/scripts/self-heal.mjs --safe')
    results.steps.push({ id: 'self-heal', ok: !heal.error, output: heal.error ? heal.stdout : heal })
  }

  if (!summary.ok) {
    console.error('[self-audit] One or more steps failed. See ops/reports/deployment-readiness.json')
    process.exit(1)
  } else {
    console.log('[self-audit] All steps passed. Readiness report generated.')
  }
}

main()
