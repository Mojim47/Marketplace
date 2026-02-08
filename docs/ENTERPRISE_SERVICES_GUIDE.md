# 🚀 NextGen Marketplace - Enterprise Services Guide

> **Production-Ready Infrastructure Services**  
> MinIO (Object Storage) • MeiliSearch (Search Engine) • BullMQ (Job Queue) • Automated Backups • SEO Optimization

---

## 📦 New Services Overview

### 1. **MinIO - S3-Compatible Object Storage**
- **Purpose**: Store product images, invoices, and user uploads
- **Port**: 9000 (API), 9001 (Console)
- **Features**:
  - Presigned URLs for client-side uploads
  - Automatic bucket initialization
  - Public/private file separation
  - Multi-part upload support for large files

### 2. **MeiliSearch - Lightning-Fast Search Engine**
- **Purpose**: Power product search with typo-tolerance
- **Port**: 7700
- **Features**:
  - Real-time indexing
  - Persian language support
  - Faceted search (categories, brands, price)
  - Ranking by sales, stock, and ratings

### 3. **BullMQ - Background Job Queue**
- **Purpose**: Process heavy tasks asynchronously
- **Queues**:
  - `sms-queue`: Kavenegar SMS notifications
  - `email-queue`: Invoice and notification emails
  - `image-process-queue`: Image resizing and optimization

### 4. **Automated Database Backups**
- **Schedule**: Every 12 hours
- **Process**: pg_dump → gzip → MinIO upload
- **Retention**: 14 backups in MinIO

### 5. **Technical SEO**
- **Features**:
  - XML Sitemap generation
  - Product Schema (JSON-LD)
  - Breadcrumb Schema
  - Organization Schema

---

## 🔧 Quick Start

### 1️⃣ Install Dependencies

```bash
# Root project
npm install

# Install new packages
npm install --workspace=libs/storage @aws-sdk/client-s3 @aws-sdk/s3-request-presigner @aws-sdk/lib-storage
npm install --workspace=libs/search meilisearch
npm install --workspace=libs/queue bullmq ioredis sharp
npm install --workspace=apps/worker bullmq sharp axios nodemailer
npm install --workspace=apps/web next-sitemap
```

### 2️⃣ Configure Environment Variables

Copy `.env.example` to `.env` and update:

```bash
# MinIO
MINIO_ROOT_PASSWORD=your_secure_password_here
MINIO_SECRET_KEY=your_secure_password_here

# MeiliSearch
MEILI_MASTER_KEY=your_secure_master_key_here

# SMS Provider (Kavenegar)
KAVENEGAR_API_KEY=your_api_key_here

# SMTP (for emails)
SMTP_USER=your_email@gmail.com
SMTP_PASSWORD=your_app_password_here
```

### 3️⃣ Start All Services

```bash
# Start infrastructure services
docker-compose -f docker-compose.prod.yml up -d

# Verify all services are healthy
docker-compose -f docker-compose.prod.yml ps
```

### 4️⃣ Initialize Services

```bash
# Initialize MinIO buckets
npm run storage:init

# Initialize MeiliSearch indexes
npm run search:init

# Test backup script
./scripts/backup-db.sh
```

---

## 📚 Usage Examples

### Storage Service (MinIO)

```typescript
import { StorageService } from '@nextgen/storage';

const storage = new StorageService(logger);
await storage.initialize();

// Upload a file
const { key, url } = await storage.uploadFile(
  buffer,
  'products/image.jpg',
  { contentType: 'image/jpeg', isPublic: true }
);

// Generate presigned URL (client-side upload)
const { uploadUrl, key } = await storage.getPresignedUploadUrl(
  'products/temp-image.jpg',
  { contentType: 'image/jpeg', expiresIn: 3600 }
);
// Send uploadUrl to frontend for direct upload
```

### Search Service (MeiliSearch)

```typescript
import { SearchService } from '@nextgen/search';

const search = new SearchService(logger);
await search.initialize();

// Index a product
await search.indexProduct({
  id: 'prod_123',
  name: 'لپ تاپ ایسوس',
  price: 25000000,
  inStock: true,
  totalSales: 150,
  rating: 4.5,
  // ... more fields
});

// Search products
const results = await search.searchProducts({
  query: 'لپتاپ',
  limit: 20,
  filters: 'inStock = true AND price < 30000000',
  facets: ['brand', 'category'],
  sort: ['totalSales:desc'],
});
```

### Queue Service (BullMQ)

```typescript
import { QueueService } from '@nextgen/queue';

const queue = new QueueService(logger);

// Send SMS
await queue.sendSms({
  to: '09123456789',
  message: 'کد تایید شما: 123456',
});

// Send Email with template
await queue.sendEmail({
  to: 'user@example.com',
  subject: 'فاکتور خرید شما',
  template: 'invoice',
  params: { orderId: '12345', amount: 1000000 },
});

// Process image (create thumbnails)
await queue.processImage({
  sourceKey: 'uploads/original.jpg',
  operations: [
    { width: 150, height: 150, suffix: '_thumb', format: 'webp', quality: 85 },
    { width: 800, height: 800, suffix: '_large', format: 'webp', quality: 90 },
  ],
});
```

