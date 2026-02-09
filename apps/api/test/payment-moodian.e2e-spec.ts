import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { GenericContainer, StartedTestContainer } from 'testcontainers';
import { execSync } from 'node:child_process';
import { ConfigService } from '@nestjs/config';
import path from 'node:path';
import { PaymentService } from '../src/payment/payment.service';
import { QueueService } from '@nextgen/queue';
import { QUEUE_NAMES } from '@nextgen/queue/queue.constants';
import { ElectronicSignatureService } from '@nextgen/moodian/electronic-signature.service';
import { TaxService } from '../src/shared/tax/tax.service';
import { generateKeyPairSync } from 'node:crypto';
import { Decimal } from '@prisma/client/runtime/library';
import { register } from 'prom-client';

// Stub payment gateway to avoid external dependency in E2E
vi.mock('@nextgen/payment', () => {
  class ZarinPalService {
    async requestPayment() {
      return { authority: 'AUTH', url: 'https://example.com' };
    }
    async verifyPayment() {
      return { refId: 'REF', status: 'OK' };
    }
    async refundPayment() {
      return { status: 'OK' };
    }
  }
  return { ZarinPalService };
});

let pg: StartedTestContainer;
let redis: StartedTestContainer;
let prisma: any;
let redisPort: number;

beforeEach(() => {
  // ensure metrics registry clean to avoid duplicate Gauge errors
  register.clear();
  if (redisPort) {
    const Redis = require('ioredis');
    const client = new Redis(redisPort, '127.0.0.1');
    client.flushdb().then(() => client.quit());
  }
});

beforeAll(async () => {
  pg = await new GenericContainer('postgres:16-alpine')
    .withEnvironment({ POSTGRES_USER: 'postgres', POSTGRES_PASSWORD: 'postgres', POSTGRES_DB: 'testdb' })
    .withExposedPorts(5432)
    .start();
  const pgPort = pg.getMappedPort(5432);
  process.env.DATABASE_URL = `postgresql://postgres:postgres@localhost:${pgPort}/testdb?schema=public`;

  // apply schema non-interactively (test only)
  execSync(`pnpm prisma db push --schema=prisma/schema.prisma --force-reset --skip-generate`, {
    stdio: 'inherit',
  });
  execSync(`pnpm prisma generate --schema=prisma/schema.prisma`, { stdio: 'inherit' });

  const clientPath = path.resolve(__dirname, '../../../node_modules/.prisma/client/index.js');
  const { PrismaClient } = await import(`file://${clientPath}`);
  prisma = new PrismaClient();

  redis = await new GenericContainer('redis:7-alpine').withExposedPorts(6379).start();
  redisPort = redis.getMappedPort(6379);
});

afterAll(async () => {
  await prisma?.$disconnect();
  if (pg) await pg.stop();
  if (redis) await redis.stop();
});

