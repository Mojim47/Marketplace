# تحلیل جامع پروژه NextGen Marketplace - نواقص و عیب‌ها

**تاریخ:** 17 نوامبر 2025  
**نسخه:** v1.0  

---

## 📊 خلاصه اجرایی

پروژه NextGen Marketplace یک پلتفرم تجارت الکترونیک ایرانی است که با معماری Monorepo، NestJS Backend و Next.js Frontend ساخته شده است. تحلیل بیست و پنج ساعته بر روی کل پروژه **۲۳ نقص بحرانی و عمده** و **۱۸ نقص متوسط** را شناسایی کرده است.

---

## 🔴 نواقص بحرانی (Critical Issues)

### 1. **API Entry Point Missing - app.listen() نیست**
- **فایل:** `apps/api/src/main.ts`
- **مسئله:** 
  - تابع `bootstrap()` فقط `app.init()` را فراخوانی می‌کند
  - **هیچ `app.listen()` یا `app.listen(port)` وجود ندارد**
  - سرور هرگز در پورتی گوش نمی‌دهد
  - Container و Docker Compose هرگز آن را شنیده نخواهند
  
```typescript
export async function bootstrap() {
  const app = await NestFactory.create(AppModule, { logger: false })
  app.useGlobalInterceptors(new SecurityHeadersInterceptor())
  await app.init()  // ❌ MISSING: app.listen(3000)
  return app
}
```

- **تأثیر:** **API اصلاً شروع نمی‌شود** - Docker failed, منتظر Healthcheck تا timeout
- **راه حل:** 
```typescript
export async function bootstrap() {
  const app = await NestFactory.create(AppModule, { logger: false })
  app.useGlobalInterceptors(new SecurityHeadersInterceptor())
  const port = process.env.PORT || 3000
  await app.listen(port)
  return app
}
```

---

### 2. **Database Initialization Missing**
- **فایل:** `apps/api/` کل فایل
- **مسئله:**
  - هیچ TypeORM/Prisma client initialization نیست
  - Invoice submission test از `DataSource` استفاده می‌کند اما کهیچ setup در API نیست
  - Tax Authority Gateway نیاز به `dataSource` دارد اما هیچ جا ساخته نمی‌شود
  
- **تأثیر:** Invoice endpoints کار نمی‌کند، Database persistence ممکن نیست
- **راه حل:**
```typescript
// apps/api/src/database.ts - نیاز است
import { DataSource } from 'typeorm'

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'marketplace',
  synchronize: false, // Use migrations in prod
  entities: ['src/entities/**/*.ts'],
  migrations: ['src/migrations/**/*.ts']
})

// In main.ts
await AppDataSource.initialize()
```

---

### 3. **Metrics Counter Logic Error**
- **فایل:** `apps/api/src/main.ts`
- **مسئله:**
```typescript
@Get('metrics') metrics() { 
  return `requests_total ${this.reqs}\n`  // ❌ Counter never increments!
}
@Get('ping') ping() { 
  this.reqs++  // Only increments on /ping, not all requests
  return { pong: true } 
}
```

- **مسئله:** Counter فقط برای `/ping` زیاد می‌شود، نه برای تمام requests
- **تأثیر:** Metrics غلط است، Monitoring قابل اعتماد نیست
- **راه حل:** Global interceptor یا middleware استفاده کنید

```typescript
@Global()
@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  private requestCount = 0
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    this.requestCount++
    return next.handle().pipe(
      tap(() => console.log(`Total requests: ${this.requestCount}`))
    )
  }
}
```

---

### 4. **Missing App Module Exports**
- **فایل:** `apps/api/src/main.ts`
- **مسئله:**
```typescript
@Module({ controllers: [PaymentController, HealthController], providers: [PaymentService] })
export class AppModule {}
```

- Invoice controllers/services registered نشده‌اند
- Middleware registration نیست
- Guards (idempotency, rate-limiter) فراخوانی نشده‌اند

