import { randomUUID } from 'node:crypto';
import {
  Body,
  CanActivate,
  Controller,
  ExceptionFilter,
  ArgumentsHost,
  Get,
  Global,
  Inject,
  Module,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
  HttpException,
  type ExecutionContext,
  type INestApplication,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { getCurrentCorrelationContext } from '../src/_middleware/correlation-id.middleware';

type StructuredLog = {
  message?: string;
  traceId?: string;
  metadata?: Record<string, unknown>;
};

const readJsonLogs = (spy: ReturnType<typeof vi.spyOn>): StructuredLog[] => {
  return spy.mock.calls
    .map((call) => call[0])
    .filter((item): item is string => typeof item === 'string')
    .map((line) => {
      try {
        return JSON.parse(line) as StructuredLog;
      } catch {
        return null;
      }
    })
    .filter((entry): entry is StructuredLog => entry !== null);
};

type StateLock = { key: string; token: string };

class InMemoryStateService {
  private readonly state = new Map<string, string>();
  private readonly expiresAt = new Map<string, number>();
  private readonly locks = new Map<string, { token: string; expiresAt: number }>();

  private keyForState(key: string) {
    return `state:${key}`;
  }

  private lockForState(key: string) {
    return `lock:${key}`;
  }

  private isExpired(key: string): boolean {
    const expires = this.expiresAt.get(key);
    if (!expires) return false;
    if (Date.now() <= expires) return false;
    this.state.delete(key);
    this.expiresAt.delete(key);
    return true;
  }

  async setState<T>(key: string, value: T, options?: { ttlSeconds?: number }): Promise<boolean> {
    const stateKey = this.keyForState(key);
    this.state.set(stateKey, JSON.stringify(value));
    const ttlSeconds = options?.ttlSeconds ?? 3600;
    this.expiresAt.set(stateKey, Date.now() + ttlSeconds * 1000);
    return true;
  }

  async getState<T>(key: string): Promise<T | null> {
    const stateKey = this.keyForState(key);
    if (this.isExpired(stateKey)) {
      return null;
    }
    const raw = this.state.get(stateKey);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  }

  async deleteState(key: string): Promise<boolean> {
    const stateKey = this.keyForState(key);
    const had = this.state.has(stateKey);
    this.state.delete(stateKey);
    this.expiresAt.delete(stateKey);
    return had;
  }

  async acquireLock(
    key: string,
    options?: { ttlMs?: number; retryAttempts?: number; retryDelayMs?: number }
  ): Promise<StateLock | null> {
    const lockKey = this.lockForState(key);
    const ttlMs = options?.ttlMs ?? 10000;
    const retryAttempts = options?.retryAttempts ?? 3;
    const retryDelayMs = options?.retryDelayMs ?? 20;

    for (let i = 0; i < retryAttempts; i++) {
      const current = this.locks.get(lockKey);
      if (!current || current.expiresAt <= Date.now()) {
        const token = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        this.locks.set(lockKey, { token, expiresAt: Date.now() + ttlMs });
        return { key, token };
      }
      if (i < retryAttempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
      }
    }

    return null;
  }

  async releaseLock(lock: StateLock): Promise<boolean> {
    const lockKey = this.lockForState(lock.key);
    const current = this.locks.get(lockKey);
    if (!current || current.token !== lock.token) {
      return false;
    }
    this.locks.delete(lockKey);
    return true;
  }
}

class InMemoryPrismaService {
  private users: any[] = [];
  private vendors: any[] = [];
  private categories: any[] = [];
  private products: any[] = [];
  private orders: any[] = [];

  user = {
    create: async ({ data }: any) => {
      const user = { id: randomUUID(), ...data };
      this.users.push(user);
      return user;
    },
  };

  vendor = {
    create: async ({ data }: any) => {
      const vendor = { id: randomUUID(), ...data, businessName: data.storeName };
      this.vendors.push(vendor);
      return vendor;
    },
  };

  category = {
    create: async ({ data }: any) => {
      const category = { id: randomUUID(), ...data };
      this.categories.push(category);
      return category;
    },
  };

  product = {
    create: async ({ data }: any) => {
      const product = { id: randomUUID(), isActive: true, images: [], ...data };
      this.products.push(product);
      return product;
    },
    findUnique: async ({ where, select }: any) => {
      const product = this.products.find((p) => p.id === where.id) || null;
      if (!product) return null;
      if (!select) return product;
      const picked: any = {};
      for (const key of Object.keys(select)) {
        if (select[key]) picked[key] = product[key];
      }
      return picked;
    },
    update: async ({ where, data }: any) => {
      const product = this.products.find((p) => p.id === where.id);
      if (!product) throw new Error('product_not_found');
      if (data?.stock?.decrement) product.stock -= data.stock.decrement;
      if (data?.stock?.increment) product.stock += data.stock.increment;
      return product;
    },
  };

  discount = {
    findFirst: async () => null,
  };

  order = {
    create: async ({ data }: any) => {
      const items = (data.items?.create || []).map((item: any) => ({
        id: randomUUID(),
        ...item,
      }));
      const order = {
        id: randomUUID(),
        createdAt: new Date(),
        updatedAt: new Date(),
        ...data,
        items,
      };
      this.orders.push(order);
      return order;
    },
    findMany: async ({ where }: any) => {
      const list = this.orders.filter((o) => (where?.userId ? o.userId === where.userId : true));
      return list.map((o) => ({
        ...o,
        vendor: this.vendors.find((v) => v.id === o.vendorId) || null,
      }));
    },
  };

  async $transaction<T>(fn: (tx: any) => Promise<T>): Promise<T> {
    return fn(this);
  }

  async $disconnect(): Promise<void> {
    return;
  }
}

class NoopSessionService {
  async createSession() {
    return `session-${Date.now()}`;
  }
  async getSession() {
    return null;
  }
  async touchSession() {
    return true;
  }
  async destroySession() {
    return true;
  }
  async isSessionValid() {
    return true;
  }
}

class DeterministicHttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      response.status(status).json(
        typeof body === 'string' ? { statusCode: status, message: body } : body
      );
      return;
    }

    response.status(500).json({ statusCode: 500, message: 'Internal Server Error' });
  }
}

