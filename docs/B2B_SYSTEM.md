# B2B System Documentation

## معماری سیستم B2B (Business-to-Business)

این سیستم برای خریدهای عمده کارخانه‌ها، توزیع‌کنندگان و نمایندگان طراحی شده است.

---

## 1. معماری پایگاه داده (Database Schema)

### 1.1 مدل Organization (سازمان)
نمایانگر کارخانه، توزیع‌کننده، خرده‌فروش یا نماینده

```prisma
model Organization {
  id                  String              @id @default(cuid())
  name                String              // نام فارسی
  nameEn              String?             // نام انگلیسی
  slug                String              @unique
  type                OrganizationType    // نوع سازمان
  
  // اطلاعات قانونی
  nationalId          String?   @unique  // شناسه ملی (11 رقم)
  economicCode        String?   @unique  // کد اقتصادی (14 رقم)
  registrationNumber  String?             // شماره ثبت شرکت
  
  // اطلاعات تماس
  email               String?
  phone               String?
  fax                 String?
  website             String?
  
  // آدرس
  address             String?
  city                String?
  state               String?
  postalCode          String?
  country             String?   @default("IR")
  
  // وضعیت
  isActive            Boolean   @default(true)
  isVerified          Boolean   @default(false)
  verifiedAt          DateTime?
  
  // روابط
  members             User[]
  supplierRelations   B2BRelation[]      @relation("SupplierRelations")
  buyerRelations      B2BRelation[]      @relation("BuyerRelations")
  priceLists          PriceList[]
  cheques             Cheque[]
  
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt
}

enum OrganizationType {
  FACTORY       // کارخانه
  DISTRIBUTOR   // توزیع‌کننده
  RETAILER      // خرده‌فروش
  AGENT         // نماینده
}
```

### 1.2 مدل B2BRelation (رابطه B2B)
قرارداد بین کارخانه (تامین‌کننده) و نماینده (خریدار)

```prisma
model B2BRelation {
  id                  String        @id @default(cuid())
  
  // طرفین قرارداد
  supplierId          String        // کارخانه
  supplier            Organization  @relation("SupplierRelations", ...)
  buyerId             String        // نماینده
  buyer               Organization  @relation("BuyerRelations", ...)
  
  // شرایط اعتباری
  creditLimit         Decimal       @db.Decimal(18, 2)  // سقف اعتبار (ریال)
  currentDebt         Decimal       @default(0) @db.Decimal(18, 2)
  paymentTermDays     Int           @default(30)  // مهلت پرداخت (روز)
  
  // قیمت‌گذاری
  priceListId         String?
  priceList           PriceList?
  discountPercentage  Decimal?      @db.Decimal(5, 2)  // تخفیف اضافی (%)
  
  // قرارداد
  contractNumber      String?
  contractDocument    String?       // URL سند قرارداد
  startDate           DateTime
  endDate             DateTime?
  
  isActive            Boolean       @default(true)
  createdAt           DateTime      @default(now())
  updatedAt           DateTime      @updatedAt
  
  @@unique([supplierId, buyerId])
}
```

### 1.3 مدل PriceList (لیست قیمت)
قیمت‌های اختصاصی برای سازمان‌ها

```prisma
model PriceList {
  id              String         @id @default(cuid())
  organizationId  String
  organization    Organization   @relation(...)
  
  name            String
  code            String         @unique
  description     String?
  type            String         @default("STANDARD")  // STANDARD, WHOLESALE, VIP, PROMOTIONAL
  priority        Int            @default(0)           // اولویت (عدد بزرگتر = اولویت بالاتر)
  
  startDate       DateTime       @default(now())
  endDate         DateTime?
  isActive        Boolean        @default(true)
  
  productPrices   ProductPrice[]
  b2bRelations    B2BRelation[]
  
  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt
}
```

### 1.4 مدل ProductPrice (قیمت محصول)
قیمت محصولات در لیست قیمت