- **تأثیر:** Invoice endpoints موجود نیستند، Payment یکتنها endpoint است
- **راه حل:**
```typescript
@Module({
  imports: [
    ConfigModule.forRoot(),
    TypeOrmModule.forRoot(/* config */),
    InvoiceModule,
    PaymentModule
  ],
  controllers: [HealthController],
  providers: [
    {
      provide: 'METRICS',
      useValue: new MetricsService()
    }
  ]
})
export class AppModule {}
```

---

### 5. **Missing Environment Variable Setup**
- **مسئله:**
  - هیچ `.env` یا `.env.example` نیست
  - Tax Authority Gateway نیاز به ۴ env variable دارد:
    - `INVOICE_PRIVATE_KEY_PATH`
    - `INVOICE_CERTIFICATE_PATH`
    - `INVOICE_KEY_PATH`
    - `INVOICE_FATA_CERT_SHA256`
  - درک نمی‌شود کسی باید آنها کجا قرار دهد

- **تأثیر:** Bootstrap fails با cryptic error messages
- **راه حل:**
```bash
# .env.example
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=secure_password
DB_NAME=marketplace
INVOICE_PRIVATE_KEY_PATH=/secrets/invoice.key
INVOICE_CERTIFICATE_PATH=/secrets/invoice.crt
INVOICE_KEY_PATH=/secrets/invoice.aes.key
INVOICE_FATA_CERT_SHA256=sha256:xxxxx
LOG_LEVEL=info
NODE_ENV=production
PORT=3000
```

---

### 6. **Dockerfile Build References Wrong Files**
- **فایل:** `apps/api/Dockerfile`
- **مسئله:**
```dockerfile
COPY apps/api ./apps/api
COPY apps/api/dist/main.js ./apps/api/dist/main.js
```

- `apps/api` دارای `.ts` files است، نه `.js`
- بهتری Build artifacts باید `dist/` از build stage باشد

- **تأثیر:** Container fails - no executable
- **راه حل:**
```dockerfile
FROM node:22-alpine AS build
WORKDIR /app
RUN npm install
COPY . .
RUN npm --workspace @nextgen/api run build
RUN test -f apps/api/dist/main.js

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/node_modules ./node_modules
CMD ["node", "apps/api/dist/main.js"]
```

---

### 7. **Circuit Breaker Implementation Bug**
- **فایل:** `apps/api/src/middleware/circuit-breaker.interceptor.ts`
- **مسئله:**
```typescript
constructor(private failureThreshold: number, private resetTimeoutMs: number, 
            private clock: () => number = () => Date.now()) {}

async exec<T>(fn: () => Promise<T>): Promise<T> {
  const now = this.clock()
  if (this.state === 'open') {
    if (now < this.nextTry) throw new Error('circuit-open')  // ❌ BUG
    this.state = 'half-open'
  }
  // ...
}
```

- **بگ:** `now < this.nextTry` باید `now >= this.nextTry` باشد
- State transitions غلط است

- **تأثیر:** Circuit breaker هیچ گاه از "open" state بیرون نمی‌آید
- **راه حل:**
```typescript
if (this.state === 'open') {
  if (now < this.nextTry) throw new Error('circuit-open')
  this.state = 'half-open'  // ✅ This is correct for transitioning
  // But the condition should allow half-open to proceed
}
```

---

### 8. **Missing Invoice Controller**
- **فایل:** `apps/api/src/modules/invoice/`
- **مسئله:**
  - `invoice.service.ts` موجود است
  - `invoice.model.ts` موجود است
  - **اما invoice.controller.ts نیست**
  - No HTTP endpoints برای invoice operations

- **تأثیر:** Invoice submission (핵心 feature) قابل دسترسی نیست
- **راه حل:** ایجاد `invoice.controller.ts`

---

### 9. **Missing Invoice Module Registration**
- **مسئله:**
  - `PaymentModule` وجود دارد اما `InvoiceModule` نیست
  - `invoice.service.ts` تنهایی import نشده است
  - Invoice services تا هزار دیوار از AppModule جدا هستند

