#!/usr/bin/env node
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')

const modules = [
  { id: 'api', label: 'API (NestJS payment + health)', paths: ['apps/api/package.json', 'apps/api/src/main.ts'] },
  { id: 'web', label: 'Next.js storefront', paths: ['apps/web/package.json', 'apps/web/src/app/(fa)/page.tsx'] },
  { id: 'admin', label: 'Admin console (React microapp)', paths: ['apps/admin/src/app/page.tsx'] },
  { id: 'ui-lib', label: 'UI component library', paths: ['libs/ui/src/index.ts'] },
  { id: 'types-lib', label: 'DTO library', paths: ['libs/types/src/dtos/index.ts'] }
]

const isWindows = process.platform === 'win32'
const npmCmd = 'npm'
const npxCmd = 'npx'

const steps = [
  { id: 'ts-build', label: 'TypeScript composite build', command: npmCmd, args: ['run', 'build'] },
  { id: 'tests', label: 'Vitest coverage', command: npmCmd, args: ['run', 'coverage'] },
  { id: 'web-prebuild', label: 'Web assets prebuild', command: npmCmd, args: ['--workspace', '@nextgen/web', 'run', 'prebuild'] },
  { id: 'web-build', label: 'Next.js storefront build', command: npmCmd, args: ['--workspace', '@nextgen/web', 'run', 'build'] },
  { id: 'admin-compile', label: 'Admin console type-check + emit', command: npxCmd, args: ['tsc', '-p', 'apps/admin/tsconfig.json', '--pretty', 'false'] },
  { id: 'api-build', label: 'API build', command: npmCmd, args: ['--workspace', '@nextgen/api', 'run', 'build'] }
]

const reportPath = path.join(rootDir, 'ops', 'reports', 'core-finalization.json')

async function runStep(step) {
  return new Promise((resolve, reject) => {
    const started = Date.now()
  const child = spawn(step.command, step.args, { cwd: rootDir, stdio: 'inherit', shell: isWindows })
    child.on('error', reject)
    child.on('exit', code => {
      const durationMs = Date.now() - started
      if (code === 0) resolve({ status: 'PASS', durationMs })
      else reject(Object.assign(new Error(`${step.label} failed with code ${code}`), { durationMs }))
    })
  })
}

async function writeReport(data) {
  await mkdir(path.dirname(reportPath), { recursive: true })
  await writeFile(reportPath, JSON.stringify(data, null, 2))
}

async function main() {
  console.log('🔐  NextGen core finalization')
  const missing = modules
    .map(m => ({ ...m, missing: m.paths.filter(rel => !existsSync(path.join(rootDir, rel))) }))
    .filter(m => m.missing.length)
  if (missing.length) {
    missing.forEach(m => console.error(`❌ Missing ${m.label}: ${m.missing.join(', ')}`))
    const now = new Date().toISOString()
    const missingMap = Object.fromEntries(missing.map(m => [m.id, m.missing]))
    await writeReport({
      generatedAt: now,
      modules: modules.map(m => ({ id: m.id, label: m.label, missing: missingMap[m.id] ?? [] })),
      steps: [],
      status: 'FAILED_PRECHECK'
    })
    process.exitCode = 1
    return
  }

  const results = []
  for (const step of steps) {
    process.stdout.write(`→ ${step.label}\n`)
    try {
      const outcome = await runStep(step)
      results.push({ id: step.id, label: step.label, status: outcome.status, durationMs: outcome.durationMs })
    } catch (err) {
      console.error(`✖ ${step.label}: ${err.message}`)
      results.push({ id: step.id, label: step.label, status: 'FAIL', durationMs: err.durationMs ?? null, error: err.message })
      await writeReport({ generatedAt: new Date().toISOString(), modules: modules.map(m => ({ id: m.id, label: m.label })), steps: results })
      process.exitCode = 1
      return
    }
  }

  const report = { generatedAt: new Date().toISOString(), modules: modules.map(m => ({ id: m.id, label: m.label })), steps: results, status: 'PASS' }
  await writeReport(report)
  console.log(`✅ Core build complete. Report: ${path.relative(rootDir, reportPath)}`)
}

main().catch(async err => {
  console.error('Fatal finalize-core error:', err)
  await writeReport({ generatedAt: new Date().toISOString(), error: err.message })
  process.exitCode = 1
})