```prisma
model ProductPrice {
  id              String      @id @default(cuid())
  priceListId     String
  priceList       PriceList   @relation(...)
  productId       String
  product         Product     @relation(...)
  
  price           Decimal     @db.Decimal(18, 2)
  compareAtPrice  Decimal?    @db.Decimal(18, 2)
  minQuantity     Int         @default(1)
  maxQuantity     Int?
  
  // قیمت‌گذاری پله‌ای (JSON)
  tierPricing     Json?       // [{ minQty: 10, price: 95000 }, { minQty: 50, price: 90000 }]
  
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt
  
  @@unique([priceListId, productId])
}
```

### 1.5 مدل Cheque (چک)
مدیریت چک‌های صیادی

```prisma
model Cheque {
  id              String         @id @default(cuid())
  organizationId  String
  organization    Organization   @relation(...)
  orderId         String?
  order           Order?         @relation(...)
  
  // اطلاعات چک
  chequeNumber    String         // شماره صیادی
  amount          Decimal        @db.Decimal(18, 2)
  currency        String         @default("IRR")
  
  // اطلاعات بانکی
  bankName        String
  branchName      String?
  accountNumber   String
  
  // تاریخ‌ها
  issueDate       DateTime
  dueDate         DateTime       // تاریخ سررسید
  cashedDate      DateTime?
  
  // مدارک
  imageUrl        String?        // تصویر چک
  
  // وضعیت
  status          ChequeStatus   @default(PENDING)
  notes           String?
  rejectionReason String?
  
  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt
  
  @@unique([organizationId, chequeNumber])
}

enum ChequeStatus {
  PENDING   // در انتظار بررسی
  APPROVED  // تایید شده
  REJECTED  // رد شده
  CASHED    // نقد شده
  BOUNCED   // برگشتی
}
```

---

## 2. لایه سرویس (Service Layer)

### 2.1 B2BService
سرویس مدیریت قیمت‌گذاری و اعتبار

**متدها:**
- `getProductPrice(productId, organizationId, quantity)` - محاسبه قیمت B2B
- `checkCreditAvailability(organizationId, orderAmount)` - بررسی اعتبار
- `increaseDebt(organizationId, supplierId, amount)` - افزایش بدهی
- `decreaseDebt(organizationId, supplierId, amount)` - کاهش بدهی
- `validateOrganizationAccess(userId, organizationId)` - Tenant Isolation
- `getProductsWithB2BPricing(organizationId, filters)` - لیست محصولات با قیمت B2B

**منطق قیمت‌گذاری (Pricing Logic):**
```
1. بررسی رابطه B2B (B2BRelation)
2. دریافت PriceList مرتبط
3. یافتن ProductPrice برای محصول
4. بررسی tierPricing بر اساس quantity
5. اعمال discountPercentage (اگر وجود دارد)
6. اولویت: B2B_CUSTOM > B2B_TIER > BASE_PRICE
```

### 2.2 ChequeService
سرویس مدیریت چک‌ها

**متدها:**
- `createCheque(dto)` - ثبت چک جدید
- `approveCheque(dto)` - تایید/رد چک
- `getOrganizationCheques(organizationId, filters)` - لیست چک‌ها
- `getDueCheques(organizationId?)` - چک‌های سررسید (7 روز آینده)

---

## 3. لایه API (API Layer)

### 3.1 محصولات (Products)
```
GET /api/b2b/products?organizationId=xxx&search=xxx&page=1&pageSize=50
```

**Response:**
```json
[
  {
    "id": "prod-123",
    "name": "محصول نمونه",
    "sku": "PROD-001",
    "basePrice": 100000,
    "b2bPrice": 85000,
    "stock": 500,
    "unit": "عدد",
    "priceListName": "لیست قیمت VIP",
    "tierDiscount": 15
  }
]
```

### 3.2 چک‌ها (Cheques)

