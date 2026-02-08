import { execSync } from 'node:child_process'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(fileURLToPath(import.meta.url))
const repo = path.resolve(root, '..', '..')

const run = (cmd) => execSync(cmd, { cwd: repo, stdio: 'pipe', encoding: 'utf-8' })

let failures = 0

try { run('npm run typecheck --silent') } catch (e) { process.stdout.write(e.stdout ?? ''); failures++ }
try { run('npm run build --silent') } catch (e) { process.stdout.write(e.stdout ?? ''); failures++ }
try { run('npm run coverage --silent') } catch (e) { process.stdout.write(e.stdout ?? ''); failures++ }

const scanDir = (dir, patterns) => {
  const findings = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) findings.push(...scanDir(full, patterns))
    else if (/\.(ts|js|mjs|cjs)$/.test(entry.name)) {
      const txt = readFileSync(full, 'utf-8')
      for (const p of patterns) if (p.regex.test(txt)) findings.push({ file: full, rule: p.rule })
    }
  }
  return findings
}

const simulatedSemgrep = scanDir(path.join(repo, 'libs', 'security', 'src'), [
  { rule: 'eval_usage', regex: /\beval\(/ },
  { rule: 'insecure_random', regex: /Math\.random\(/ }
])
if (simulatedSemgrep.length) failures++

const simulatedBandit = scanDir(path.join(repo, 'libs', 'security', 'src'), [
  { rule: 'weak_hash_md5', regex: /createHash\(['"]md5['"]\)/i }
])
if (simulatedBandit.length) failures++
let auditJSON = ''
try { auditJSON = run('node ./libs/security/dist/bin/security-auditor.js --root libs/security/src --fail-on warn') } catch (e) { process.stdout.write(typeof e.stdout === 'string' ? e.stdout : String(e)); failures++ }
try { run('npm audit --audit-level=high --omit=dev --silent') } catch { failures++ }
if (auditJSON) {
  const escaped = auditJSON.replace(/"/g,'\\"')
  run(`node -e "require('node:fs').writeFileSync('ops/reports/security-audit.json', '${escaped}')"`)
}

try {
  const lcov = readFileSync(path.join(repo, 'coverage', 'lcov.info'), 'utf-8')
  if (!lcov.includes('BRH:') || !lcov.includes('FNH:')) failures++
} catch { failures++ }

if (failures > 0) {
  process.exit(1)
}
