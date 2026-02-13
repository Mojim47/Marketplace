# NextGen Marketplace - Database Design Document

## ۱. موجودیت‌ها (Entities)

### Core Entities:
1. **User** - کاربر سیستم
2. **Product** - محصول
3. **Category** - دسته‌بندی
4. **Order** - سفارش
5. **Payment** - پرداخت
6. **Vendor** - فروشنده
7. **Review** - نظر و امتیاز

### Supporting Entities:
8. **Cart** - سبد خرید
9. **Wishlist** - علاقه‌مندی‌ها
10. **Address** - آدرس
11. **Inventory** - موجودی

---

## ۲. جدول‌ها و ویژگی‌های آن‌ها (Tables & Attributes)

### جدول ۱: Users (کاربران)
```
┌─────────────────────────────────────┐
│           USERS                      │
├─────────────────────────────────────┤
│ id (PK)              UUID           │
│ email (UNIQUE)       VARCHAR(255)   │
│ password_hash        VARCHAR(255)   │
│ first_name           VARCHAR(100)   │
│ last_name            VARCHAR(100)   │
│ phone                VARCHAR(20)    │
│ is_active            BOOLEAN        │
│ created_at           TIMESTAMP      │
│ updated_at           TIMESTAMP      │
└─────────────────────────────────────┘
```

### جدول ۲: Categories (دسته‌بندی‌ها)
```
┌─────────────────────────────────────┐
│       CATEGORIES                    │
├─────────────────────────────────────┤
│ id (PK)              UUID           │
│ name                 VARCHAR(100)   │
│ slug                 VARCHAR(100)   │
│ description          TEXT           │
│ parent_id (FK)       UUID (NULL)    │
│ created_at           TIMESTAMP      │
└─────────────────────────────────────┘
```

### جدول ۳: Products (محصولات)
```
┌─────────────────────────────────────┐
│          PRODUCTS                   │
├─────────────────────────────────────┤
│ id (PK)              UUID           │
│ category_id (FK)     UUID           │
│ vendor_id (FK)       UUID           │
│ sku                  VARCHAR(50)    │
│ name                 VARCHAR(255)   │
│ description          TEXT           │
│ price                DECIMAL(10,2)  │
│ stock                INT            │
│ status               ENUM           │
│ created_at           TIMESTAMP      │
│ updated_at           TIMESTAMP      │
└─────────────────────────────────────┘
```

### جدول ۴: Vendors (فروشندگان)
```
┌─────────────────────────────────────┐
│          VENDORS                    │
├─────────────────────────────────────┤
│ id (PK)              UUID           │
│ name                 VARCHAR(255)   │
│ email                VARCHAR(255)   │
│ phone                VARCHAR(20)    │
│ commission_rate      DECIMAL(5,2)   │
│ is_active            BOOLEAN        │
│ created_at           TIMESTAMP      │
└─────────────────────────────────────┘
```

### جدول ۵: Orders (سفارش‌ها)
```
┌─────────────────────────────────────┐
│            ORDERS                   │
├─────────────────────────────────────┤
│ id (PK)              UUID           │
│ user_id (FK)         UUID           │
│ order_number         VARCHAR(20)    │
│ status               ENUM           │
│ total_amount         DECIMAL(10,2)  │
│ created_at           TIMESTAMP      │
│ updated_at           TIMESTAMP      │
└─────────────────────────────────────┘
```

### جدول ۶: Order_Items (موارد سفارش)
```
┌─────────────────────────────────────┐
│        ORDER_ITEMS                  │
├─────────────────────────────────────┤
│ id (PK)              UUID           │
│ order_id (FK)        UUID           │
│ product_id (FK)      UUID           │
│ quantity             INT            │
│ unit_price           DECIMAL(10,2)  │
│ total_price          DECIMAL(10,2)  │
└─────────────────────────────────────┘
```

### جدول ۷: Payments (پرداخت‌ها)
```
┌─────────────────────────────────────┐
│           PAYMENTS                  │
├─────────────────────────────────────┤
│ id (PK)              UUID           │
│ order_id (FK)        UUID           │
│ amount               DECIMAL(10,2)  │
│ status               ENUM           │
│ gateway              VARCHAR(50)    │
│ transaction_id       VARCHAR(100)   │
│ created_at           TIMESTAMP      │
└─────────────────────────────────────┘
```

### جدول ۸: Reviews (نظرات)
```
┌─────────────────────────────────────┐
│           REVIEWS                   │
├─────────────────────────────────────┤
│ id (PK)              UUID           │
│ product_id (FK)      UUID           │
│ user_id (FK)         UUID           │
│ rating               INT (1-5)      │
│ comment              TEXT           │
│ created_at           TIMESTAMP      │
└─────────────────────────────────────┘
```

### جدول ۹: Cart (سبد خرید)
```
┌─────────────────────────────────────┐
│             CART                    │
├─────────────────────────────────────┤
│ id (PK)              UUID           │
│ user_id (FK)         UUID           │
│ created_at           TIMESTAMP      │
│ updated_at           TIMESTAMP      │
└─────────────────────────────────────┘
```

