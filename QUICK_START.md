# 🚀 راه‌اندازی سریع - 10 دقیقه تا اولین API Call

## ✅ پیش‌نیازها (چک کنید)

```bash
# چک کردن Node.js
node --version  # باید >= 18.0.0 باشد

# چک کردن pnpm
pnpm --version  # باید >= 9.0.0 باشد

# چک کردن Docker
docker --version
docker-compose --version
```

اگر نصب نیستند:
- Node.js: https://nodejs.org/
- pnpm: `npm install -g pnpm`
- Docker: https://www.docker.com/get-started

**Env Load Order (dev):** .env -> .env.local -> .env.{NODE_ENV}
**Prod/Staging:** env files are ignored by default; use real process.env secrets.

---

## 🎯 مرحله 1: تنظیم Environment (2 دقیقه)

```bash
# کپی کردن .env.example
cp .env.local.example .env.local

# تولید JWT secrets امن
echo "JWT_SECRET=$(openssl rand -base64 64)" >> .env.local
echo "JWT_REFRESH_SECRET=$(openssl rand -base64 64)" >> .env.local

# نمایش فایل برای بررسی
cat .env.local | grep JWT_SECRET
```

**✅ چک کنید:** باید دو خط با JWT_SECRET و JWT_REFRESH_SECRET\ ببینید\r\n\r\n\*\*Env\ Load\ Order\ \(dev\):\*\*\ \.env\ ->\ \.env\.local\ ->\ \.env\.\{NODE_ENV}\r\n\*\*Prod/Staging:\*\*\ env\ files\ are\ ignored\ by\ default;\ use\ real\ process\.env\ secrets\.

---

## 🎯 مرحله 2: راه‌اندازی Database و Redis (3 دقیقه)

```bash
# شروع PostgreSQL و Redis
docker-compose up -d postgres redis

# صبر کنید تا healthy شوند (30 ثانیه)
echo "⏳ Waiting for services..."
sleep 30

# چک کردن وضعیت
docker-compose ps

# باید ببینید:
# nextgen-postgres   Up (healthy)
# nextgen-redis      Up (healthy)
```

**✅ چک کنید:** هر دو سرویس باید "Up (healthy)" باشند

**اگر خطا داد:**
```bash
# مشاهده logs
docker-compose logs postgres
docker-compose logs redis

# رفع مشکل پورت اشغال
# اگر پورت 5432 یا 6379 اشغال است:
docker-compose down
# ویرایش docker-compose.yml و تغییر پورت‌ها
```

---

## 🎯 مرحله 3: نصب Dependencies (2 دقیقه)

```bash
# نصب تمام packages
pnpm install

# این کار 1-2 دقیقه طول می‌کشد
# ☕ می‌توانید یک چای بردارید!
```

**✅ چک کنید:** باید پوشه `node_modules` ایجاد شود

---

## 🎯 مرحله 4: Setup Database (2 دقیقه)

```bash
# Generate Prisma Client
pnpm db:generate

# اجرای migrations
pnpm db:migrate:deploy

# اجرای seed (داده‌های اولیه)
pnpm db:seed

# باید ببینید:
# ✅ Tenant created
# ✅ Admin user created
# ✅ Products seeded
```

**✅ چک کنید:** باید پیام‌های موفقیت ببینید

**اگر خطا داد:**
```bash
# چک کردن اتصال database
docker-compose exec postgres psql -U nextgen -d nextgen_marketplace -c "SELECT 1;"

# اگر خطای "database does not exist" داد:
docker-compose exec postgres createdb -U nextgen nextgen_marketplace

# سپس دوباره migrate کنید
pnpm db:migrate:deploy
```

---

## 🎯 مرحله 5: راه‌اندازی API (1 دقیقه)

```bash
# شروع API در development mode
pnpm dev:api

# باید ببینید:
# [Nest] INFO [NestApplication] Nest application successfully started
# [Nest] INFO API is running on: http://localhost:3001
```

**✅ چک کنید:** API باید بدون خطا start شود

**نکته:** این terminal را باز نگه دارید. برای مراحل بعدی terminal جدید باز کنید.

---

## 🎯 مرحله 6: تست اولین API Call! 🎉

در terminal جدید:

```bash
# تست Health Check
curl http://localhost:3001/livez`r`n`r`n# Readiness (DB/Redis/MinIO)`r`ncurl http://localhost:3001/health

# باید ببینید:
# {"status":"ok","timestamp":"2026-02-06T..."}
```

**✅ تبریک! API شما کار می‌کند! 🎉**

---

## 🎯 مرحله 7: باز کردن Swagger UI

```bash
# در مرورگر باز کنید:
# Windows:
start http://localhost:3001/api/docs

# Mac/Linux:
open http://localhost:3001/api/docs

# یا دستی: http://localhost:3001/api/docs
```

