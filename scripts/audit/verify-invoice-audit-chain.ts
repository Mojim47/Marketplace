/**
 * Verify hash-chain integrity of invoice_audits table.
 * Exits non-zero on first mismatch.
 */
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

async function main() {
  const prisma = new PrismaClient();
  const invoices = await prisma.invoice.findMany({ select: { id: true } });
  for (const inv of invoices) {
    const events = await prisma.invoiceAudit.findMany({
      where: { invoice_id: inv.id },
      orderBy: { created_at: 'asc' },
    });
    let prevHash = '';
    for (const e of events) {
      const computed = crypto
        .createHash('sha256')
        .update(prevHash + JSON.stringify(e.payload))
        .digest('hex');
      if (computed !== e.hash) {
        console.error(`Hash mismatch on invoice ${inv.id} audit ${e.id}`);
        process.exit(1);
      }
      prevHash = e.hash;
    }
  }
  console.log('Invoice audit chains verified successfully.');
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