### SEO Components

```tsx
import { ProductSchema } from '@/components/seo';

export default function ProductPage({ product }) {
  return (
    <>
      <ProductSchema
        product={{
          id: product.id,
          name: product.name,
          price: product.price,
          salePrice: product.salePrice,
          availability: product.inStock ? 'InStock' : 'OutOfStock',
          image: product.images,
          rating: {
            value: product.rating,
            count: product.reviewCount,
          },
          seller: {
            name: product.vendorName,
            type: 'Organization',
          },
        }}
      />
      
      {/* Your page content */}
    </>
  );
}
```

---

## 🔐 Security Checklist

- [ ] Change all default passwords in `.env`
- [ ] Set `MEILI_MASTER_KEY` to a random 32-character string
- [ ] Configure `MINIO_ROOT_PASSWORD` (min 8 characters)
- [ ] Add your `KAVENEGAR_API_KEY`
- [ ] Configure SMTP credentials for email
- [ ] In production, set `internal: true` in Docker network config
- [ ] Never expose MinIO/MeiliSearch ports to public

---

## 📊 Monitoring & Health Checks

### Service Health

```bash
# Check all services
docker-compose -f docker-compose.prod.yml ps

# Check MinIO health
curl http://localhost:9000/minio/health/live

# Check MeiliSearch health
curl http://localhost:7700/health

# Check Redis (for queues)
docker exec nextgen-redis-prod redis-cli -a $REDIS_PASSWORD PING
```

### Queue Statistics

```typescript
// Get queue stats
const stats = await queueService.getQueueStats('sms-queue');
console.log(stats);
// { waiting: 5, active: 2, completed: 1234, failed: 3 }
```

### Search Index Stats

```typescript
const stats = await searchService.getStats();
console.log(stats);
// { numberOfDocuments: 1500, isIndexing: false }
```

---

## 🔄 Backup & Restore

### Manual Backup

```bash
./scripts/backup-db.sh
```

### Restore from Backup

```bash
# List available backups
./scripts/restore-db.sh

# Restore specific backup
./scripts/restore-db.sh nextgen_db_backup_20251123_120000.sql.gz
```

### Automated Backups

Backups run automatically every 12 hours via cron inside the `backup` container.

View backup logs:
```bash
docker logs nextgen-backup-service
```

---

## 🚀 Production Deployment

### 1. Build Worker Docker Image

```bash
docker build -f Dockerfile.worker -t nextgen-worker:latest .
```

### 2. Start All Services

```bash
docker-compose -f docker-compose.prod.yml up -d
```

### 3. Verify Worker is Running

```bash
docker logs nextgen-worker-prod
```

Expected output:
```
🚀 Starting NextGen Marketplace Worker Service...
SMS Worker started
Email Worker started
Image Worker started
✅ Worker service is running and processing jobs
```

---

## 🛠 Troubleshooting

### MinIO Connection Failed

```bash
# Check if MinIO is running
docker ps | grep minio

# Check logs
docker logs nextgen-minio-prod

# Verify network connectivity
docker exec nextgen-api-container ping minio
```

### MeiliSearch Not Indexing

```bash
# Check MeiliSearch logs
docker logs nextgen-meilisearch-prod

# Verify master key is set
docker exec nextgen-meilisearch-prod env | grep MEILI_MASTER_KEY

# Manually test indexing
curl -X POST 'http://localhost:7700/indexes/products/documents' \
  -H 'Authorization: Bearer YOUR_MASTER_KEY' \
  -H 'Content-Type: application/json' \
  --data '[{"id": "1", "name": "Test Product"}]'
```

### Worker Not Processing Jobs

```bash
# Check worker logs
docker logs -f nextgen-worker-prod

# Check Redis connection
docker exec nextgen-redis-prod redis-cli -a $REDIS_PASSWORD PING

# Check queue contents
docker exec nextgen-redis-prod redis-cli -a $REDIS_PASSWORD \
  LLEN bull:sms-queue:wait
```

---

## 📈 Performance Tuning

### MinIO
- Increase memory limits for high-traffic scenarios
- Use SSD storage for better I/O performance
- Enable CDN for public files

### MeiliSearch
- Adjust `MEILI_MAX_INDEXING_MEMORY` based on dataset size
- Increase `MEILI_MAX_INDEXING_THREADS` for faster indexing
- Use separate index per language if multilingual

### BullMQ Workers
- Increase worker `concurrency` for more parallelism
- Add more worker replicas in `docker-compose.yml`
- Monitor Redis memory usage

---

## 📞 Support

For issues or questions:
- Check logs: `docker-compose logs -f [service-name]`
- Review configuration in `.env`
- Ensure all services are healthy: `docker-compose ps`

---

## ✅ Final Checklist

- [ ] All Docker services running and healthy
- [ ] Environment variables configured
- [ ] MinIO buckets initialized
- [ ] MeiliSearch indexes created
- [ ] Workers processing jobs
- [ ] Backup script tested
- [ ] SEO components integrated
- [ ] Sitemap generated (`npm run postbuild`)

**You're now running enterprise-grade infrastructure! 🎉**
