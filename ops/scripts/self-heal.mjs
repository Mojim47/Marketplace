#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const repo = path.resolve('.')

function patchFile(file, transform) {
  const p = path.join(repo, file)
  const original = readFileSync(p, 'utf-8')
  const next = transform(original)
  if (next !== original) writeFileSync(p, next)
}

function ensureApiSecurityHeaders() {
  const mainTs = 'apps/api/src/main.ts'
  patchFile(mainTs, (src) => {
    if (/SecurityHeadersInterceptor/.test(src)) return src
    // Add a global interceptor registration for security headers
    const injection = `\nimport { SecurityHeadersInterceptor } from './middleware/security-headers.interceptor.js'\n`
    const modified = src.replace(/import 'reflect-metadata'\s*;?/,
      (m) => `${m}${injection}`)
      .replace(/await app\.init\(\)/, `app.useGlobalInterceptors(new SecurityHeadersInterceptor());\n  await app.init()`)
    return modified
  })
}

function main() {
  // Safe self-heal steps
  ensureApiSecurityHeaders()
  console.log('[self-heal] Applied safe defaults (API security headers).')
}

main()
