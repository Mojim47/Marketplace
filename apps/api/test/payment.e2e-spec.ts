import { randomUUID } from 'crypto';
import type { CanActivate, ExecutionContext, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@nextgen/waf', () => ({
  WAFService: class WAFService {},
}));

vi.mock('@nextgen/payment', () => {
  return {
    ZarinPalService: class {
      requestPayment = vi.fn();
      verifyPayment = vi.fn();
      refundPayment = vi.fn();
      getUnverifiedTransactions = vi.fn();
      isSandbox = vi.fn();
    },
  };
});

const SCHEMA = 'e2e_payment';

class TestJwtAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    request.user = { id: 'user_1' };
    return true;
  }
}

class TestPrismaService {
  constructor(private readonly client: PrismaClient) {}

  order = {
    findFirst: async ({ where }: any) => {
      const rows = await this.client.$queryRawUnsafe<
        Array<{
          id: string;
          user_id: string;
          payment_status: string;
          total_amount: number;
          order_number: string;
          customer_phone: string | null;
          customer_email: string | null;
          status: string;
        }>
      >(
        `SELECT id, user_id, payment_status, total_amount, order_number, customer_phone, customer_email, status
         FROM "${SCHEMA}"."orders"
         WHERE id = $1 AND user_id = $2
         LIMIT 1`,
        where.id,
        where.userId
      );

      const row = rows[0];
      if (!row) return null;

      return {
        id: row.id,
        userId: row.user_id,
        paymentStatus: row.payment_status,
        totalAmount: new Decimal(row.total_amount),
        orderNumber: row.order_number,
        customerPhone: row.customer_phone,
        customerEmail: row.customer_email,
        status: row.status,
      };
    },
    update: async ({ where, data }: any) => {
      await this.client.$executeRawUnsafe(
        `UPDATE "${SCHEMA}"."orders"
         SET payment_status = $1, status = $2
         WHERE id = $3`,
        data.paymentStatus,
        data.status,
        where.id
      );
      return true;
    },
  };

