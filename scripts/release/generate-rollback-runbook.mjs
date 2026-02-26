#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

function resolveArtifactRef() {
  return (
    process.env.ARTIFACT_REF ||
    process.env.GITHUB_SHA ||
    new Date().toISOString().replace(/[:.]/g, '-')
  );
}

function resolveBackupFile() {
  const value = process.env.DB_MIGRATION_BACKUP_FILE || process.env.DB_BACKUP_FILE || '';
  if (!value) {
    throw new Error('missing DB_MIGRATION_BACKUP_FILE (or DB_BACKUP_FILE) for rollback runbook');
  }
  return value;
}

function main() {
  const artifactRef = resolveArtifactRef();
  const backupFile = resolveBackupFile();
  const artifactImage = process.env.ARTIFACT_IMAGE || '';
  const outputDir = path.resolve(process.cwd(), 'artifacts/release');
  fs.mkdirSync(outputDir, { recursive: true });

  const payload = {
    generatedAt: new Date().toISOString(),
    artifactRef,
    artifactImage,
    backupFile,
    restoreCommand: `DATABASE_URL="<production-db-url>" bash scripts/db/rollback-from-backup.sh "${backupFile}"`,
    postRestoreChecks: [
      'pnpm run db:drift:runtime',
      'curl -fsS "$API_HEALTH_URL"',
      'curl -fsS "$WEB_HEALTH_URL"',
      'curl -fsS "$ADMIN_HEALTH_URL"',
    ],
  };

  const markdown = [
    '# Rollback Incident Runbook',
    '',
    `- Generated At: ${payload.generatedAt}`,
    `- Artifact Ref: \`${artifactRef}\``,
    `- Artifact Image: \`${artifactImage || 'n/a'}\``,
    `- Backup File: \`${backupFile}\``,
    '',
    '## Deterministic Restore Command',
    '',
    '```bash',
    payload.restoreCommand,
    '```',
    '',
    '## Post-Restore Verification',
    '',
    '```bash',
    ...payload.postRestoreChecks,
    '```',
    '',
  ].join('\n');

  const mdPath = path.join(outputDir, `rollback-runbook-${artifactRef}.md`);
  const jsonPath = path.join(outputDir, `rollback-runbook-${artifactRef}.json`);

  fs.writeFileSync(mdPath, markdown, 'utf8');
  fs.writeFileSync(jsonPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

  console.log(
    JSON.stringify(
      {
        status: 'ok',
        artifactRef,
        output: { mdPath, jsonPath },
      },
      null,
      2
    )
  );
}

main();