describe(
  'Payment → Invoice → Queue (Moodian v2)',
  () => {
    it('creates single invoice, enqueues submit job, and records audit', async () => {
      const pgPort = pg.getMappedPort(5432);

      // seed tenant/user/order
      const tenant = await prisma.tenant.create({
        data: { slug: 't1', name: 'Tenant', status: 'ACTIVE', tax_id: '12345678901234' },
      });
      const vendor = await prisma.vendor.create({
        data: { tenant_id: tenant.id, name: 'Vendor1', slug: 'vendor1', commission_rate: 10 },
      });
      const product = await prisma.product.create({
        data: {
          tenant_id: tenant.id,
          vendor_id: vendor.id,
          sku: 'SKU1',
          name: 'Item',
          slug: 'item',
          price: 1090000,
          stock: 10,
          status: 'ACTIVE',
          tax_rate: 9,
        },
      });
      const user = await prisma.user.create({
        data: {
          tenant_id: tenant.id,
          email: 'u@example.com',
          password_hash: 'x',
          roles: { create: [{ role: 'CUSTOMER', tenant_id: tenant.id }] },
          is_active: true,
        },
      });
      const order = await prisma.order.create({
        data: {
          tenant_id: tenant.id,
          user_id: user.id,
          order_number: 'ORD-1',
          status: 'PAID',
          subtotal: 1000000,
          discount_amount: 0,
          tax_amount: 90000,
          total: 1090000,
          created_at: new Date(),
        },
      });
      const payment = await prisma.payment.create({
        data: {
          tenant_id: tenant.id,
          user_id: user.id,
          order_id: order.id,
          amount: order.total,
          gateway: 'ZARINPAL',
          status: 'COMPLETED',
          gateway_ref: 'REF-1',
          card_pan: '1234********3456',
        },
      });
      await prisma.orderItem.create({
        data: {
          order_id: order.id,
          product_id: product.id,
          tenant_id: tenant.id,
          product_name: 'Item',
          product_sku: 'SKU1',
          quantity: 1,
          unit_price: 1090000,
          total: 1090000,
        },
      });

      const queueService = new QueueService(
        new ConfigService({ REDIS_HOST: '127.0.0.1', REDIS_PORT: redisPort }),
      );

      // dummy services/mocks
      const circuitBreakerService: any = { createBreaker: () => ({}), fire: async () => ({}) };
      const auditService: any = {};
      const securityService: any = {};
      const taxService = {
        submitInvoice: async () => ({ status: 'PENDING' as const, senaRefId: 'SENA-1' }),
      } as unknown as TaxService;

      const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
      const privPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
      const pubPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();

      const config = new ConfigService({
        FEATURE_MOODIAN_V2: 'true',
        MOODIAN_PRIVATE_KEY: privPem,
        MOODIAN_PUBLIC_KEY: pubPem,
      });

      const signatureService = new ElectronicSignatureService(config);

      const service = new PaymentService(
        prisma,
        securityService,
        circuitBreakerService,
        auditService,
        taxService,
        config,
        signatureService,
        queueService,
      );

      // fake transaction representing successful payment
      const transaction = {
        payment_id: payment.id,
        order_id: order.id,
        tenant_id: tenant.id,
        user_id: user.id,
        amount: new Decimal(order.total),
        status: 'paid',
        ref_id: 'REF-1',
      };

      await (service as any).issueInvoiceAndSubmit(transaction, { refId: 'REF-1', cardPan: '1234567890123456' });

      const invoices = await prisma.invoice.findMany();
      expect(invoices.length).toBe(1);
      expect(invoices[0].status).toBe('SENT_TO_MOODIAN');

      const items = await prisma.invoiceItem.count();
      expect(items).toBe(1);

      // queue job enqueued with jobId = invoice.id
      const { Queue } = require('bullmq');
      const queue = new Queue('moodian-submit', {
        connection: { host: '127.0.0.1', port: redisPort },
      });
      const counts = await queue.getJobCounts('wait', 'delayed', 'paused');
      expect(counts.wait + counts.delayed + counts.paused).toBe(1);
      await queue.close();

      const audits = await prisma.invoiceAudit.count({ where: { invoice_id: invoices[0].id } });
      expect(audits).toBeGreaterThan(0);
    }, 30000);

    it('is idempotent on duplicate callback (no duplicate invoice/job)', async () => {
      const pgPort = pg.getMappedPort(5432);

      const tenant = await prisma.tenant.create({
        data: { slug: 't2', name: 'Tenant2', status: 'ACTIVE', tax_id: '98765432109876' },
      });
      const vendor = await prisma.vendor.create({
        data: { tenant_id: tenant.id, name: 'Vendor2', slug: 'vendor2', commission_rate: 10 },
      });
      const product = await prisma.product.create({
        data: {
          tenant_id: tenant.id,
          vendor_id: vendor.id,
          sku: 'SKU2',
          name: 'Item2',
          slug: 'item2',
          price: 1090000,
          stock: 10,
          status: 'ACTIVE',
          tax_rate: 9,
        },
      });
      const user = await prisma.user.create({
        data: {
          tenant_id: tenant.id,
          email: 'u2@example.com',
          password_hash: 'x',
          roles: { create: [{ role: 'CUSTOMER', tenant_id: tenant.id }] },
          is_active: true,
        },
      });
      const order = await prisma.order.create({
        data: {
          tenant_id: tenant.id,
          user_id: user.id,
          order_number: 'ORD-2',
          status: 'PAID',
          subtotal: 1000000,
          discount_amount: 0,
          tax_amount: 90000,
          total: 1090000,
          created_at: new Date(),
        },
      });
      const payment = await prisma.payment.create({
        data: {
          tenant_id: tenant.id,
          user_id: user.id,
          order_id: order.id,
          amount: order.total,
          gateway: 'ZARINPAL',
          status: 'COMPLETED',
          gateway_ref: 'REF-2',
          card_pan: '1234********3456',
        },
      });
      await prisma.orderItem.create({
        data: {
          order_id: order.id,
          product_id: product.id,
          tenant_id: tenant.id,
          product_name: 'Item2',
          product_sku: 'SKU2',
          quantity: 1,
          unit_price: 1090000,
          total: 1090000,
        },
      });

      const queueService = new QueueService(
        new ConfigService({ REDIS_HOST: '127.0.0.1', REDIS_PORT: redisPort }),
      );
      const circuitBreakerService: any = { createBreaker: () => ({}), fire: async () => ({}) };
      const auditService: any = {};
      const securityService: any = {};
      const taxService = {
        submitInvoice: async () => ({ status: 'PENDING' as const, senaRefId: 'SENA-2' }),
      } as unknown as TaxService;
      const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
      const privPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
      const pubPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
      const config = new ConfigService({
        FEATURE_MOODIAN_V2: 'true',
        MOODIAN_PRIVATE_KEY: privPem,
        MOODIAN_PUBLIC_KEY: pubPem,
      });
      const signatureService = new ElectronicSignatureService(config);

      const service = new PaymentService(
        prisma,
        securityService,
        circuitBreakerService,
        auditService,
        taxService,
        config,
        signatureService,
        queueService,
      );

      const transaction = {
        payment_id: payment.id,
        order_id: order.id,
        tenant_id: tenant.id,
        user_id: user.id,
        amount: new Decimal(order.total),
        status: 'paid',
        ref_id: 'REF-2',
      };

      // Call twice
      await (service as any).issueInvoiceAndSubmit(transaction, { refId: 'REF-2', cardPan: '1234567890123456' });
      await (service as any).issueInvoiceAndSubmit(transaction, { refId: 'REF-2', cardPan: '1234567890123456' });

      const invoices = await prisma.invoice.findMany({ where: { order_id: order.id } });
      expect(invoices.length).toBe(1);

      const { Queue } = require('bullmq');
      const queue = new Queue('moodian-submit', {
        connection: { host: '127.0.0.1', port: redisPort },
      });
      const counts = await queue.getJobCounts('wait', 'delayed', 'paused');
      expect(counts.wait + counts.delayed + counts.paused).toBe(1);
      await queue.close();
    }, 30000);
  },
);