**✅ چک کنید:** باید صفحه Swagger با لیست API endpoints ببینید

---

## 🎯 مرحله 8: ثبت‌نام اولین کاربر

در Swagger UI:
1. پیدا کردن `POST /api/v3/auth/register`
2. کلیک روی "Try it out"
3. وارد کردن:
```json
{
  "email": "test@example.com",
  "password": "Test@123456",
  "firstName": "علی",
  "lastName": "رضایی"
}
```
4. کلیک "Execute"

**یا با curl:**
```bash
curl -X POST http://localhost:3001/api/v3/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test@123456",
    "firstName": "علی",
    "lastName": "رضایی"
  }'
```

**✅ چک کنید:** باید Response 201 با اطلاعات کاربر دریافت کنید

---

## 🎯 مرحله 9: Login و دریافت Token

```bash
curl -X POST http://localhost:3001/api/v3/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test@123456"
  }'

# باید ببینید:
# {
#   "access_token": "eyJhbGc...",
#   "refresh_token": "eyJhbGc...",
#   "user": {...}
# }
```

**✅ چک کنید:** باید `access_token` دریافت کنید

**نکته:** این token را کپی کنید - برای مراحل بعدی نیاز دارید!

---

## 🎯 مرحله 10: مشاهده محصولات

```bash
# بدون authentication
curl http://localhost:3001/api/v3/products

# باید لیست محصولات seed شده را ببینید
```

**✅ تبریک! شما یک مارکت‌پلیس کامل دارید! 🎉**

---

## 📊 چک‌لیست نهایی

- [ ] ✅ Database running (postgres)
- [ ] ✅ Cache running (redis)
- [ ] ✅ API responding to /health
- [ ] ✅ Swagger UI accessible
- [ ] ✅ Can register users
- [ ] ✅ Can login and get token
- [ ] ✅ Can view products

---

## 🎯 مراحل بعدی

حالا که API کار می‌کند، می‌توانید:

### 1. ایجاد محصول جدید
```bash
# با token از مرحله 9:
TOKEN="eyJhbGc..."

curl -X POST http://localhost:3001/api/v3/products \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "لپ‌تاپ ایسوس",
    "name_fa": "لپ‌تاپ ایسوس",
    "price": 25000000,
    "stock": 5,
    "description": "لپ‌تاپ گیمینگ"
  }'
```

### 2. جستجوی محصولات
```bash
curl "http://localhost:3001/api/v3/products?search=لپ‌تاپ"
```

### 3. مشاهده یک محصول
```bash
curl http://localhost:3001/api/v3/products/PRODUCT_ID
```

### 4. راه‌اندازی Frontend (اختیاری)
```bash
# در terminal جدید:
pnpm dev:web

# باز کردن در مرورگر:
open http://localhost:3000
```

---

## 🐛 رفع مشکلات رایج

### خطا: "Port 3001 already in use"
```bash
# پیدا کردن process
lsof -i :3001  # Mac/Linux
netstat -ano | findstr :3001  # Windows

# کشتن process
kill -9 PID  # Mac/Linux
taskkill /PID PID /F  # Windows
```

### خطا: "Cannot connect to database"
```bash
# چک کردن docker
docker-compose ps

# اگر down است:
docker-compose up -d postgres

# چک کردن logs
docker-compose logs postgres
```

### خطا: "Prisma Client not generated"
```bash
pnpm db:generate
```

### خطا: "Module not found"
```bash
# پاک کردن و نصب مجدد
rm -rf node_modules
pnpm install
```

---

## 📞 کمک بیشتر

اگر مشکلی پیش آمد:

1. **چک کردن logs:**
```bash
# API logs
# در terminal که API run می‌کند

# Database logs
docker-compose logs -f postgres

# Redis logs
docker-compose logs -f redis
```

2. **چک کردن health:**
```bash
curl http://localhost:3001/livez`r`n`r`n# Readiness (DB/Redis/MinIO)`r`ncurl http://localhost:3001/health
```

3. **Restart همه چیز:**
```bash
# Stop API (Ctrl+C در terminal API)
docker-compose down
docker-compose up -d
pnpm dev:api
```

---

## 🎉 موفقیت!

اگر همه مراحل را با موفقیت انجام دادید:
- ✅ شما یک API کامل دارید
- ✅ Database با داده‌های اولیه
- ✅ Authentication کار می‌کند
- ✅ محصولات قابل مشاهده هستند

**مرحله بعدی:** مراجعه به `INCREMENTAL_DEPLOYMENT_ROADMAP.md` برای فاز 2

**موفق باشید! 🚀**









## Production Compose (Profile: prod)

```bash
# Prod-only limits/reservations
docker compose --profile prod -f docker-compose.yml -f docker-compose.prod.yml up -d
```
