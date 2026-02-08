# 🚀 راهنمای پیادهسازی بهبودهای B2B

## 📋 فهرست اقدامات

### مرحله 1: سیستم مودیان (الزامی - 2 هفته)

#### 1.1 اضافه کردن مدل TaxInvoice به Prisma

```prisma
model TaxInvoice {
  id                String   @id @default(cuid())
  invoiceNumber     String   @unique
  proformaId        String?
  orderId           String?
  
  // Moodian
  moodianSUID       String?  @unique
  moodianStatus     String   @default("PENDING")
  moodianSentAt     DateTime?
  moodianReference  String?
  
  // Tax Info
  sellerTaxID       String
  buyerTaxID        String
  
  // Amounts
  subtotal          Decimal  @db.Decimal(18,2)
  taxAmount         Decimal  @db.Decimal(18,2)
  totalAmount       Decimal  @db.Decimal(18,2)
  
  // Electronic
  electronicSign    String?
  qrCode            String?
  
  status            String   @default("DRAFT")
  issueDate         DateTime @default(now())
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  
  @@index([moodianSUID])
  @@index([moodianStatus])
  @@map("tax_invoices")
}
```

#### 1.2 ایجاد سرویس مودیان

فایل ایجاد شده: `/libs/moodian/src/moodian.service.ts`

#### 1.3 اتصال به API مودیان

```typescript
// در .env اضافه کنید:
MOODIAN_API_URL=https://tp.tax.gov.ir/api/v1
MOODIAN_USERNAME=your_username
MOODIAN_PASSWORD=your_password
MOODIAN_TAX_ID=your_14_digit_tax_id
```

### مرحله 2: Audit Trail (امنیت - 1 هفته)

#### 2.1 مدل PriceAuditLog

```prisma
model PriceAuditLog {
  id              String   @id @default(cuid())
  userId          String
  organizationId  String?
  productId       String
  
  tierLevel       String?
  basePrice       Decimal  @db.Decimal(18,2)
  dealerPrice     Decimal  @db.Decimal(18,2)
  effectivePrice  Decimal  @db.Decimal(18,2)
  priceSource     String
  
  ipAddress       String?
  userAgent       String?
  viewedAt        DateTime @default(now())
  
  @@index([userId, viewedAt])
  @@index([productId, viewedAt])
  @@map("price_audit_logs")
}
```

#### 2.2 لاگ خودکار در TieredPriceService

```typescript
async calculatePrice(
  productId: string,
  dealerContext: DealerContext,
  quantity: number = 1
): Promise<TieredPriceResult> {
  const result = await this.calculatePriceInternal(productId, dealerContext, quantity);
  
  // ثبت لاگ
  await prisma.priceAuditLog.create({
    data: {
      userId: dealerContext.userId,
      organizationId: dealerContext.organizationId,
      productId,
      tierLevel: result.tierLevel,
      basePrice: result.basePrice,
      dealerPrice: result.dealerPrice,
      effectivePrice: result.effectivePrice,
      priceSource: result.priceSource,
      viewedAt: new Date(),
    },
  });
  
  return result;
}
```

### مرحله 3: Workflow Engine (کارایی - 2 هفته)

#### 3.1 مدلهای Workflow

```prisma
model WorkflowDefinition {
  id          String  @id @default(cuid())
  name        String  @unique
  entityType  String
  steps       Json
  isActive    Boolean @default(true)
  createdAt   DateTime @default(now())
  
  instances   WorkflowInstance[]
  
  @@map("workflow_definitions")
}

model WorkflowInstance {
  id            String   @id @default(cuid())
  definitionId  String
  entityType    String
  entityId      String
  currentStep   Int      @default(0)
  status        String   @default("PENDING")
  approvals     Json     @default("[]")
  startedAt     DateTime @default(now())
  completedAt   DateTime?
  
  definition    WorkflowDefinition @relation(fields: [definitionId], references: [id])
  
  @@index([entityType, entityId])
  @@map("workflow_instances")
}
```

#### 3.2 سرویس Workflow

```typescript
class WorkflowService {
  async submitForApproval(
    entityType: string,
    entityId: string,
    submittedBy: string
  ): Promise<WorkflowInstance> {
    // پیدا کردن workflow مناسب
    const definition = await this.findWorkflow(entityType);
    
    // ایجاد instance
    const instance = await prisma.workflowInstance.create({
      data: {
        definitionId: definition.id,
        entityType,
        entityId,
        currentStep: 0,
        status: 'PENDING',
        approvals: [{ submittedBy, timestamp: new Date() }],
      },
    });
    
    // ارسال اعلان به تاییدکننده
    await this.notifyApprover(instance);
    
    return instance;
  }
  
  async approve(workflowId: string, userId: string): Promise<void> {
    const instance = await prisma.workflowInstance.findUnique({
      where: { id: workflowId },
      include: { definition: true },
    });
    
    const steps = instance.definition.steps as any[];
    const nextStep = instance.currentStep + 1;
    
    if (nextStep >= steps.length) {
      // تایید نهایی
      await prisma.workflowInstance.update({
        where: { id: workflowId },
        data: {
          status: 'APPROVED',
          completedAt: new Date(),
        },
      });
      
      // اعمال تایید روی entity
      await this.applyApproval(instance.entityType, instance.entityId);
    } else {
      // رفتن به مرحله بعد
      await prisma.workflowInstance.update({
        where: { id: workflowId },
        data: { currentStep: nextStep },
      });
      
      await this.notifyApprover(instance);
    }
  }
}
```