  paymentTransaction = {
    create: async ({ data }: any) => {
      const id = data.id || randomUUID();
      const amount = data.amount?.toNumber ? data.amount.toNumber() : Number(data.amount);

      await this.client.$executeRawUnsafe(
        `INSERT INTO "${SCHEMA}"."payment_transactions"
          (id, user_id, order_id, authority, amount, description, mobile, email, callback_url, gateway, status)
         VALUES
          ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        id,
        data.userId,
        data.orderId,
        data.authority,
        amount,
        data.description,
        data.mobile,
        data.email,
        data.callbackUrl,
        data.gateway,
        data.status
      );

      return {
        id,
        authority: data.authority,
      };
    },
    findUnique: async ({ where }: any) => {
      const rows = await this.client.$queryRawUnsafe<
        Array<{
          id: string;
          user_id: string;
          order_id: string;
          authority: string;
          amount: number;
          status: string;
          ref_id: string | null;
          card_pan: string | null;
        }>
      >(
        `SELECT id, user_id, order_id, authority, amount, status, ref_id, card_pan
         FROM "${SCHEMA}"."payment_transactions"
         WHERE authority = $1
         LIMIT 1`,
        where.authority
      );

      const row = rows[0];
      if (!row) return null;

      return {
        id: row.id,
        userId: row.user_id,
        orderId: row.order_id,
        authority: row.authority,
        amount: new Decimal(row.amount),
        status: row.status,
        refId: row.ref_id,
        cardPan: row.card_pan,
      };
    },
    update: async ({ where, data }: any) => {
      const status = data.status ?? null;
      const refId = data.refId ?? null;
      const cardPan = data.cardPan ?? null;
      const cardHash = data.cardHash ?? null;
      const feeType = data.feeType ?? null;
      const fee = data.fee?.toNumber ? data.fee.toNumber() : (data.fee ?? null);
      const errorMessage = data.errorMessage ?? null;

      if (where.authority) {
        await this.client.$executeRawUnsafe(
          `UPDATE "${SCHEMA}"."payment_transactions"
           SET status = $1, ref_id = $2, card_pan = $3, card_hash = $4, fee_type = $5, fee = $6, error_message = $7
           WHERE authority = $8`,
          status,
          refId,
          cardPan,
          cardHash,
          feeType,
          fee,
          errorMessage,
          where.authority
        );
      } else if (where.id) {
        await this.client.$executeRawUnsafe(
          `UPDATE "${SCHEMA}"."payment_transactions"
           SET status = $1, ref_id = $2, card_pan = $3, card_hash = $4, fee_type = $5, fee = $6, error_message = $7
           WHERE id = $8`,
          status,
          refId,
          cardPan,
          cardHash,
          feeType,
          fee,
          errorMessage,
          where.id
        );
      }

      return true;
    },
  };

  $transaction = async (operations: Array<Promise<unknown>>) => Promise.all(operations);
}

describe('Payment E2E', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let container: PostgreSqlContainer;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16-alpine')
      .withDatabase('nextgen_test')
      .withUsername('test_user')
      .withPassword('test_password')
      .start();

    const databaseUrl = `${container.getConnectionUri()}?schema=public`;
    process.env.NODE_ENV = 'development';
    process.env.DATABASE_URL = databaseUrl;
    process.env.JWT_SECRET = 'test_jwt_secret__very_long_and_secure__64chars_minimum__v1';
    process.env.JWT_ISSUER = 'nextgen-test';
    process.env.JWT_AUDIENCE = 'nextgen-test-api';
    process.env.APP_URL = 'http://localhost:3001';

    prisma = new PrismaClient({ datasourceUrl: databaseUrl });

    await prisma.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS "${SCHEMA}"`);
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "${SCHEMA}"."orders" (
        id text PRIMARY KEY,
        user_id text NOT NULL,
        payment_status text NOT NULL,
        total_amount numeric(15,2) NOT NULL,
        order_number text NOT NULL,
        customer_phone text,
        customer_email text,
        status text NOT NULL
      )
    `);

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "${SCHEMA}"."payment_transactions" (
        id text PRIMARY KEY,
        user_id text NOT NULL,
        order_id text NOT NULL,
        authority text NOT NULL,
        amount numeric(15,2) NOT NULL,
        description text,
        mobile text,
        email text,
        callback_url text,
        gateway text,
        status text,
        ref_id text,
        card_pan text,
        card_hash text,
        fee_type text,
        fee numeric(15,2),
        paid_at timestamptz,
        verified_at timestamptz,
        error_message text
      )
    `);

    const { AppModule } = await import('../src/app.module');
    const { JwtAuthGuard } = await import('../src/common/guards/jwt-auth.guard');
    const { PrismaService } = await import('../src/database/prisma.service');

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideGuard(JwtAuthGuard)
      .useClass(TestJwtAuthGuard)
      .overrideProvider(PrismaService)
      .useValue(new TestPrismaService(prisma))
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${SCHEMA}"."payment_transactions"`);
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${SCHEMA}"."orders"`);
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
    await container.stop();
  });

  it('processes payment request and verification flow', async () => {
    const orderId = 'order_1';

    await prisma.$executeRawUnsafe(
      `INSERT INTO "${SCHEMA}"."orders"
        (id, user_id, payment_status, total_amount, order_number, customer_phone, customer_email, status)
       VALUES
        ($1,$2,$3,$4,$5,$6,$7,$8)`,
      orderId,
      'user_1',
      'PENDING',
      100000,
      'ORD-1',
      '09120000000',
      'user@example.com',
      'DRAFT'
    );

    const paymentService = app.get(
      (await import('../src/payment/payment.service')).PaymentService
    ) as any;
    paymentService.zarinpalService.requestPayment.mockResolvedValue({
      authority: 'AUTH-1',
      redirectUrl: 'https://zarinpal.com/pay/AUTH-1',
    });
    paymentService.zarinpalService.verifyPayment.mockResolvedValue({
      refId: 'REF-1',
      cardPan: '1234',
      cardHash: 'hash',
      feeType: 'Merchant',
      fee: 1000,
    });

    const requestResponse = await request(app.getHttpServer()).post('/payment/request').send({
      orderId,
      description: '������ ���',
      callbackUrl: 'http://localhost:3001/payment/verify',
    });

    expect(requestResponse.status).toBe(200);
    expect(requestResponse.body.paymentUrl).toBe('https://zarinpal.com/pay/AUTH-1');

    const pendingRows = await prisma.$queryRawUnsafe<Array<{ status: string }>>(
      `SELECT status FROM "${SCHEMA}"."payment_transactions" WHERE authority = $1`,
      'AUTH-1'
    );
    expect(pendingRows[0]?.status).toBe('pending');

    const verifyResponse = await request(app.getHttpServer())
      .get('/payment/verify')
      .query({ Authority: 'AUTH-1', Status: 'OK' });

    expect(verifyResponse.status).toBe(200);
    expect(verifyResponse.body.success).toBe(true);

    const paidRows = await prisma.$queryRawUnsafe<Array<{ status: string; ref_id: string | null }>>(
      `SELECT status, ref_id FROM "${SCHEMA}"."payment_transactions" WHERE authority = $1`,
      'AUTH-1'
    );
    expect(paidRows[0]?.status).toBe('paid');
    expect(paidRows[0]?.ref_id).toBe('REF-1');
  });
});