@Global()
@Module({})
class TestRedisModule {
  static register(redisClient: unknown, stateService: unknown, sessionService: unknown) {
    return {
      module: TestRedisModule,
      providers: [
        { provide: 'REDIS_CLIENT', useValue: redisClient },
        { provide: 'STATE_SERVICE', useValue: stateService },
        { provide: 'SESSION_SERVICE', useValue: sessionService },
      ],
      exports: ['REDIS_CLIENT', 'STATE_SERVICE', 'SESSION_SERVICE'],
    };
  }
}

const waitForRedisReady = async (redisClient: { ping: () => Promise<unknown> }, timeoutMs: number) => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      await redisClient.ping();
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }

  throw new Error('redis_not_ready_fail_fast');
};

class ContractJwtGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const auth = request.headers?.authorization;
    const token = typeof auth === 'string' && auth.startsWith('Bearer ') ? auth.slice(7) : null;

    if (!token) {
      throw new UnauthorizedException('unauthorized');
    }

    try {
      const secret = process.env.JWT_SECRET || 'development-jwt-secret-32-chars-minimum';
      const issuer = process.env.JWT_ISSUER || 'nextgen-marketplace';
      const audience = process.env.JWT_AUDIENCE || 'nextgen-api';
      const payload = jwt.verify(token, secret, {
        algorithms: ['HS256'],
        issuer,
        audience,
      }) as {
        sub: string;
        email?: string;
        role?: string;
      };

      request.user = {
        id: payload.sub,
        sub: payload.sub,
        email: payload.email || 'contract@test.local',
        role: payload.role || 'USER',
      };

      return true;
    } catch {
      throw new UnauthorizedException('unauthorized');
    }
  }
}

@Controller('cart')
@UseGuards(ContractJwtGuard)
class TestCartController {
  constructor(@Inject('CART_SERVICE') private readonly cartService: any) {}

  @Post('items')
  add(@Req() req: any, @Body() dto: any) {
    return this.cartService.addToCart(req.user.id, dto);
  }
}

@Controller('checkout')
@UseGuards(ContractJwtGuard)
class TestCheckoutController {
  constructor(@Inject('CHECKOUT_SERVICE') private readonly checkoutService: any) {}