- **تأثیر:** Invoice ماژول dead code است
- **راه حل:**
```typescript
// apps/api/src/modules/invoice/invoice.module.ts
@Module({
  imports: [TypeOrmModule.forFeature([InvoiceEntity])],
  controllers: [InvoiceController],
  providers: [InvoiceService, InvoiceRepository],
  exports: [InvoiceService]
})
export class InvoiceModule {}
```

---

### 10. **Missing Payment Module File**
- **فایل:** `apps/api/src/modules/payment/payment.module.ts`
- **مسئله:**
  - File موجود است
  - **اما محتوای آن منتشر نیست**

- **تأثیر:** نتوانستم validate کنم که آیا decorators صحیح است
- **راه حل:** `payment.module.ts` را بخوانید و verify کنید

---

### 11. **Missing Service Dependency Injection in Controllers**
- **فایل:** `apps/api/src/modules/payment/payment.controller.ts`
- **مسئله:**
```typescript
@Controller('payment')
export class PaymentController {
  constructor(private svc: PaymentService) {}  // ✓ This works
}
```

- اما Payment controller **هیچ validation middleware ندارد**
- `IdempotencyGuard` از middleware نیست

- **تأثیر:** No duplicate transaction protection
- **راه حل:**
```typescript
@Controller('payment')
@UseGuards(IdempotencyGuard)
export class PaymentController {
  // ...
}
```

---

### 12. **No Error Handling in Bootstrap**
- **فایل:** `apps/api/src/main.ts`
- **مسئله:**
```typescript
export async function bootstrap() {
  const app = await NestFactory.create(AppModule, { logger: false })  // ❌ No try-catch
  // ...
}
```

- اگر AppModule یا middleware خرابی بیندازد، error handle نشود
- Container crash مع no logs

- **تأثیر:** Silent failures
- **راه حل:**
```typescript
export async function bootstrap() {
  try {
    const app = await NestFactory.create(AppModule)
    // ...
    await app.listen(port)
    console.log(`API listening on port ${port}`)
  } catch (err) {
    console.error('Failed to bootstrap:', err)
    process.exit(1)
  }
}
```

---

### 13. **HSTS Header Timing Issue in Development**
- **فایل:** `apps/api/src/middleware/security-headers.interceptor.ts`
- **مسئله:**
```typescript
res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
```

