# 📊 Sales & Operations Tools - راهنمای استفاده

این ماژول شامل ابزارهای مارکتینگ، پشتیبانی، گزارش‌گیری و اشتراک‌گذاری برای NextGen Marketplace است.

## 🎯 ویژگی‌های پیاده‌سازی شده

### 1. Google Analytics (تحلیل وب)
**فایل:** `apps/web/src/components/analytics/GoogleAnalytics.tsx`

**قابلیت‌ها:**
- ✅ بارگذاری بهینه با Next.js Script
- ✅ ردیابی خودکار تغییر مسیر (Page Views)
- ✅ پشتیبانی از رویدادهای سفارشی (Custom Events)
- ✅ ردیابی تجارت الکترونیک (Ecommerce Tracking)
- ✅ تنظیمات حریم خصوصی (anonymize_ip)

**نحوه فعال‌سازی:**
```bash
# در فایل .env.local اضافه کنید:
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
```

**استفاده از رویدادهای سفارشی:**
```tsx
import { trackEvent, trackEcommerce } from '@/components/analytics/GoogleAnalytics';

// ثبت رویداد ساده
trackEvent('button_click', { button_name: 'purchase' });

// ثبت مشاهده محصول
trackEcommerce.viewItem('product-123', 'تلفن همراه', 5000000);

// ثبت افزودن به سبد
trackEcommerce.addToCart('product-123', 'تلفن همراه', 5000000, 1);

// ثبت خرید
trackEcommerce.purchase('ORD-001', 5000000, [
  { id: 'product-123', name: 'تلفن همراه', price: 5000000, quantity: 1 }
]);
```

---

### 2. Live Chat (چت زنده پشتیبانی)
**فایل:** `apps/web/src/components/support/LiveChat.tsx`

**پشتیبانی از پلتفرم‌ها:**
- ✅ **Crisp** (crisp.chat) - بین‌المللی
- ✅ **Goftino** (goftino.com) - فارسی
- ✅ **Tawk.to** (tawk.to) - رایگان
- ✅ **Intercom** (intercom.com) - پیشرفته

**نحوه فعال‌سازی:**
```bash
# در فایل .env.local:
NEXT_PUBLIC_CHAT_PROVIDER=goftino
NEXT_PUBLIC_CHAT_WEBSITE_ID=abc123-def456
```

**کنترل برنامه‌نویسی چت:**
```tsx
import { chatControls } from '@/components/support/LiveChat';

// باز کردن چت
chatControls.open();

// بستن چت
chatControls.close();

// مخفی کردن چت
chatControls.hide();

// نمایش چت
chatControls.show();
```

---

### 3. صفحه چاپ فاکتور
**فایل:** `apps/web/app/admin/orders/[id]/print/page.tsx`

**قابلیت‌ها:**
- ✅ فاکتور استاندارد A4 با طراحی حرفه‌ای
- ✅ برچسب ارسال پستی قابل جداسازی
- ✅ بهینه‌سازی برای چاپ (`@media print`)
- ✅ اطلاعات کامل فروشنده و خریدار
- ✅ جدول محصولات با محاسبات مالیاتی
- ✅ بارکد سفارش
- ✅ دکمه چاپ و بازگشت

**دسترسی:**
```
/admin/orders/[orderId]/print
مثال: /admin/orders/ORD-12345/print
```

**نکات طراحی:**
- هدر و فوتر سایت در هنگام چاپ مخفی می‌شوند
- برچسب ارسال در صفحه جداگانه چاپ می‌شود
- فونت‌ها و رنگ‌ها برای چاپ سیاه‌وسفید بهینه شده‌اند

---

### 4. خروجی Excel/CSV
**فایل:** `apps/web/app/api/admin/reports/export/route.ts`

**قابلیت‌ها:**
- ✅ خروجی Excel (`.xlsx`) با فرمت حرفه‌ای
- ✅ خروجی CSV برای داده‌های ساده
- ✅ پشتیبانی از RTL برای فارسی
- ✅ فرمت‌بندی اعداد و تاریخ
- ✅ فرمول‌های محاسباتی برای جمع‌کل

**APIها:**

**1. خروجی سفارشات:**
```bash
GET /api/admin/reports/export?type=orders&month=2024-01
```

**2. خروجی کاربران:**
```bash
GET /api/admin/reports/export?type=users&startDate=2024-01-01&endDate=2024-01-31
```

**3. خروجی CSV (POST):**
```bash
POST /api/admin/reports/export
Content-Type: application/json

{
  "type": "orders",
  "data": [
    { "orderNumber": "ORD-001", "total": 500000 }
  ]
}
```

**استفاده در React:**
```tsx
const handleExport = async () => {
  const response = await fetch('/api/admin/reports/export?type=orders&month=2024-01');
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'orders-report.xlsx';
  a.click();
};
```

---

### 5. OpenGraph Metadata (اشتراک‌گذاری اجتماعی)
**فایل:** `apps/web/app/(public)/product/[id]/page.tsx`

**قابلیت‌ها:**
- ✅ تصویر محصول در پیش‌نمایش
- ✅ نام و توضیحات محصول
- ✅ قیمت در توضیحات
- ✅ پشتیبانی از Twitter Card
- ✅ بهینه‌سازی SEO