  @Post('init')
  init(@Req() req: any) {
    return this.checkoutService.initCheckout(req.user.id);
  }

  @Put(':sessionId/shipping')
  shipping(@Req() req: any, @Param('sessionId') sessionId: string, @Body() body: any) {
    return this.checkoutService.setShippingAddress(sessionId, req.user.id, body);
  }

  @Put(':sessionId/payment')
  payment(@Req() req: any, @Param('sessionId') sessionId: string, @Body() body: any) {
    return this.checkoutService.setPaymentMethod(sessionId, req.user.id, body.method);
  }

  @Post(':sessionId/complete')
  complete(@Req() req: any, @Param('sessionId') sessionId: string) {
    return this.checkoutService.completeCheckout(sessionId, req.user.id);
  }
}

@Controller('orders')
@UseGuards(ContractJwtGuard)
class TestOrdersController {
  constructor(@Inject('ORDERS_SERVICE') private readonly ordersService: any) {}

  @Get()
  findAll(@Req() req: any) {
    return this.ordersService.findAll(req.user.id, {});
  }
}

describe('Checkout HTTP Contract E2E', () => {
  let app: INestApplication;
  let prisma: any;
  let redisClient: any;
  let logSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  const issueAccessToken = (userId: string, email: string): string => {
    const secret = process.env.JWT_SECRET || 'development-jwt-secret-32-chars-minimum';
    const issuer = process.env.JWT_ISSUER || 'nextgen-marketplace';
    const audience = process.env.JWT_AUDIENCE || 'nextgen-api';
    return jwt.sign(
      { sub: userId, email, role: 'USER' },
      secret,
      {
        algorithm: 'HS256',
        issuer,
        audience,
        expiresIn: '1h',
      }
    );
  };

  beforeAll(async () => {
    const databaseUrl = 'inmemory://nextgen-test';
    const redisUrl = 'redis://mock';

    process.env.NODE_ENV = 'development';
    process.env.DATABASE_URL = databaseUrl;
    process.env.REDIS_URL = redisUrl;
    process.env.JWT_SECRET = 'test_jwt_secret__very_long_and_secure__64chars_minimum__v1';
    process.env.JWT_ISSUER = 'nextgen-test';
    process.env.JWT_AUDIENCE = 'nextgen-test-api';
    process.env.LOG_FORMAT = 'json';

    const { default: RedisMock } = await import('ioredis-mock');
    const { LoggingService } = await import('../src/_observability/logging.service');
    const { CartService } = await import('../src/cart/cart.service');
    const { CheckoutService } = await import('../src/checkout/checkout.service');
    const { PrismaService } = await import('../src/database/prisma.service');
    const { CorrelationIdMiddleware } = await import('../src/_middleware/correlation-id.middleware');

    prisma = new InMemoryPrismaService();
    redisClient = new RedisMock();
    await waitForRedisReady(redisClient, 5000);

    const stateService = new InMemoryStateService();
    const sessionService = new NoopSessionService();
    const loggingStub = {
      log: (message: string, _context?: string, metadata?: Record<string, unknown>) =>
        console.log(
          JSON.stringify({
            level: 'info',
            message,
            metadata,
            traceId: getCurrentCorrelationContext()?.traceId,
          })
        ),
      warn: (message: string, _context?: string, metadata?: Record<string, unknown>) =>
        console.warn(
          JSON.stringify({
            level: 'warn',
            message,
            metadata,
            traceId: getCurrentCorrelationContext()?.traceId,
          })
        ),
      error: (message: string, _stack?: string, _context?: string, metadata?: Record<string, unknown>) =>
        console.error(
          JSON.stringify({
            level: 'error',
            message,
            metadata,
            traceId: getCurrentCorrelationContext()?.traceId,
          })
        ),
      debug: () => undefined,
      verbose: () => undefined,
    };
    const cartServiceInstance = new CartService(prisma, stateService as any);
    const checkoutServiceInstance = new CheckoutService(
      prisma,
      cartServiceInstance as any,
      stateService as any,
      loggingStub as any
    );
    const ordersServiceInstance = {
      findAll: async (userId: string) => prisma.order.findMany({ where: { userId } }),
    };

    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
        TestRedisModule.register(redisClient, stateService, sessionService),
      ],
      controllers: [TestCartController, TestCheckoutController, TestOrdersController],
      providers: [
        { provide: 'CART_SERVICE', useValue: cartServiceInstance },
        { provide: 'CHECKOUT_SERVICE', useValue: checkoutServiceInstance },
        { provide: 'ORDERS_SERVICE', useValue: ordersServiceInstance },
        { provide: PrismaService, useValue: prisma },
      ],
    })
      .compile();

    app = moduleRef.createNestApplication();
    const correlation = new CorrelationIdMiddleware();
    app.use((req: any, res: any, next: any) => correlation.use(req, res, next));
    app.useGlobalFilters(new DeterministicHttpExceptionFilter());
    await app.init();

  }, 180000);

  afterAll(async () => {
    if (app) await app.close();
    if (prisma) await prisma.$disconnect();
    if (redisClient) {
      if (typeof redisClient.disconnect === 'function') {
        redisClient.disconnect();
      }
      if (typeof redisClient.quit === 'function') {
        await redisClient.quit();
      }
    }
  });

  const createUserAndToken = async () => {
    const uniq = randomUUID().slice(0, 8);
    const email = `e2e-${uniq}@example.com`;

    const user = await prisma.user.create({
      data: {
        email,
        mobile: `0912${Math.floor(Math.random() * 8999999 + 1000000)}`,
        passwordHash: `hashed_${uniq}`,
        firstName: 'E2E',
        lastName: 'User',
        role: 'USER',
        isActive: true,
      },
    });

    return { token: issueAccessToken(user.id, user.email) };
  };

  const seedProduct = async () => {
    const uniq = randomUUID().slice(0, 8);
    const vendorUser = await prisma.user.create({
      data: {
        email: `vendor-${uniq}@example.com`,
        firstName: 'Vendor',
        phone: `0912${Math.floor(Math.random() * 8999999 + 1000000)}`,
        mobile: `0912${Math.floor(Math.random() * 8999999 + 1000000)}`,
        passwordHash: `hashed_${uniq}`,
        role: 'USER',
        isTwoFactorEnabled: false,
        emailVerified: new Date(),
        phoneVerified: new Date(),
      } as any,
    });

    const vendor = await prisma.vendor.create({
      data: {
        userId: vendorUser.id,
        storeName: `Vendor ${uniq}`,
        slug: `vendor-${uniq}`,
        businessLegalName: `Vendor ${uniq} LLC`,
        taxNumber: `${Math.floor(Math.random() * 9000000000 + 1000000000)}`,
        status: 'PENDING',
      } as any,
    });

    const category = await prisma.category.create({
      data: {
        name: `Category ${uniq}`,
        slug: `category-${uniq}`,
        isActive: true,
      } as any,
    });

    const product = await prisma.product.create({
      data: {
        vendorId: vendor.id,
        categoryId: category.id,
        name: `Product ${uniq}`,
        slug: `product-${uniq}`,
        description: `Contract product ${uniq}`,
        price: 100000,
        costPrice: 70000,
        stock: 20,
        sku: `sku-${uniq}`,
        status: 'ACTIVE',
      } as any,
    });

    return product;
  };

  it('fails hard for anonymous checkout init', async () => {
    const traceId = `trace-${randomUUID()}`;
    const response = await request(app.getHttpServer())
      .post('/checkout/init')
      .set('x-trace-id', traceId)
      .send({});

    expect(response.status).toBe(401);
  });

  it('blocks forbidden transition and emits guard audit with prevState/nextState/guardReason/traceId', async () => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const traceId = `trace-${randomUUID()}`;
    const { token } = await createUserAndToken();
    const product = await seedProduct();

    const cartAdd = await request(app.getHttpServer())
      .post('/cart/items')
      .set('authorization', `Bearer ${token}`)
      .set('x-trace-id', traceId)
      .send({ productId: product.id, quantity: 1 });
    expect(cartAdd.status).toBe(201);

    const init = await request(app.getHttpServer())
      .post('/checkout/init')
      .set('authorization', `Bearer ${token}`)
      .set('x-trace-id', traceId)
      .send({});
    expect(init.status).toBe(201);

    const paymentBeforeShipping = await request(app.getHttpServer())
      .put(`/checkout/${init.body.id}/payment`)
      .set('authorization', `Bearer ${token}`)
      .set('x-trace-id', traceId)
      .send({ method: 'ONLINE' });
    expect(paymentBeforeShipping.status).toBe(400);
    expect(paymentBeforeShipping.body.message).toBe('checkout_step_transition_forbidden');

    const warnLogs = readJsonLogs(warnSpy).filter((entry) => entry.message === 'checkout_guard_blocked');
    const guardLog = warnLogs.at(-1);
    expect(guardLog).toBeTruthy();
    expect(guardLog?.traceId).toBe(traceId);
    expect(guardLog?.metadata).toEqual(
      expect.objectContaining({
        prevState: 'S6_CHECKOUT_INIT',
        nextState: 'S8_CHECKOUT_PAYMENT_SET',
        guardReason: 'payment_set_requires_payment_step',
      })
    );

    logSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it('executes full cart->checkout->orders path and emits transition audit on real endpoints', async () => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const traceId = `trace-${randomUUID()}`;
    const { token } = await createUserAndToken();
    const product = await seedProduct();

    const cartAdd = await request(app.getHttpServer())
      .post('/cart/items')
      .set('authorization', `Bearer ${token}`)
      .set('x-trace-id', traceId)
      .send({ productId: product.id, quantity: 1 });
    expect(cartAdd.status).toBe(201);

    const init = await request(app.getHttpServer())
      .post('/checkout/init')
      .set('authorization', `Bearer ${token}`)
      .set('x-trace-id', traceId)
      .send({});
    expect(init.status).toBe(201);

    const shipping = await request(app.getHttpServer())
      .put(`/checkout/${init.body.id}/shipping`)
      .set('authorization', `Bearer ${token}`)
      .set('x-trace-id', traceId)
      .send({
        fullName: 'Test User',
        phone: '09120000000',
        province: 'Tehran',
        city: 'Tehran',
        address: 'Tehran, Example St',
        postalCode: '1111111111',
      });
    expect(shipping.status).toBe(200);

    const payment = await request(app.getHttpServer())
      .put(`/checkout/${init.body.id}/payment`)
      .set('authorization', `Bearer ${token}`)
      .set('x-trace-id', traceId)
      .send({ method: 'ONLINE' });
    expect(payment.status).toBe(200);

    const complete = await request(app.getHttpServer())
      .post(`/checkout/${init.body.id}/complete`)
      .set('authorization', `Bearer ${token}`)
      .set('x-trace-id', traceId)
      .send({});
    expect(complete.status).toBe(201);
    expect(typeof complete.body.orderId).toBe('string');
    expect(complete.body.orderId.length).toBeGreaterThan(0);
    expect(typeof complete.body.orderNumber).toBe('string');
    expect(complete.body.orderNumber.length).toBeGreaterThan(0);

    const orders = await request(app.getHttpServer())
      .get('/orders')
      .set('authorization', `Bearer ${token}`)
      .set('x-trace-id', traceId);
    expect(orders.status).toBe(200);
    expect(Array.isArray(orders.body)).toBe(true);
    expect(orders.body.some((order: any) => order.id === complete.body.orderId)).toBe(true);

    const transitionLogs = readJsonLogs(logSpy).filter((entry) => entry.message === 'checkout_transition');
    const checkoutLogs = transitionLogs.filter((entry) => entry.traceId === traceId);

    expect(
      checkoutLogs.map((entry) => entry.metadata).filter(Boolean)
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ prevState: 'S5_CART_ACTIVE', nextState: 'S6_CHECKOUT_INIT' }),
        expect.objectContaining({ prevState: 'S6_CHECKOUT_INIT', nextState: 'S7_CHECKOUT_SHIPPING_SET' }),
        expect.objectContaining({ prevState: 'S7_CHECKOUT_SHIPPING_SET', nextState: 'S8_CHECKOUT_PAYMENT_SET' }),
        expect.objectContaining({
          prevState: 'S8_CHECKOUT_PAYMENT_SET',
          nextState: 'S9_ORDER_CREATED',
          details: expect.objectContaining({
            orderId: complete.body.orderId,
            orderNumber: complete.body.orderNumber,
          }),
        }),
      ])
    );

    logSpy.mockRestore();
    warnSpy.mockRestore();
  });
});