### جدول ۱۰: Cart_Items (موارد سبد)
```
┌─────────────────────────────────────┐
│         CART_ITEMS                  │
├─────────────────────────────────────┤
│ id (PK)              UUID           │
│ cart_id (FK)         UUID           │
│ product_id (FK)      UUID           │
│ quantity             INT            │
└─────────────────────────────────────┘
```

### جدول ۱۱: Wishlist (علاقه‌مندی‌ها)
```
┌─────────────────────────────────────┐
│          WISHLIST                   │
├─────────────────────────────────────┤
│ id (PK)              UUID           │
│ user_id (FK)         UUID           │
│ product_id (FK)      UUID           │
│ created_at           TIMESTAMP      │
└─────────────────────────────────────┘
```

### جدول ۱۲: Address (آدرس‌ها)
```
┌─────────────────────────────────────┐
│          ADDRESS                    │
├─────────────────────────────────────┤
│ id (PK)              UUID           │
│ user_id (FK)         UUID           │
│ province             VARCHAR(50)    │
│ city                 VARCHAR(50)    │
│ street               VARCHAR(255)   │
│ postal_code          VARCHAR(10)    │
│ is_default           BOOLEAN        │
│ created_at           TIMESTAMP      │
└─────────────────────────────────────┘
```

---

## ۳. روابط (Relationships)

```
Users ─────1─────N───── Orders
              (has many)

Users ─────1─────N───── Cart
              (has one)

Users ─────1─────N───── Wishlist

Users ─────1─────N───── Reviews

Users ─────1─────N───── Address

Categories ─────1─────N───── Products
                  (belongs to)

Vendors ─────1─────N───── Products
              (sells)

Products ─────1─────N───── Order_Items
                  (included in)

Orders ─────1─────N───── Order_Items
              (contains)

Orders ─────1─────1───── Payments
              (has one)

Products ─────1─────N───── Reviews
              (reviewed by)

Products ─────1─────N───── Cart_Items
              (added to cart)

Cart ─────1─────N───── Cart_Items
         (contains)

Products ─────1─────N───── Wishlist
           (wishlisted by)
```

---

## ۴. انواع داده (Data Types)

| Type | استفاده | مثال |
|------|--------|------|
| `UUID/GUID` | کلید اصلی | `id` |
| `VARCHAR(n)` | متن کوتاه | `email`, `name` |
| `TEXT` | متن طولانی | `description`, `comment` |
| `INT` | اعداد صحیح | `quantity`, `stock` |
| `DECIMAL(10,2)` | اعداد اعشاری | `price`, `amount` |
| `BOOLEAN` | صحیح/غلط | `is_active`, `is_default` |
| `TIMESTAMP` | تاریخ و زمان | `created_at`, `updated_at` |
| `ENUM` | مقادیر محدود | `status`, `gateway` |
| `JSON` | داده‌های ساختاری | `metadata`, `attributes` |

---

## ۵. ENUM انواع

### Order Status:
```
PENDING → PAID → PROCESSING → SHIPPED → DELIVERED → COMPLETED
```

### Payment Status:
```
PENDING → COMPLETED / FAILED
```

### Product Status:
```
DRAFT → ACTIVE → OUT_OF_STOCK → DISCONTINUED
```

---

## ۶. Indexes (برای بهتری جستجو)

```
├─ Users:
│  ├─ INDEX(email) - برای لاگین سریع
│  ├─ INDEX(phone) - برای جستجو
│
├─ Products:
│  ├─ INDEX(category_id) - برای نمایش کالاهای یک دسته
│  ├─ INDEX(vendor_id) - برای نمایش کالاهای فروشنده
│  ├─ INDEX(sku) - برای جستجوی کالا
│
├─ Orders:
│  ├─ INDEX(user_id) - برای نمایش سفارشات کاربر
│  ├─ INDEX(status) - برای فیلتر کردن سفارشات
│  ├─ INDEX(created_at) - برای مرتب‌سازی زمانی
│
└─ Reviews:
   ├─ INDEX(product_id) - برای نمایش نظرات یک محصول
   └─ INDEX(user_id) - برای نمایش نظرات یک کاربر
```

---

## ۷. Constraints (محدودیت‌ها)

```
├─ PRIMARY KEY: هر جدول باید id منحصربفرد داشته باشد
├─ FOREIGN KEY: جداول باید درست به هم وصل باشند
├─ UNIQUE: email و phone نباید تکراری باشند
├─ NOT NULL: فیلدهای ضروری خالی نباشند
└─ CHECK: مثلاً rating بین 1-5 باشد
```

---

## ۸. Normalization (نرمال‌سازی)

- ✅ **1NF**: هر سلول یک مقدار دارد
- ✅ **2NF**: هیچ وابستگی جزئی نیست
- ✅ **3NF**: هیچ وابستگی انتقالی نیست
- ✅ **BCNF**: طراحی نهایی بهینه است

