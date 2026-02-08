# ═══════════════════════════════════════════════════════════════════════════
# NextGen Marketplace - AI Integration Documentation
# ═══════════════════════════════════════════════════════════════════════════

## 🧠 Overview

This document describes the AI-powered features integrated into the NextGen Marketplace:

1. **Auto-Content Engine**: Automated SEO content generation using OpenAI/Llama
2. **AI-to-3D Pipeline**: Convert product images to AR models using Meshy.ai
3. **AI Sales Assistant**: Text-to-SQL chatbot for admin analytics

---

## 1️⃣ Auto-Content Engine

### Purpose
Automatically generate compelling product descriptions, metadata, and SEO tags when vendors upload products.

### How It Works
1. Vendor uploads a product with minimal information
2. System triggers `ContentWorker` via BullMQ queue
3. Worker calls OpenAI GPT-4 (or Ollama as fallback)
4. AI generates:
   - Persian description (200-300 words)
   - English description (100-150 words)
   - Meta title (60 chars)
   - Meta description (150-160 chars)
   - SEO keywords (5-10)
   - Suggested pricing (based on market analysis)
5. Content is saved to database

### Configuration

```env
# .env
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
OLLAMA_ENDPOINT=http://localhost:11434  # Fallback
OLLAMA_MODEL=llama3.2
```

### Usage

```typescript
import { QueueService } from '@nextgen/queue';

const queueService = new QueueService();

// Trigger content generation
await queueService.addJob('CONTENT_GENERATION', {
  productId: 'prod_123',
  productName: 'لپ‌تاپ ایسوس',
  attributes: { ram: '16GB', storage: '512GB SSD' },
  categoryName: 'لپ‌تاپ',
  vendorName: 'فروشگاه تکنو',
});
```

### Files
- `apps/worker/src/content.worker.ts` - Worker implementation
- `libs/queue/src/config.ts` - Job type definitions

---

## 2️⃣ AI-to-3D Pipeline (AR Generation)

### Purpose
Convert 2D product images to 3D models (.glb) for Augmented Reality experiences.

### How It Works
1. Admin uploads product image via `/admin/ar-generation`
2. Image is uploaded to MinIO storage
3. System triggers `ARGenerationWorker` via BullMQ
4. Worker calls Meshy.ai API (or CSM.ai as fallback)
5. AI generates 3D model (takes 2-5 minutes)
6. GLB file is downloaded and stored in MinIO
7. Product is updated with `arModelUrl`

### Configuration

```env
# .env
MESHY_API_KEY=msy_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
CSM_API_KEY=csm_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx  # Fallback
```

### API Flow

```typescript
// Step 1: Upload image
POST /api/admin/ar-generation/upload
Content-Type: multipart/form-data
Body: { file: File, productId: string }

Response: { imageUrl: string, imageKey: string }

// Step 2: Generate AR model
POST /api/admin/ar-generation/generate
Content-Type: application/json
Body: { productId: string, imageUrl: string, imageKey: string }

Response: { jobId: string }
```

### Files
- `apps/worker/src/ar-generation.worker.ts` - Worker implementation
- `apps/web/app/admin/ar-generation/page.tsx` - Admin UI

---

## 3️⃣ AI Sales Assistant

### Purpose
Intelligent chatbot that answers admin questions about database analytics using natural language.

### How It Works
1. Admin asks question in Persian: "این هفته چقدر سود کردیم؟"
2. System sends question to OpenAI GPT-4
3. AI generates safe SQL query
4. Query is executed on PostgreSQL database
5. Results are formatted and visualized (charts, tables, metrics)
6. Response is streamed back to admin

### Configuration

```env
# .env
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
AI_SDK_MAX_TOKENS=2000
AI_SDK_TEMPERATURE=0.7
```

### Security Features
- Only SELECT queries allowed (no INSERT/UPDATE/DELETE)
- Admin authentication required
- Query validation before execution
- SQL injection protection via parameterized queries

### Usage

```tsx
// Add to any admin page
import AiAssistant from '@/src/components/AiAssistant';

export default function AdminDashboard() {
  return (
    <div>
      {/* Your dashboard content */}
      <AiAssistant />
    </div>
  );
}
```

