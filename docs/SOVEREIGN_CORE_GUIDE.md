# 🏛️ SOVEREIGN DISTRIBUTION CORE - راهنمای جامع

## 📋 فهرست مطالب

1. [معرفی](#معرفی)
2. [معماری سیستم](#معماری-سیستم)
3. [Price Sovereignty Engine](#price-sovereignty-engine)
4. [Risk & Credit Scoring Engine](#risk--credit-scoring-engine)
5. [Warranty Registry System](#warranty-registry-system)
6. [API Endpoints](#api-endpoints)
7. [تست‌های یکپارچگی مالی](#تستهای-یکپارچگی-مالی)
8. [دستورالعمل‌های امنیتی](#دستورالعملهای-امنیتی)

---

## معرفی

**Sovereign Distribution Core** یک لایه یکپارچگی مالی Production-Grade است که برای سیستم توزیع B2B طراحی شده و **ریسک عملیاتی نزدیک به صفر** را تضمین می‌کند.

### ویژگی‌های کلیدی

- ✅ **Price Sovereignty**: قیمت‌گذاری دینامیک با Volatility Indexes و Price Locking
- ✅ **Risk Management**: امتیازدهی ریسک با فرمول Lambda Decay و واچینگ شهرت‌محور
- ✅ **Warranty Registry**: ثبت گارانتی با قفل عملیاتی (Serial Number Sovereignty)
- ✅ **Zero Floating-Point Errors**: استفاده صددرصدی از Decimal برای فیلدهای مالی
- ✅ **Atomic Transactions**: تمام عملیات مالی با Transaction Management
- ✅ **Audit Trails**: لاگ کامل تمام تغییرات مالی

---

## معماری سیستم

### مدل‌های دیتابیس

```prisma
// 1. VolatilityIndex - شاخص نوسان قیمت
model VolatilityIndex {
  id             String    @id @default(cuid())
  indexName      String    @unique // e.g., "COPPER_IR_WEEKLY"
  indexValue     Decimal   @db.Decimal(18, 6) // e.g., 1.157000
  effectiveFrom  DateTime
  effectiveUntil DateTime?
  isActive       Boolean   @default(true)
  
  products       Product[]
  auditLogs      AuditLog[]
}

// 2. PriceLock - قفل قیمت
model PriceLock {
  id               String       @id @default(cuid())
  productId        String
  organizationId   String
  lockedPrice      Decimal      @db.Decimal(18, 2)
  lockedAt         DateTime     @default(now())
  expiresAt        DateTime
  isActive         Boolean      @default(true)
  
  product          Product      @relation(fields: [productId])
  organization     Organization @relation(fields: [organizationId])
}

// 3. RiskProfile - پروفایل ریسک و اعتبار
model RiskProfile {
  id                   String    @id @default(cuid())
  organizationId       String    @unique
  score                Decimal   @db.Decimal(5, 2) // 0-200
  baseCreditLimit      Decimal   @db.Decimal(18, 2)
  currentCreditLimit   Decimal   @db.Decimal(18, 2)
  decayLambda          Decimal   @db.Decimal(5, 4) // e.g., 0.1000
  
  organization         Organization @relation(fields: [organizationId])
  events               FinancialEvent[]
  vouchesGiven         ReputationVouch[] @relation("VoucherProfile")
  vouchesReceived      ReputationVouch[] @relation("VoucheeProfile")
}

// 4. FinancialEvent - رویدادهای مالی
model FinancialEvent {
  id              String              @id @default(cuid())
  riskProfileId   String
  eventType       FinancialEventType
  impactValue     Decimal             @db.Decimal(10, 2)
  eventDate       DateTime            @default(now())
  isProcessed     Boolean             @default(false)
  description     String
  
  riskProfile     RiskProfile         @relation(fields: [riskProfileId])
}

enum FinancialEventType {
  PAYMENT_ON_TIME
  PAYMENT_LATE
  DEFAULT
  CHEQUE_BOUNCED
  CREDIT_INCREASE
  CREDIT_DECREASE
  VOUCH_PENALTY
  VOUCH_REWARD
}

// 5. ReputationVouch - واچینگ شهرت‌محور
model ReputationVouch {
  id                  String    @id @default(cuid())
  voucherId           String
  voucheeId           String
  vouchAmount         Decimal   @db.Decimal(18, 2)
  riskSharePercentage Int       // 0-100
  createdAt           DateTime  @default(now())
  expiresAt           DateTime?
  isActive            Boolean   @default(true)
  
  voucher             RiskProfile @relation("VoucherProfile", fields: [voucherId])
  vouchee             RiskProfile @relation("VoucheeProfile", fields: [voucheeId])
}

// 6. WarrantyRegistry - ثبت گارانتی
model WarrantyRegistry {
  id                     String         @id @default(cuid())
  productId              String
  serialNumber           String         @unique // CRITICAL: UNIQUE constraint
  activatedBy            String
  installationProjectId  String
  customerId             String
  customerName           String
  customerMobile         String
  customerAddress        String
  warrantyMonths         Int            @default(12)
  startsAt               DateTime
  expiresAt              DateTime
  status                 WarrantyStatus @default(ACTIVE)
  
  product                Product              @relation(fields: [productId])
  installer              User                 @relation(fields: [activatedBy])
  installationProject    InstallationProject  @relation(fields: [installationProjectId])
}

enum WarrantyStatus {
  ACTIVE
  EXPIRED
  CLAIMED
  VOIDED
  TRANSFERRED
}

// 7. InstallationProject - پروژه نصب
model InstallationProject {
  id           String    @id @default(cuid())
  projectName  String
  installerId  String
  customerId   String
  status       String    // PLANNED, IN_PROGRESS, COMPLETED, CANCELLED
  createdAt    DateTime  @default(now())
  completedAt  DateTime?
  
  installer    User      @relation("InstallerProjects", fields: [installerId])
  customer     User      @relation("CustomerProjects", fields: [customerId])
  warranties   WarrantyRegistry[]
}
```

---

## Price Sovereignty Engine

### فرمول قیمت‌گذاری

$$
Price_{Final} = (Price_{Base} \times Index_{Volatility}) \times (1 - Discount_{Tier})
$$

### MarginGuard Constraint

برای هر محصول:

$$
Price_{Final} \geq Cost_{Price} \times 1.10
$$

این constraint تضمین می‌کند که حداقل 10% سود وجود داشته باشد.

### API Methods

#### 1. محاسبه قیمت نهایی

```typescript
import { PriceEngine } from './sovereign-core/price-engine.service';

// Get final price with caching
const result = await priceEngine.getFinalPrice(
  productId: string,
  organizationId: string,
  tierLevel?: 'GOLD' | 'SILVER' | 'BRONZE'
);

// Response:
{
  finalPrice: Decimal,
  basePrice: Decimal,
  volatilityIndex: Decimal,
  tierDiscount: Decimal,
  calculatedAt: Date
}
```

#### 2. قفل قیمت (Price Lock)

```typescript
// Lock price for 30 days
const result = await priceEngine.lockPrice(
  productId: string,
  organizationId: string,
  durationDays: number = 30
);

// Response:
{
  success: boolean,
  priceLock: {
    id: string,
    lockedPrice: Decimal,
    expiresAt: Date
  }
}
```

#### 3. بازیابی قفل فعال

```typescript
const lock = await priceEngine.getActivePriceLock(
  productId: string,
  organizationId: string
);
```

#### 4. محاسبه قیمت گروهی (Bulk)

```typescript
const prices = await priceEngine.getBulkPrices(
  productIds: string[],
  organizationId: string,
  tierLevel?: string
);
```

### Redis Caching Strategy

- **Cache Key Pattern**: `price:{productId}:{organizationId}:{tierLevel}`
- **TTL**: 1 hour (3600 seconds)
- **Invalidation**: When volatility index changes

```typescript
// Invalidate cache for all products using an index
await priceEngine.invalidateCacheForIndex(volatilityIndexId: string);
```

---

## Risk & Credit Scoring Engine

### فرمول Lambda Decay

$$
Score_{New} = Score_{Old} + (Impact_{Event} \times e^{-\lambda \cdot t})
$$

- **λ (Lambda)**: پارامتر واپاشی (معمولاً 0.1)
- **t**: زمان سپری شده بر حسب ماه
- **Score Range**: 0-200 (clamp شده)

### محاسبه Credit Limit دینامیک

$$
Credit_{Current} = Credit_{Base} \times \frac{Score}{100}
$$

مثال:
- Base Credit = 10,000 تومان
- Score = 150
- Current Credit = 10,000 × 1.5 = 15,000 تومان

### API Methods

#### 1. پردازش رویداد مالی

```typescript
import { RiskEngine } from './sovereign-core/risk-engine.service';

const result = await riskEngine.processFinancialEvent({
  organizationId: string,
  eventType: 'PAYMENT_ON_TIME' | 'PAYMENT_LATE' | 'DEFAULT' | 'CHEQUE_BOUNCED',
  impactValue: number, // e.g., +10 or -20
  description: string,
  relatedOrderId?: string,
  relatedProformaId?: string,
  relatedChequeId?: string
});

// Response:
{
  success: boolean,
  oldScore: Decimal,
  newScore: Decimal,
  oldCreditLimit: Decimal,
  newCreditLimit: Decimal,
  eventsProcessed: number
}
```

#### 2. واچینگ (Risk-Sharing Guarantee)

```typescript
const result = await riskEngine.vouchForOrganization({
  voucherOrganizationId: string,
  voucheeOrganizationId: string,
  vouchAmount: number,
  riskSharePercentage: number, // 0-100
  expirationDays?: number
});

// Response:
{
  success: boolean,
  vouch: {
    id: string,
    vouchAmount: Decimal,
    riskSharePercentage: number,
    expiresAt: Date
  }
}
```

#### 3. پردازش نکول (Default Processing)

```typescript
const result = await riskEngine.processVoucheeDefault(
  voucheeOrganizationId: string,
  defaultAmount: number
);

// Response:
{
  success: boolean,
  vouchersAffected: number,
  totalPenalty: Decimal,
  penalties: [
    {
      voucherId: string,
      penaltyAmount: Decimal,
      newScore: Decimal,
      newCreditLimit: Decimal
    }
  ]
}
```

**فرمول جریمه هر Voucher:**

$$
Penalty = Default_{Amount} \times \frac{Vouch_{Amount}}{Total_{Vouch}} \times \frac{Risk_{Share}}{100}
$$

مثال:
- Default Amount = 50,000 تومان
- Voucher A: 30,000 تومان vouch با 60% risk share
- Voucher B: 20,000 تومان vouch با 40% risk share
- Total Vouch = 50,000 تومان

**Penalty A** = 50,000 × (30,000 / 50,000) × 0.6 = 18,000 تومان  
**Penalty B** = 50,000 × (20,000 / 50,000) × 0.4 = 8,000 تومان

#### 4. بازیابی پروفایل ریسک

```typescript
const profile = await riskEngine.getRiskProfile(organizationId: string);

// Response:
{
  id: string,
  organizationId: string,
  score: Decimal,
  baseCreditLimit: Decimal,
  currentCreditLimit: Decimal,
  decayLambda: Decimal,
  events: FinancialEvent[],
  vouchesGiven: ReputationVouch[],
  vouchesReceived: ReputationVouch[]
}
```

---

## Warranty Registry System

### Serial Number Sovereignty

هر شماره سریال UNIQUE است و نمی‌تواند دوباره ثبت شود:

```prisma
model WarrantyRegistry {
  serialNumber  String  @unique // ⚠️ CRITICAL
}
```

### API Endpoints

#### 1. ثبت گارانتی (INSTALLER Only)

```http
POST /api/sovereign-core/warranty/register
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json

{
  "productId": "clxxx...",
  "serialNumber": "SN-2024-COPPER-001234",
  "installationProjectId": "clyyyy...",
  "customerId": "clzzz...",
  "customerName": "علی محمدی",
  "customerMobile": "09123456789",
  "customerAddress": "تهران، خیابان ولیعصر، پلاک 123",
  "warrantyMonths": 24
}
```

**Response:**

```json
{
  "success": true,
  "warranty": {
    "id": "clwww...",
    "serialNumber": "SN-2024-COPPER-001234",
    "startsAt": "2024-01-15T10:00:00Z",
    "expiresAt": "2026-01-15T10:00:00Z",
    "status": "ACTIVE"
  }
}
```

**Error Scenarios:**

- ❌ User role is not EXECUTOR/INSTALLER
- ❌ Serial number already exists
- ❌ Installation project doesn't belong to installer

#### 2. استعلام گارانتی

```http
GET /api/sovereign-core/warranty/SN-2024-COPPER-001234
Authorization: Bearer <JWT_TOKEN>
```

**Response:**

```json
{
  "success": true,
  "warranty": {
    "id": "clwww...",
    "serialNumber": "SN-2024-COPPER-001234",
    "product": {
      "name": "لوله مسی 1 اینچ",
      "sku": "COPPER-PIPE-1IN"
    },
    "installer": {
      "firstName": "حسن",
      "lastName": "احمدی",
      "mobile": "09121234567"
    },
    "customerName": "علی محمدی",
    "startsAt": "2024-01-15T10:00:00Z",
    "expiresAt": "2026-01-15T10:00:00Z",
    "status": "ACTIVE"
  }
}
```

---

## API Endpoints

### Price Engine Endpoints

یکپارچه با `ProductController` و `OrderController` برای استفاده داخلی.

### Risk Engine Endpoints

#### 1. پردازش رویداد مالی (ADMIN Only)

```http
POST /api/sovereign-core/risk/process-event
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json

{
  "organizationId": "clxxx...",
  "eventType": "PAYMENT_LATE",
  "impactValue": -20,
  "description": "تأخیر 15 روزه در پرداخت فاکتور 1234",
  "relatedOrderId": "clyyyy..."
}
```

**Response:**

```json
{
  "success": true,
  "oldScore": 100,
  "newScore": 85.3,
  "oldCreditLimit": 10000,
  "newCreditLimit": 8530,
  "eventsProcessed": 3
}
```

#### 2. ایجاد واچ (Risk-Sharing)

```http
POST /api/sovereign-core/risk/vouch
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json

{
  "voucheeOrganizationId": "clxxx...",
  "vouchAmount": 20000,
  "riskSharePercentage": 50,
  "expirationDays": 180
}
```

**Response:**

```json
{
  "success": true,
  "vouch": {
    "id": "clzzz...",
    "vouchAmount": 20000,
    "riskSharePercentage": 50,
    "expiresAt": "2024-07-15T10:00:00Z"
  }
}
```

#### 3. مشاهده پروفایل ریسک

```http
GET /api/sovereign-core/risk/profile/clxxx...
Authorization: Bearer <JWT_TOKEN>
```

**Response:**

```json
{
  "success": true,
  "profile": {
    "id": "clppp...",
    "organizationId": "clxxx...",
    "score": 135.50,
    "baseCreditLimit": 10000,
    "currentCreditLimit": 13550,
    "decayLambda": 0.1,
    "events": [...],
    "vouchesGiven": [...],
    "vouchesReceived": [...]
  }
}
```

#### 4. پردازش نکول (ADMIN Only)

```http
POST /api/sovereign-core/risk/process-default
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json

{
  "voucheeOrganizationId": "clxxx...",
  "defaultAmount": 50000
}
```

**Response:**

```json
{
  "success": true,
  "vouchersAffected": 2,
  "totalPenalty": 26000,
  "penalties": [
    {
      "voucherId": "clzzz1...",
      "penaltyAmount": 18000,
      "newScore": 132,
      "newCreditLimit": 106400
    },
    {
      "voucherId": "clzzz2...",
      "penaltyAmount": 8000,
      "newScore": 122,
      "newCreditLimit": 97600
    }
  ]
}
```

---

## تست‌های یکپارچگی مالی

### اجرای تست‌ها

```bash
# Run all sovereign-core tests
pnpm test sovereign-core

# Run price engine tests only
pnpm test price-engine.service.spec.ts

# Run risk engine tests only
pnpm test risk-engine.service.spec.ts

# Run with coverage
pnpm test:cov sovereign-core
```

### دسته‌بندی تست‌ها

#### 1. تست‌های دقت Decimal (Price Engine)

```typescript
it('should calculate final price without floating-point precision loss', async () => {
  // Validates: No precision errors with Decimal type
  // Example: 1234567.89 × 1.157 × (1 - 0.15) = 1214210.1651 (exact)
});
```

#### 2. تست‌های MarginGuard

```typescript
it('should throw error if final price violates 10% minimum margin', async () => {
  // Validates: Price >= costPrice × 1.10
  // Example: (100 × 0.5) = 50 < (95 × 1.10) = 104.5 → ❌ Error
});
```

#### 3. تست‌های Race Condition

```typescript
it('should handle concurrent price lock requests with atomic transaction', async () => {
  // Validates: Only ONE lock succeeds out of 5 concurrent requests
  // Uses: Prisma.$transaction for atomicity
});
```

#### 4. تست‌های Lambda Decay (Risk Engine)

```typescript
it('should apply exponential decay correctly for old events', async () => {
  // Validates: score = 100 + (-20 × e^(-0.1 × 12)) = 93.98
  // Formula: e^(-0.1 × 12) ≈ 0.301
});
```

#### 5. تست‌های Cascading Penalties

```typescript
it('should penalize vouchers proportionally when vouchee defaults', async () => {
  // Validates: Penalty = DefaultAmount × (VouchAmount / TotalVouch) × RiskShare
  // Example: 50,000 × 0.6 × 0.6 = 18,000
});
```

---

## دستورالعمل‌های امنیتی

### ⚠️ نقض امنیتی بحرانی (CRITICAL)

این موارد **هرگز** نباید اتفاق بیفتند:

1. ❌ استفاده از `Float` یا `Double` برای فیلدهای مالی → **ONLY `Decimal`**
2. ❌ عملیات مالی بدون `prisma.$transaction` → **ALWAYS Atomic**
3. ❌ اضافه کردن فیلد مالی جدید بدون `@db.Decimal(18, 2)` → **ALWAYS Annotate**
4. ❌ تغییر قیمت یا اعتبار بدون لاگ در `AuditLog` → **ALWAYS Audit**
5. ❌ دسترسی RBAC نادرست (مثلاً EXECUTOR ثبت رویداد مالی) → **STRICT Roles**

### ✅ چک‌لیست کد

قبل از هر Commit:

- [ ] تمام فیلدهای مالی `Decimal` هستند؟
- [ ] تمام عملیات مالی داخل `$transaction` هستند؟
- [ ] Audit Log برای تمام تغییرات مالی ثبت شده؟
- [ ] RBAC Guards برای API endpoints فعال است؟
- [ ] Unit Tests برای Logic جدید نوشته شده؟
- [ ] MarginGuard constraint رعایت شده؟

### 🔒 RBAC Roles

| Endpoint | Required Role |
|----------|---------------|
| POST /warranty/register | EXECUTOR |
| POST /risk/process-event | ADMIN |
| POST /risk/process-default | ADMIN |
| GET /risk/profile/:id | ANY |
| POST /risk/vouch | ANY (با organizationId) |

---

## نتیجه‌گیری

**Sovereign Distribution Core** یک سیستم مالی تولید‌محور با:

- ✅ **Zero Floating-Point Errors**: Decimal برای همه محاسبات
- ✅ **Atomic Transactions**: Transaction Management برای عملیات مالی
- ✅ **Time-Weighted Risk Scoring**: Lambda Decay Formula
- ✅ **Risk-Sharing Vouching**: جریمه متناسب برای Vouchers
- ✅ **Price Sovereignty**: قفل قیمت و MarginGuard
- ✅ **Warranty Registry**: Serial Number Sovereignty
- ✅ **Full Audit Trails**: لاگ کامل تمام تغییرات

**Status**: ✅ **PRODUCTION-READY** با تست‌های کامل و ریسک عملیاتی نزدیک به صفر.
