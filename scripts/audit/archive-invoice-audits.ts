/**
 * Archive invoice_audits to append-only JSONL with checksum for WORM-like storage.
 * Intended to run on a schedule (e.g., daily) and upload the file to immutable storage.
 */
import { PrismaClient } from '@prisma/client';
import { createWriteStream, existsSync, mkdirSync } from 'fs';
import crypto from 'crypto';
import path from 'path';

async function main() {
  const prisma = new PrismaClient();
  const outDir = process.env.ARCHIVE_DIR || './_archives';
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  const filename = `invoice_audits_${new Date().toISOString().slice(0, 10)}.jsonl`;
  const outPath = path.join(outDir, filename);
  const out = createWriteStream(outPath, { flags: 'a' });

  const audits = await prisma.invoiceAudit.findMany({
    orderBy: { created_at: 'asc' },
  });

  const hash = crypto.createHash('sha256');
  for (const a of audits) {
    const line = JSON.stringify(a);
    out.write(line + '\n');
    hash.update(line);
  }
  out.end();
  const checksum = hash.digest('hex');
  const shaPath = `${outPath}.sha256`;
  createWriteStream(shaPath).write(checksum);

  console.log(`Archived ${audits.length} audit records to ${outPath}`);
  console.log(`SHA256: ${checksum}`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
