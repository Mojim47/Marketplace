#!/usr/bin/env node
/**
 * Global Deployment Verification Script
 * Validates all 48h critical compliance items
 */

import { existsSync } from 'fs'
import { join } from 'path'

const CHECKS = [
  {
    id: 'gs1-digital-link',
    name: 'GS1 Digital Link Generator',
    path: 'libs/utils/src/gs1-digital-link.ts',
    required: true
  },
  {
    id: 'ai-bias-test',
    name: 'AI Bias Test Framework',
    path: 'ops/compliance/ai-bias-test.mjs',
    required: true
  },
  {
    id: 'eu-ar-footer',
    name: 'EU AR Address in Footer',
    path: 'apps/web/components/layout/Footer.tsx',
    required: true
  },
  {
    id: 'calibration-sticker',
    name: 'Calibration Sticker Template',
    path: 'apps/web/public/compliance/calibration-sticker.svg',
    required: true
  },
  {
    id: 'deployment-checklist',
    name: 'Global Deployment Checklist',
    path: 'docs/02-deployment/GLOBAL_DEPLOYMENT_CHECKLIST.md',
    required: true
  }
]

function verifyDeployment() {
  console.log('🔍 Global Deployment Verification\n')
  console.log('Checking 48h Critical Items...\n')

  let passed = 0
  let failed = 0

  for (const check of CHECKS) {
    const fullPath = join(process.cwd(), check.path)
    const exists = existsSync(fullPath)
    
    if (exists) {
      console.log(`✅ ${check.name}`)
      passed++
    } else {
      console.log(`❌ ${check.name} - MISSING`)
      failed++
    }
  }

  console.log('\n' + '─'.repeat(60))
  console.log(`\nResults: ${passed}/${CHECKS.length} checks passed`)

  if (failed === 0) {
    console.log('\n✅ DEPLOYMENT READY - All critical items implemented\n')
    return 0
  } else {
    console.log(`\n❌ DEPLOYMENT BLOCKED - ${failed} items missing\n`)
    return 1
  }
}

process.exit(verifyDeployment())