**پلتفرم‌های پشتیبانی‌شده:**
- ✅ تلگرام
- ✅ واتساپ
- ✅ لینکدین
- ✅ توییتر/X
- ✅ فیسبوک

**خروجی نمونه:**
```html
<meta property="og:title" content="تلفن همراه سامسونگ" />
<meta property="og:description" content="قیمت: 5,000,000 تومان" />
<meta property="og:image" content="https://example.com/product.jpg" />
<meta property="og:url" content="https://example.com/product/123" />
```

---

## 🚀 شروع سریع

### گام 1: تنظیم متغیرهای محیطی
```bash
cd apps/web
cp .env.example .env.local
```

سپس فایل `.env.local` را ویرایش کنید:
```env
# Google Analytics
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-ABC123XYZ

# Live Chat (Goftino برای فارسی توصیه می‌شود)
NEXT_PUBLIC_CHAT_PROVIDER=goftino
NEXT_PUBLIC_CHAT_WEBSITE_ID=your-website-id
```

### گام 2: نصب وابستگی‌ها
```bash
npm install
```

پکیج‌های اضافه شده:
- `exceljs` - برای تولید فایل‌های Excel

### گام 3: اجرای پروژه
```bash
npm run dev
```

---

## 📖 مستندات تکمیلی

### مسیرهای API

| مسیر | متد | توضیحات |
|------|------|---------|
| `/api/admin/reports/export` | GET | خروجی Excel سفارشات/کاربران |
| `/api/admin/reports/export` | POST | خروجی CSV با داده دلخواه |
| `/admin/orders/[id]/print` | GET | صفحه چاپ فاکتور |

### کامپوننت‌ها

| فایل | نوع | توضیحات |
|------|-----|---------|
| `GoogleAnalytics.tsx` | Client Component | اسکریپت GA4 |
| `LiveChat.tsx` | Client Component | ویجت چت |

---

## 🔒 امنیت

### Google Analytics
- ✅ تنها در محیط production فعال است
- ✅ anonymize_ip فعال است
- ✅ cookie با SameSite=None;Secure

### Live Chat
- ✅ تنها در محیط production فعال است
- ✅ lazy loading برای بهینه‌سازی

### Excel Export
- ⚠️ **نکته امنیتی:** این API باید محافظت شود
- پیشنهاد: اضافه کردن middleware احراز هویت
- پیشنهاد: محدودکردن دسترسی به ادمین‌ها

```tsx
// مثال محافظت API:
export async function GET(request: NextRequest) {
  const session = await getServerSession();
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // ... ادامه کد
}
```

---

## 🎨 سفارشی‌سازی

### تغییر رنگ‌بندی فاکتور
در فایل `page.tsx` فاکتور:
```tsx
// Header background
<tr className="bg-gray-100"> // تغییر به bg-blue-100

// Footer styling
<div className="bg-gray-50"> // تغییر به bg-blue-50
```

### افزودن ستون‌های جدید به Excel
در فایل `route.ts`:
```tsx
worksheet.columns = [
  { header: 'ستون جدید', key: 'newColumn', width: 15 },
  // ... ستون‌های دیگر
];
```

---

## 🐛 عیب‌یابی

### Analytics کار نمی‌کند
1. بررسی کنید `NEXT_PUBLIC_GA_MEASUREMENT_ID` در `.env.local` تنظیم شده باشد
2. کنسول مرورگر را چک کنید: باید `[OpenTelemetry] ...` نشان دهد
3. در محیط development فعال نمی‌شود - production build بگیرید:
   ```bash
   npm run build && npm start
   ```

### Chat Widget نمایش داده نمی‌شود
1. مطمئن شوید `NEXT_PUBLIC_CHAT_PROVIDER` و `NEXT_PUBLIC_CHAT_WEBSITE_ID` تنظیم شده‌اند
2. کنسول مرورگر را برای خطاهای JavaScript بررسی کنید
3. فایروال یا ad-blocker را غیرفعال کنید

### Excel Export خطا می‌دهد
1. مطمئن شوید `exceljs` نصب شده است
2. بررسی کنید داده‌های mock در `getOrdersData()` صحیح باشند
3. لاگ‌های سرور را چک کنید

---

## 📝 TODO و بهبودهای آینده

- [ ] اضافه کردن احراز هویت به Excel Export API
- [ ] اتصال به دیتابیس واقعی (حذف داده‌های mock)
- [ ] افزودن نمودار به گزارشات Excel
- [ ] پشتیبانی از چند زبانه در فاکتور
- [ ] اضافه کردن QR Code به برچسب ارسال
- [ ] پشتیبانی از چندین تصویر در OpenGraph
- [ ] افزودن Google Tag Manager
- [ ] اضافه کردن Facebook Pixel

---

## 📞 پشتیبانی

برای سوالات و مشکلات:
- 📧 ایمیل: support@nextgen-market.com
- 💬 تلگرام: @nextgen_support
- 🌐 مستندات: https://docs.nextgen-market.com

---

**نسخه:** 1.0.0  
**تاریخ بروزرسانی:** 2024-01-20  
**نویسنده:** NextGen Development Team