### Sample Questions
- "این هفته چقدر سود کردیم؟" (This week's profit)
- "کدام محصول بیشترین فروش را داشته؟" (Top selling product)
- "تعداد سفارشات امروز چقدر است؟" (Today's order count)
- "چند کاربر جدید امروز ثبت‌نام کردند؟" (New users today)
- "محصولات کم‌فروش را نمایش بده" (Low-selling products)

### Files
- `apps/web/src/components/AiAssistant.tsx` - Chat UI
- `apps/web/app/api/admin/ai-assistant/route.ts` - API endpoint

---

## 📦 Dependencies

Add these to `package.json`:

```json
{
  "dependencies": {
    "ai": "^3.0.0",
    "chart.js": "^4.4.0",
    "react-chartjs-2": "^5.2.0",
    "bullmq": "^5.0.0",
    "sharp": "^0.33.0"
  }
}
```

---

## 🚀 Deployment Checklist

### 1. Install Dependencies
```bash
npm install ai chart.js react-chartjs-2
```

### 2. Configure Environment Variables
Copy API keys to `.env`:
- `OPENAI_API_KEY`
- `MESHY_API_KEY` or `CSM_API_KEY`
- `OLLAMA_ENDPOINT` (for local models)

### 3. Run Database Migration
```bash
npx prisma migrate dev --name add_ai_fields
```

### 4. Start Worker Service
```bash
npm run docker:build:worker
docker compose up -d worker
```

### 5. Test Features
- **Content Generation**: Upload product without description
- **AR Generation**: Visit `/admin/ar-generation`
- **AI Assistant**: Open admin dashboard, click floating button

---

## 💰 Cost Optimization

### OpenAI API Costs
- **gpt-4o-mini**: $0.15/1M input tokens, $0.60/1M output tokens
- Content generation: ~500 tokens per product = $0.0003/product
- AI Assistant: ~1000 tokens per query = $0.0006/query

### Meshy.ai API Costs
- Image-to-3D: $0.10-$0.30 per generation
- Average time: 2-5 minutes

### Recommendations
1. Use **Ollama** for local LLM (free but slower)
2. Batch content generation jobs
3. Cache AI responses for similar products
4. Set rate limits on AI endpoints

---

## 🛡️ Fallback Strategy

Each AI feature has a fallback mechanism:

1. **Content Generation**:
   - Primary: OpenAI GPT-4
   - Fallback: Ollama (local Llama)
   - Last Resort: Template-based generation

2. **AR Generation**:
   - Primary: Meshy.ai
   - Fallback: CSM.ai
   - Last Resort: Manual 3D modeling

3. **AI Assistant**:
   - Primary: OpenAI GPT-4
   - Fallback: Direct SQL execution with predefined queries
   - Last Resort: Manual reports

---

## 📊 Monitoring

### Queue Metrics
Monitor BullMQ queues in Redis:

```bash
# Check queue status
redis-cli LLEN bull:content-generation-queue:wait
redis-cli LLEN bull:ar-generation-queue:wait
```

### Worker Logs
```bash
docker logs nextgen-worker -f --tail 100
```

### AI API Usage
Track OpenAI usage at: https://platform.openai.com/usage
Track Meshy usage at: https://app.meshy.ai/usage

---

## 🔧 Troubleshooting

### Issue: Content not generating
**Solution**: Check OpenAI API key and Ollama endpoint

```bash
# Test OpenAI
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY"

# Test Ollama
curl http://localhost:11434/api/tags
```

### Issue: AR generation fails
**Solution**: Verify Meshy API key and image format

```bash
# Test Meshy API
curl https://api.meshy.ai/v2/account \
  -H "Authorization: Bearer $MESHY_API_KEY"
```

### Issue: AI Assistant not responding
**Solution**: Check admin authentication and database connection

---

## 🎯 Future Enhancements

1. **Voice Assistant**: Add speech-to-text for voice queries
2. **Image Recognition**: Auto-tag products from images
3. **Pricing AI**: Dynamic pricing based on demand
4. **Fraud Detection**: AI-powered transaction monitoring
5. **Customer Support Bot**: Automated customer service

---

## 📚 References

- OpenAI API: https://platform.openai.com/docs
- Meshy.ai Docs: https://docs.meshy.ai
- Vercel AI SDK: https://sdk.vercel.ai/docs
- BullMQ: https://docs.bullmq.io
- Ollama: https://ollama.ai/library

---

**Last Updated**: November 24, 2025
**Version**: 1.0.0
**Author**: NextGen AI Team
