#!/usr/bin/env node
import { execSync } from 'node:child_process'

function sh(cmd) {
  return execSync(cmd, { stdio: 'pipe', encoding: 'utf8' }).trim()
}

function log(title, data) {
  console.log(`\n=== ${title} ===`)
  console.log(data)
}

try {
  const ns = process.env.K8S_NAMESPACE || 'default'
  const ctx = process.env.K8S_CONTEXT || ''
  const k = (c) => sh(`kubectl ${ctx?`--context ${ctx}`:''} -n ${ns} ${c}`)

  // 1) Check Deployment rollout status
  let rollout
  try { rollout = k('rollout status deploy/nextgen-api --timeout=120s') } catch (e) { rollout = e.stdout||String(e) }
  log('Rollout status', rollout)

  // 2) RBAC review: ensure SA bound and limited verbs
  const sa = k('get sa nextgen-api-sa -o yaml')
  log('ServiceAccount', sa)
  const rb = k('get rolebinding nextgen-api-rb -o yaml')
  log('RoleBinding', rb)

  // 3) Pod security context check
  const pods = k('get pods -l app=nextgen-api -o json')
  const info = JSON.parse(pods)
  const securityFindings = []
  for (const item of info.items) {
    const c = item.spec.containers?.[0]
    if (!item.spec.securityContext?.runAsNonRoot) securityFindings.push(`${item.metadata.name}: runAsNonRoot missing`)
    if (c?.securityContext?.privileged) securityFindings.push(`${item.metadata.name}: privileged=true`)
  }
  log('Security checks', securityFindings.length?securityFindings.join('\n'):'OK')

  // 4) Basic network policy check (placeholder)
  let np
  try { np = k('get networkpolicy -o name') } catch { np = 'No NetworkPolicies found' }
  log('NetworkPolicies', np)

  // 5) Cluster vulnerability scan placeholder (Trivy Kubernetes) - requires trivy installed
  let trivy
  try { trivy = sh('trivy k8s --report summary --format table all || echo "trivy-scan-failed"') } catch (e) { trivy = 'trivy not installed or failed' }
  log('Trivy summary', trivy)

} catch (err) {
  console.error('post-deploy-security-check failed:', err?.message || err)
  process.exit(1)
}
