# NextGen Marketplace - Database Implementation Complete

## ✅ فایل‌های ایجاد شده:

### 1. **DATABASE_DESIGN.md** (13 KB)
- نقشه کامل طراحی مفهومی
- Entities و Relationships
- Data Types و Constraints
- Indexes و Normalization

### 2. **prisma/schema.prisma** (6.2 KB)
- تعریف تمام جدول‌ها به صورت ORM
- Relations و Constraints
- Use Prisma Client برای کدنویسی

### 3. **database.sql** (8 KB)
- SQL خالص برای PostgreSQL
- تمام جدول‌ها
- Triggers و Indexes
- قابل اجرا مستقیم

### 4. **seed.sql** (8 KB)
- نمونه داده‌های تست
- 12 جدول با داده
- برای توسعه و تست

---

## 📊 جدول‌ها (12 تا)

| # | جدول | توضیح | Rows |
|---|-------|--------|------|
| 1 | `users` | کاربران | 3 |
| 2 | `addresses` | آدرس‌ها | 2 |
| 3 | `categories` | دسته‌بندی | 5 |
| 4 | `vendors` | فروشندگان | 3 |
| 5 | `products` | محصولات | 8 |
| 6 | `carts` | سبد خرید | 1 |
| 7 | `cart_items` | موارد سبد | 2 |
| 8 | `wishlists` | علاقه‌مندی | 2 |
| 9 | `orders` | سفارش‌ها | 2 |
| 10 | `order_items` | موارد سفارش | 3 |
| 11 | `payments` | پرداخت‌ها | 2 |
| 12 | `reviews` | نظرات | 2 |

---

## 🔌 روابط (Relations)

```
Users (1) ──────→ (N) Orders
Users (1) ──────→ (1) Cart
Users (1) ──────→ (N) Addresses
Users (1) ──────→ (N) Reviews
Users (1) ──────→ (N) Wishlists

Categories (1) ──→ (N) Products
Categories (1) ──→ (1) Categories (Parent)

Vendors (1) ────→ (N) Products

Products (1) ───→ (N) Cart_Items
Products (1) ───→ (N) Order_Items
Products (1) ───→ (N) Reviews
Products (1) ───→ (N) Wishlists

Carts (1) ──────→ (N) Cart_Items

Orders (1) ─────→ (N) Order_Items
Orders (1) ─────→ (1) Payment
```

---

## 🗄️ نحوه استفاده:

### **روش 1: ORM (Prisma) - برای Node.js**

```bash
# نصب
npm install @prisma/client

# اجرای migrations
npx prisma migrate dev --name init

# استفاده در کد:
const users = await prisma.user.findMany();
const createOrder = await prisma.order.create({
  data: { user_id: '...', total_amount: 100 }
});
```

### **روش 2: SQL خالص - برای PostgreSQL**

```bash
# اتصال
psql -U nextgen -d nextgen_marketplace -f database.sql

# اضافه کردن نمونه داده‌ها
psql -U nextgen -d nextgen_marketplace -f seed.sql

# Query مثال:
SELECT p.name, COUNT(o.id) as sales 
FROM products p
LEFT JOIN order_items o ON p.id = o.product_id
GROUP BY p.id
ORDER BY sales DESC;
```

---

## 📋 Indexes (برای سرعت)

```
users:
  ├─ email (UNIQUE) - لاگین سریع
  └─ phone - جستجو

products:
  ├─ category_id - دسته‌بندی
  ├─ vendor_id - فروشنده
  └─ sku - کالا

orders:
  ├─ user_id - سفارشات کاربر
  ├─ status - فیلتر
  └─ created_at - ترتیب زمانی

reviews:
  ├─ product_id - نظرات محصول
  └─ user_id - نظرات کاربر
```

---

## ⚡ Features

- ✅ **Multi-tenant Ready** (برای بسیاری از فروشگاه‌ها)
- ✅ **Normalized Design** (3NF+)
- ✅ **Cascading Deletes** (حذف خودکار وابستگان)
- ✅ **Auto Timestamps** (updated_at خودکار)
- ✅ **Triggers** (Automatic updates)
- ✅ **Foreign Keys** (Referential integrity)
- ✅ **UNIQUE Constraints** (داده‌های منحصربفرد)

---

## 🚀 نوع داده‌ها

```
UUID/GUID ────→ شناسه‌های منحصربفرد
VARCHAR(n) ───→ متن کوتاه (ایمیل، نام)
TEXT ─────────→ متن طولانی (توضیح)
INT ──────────→ اعداد صحیح (تعداد، موجودی)
DECIMAL ──────→ اعداد اعشاری (قیمت)
BOOLEAN ──────→ صحیح/غلط
TIMESTAMP ────→ تاریخ و زمان
CHECK ────────→ بررسی‌های شرطی (rating 1-5)
```

---

## 💾 فضای حافظه

```
هر جدول:
  ├─ 100 کاربر ≈ 50 KB
  ├─ 1000 محصول ≈ 500 KB
  ├─ 10000 سفارش ≈ 5 MB
  └─ 100000 سفارش ≈ 50 MB

Total: کل سیستم ≈ 100-500 MB (بدون indexes)
```

---

## 📈 تعداد جدول‌ها

| Level | Count | Purpose |
|-------|-------|---------|
| Core | 2 | Users, Addresses |
| Catalog | 3 | Categories, Vendors, Products |
| Shopping | 4 | Carts, Cart_Items, Wishlists, Orders |
| Payment | 2 | Orders, Payments |
| Reviews | 1 | Reviews |
| **Total** | **12** | **Complete System** |

---

## ✔️ Checklist

- [x] Conceptual Design
- [x] Entities & Attributes
- [x] Relationships (1:1, 1:N, M:N)
- [x] Data Types
- [x] Primary Keys
- [x] Foreign Keys
- [x] Unique Constraints
- [x] Indexes
- [x] Triggers
- [x] ORM Schema (Prisma)
- [x] SQL Schema
- [x] Seed Data

---

**پایگاه داده کامل و آماده برای استفاده! 🎉**