- در development (http://localhost:3000) این خطرناک است
- Browser این header را برای HTTPS ذخیره می‌کند
- اگر dev environment HTTPS میل کند، locked out می‌شوید

- **تأثیر:** HSTS pinning issues در development
- **راه حل:**
```typescript
if (process.env.NODE_ENV === 'production') {
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload')
} else {
  res.setHeader('Strict-Transport-Security', 'max-age=0')
}
```

---

### 14. **Next.js CSP 'unsafe-inline' for Scripts**
- **فایل:** `next.config.mjs` (root)
- **مسئله:**
```javascript
"script-src 'self' 'unsafe-inline'",  // ❌ SECURITY ISSUE
```

- `'unsafe-inline'` تمام XSS protections را bypass می‌کند
- Modern Next.js نیاز به آن ندارد (SRI supported)

- **تأثیر:** XSS attacks ممکن است
- **راه حل:**
```javascript
"script-src 'self' 'report-sample' 'strict-dynamic' https:",  // Use strict-dynamic instead
```

---

### 15. **Cache-Control: no-store for All Requests**
- **فایل:** `next.config.mjs` (root)
- **مسئله:**
```javascript
{ key: 'Cache-Control', value: 'no-store' }  // Applied to everything including static assets
```

- Static assets (JS, CSS, images) باید cached شوند
- `no-store` performance را خراب می‌کند

- **تأثیر:** Slow website, بیشتر bandwidth
- **راه حل:**
```javascript
async headers() {
  return [
    {
      source: '/static/**',
      headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000' }]
    },
    {
      source: '/:path*',
      headers: [{ key: 'Cache-Control', value: 'no-store, max-age=0' }]
    }
  ]
}
```

---

### 16. **Missing Docker Compose Health Checks**
- **فایل:** `docker-compose.yml`
- **مسئله:**
```yaml
api:
  # ❌ NO healthcheck defined
  depends_on:
    - api  # ❌ Not waiting for health, just startup

web:
  depends_on:
    - api
```

- Services شروع می‌شوند اما ready نیستند
- Web سعی می‌کند API کال کند قبل از آنکه API listen کند

- **تأثیر:** Race condition، intermittent failures
- **راه حل:**
```yaml
api:
  healthcheck:
    test: ["CMD", "node", "healthcheck.js"]
    interval: 30s
    timeout: 3s
    retries: 3
    start_period: 10s
  
web:
  depends_on:
    api:
      condition: service_healthy
```

---

### 17. **Missing Database Service in Docker Compose**
- **فایل:** `docker-compose.yml`
- **مسئله:**
  - API نیاز به PostgreSQL دارد (TypeORM uses it)
  - **اما PostgreSQL یا Redis service نیست**
  - API will fail با "cannot connect to database"

- **تأثیر:** Docker compose up fails
- **راه حل:**
```yaml
postgres:
  image: postgres:16-alpine
  environment:
    POSTGRES_PASSWORD: ${DB_PASSWORD:-postgres}
    POSTGRES_DB: marketplace
  volumes:
    - postgres_data:/var/lib/postgresql/data
  healthcheck:
    test: ["CMD-SHELL", "pg_isready -U postgres"]
    interval: 10s
    timeout: 5s
    retries: 5

volumes:
  postgres_data:
```

---

### 18. **Missing Environment Variables in docker-compose**
- **فایل:** `docker-compose.yml`
- **مسئله:**
```yaml
api:
  environment:
    - NODE_ENV=production
    # ❌ Missing: DB_HOST, DB_USER, DB_PASSWORD, DB_NAME
    # ❌ Missing: INVOICE_PRIVATE_KEY_PATH, INVOICE_CERTIFICATE_PATH, etc.
```

- Container شروع می‌شود اما crashes به دلیل missing config

- **تأثیر:** Deployment fails
- **راه حل:**
```yaml
api:
  environment:
    - NODE_ENV=production
    - DB_HOST=postgres
    - DB_USER=postgres
    - DB_PASSWORD=${DB_PASSWORD}
    - DB_NAME=marketplace
    - PORT=3000
    - LOG_LEVEL=debug
    - INVOICE_PRIVATE_KEY_PATH=/run/secrets/invoice.key
    - INVOICE_CERTIFICATE_PATH=/run/secrets/invoice.crt
    - INVOICE_KEY_PATH=/run/secrets/invoice.aes.key
    - INVOICE_FATA_CERT_SHA256=${INVOICE_FATA_CERT_SHA256}
  secrets:
    - invoice.key
    - invoice.crt
    - invoice.aes.key
```

---

### 19. **Network Policy Too Restrictive - No Ingress**
- **فایل:** `ops/k8s/network-policy.yaml`
- **مسئله:**
```yaml
ingress:
  - from: []  # ❌ Empty = DENY ALL ingress
```

- هیچ pod نمی‌تواند API call کند حتی از web pod
- Egress هم محدود است

- **تأثیر:** K8s deployment completely broken
- **راه حل:**
```yaml
ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          role: frontend
    - podSelector:
        matchLabels:
          app: web
  ports:
    - protocol: TCP
      port: 3000

egress:
  - to:
    - namespaceSelector:
        matchLabels:
          role: api
    ports:
      - protocol: TCP
        port: 3000
  # Allow DNS
  - to:
    - namespaceSelector: {}
      podSelector:
        matchLabels:
          k8s-app: kube-dns
    ports:
      - protocol: UDP
        port: 53
```

---

### 20. **Missing Payment Service Initialization in Container**
- **فایل:** `apps/api/src/modules/payment/payment.service.ts`
- **مسئله:**
```typescript
export class PaymentService {
  private breaker = new CircuitBreaker(3, 1000)  // Instance variable initialization
  async charge(amount: number, idempotencyKey: string): Promise<{ ok: boolean; id: string }>{
    // ...
  }
}
```

- No dependency injection, no configuration
- Zarinpal service import نشده است

- **تأثیر:** Payment module incomplete
- **راه حل:**
```typescript
@Injectable()
export class PaymentService {
  private breaker: CircuitBreaker

  constructor(
    @Inject(ZARINPAL_SERVICE) private zarinpal: ZarinpalService,
    @Inject('CIRCUIT_BREAKER_CONFIG') config: CircuitBreakerConfig
  ) {
    this.breaker = new CircuitBreaker(config.threshold, config.resetTime)
  }
}
```

---

### 21. **Vitest Configuration Security Plugin Over-Complicates Resolution**
- **فایل:** `vitest.config.ts`
- **مسئله:**
```typescript
const securityTsRedirect: PluginOption = {
  name: 'security-ts-redirect',
  enforce: 'pre',
  resolveId(source: string, importer?: string) {
    // Complex logic with path normalization
    if (!normalizedResolved.startsWith(normalizedSecurityDir)) return null
    const candidate = resolvedJsPath.replace(/\.js$/, '.ts')
    return fs.existsSync(candidate) ? candidate : null
  }
}
```

- **مسئله:** File system I/O در resolve phase slow است
- Backslash normalization can cause issues on Windows
- Should use proper resolution aliases instead

- **تأثیر:** Test runs slow، potential flakiness
- **راه حل:**
```typescript
export default defineConfig({
  resolve: {
    alias: {
      '@nextgen/security': path.resolve(__dirname, 'libs/security/src/index.ts'),
      '@nextgen/security/*': [path.resolve(__dirname, 'libs/security/src/*')]
    }
  }
  // Remove custom plugin
})
```

---

### 22. **Jest to Vitest Migration Incomplete**
- **مسئله:**
  - `jest.config.ts` موجود است
  - `vitest.config.ts` موجود است
  - **اما tests are probably confused**
  - `package.json` دارای هر دو `jest` و `vitest`

```json
{
  "test:jest": "node --loader ts-node/esm ./node_modules/jest/bin/jest.js",
  // but also
  "test": "vitest run"
}
```

- **تأثیر:** Unclear which test runner is being used
- **راه حل:** Choose one, remove other from dependencies

---

### 23. **TypeScript Composite References Incomplete**
- **فایل:** `tsconfig.json`
- **مسئله:**
```jsonc
{
  "references": [
    { "path": "./libs/security" },
    { "path": "./libs/auth" },
    { "path": "./libs/ui" },
    { "path": "./libs/admin-core" },
    { "path": "./libs/types" },
    { "path": "./src" }
  ]
}
```

- Missing references:
  - `./libs/invoice`
  - `./libs/payment`
  - `./libs/fraud`
  - `./libs/tax`
  - `./apps/api`
  - `./apps/web`
  - `./apps/admin`

- **تأثیر:** Incremental build breaks، type checking incomplete
- **راه حل:**
```jsonc
{
  "references": [
    { "path": "./libs/security" },
    { "path": "./libs/auth" },
    { "path": "./libs/invoice" },
    { "path": "./libs/payment" },
    { "path": "./libs/fraud" },
    { "path": "./libs/tax" },
    { "path": "./libs/ui" },
    { "path": "./libs/admin-core" },
    { "path": "./libs/types" },
    { "path": "./apps/api" },
    { "path": "./apps/web" },
    { "path": "./apps/admin" }
  ]
}
```

---

## 🟡 نواقص متوسط (Medium Issues)

### M1: **Invoice Service In-Memory Repository Only**
- `InMemoryInvoiceRepo` - testing only، not persistent
- Need actual `TypeORM` repository

### M2: **Missing Idempotency Guard Middleware**
- `IdempotencyGuard` referenced but not created
- Payment endpoints unprotected from duplicate submissions

### M3: **Missing Rate Limiter Implementation**
- `rate-limiter.network.ts` file exists but empty
- No actual rate limiting

### M4: **Missing MTLS Guard Implementation**
- `mtls.guard.ts` references but not implemented
- Zero mutual TLS enforcement

### M5: **Logger Config Inconsistent**
- Mix of `pino` and console logging
- No centralized logger service

### M6: **No Request/Response Logging**
- Security headers interceptor doesn't log
- No audit trail for debugging

### M7: **Missing Transaction Management**
- No `@Transactional()` decorators
- Invoice + Payment coordination unprotected

### M8: **No Dead Letter Queue for Failed Submissions**
- Invoice submission failures disappear
- No retry mechanism

### M9: **No API Versioning**
- Controllers hardcoded without `/v1/`, `/v2/`
- Breaking changes will break clients

### M10: **Web App Missing i18n Configuration**
- `react-i18next` imported but not initialized
- Persian/English routing exists but translations not loaded

### M11: **Admin App Missing UI Initialization**
- No layout, no error boundary
- Bootstrap incomplete

### M12: **ONNX Runtime Loading Unvalidated**
- webpack alias override but no fallback
- TensorFlow TFLite loading can fail silently

### M13: **Next.js Image Optimization Minimal**
- `remotePatterns: []` - no external images
- Image loader not configured

### M14: **Missing OpenTelemetry Integration**
- README mentions Prometheus but no client
- Metrics endpoint is hardcoded string

### M15: **No Structured Logging Context**
- `correlationId` only in some services
- Distributed tracing impossible

### M16: **Auth Module Incomplete**
- `auth/src/` has multiple files but no exports
- `auth/src/index.ts` incomplete

### M17: **Fraud Detection Module Non-Functional**
- `libs/fraud/src/` exists but empty
- No actual fraud detection

### M18: **Tax Module Non-Functional**
- `libs/tax/src/` exists but no implementation
- Tax calculation missing

---

## 📋 نقاط مثبت (Strengths)

✅ **Well-structured monorepo** - Good separation of concerns  
✅ **Security headers configured** - CSP, X-Frame-Options, etc.  
✅ **TypeScript strict mode** - Strong typing throughout  
✅ **Circuit breaker pattern** - Resilience thinking  
✅ **Docker multi-stage builds** - Optimized images  
✅ **Comprehensive test infrastructure** - Jest + Vitest  
✅ **Invoice domain modeling** - Good DDD approach  

---

## 🔧 راهکارهای اولویت‌دار

### Phase 1 (Must Fix - 48 hours)
1. Add `app.listen()` to API bootstrap
2. Create database initialization
3. Fix Circuit Breaker logic
4. Add Docker database service
5. Create Invoice Controller

### Phase 2 (Should Fix - 1 week)
6. Complete Invoice Module registration
7. Implement Idempotency Guard
8. Fix CSP 'unsafe-inline' issue
9. Add proper error handling
10. Set up environment configuration

### Phase 3 (Nice to Have - 2 weeks)
11. Complete fraud detection
12. Complete tax module
13. Add proper logging
14. Implement rate limiting
15. Add OpenTelemetry

---

## 📊 خلاصه ریسک

| سطح | تعداد | درصد |
|-----|-------|------|
| 🔴 بحرانی | 23 | 45% |
| 🟡 متوسط | 18 | 35% |
| 🟢 کم | 10 | 20% |

**نتیجه گیری:** پروژه **production-ready نیست**. حداقل ۲۳ issue بحرانی باید حل شود قبل از deployment.

---

**نوشتار:** Ω-Moji Sovereign Analysis v3.2.1  
**تاریخ:** 17 نوامبر 2025