**ثبت چک:**
```
POST /api/b2b/cheques
Content-Type: application/json

{
  "organizationId": "org-123",
  "orderId": "order-456",
  "chequeNumber": "1234567890",
  "amount": 5000000,
  "bankName": "ملی",
  "accountNumber": "0123456789",
  "dueDate": "2024-06-15"
}
```

**لیست چک‌ها:**
```
GET /api/b2b/cheques?organizationId=xxx&status=PENDING
```

**تایید چک:**
```
PUT /api/b2b/cheques/[id]/approve
Content-Type: application/json

{
  "status": "APPROVED",
  "notes": "چک تایید شد"
}
```

### 3.3 بارگذاری CSV
```
POST /api/b2b/orders/import-csv
Content-Type: application/json

{
  "csvData": "SKU,Quantity\nPROD-001,10\nPROD-002,25",
  "organizationId": "org-123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "2 محصول با موفقیت اضافه شد",
  "processed": 2,
  "added": 2,
  "failed": []
}
```

---

## 4. رابط کاربری (UI Layer)

### 4.1 صفحه سفارش‌گذاری سریع (Quick Order)
**مسیر:** `/b2b/quick-order`

**قابلیت‌ها:**
- نمایش لیست محصولات با قیمت B2B
- ویرایش inline برای تعداد
- محاسبه خودکار جمع کل
- بارگذاری فایل CSV
- افزودن دسته‌جمعی به سبد خرید

**فرمت CSV:**
```csv
SKU,Quantity
PROD-001,10
PROD-002,25
PROD-003,5
```

---

## 5. امنیت (Security)

### 5.1 Tenant Isolation
هر سازمان فقط به داده‌های خود دسترسی دارد:
```typescript
// بررسی دسترسی
const member = await prisma.user.findFirst({
  where: {
    id: userId,
    organizationId: requestedOrganizationId,
  },
});

if (!member) {
  throw new ForbiddenException('Access denied');
}
```

### 5.2 احراز هویت (Authentication)
- تمام APIهای B2B نیاز به Admin Authentication دارند
- از `requireAdmin()` middleware استفاده می‌شود
- User باید `organizationId` در session داشته باشد

### 5.3 Validation Rules
- **شناسه ملی:** 11 رقم
- **کد اقتصادی:** 14 رقم
- **شماره چک:** Unique per organization
- **اعتبار:** creditLimit >= currentDebt + orderAmount

---

## 6. استراتژی قیمت‌گذاری (Pricing Strategy)

### 6.1 قیمت پایه (Base Price)
قیمت استاندارد محصول (`Product.price`)

### 6.2 قیمت B2B سفارشی (B2B Custom Price)
قیمت اختصاصی در `ProductPrice` برای لیست قیمت سازمان

### 6.3 قیمت پله‌ای (Tier Pricing)
تخفیف بر اساس مقدار خرید:
```json
{
  "tierPricing": [
    { "minQty": 10, "price": 95000 },
    { "minQty": 50, "price": 90000 },
    { "minQty": 100, "price": 85000 }
  ]
}
```

### 6.4 تخفیف اضافی (Additional Discount)
تخفیف درصدی در `B2BRelation.discountPercentage`

**فرمول نهایی:**
```
finalPrice = (b2bPrice OR tierPrice OR basePrice) × (1 - discountPercentage/100)
```

---

## 7. جریان کاری (Workflow)

### 7.1 ثبت سازمان جدید
1. Admin ایجاد Organization می‌کند
2. تعیین نوع سازمان (FACTORY, DISTRIBUTOR, RETAILER, AGENT)
3. تکمیل اطلاعات قانونی (شناسه ملی، کد اقتصادی)
4. تایید و فعال‌سازی (isVerified = true)