### مرحله 4: Dashboard ماژولار (UX - 1 هفته)

#### 4.1 مدل DashboardLayout

```prisma
model DashboardLayout {
  id        String   @id @default(cuid())
  userId    String
  role      String
  widgets   Json     @default("[]")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  user      User     @relation(fields: [userId], references: [id])
  
  @@unique([userId, role])
  @@map("dashboard_layouts")
}
```

#### 4.2 Widget Types

```typescript
interface Widget {
  id: string;
  type: 'SALES_CHART' | 'ORDERS_TABLE' | 'REVENUE_CARD' | 'PENDING_APPROVALS';
  position: { x: number; y: number };
  size: { w: number; h: number };
  config: Record<string, any>;
}

// مثال: داشبورد نماینده
const dealerWidgets: Widget[] = [
  {
    id: 'w1',
    type: 'REVENUE_CARD',
    position: { x: 0, y: 0 },
    size: { w: 3, h: 2 },
    config: { period: 'month' },
  },
  {
    id: 'w2',
    type: 'ORDERS_TABLE',
    position: { x: 3, y: 0 },
    size: { w: 9, h: 4 },
    config: { limit: 10 },
  },
];
```

### مرحله 5: Bulk Operations (کارایی - 1 هفته)

#### 5.1 سرویس Bulk Order

```typescript
class BulkOrderService {
  async importFromExcel(
    file: Buffer,
    userId: string
  ): Promise<{ success: number; failed: Array<{ row: number; error: string }> }> {
    const workbook = XLSX.read(file);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet);
    
    const results = { success: 0, failed: [] };
    
    for (let i = 0; i < rows.length; i++) {
      try {
        const row = rows[i] as any;
        
        // اعتبارسنجی
        if (!row.SKU || !row.Quantity) {
          throw new Error('SKU و Quantity الزامی است');
        }
        
        // پیدا کردن محصول
        const product = await prisma.product.findUnique({
          where: { sku: row.SKU },
        });
        
        if (!product) {
          throw new Error(`محصول با SKU ${row.SKU} یافت نشد`);
        }
        
        // اضافه به سبد
        await this.addToCart(userId, product.id, row.Quantity);
        
        results.success++;
      } catch (error: any) {
        results.failed.push({
          row: i + 2, // +2 برای header و 0-index
          error: error.message,
        });
      }
    }
    
    return results;
  }
}
```

### مرحله 6: Multi-Warehouse (مقیاسپذیری - 2 هفته)

#### 6.1 مدلهای Warehouse

```prisma
model Warehouse {
  id             String   @id @default(cuid())
  code           String   @unique
  name           String
  organizationId String?
  
  address        String?
  city           String?
  province       String?
  
  isActive       Boolean  @default(true)
  createdAt      DateTime @default(now())
  
  inventory      WarehouseInventory[]
  
  @@map("warehouses")
}

model WarehouseInventory {
  id                String   @id @default(cuid())
  warehouseId       String
  productId         String
  
  quantity          Int      @default(0)
  reservedQuantity  Int      @default(0)
  
  warehouse         Warehouse @relation(fields: [warehouseId], references: [id])
  product           Product   @relation(fields: [productId], references: [id])
  
  @@unique([warehouseId, productId])
  @@map("warehouse_inventory")
}
```

## 🎯 اولویتبندی پیادهسازی

### هفته 1-2: مودیان (حیاتی)
- [ ] اضافه کردن TaxInvoice به schema
- [ ] پیادهسازی MoodianService
- [ ] تست با API مودیان
- [ ] اتصال به ProformaService

### هفته 3: Audit Trail (امنیت)
- [ ] اضافه کردن PriceAuditLog
- [ ] لاگ خودکار در TieredPriceService
- [ ] داشبورد مشاهده لاگها

### هفته 4-5: Workflow (کارایی)
- [ ] مدلهای Workflow
- [ ] WorkflowService
- [ ] تست با پیشفاکتور
- [ ] اعلانها

### هفته 6: Dashboard (UX)
- [ ] مدل DashboardLayout
- [ ] Widget system
- [ ] Drag & drop UI

### هفته 7: Bulk Operations
- [ ] Excel import
- [ ] Bulk approve
- [ ] Export reports

### هفته 8: Multi-Warehouse
- [ ] مدلهای Warehouse
- [ ] موجودی به تفکیک انبار
- [ ] انتقال بین انبارها

## 📊 معیارهای موفقیت

- ✅ 100% فاکتورها به مودیان ارسال شوند
- ✅ تمام تغییرات قیمت لاگ شوند
- ✅ زمان تایید پیشفاکتور < 5 دقیقه
- ✅ امکان import 1000+ محصول در < 30 ثانیه
- ✅ پشتیبانی از 10+ انبار

## 🔗 منابع

- [مستندات مودیان](https://tp.tax.gov.ir)
- [قانون مالیات بر ارزش افزوده](https://www.intamedia.ir/vat)
- [استانداردهای حسابداری ایران](https://www.audit.org.ir)
