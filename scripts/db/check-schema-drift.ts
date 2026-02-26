import { execSync } from 'node:child_process';

function sh(cmd: string): string {
  return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function resolveBaseSha(): string {
  const fromEnv =
    process.env.BASE_SHA ||
    process.env.GITHUB_BASE_SHA ||
    process.env.GITHUB_EVENT_PULL_REQUEST_BASE_SHA ||
    '';
  if (fromEnv) {
    return fromEnv;
  }

  try {
    const before = process.env.GITHUB_EVENT_BEFORE || '';
    if (before && before !== '0000000000000000000000000000000000000000') {
      return before;
    }
  } catch {
    // ignore
  }

  try {
    return sh('git rev-parse HEAD~1');
  } catch {
    return sh('git rev-parse HEAD');
  }
}

function changedFiles(baseSha: string): string[] {
  const out = sh(`git diff --name-only --diff-filter=ACMR "${baseSha}"...HEAD`);
  if (!out) {
    return [];
  }
  return out
    .split('\n')
    .map((x) => x.trim())
    .filter(Boolean);
}

function hasMigrationChange(files: string[]) {
  return files.some(
    (file) =>
      file.startsWith('prisma/migrations/') &&
      (file.endsWith('/migration.sql') || file.endsWith('migration.sql') || file.endsWith('.sql'))
  );
}

function main() {
  const baseSha = resolveBaseSha();
  const files = changedFiles(baseSha);
  const schemaChanged = files.includes('prisma/schema.prisma');
  const migrationChanged = hasMigrationChange(files);

  if (!schemaChanged) {
    console.log('db:drift:check PASS - prisma/schema.prisma unchanged.');
    return;
  }

  if (!migrationChanged) {
    console.error(
      [
        'db:drift:check FAIL - prisma/schema.prisma changed without migration SQL.',
        `base_sha=${baseSha}`,
        'Add a new Prisma migration under prisma/migrations/<timestamp>_name/migration.sql.',
      ].join('\n')
    );
    process.exit(1);
  }

  console.log(
    [
      'db:drift:check PASS - schema and migration changed together.',
      `base_sha=${baseSha}`,
      `changed_files=${files.length}`,
    ].join('\n')
  );
}

main();