### 7.2 ایجاد رابطه B2B
1. Admin رابطه بین کارخانه و نماینده ایجاد می‌کند
2. تعیین سقف اعتبار (creditLimit)
3. انتخاب لیست قیمت (priceListId)
4. تعیین شرایط پرداخت (paymentTermDays)

### 7.3 سفارش‌گذاری
1. نماینده وارد `/b2b/quick-order` می‌شود
2. جستجو و انتخاب محصولات
3. وارد کردن تعداد یا بارگذاری CSV
4. مشاهده قیمت B2B و تخفیف‌ها
5. افزودن به سبد خرید
6. انتخاب روش پرداخت (CREDIT برای خرید اعتباری)

### 7.4 مدیریت چک
1. نماینده چک صیادی ثبت می‌کند (POST /api/b2b/cheques)
2. آپلود تصویر چک (imageUrl)
3. Admin چک را بررسی و تایید می‌کند (PUT /api/b2b/cheques/[id]/approve)
4. در تاریخ سررسید، alert به Admin داده می‌شود
5. پس از نقد شدن، status = CASHED

---

## 8. تست‌ها (Testing)

### 8.1 Unit Tests
```bash
npm test src/b2b/b2b.service.spec.ts
npm test src/b2b/cheque.service.spec.ts
```

### 8.2 Integration Tests
```bash
npm test apps/web/app/api/b2b/products/route.spec.ts
npm test apps/web/app/api/b2b/cheques/route.spec.ts
```

### 8.3 E2E Tests
```bash
npx playwright test tests/b2b/quick-order.spec.ts
```

---

## 9. مهاجرت دیتابیس (Database Migration)

```bash
# ایجاد migration جدید
npx prisma migrate dev --name add_b2b_models

# اعمال migration در production
npx prisma migrate deploy

# تولید Prisma Client
npx prisma generate
```

---

## 10. نکات مهم

### 10.1 Decimal Precision
تمام مبالغ مالی از `Decimal(18,2)` استفاده می‌کنند:
- 18 رقم کل (برای ریال ایران کافی است)
- 2 رقم اعشار

### 10.2 Currency
پیش‌فرض `IRR` (ریال ایران) است. برای تبدیل:
- 1 تومان = 10 ریال
- 1,000,000 تومان = 10,000,000 ریال

### 10.3 Unique Constraints
- `Organization.nationalId` - جلوگیری از ثبت تکراری سازمان
- `Organization.economicCode` - جلوگیری از ثبت تکراری کد اقتصادی
- `B2BRelation[supplierId, buyerId]` - هر جفت فقط یک رابطه
- `Cheque[organizationId, chequeNumber]` - هر شماره چک در هر سازمان یکتا

### 10.4 Soft Delete
سازمان‌ها با `isActive = false` غیرفعال می‌شوند (Soft Delete)

---

## 11. Troubleshooting

### 11.1 قیمت B2B نمایش داده نمی‌شود
- بررسی وجود `B2BRelation` بین supplier و buyer
- بررسی `PriceList.isActive = true`
- بررسی تاریخ اعتبار `PriceList.startDate` و `endDate`

### 11.2 خطای "Access Denied"
- بررسی `User.organizationId` در session
- بررسی عضویت کاربر در سازمان مورد نظر

### 11.3 چک تایید نمی‌شود
- بررسی `Cheque.status = PENDING`
- بررسی دسترسی Admin
- بررسی `Cheque.imageUrl` (تصویر چک)

---

## 12. نقشه راه (Roadmap)

### فاز 1 (تکمیل شده) ✅
- Schema Design
- Service Layer
- Cheque Management

### فاز 2 (تکمیل شده) ✅
- API Layer
- Bulk Order UI
- CSV Import

### فاز 3 (در دست اجرا) 🔄
- Tenant Isolation Middleware
- Admin Dashboard for B2B
- Credit Management Panel

### فاز 4 (آینده) ⏳
- Reporting & Analytics
- Mobile App
- Integration with Accounting Systems
