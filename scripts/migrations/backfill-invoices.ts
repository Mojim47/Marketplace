/**
 * Backfill legacy payments/orders into Moodian v2 invoice chain.
 * Idempotent: respects unique order_id constraint, skips existing invoices.
 */
import { PrismaClient } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { QueueService } from '@nextgen/queue';
import { ConfigService } from '@nestjs/config';
import { QUEUE_NAMES } from '@nextgen/queue/queue.constants';
import { SUIDGeneratorService } from '@nextgen/moodian/suid-generator.service';
import { ElectronicSignatureService } from '@nextgen/moodian/electronic-signature.service';

async function main() {
  const dryRun = process.env.DRY_RUN === 'true';
  const prisma = new PrismaClient();
  const config = new ConfigService(process.env);
  const queue = new QueueService(config);
  const suidGen = new SUIDGeneratorService();
  const signature = new ElectronicSignatureService(config);

  const orders = await prisma.order.findMany({
    where: { status: { in: ['PAID', 'CONFIRMED', 'COMPLETED'] } },
    include: { items: true, tenant: true, user: true, invoices: true },
  });

  for (const order of orders) {
    if (order.invoices.length > 0) continue; // idempotent skip

    const invoiceDate = new Date();
    const suid = suidGen.generateSUID(order.tenant?.tax_id || '00000000000000', invoiceDate).suid;
    const subtotal = order.subtotal ?? new Decimal(0);
    const discount = order.discount_amount ?? new Decimal(0);
    const vat = order.tax_amount ?? new Decimal(0);
    const total = order.total ?? new Decimal(0);

    const invoiceData = {
      tenant_id: order.tenant_id,
      order_id: order.id,
      invoice_number: order.order_number || `INV-${Date.now()}`,
      suid,
      invoice_type: 1,
      invoice_pattern: 1,
      seller_tax_id: order.tenant?.tax_id || '00000000000000',
      buyer_tax_id: order.user?.national_id || null,
      status: 'ISSUED',
      subtotal,
      discount_amount: discount,
      vat_amount: vat,
      total_amount: total,
      invoice_date: invoiceDate,
      jalali_date: 0,
      buyer_info: {
        userId: order.user_id,
        nationalId: order.user?.national_id ?? null,
        phone: order.user?.phone ?? null,
      },
      items: order.items,
      electronic_sign: signature.sign({ orderId: order.id, suid, total }).signature,
      signed_at: new Date(),
    };

    const invoice = dryRun
      ? { id: `dry-${order.id}`, ...invoiceData }
      : await prisma.invoice.create({ data: invoiceData });

    if (!dryRun) {
      await prisma.invoiceItem.createMany({
        data: order.items.map((item) => ({
          invoice_id: invoice.id,
          product_id: item.product_id,
          title: item.product_name,
          quantity: item.quantity,
          unit_price: new Decimal(item.total).div(item.quantity || 1),
          discount_amount: new Decimal(0),
          total_amount: item.total,
          vat_rate:
            order.tax_amount && order.total
              ? Number(new Decimal(order.tax_amount).div(order.total).mul(100).toFixed(2))
              : 9,
          vat_amount:
            order.tax_amount && order.total
              ? new Decimal(item.total).mul(order.tax_amount).div(order.total)
              : new Decimal(item.total).mul(0.09),
        })),
        skipDuplicates: true,
      });

      await queue.addJob(
        QUEUE_NAMES.MOODIAN_SUBMIT,
        'submit-invoice',
        { invoiceId: invoice.id },
        { jobId: invoice.id },
      );
    }

    console.log(
      `${dryRun ? '[DRY-RUN] ' : ''}Backfilled invoice ${invoice.id} for order ${order.id}`,
    );
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
