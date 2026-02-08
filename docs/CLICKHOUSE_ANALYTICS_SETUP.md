# ClickHouse Analytics Setup Guide

## 🎯 Overview

This guide walks you through setting up **ClickHouse Analytics** for the NextGen Marketplace. This system provides real-time search analytics, user behavior tracking, and business intelligence insights.

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Search API    │───▶│     Vector      │───▶│   ClickHouse    │
│  (Typesense)    │    │ Log Processor   │    │   Analytics     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ Analytics       │    │ Real-time       │    │ Business        │
│ Service         │    │ Processing      │    │ Intelligence    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🚀 Quick Start

### 1. Start ClickHouse Services

```bash
# Start ClickHouse, Tabix UI, and Vector
docker-compose -f docker-compose.clickhouse.yml up -d

# Verify services are running
docker-compose -f docker-compose.clickhouse.yml ps
```

### 2. Initialize Database Schema

The database schema will be automatically created when ClickHouse starts. You can verify by accessing:

- **ClickHouse**: http://localhost:8123
- **Tabix UI**: http://localhost:8124

### 3. Test the Setup

```bash
# Run the analytics test script
pnpm tsx scripts/test-clickhouse-analytics.ts
```

## 📊 What You Get

### Real-Time Analytics Tables

1. **`search_events`** - Every search query with results
2. **`failed_searches`** - Queries with no results (critical for marketplace)
3. **`product_impressions`** - Which products were shown in search results
4. **`user_sessions`** - Aggregated session data

### Materialized Views (Auto-Updating)

1. **`popular_queries_daily`** - Trending searches
2. **`search_performance_hourly`** - Performance metrics by hour
3. **`category_search_stats`** - Category performance

### Business Intelligence Queries

```sql
-- Top failed searches (product opportunities)
SELECT 
    query_normalized,
    count() as failure_count,
    uniq(user_id) as affected_users
FROM failed_searches 
WHERE date >= today() - 7
GROUP BY query_normalized
ORDER BY failure_count DESC
LIMIT 20;

-- Most clicked products in search
SELECT 
    product_id,
    product_name,
    count() as impressions,
    sum(was_clicked) as clicks,
    (clicks / impressions) * 100 as ctr,
    avg(position) as avg_position
FROM product_impressions 
WHERE date >= today() - 7
GROUP BY product_id, product_name
HAVING impressions > 10
ORDER BY ctr DESC
LIMIT 20;
```

## 🔧 Integration with Your Search

### 1. Use Analytics-Enhanced Search Service

```typescript
import { AnalyticsSearchService } from '@nextgen/search';

// In your controller
@Injectable()
export class SearchController {
  constructor(
    private readonly analyticsSearchService: AnalyticsSearchService
  ) {}

  @Get('search')
  async search(@Query() query: any, @Req() req: Request) {
    const result = await this.analyticsSearchService.search({
      q: query.q,
      user_id: req.user?.id,
      session_id: req.sessionID,
      ip_address: req.ip,
      user_agent: req.get('User-Agent'),
      category_filter: query.category,
      price_range_min: query.minPrice,
      price_range_max: query.maxPrice,
    });

    return result;
  }

  @Post('search/:eventId/click')
  async trackClick(
    @Param('eventId') eventId: string,
    @Body() body: { productId: string; position: number; timeToClick?: number }
  ) {
    await this.analyticsSearchService.trackSearchClick(
      eventId,
      body.productId,
      body.position,
      body.timeToClick
    );
    
    return { success: true };
  }
}
```

### 2. Frontend Integration

```typescript
// Track search clicks
const handleProductClick = async (product: any, position: number) => {
  const timeToClick = Date.now() - searchStartTime;
  
  await fetch(`/api/search/${searchEventId}/click`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      productId: product.id,
      position: position + 1, // 1-based
      timeToClick,
    }),
  });
  
  // Navigate to product page
  router.push(`/products/${product.id}`);
};
```

## 📈 Analytics Dashboard

### Get Dashboard Data

```typescript
import { AnalyticsService } from '@nextgen/analytics';

@Injectable()
export class AnalyticsDashboardService {
  constructor(private readonly analyticsService: AnalyticsService) {}

  async getDashboard() {
    return await this.analyticsService.getDashboard();
  }

  async getFailedSearchOpportunities() {
    return await this.analyticsService.getFailedSearchInsights(7, 50);
  }

  async getTopPerformingProducts() {
    return await this.analyticsService.getTopClickedProducts(30, 100);
  }
}
```

### Dashboard Metrics

The dashboard provides:

- **Total searches today**
- **Failed searches today** 
- **Failure rate percentage**
- **Average search time**
- **Popular queries** (trending)
- **Failed searches** (opportunities)
- **Performance by hour**
- **Top clicked products**
- **Category performance**
- **User behavior metrics**

## 🔍 Key Business Insights

### 1. Failed Search Analysis
**Why it matters**: Failed searches = missed revenue opportunities

```sql
-- Products users are searching for but don't exist
SELECT 
    query_normalized,
    count() as search_volume,
    uniq(user_id) as unique_users,
    count() * 1000000 as estimated_revenue_opportunity -- Rough estimate
FROM failed_searches 
WHERE date >= today() - 30
GROUP BY query_normalized
ORDER BY search_volume DESC
LIMIT 50;
```

### 2. Search Performance Monitoring
**Why it matters**: Slow search = poor user experience

```sql
-- Search performance trends
SELECT 
    date,
    avg(avg_search_time) as daily_avg_time,
    quantile(0.95)(avg_search_time) as p95_time,
    sum(total_searches) as daily_searches
FROM search_performance_hourly 
WHERE date >= today() - 30
GROUP BY date
ORDER BY date;
```

### 3. Product Discovery Optimization
**Why it matters**: Improve product visibility and sales

```sql
-- Products with high impressions but low clicks (need better titles/images)
SELECT 
    product_id,
    product_name,
    sum(impressions) as total_impressions,
    sum(clicks) as total_clicks,
    (total_clicks / total_impressions) * 100 as ctr,
    avg(position) as avg_position
FROM (
    SELECT 
        product_id,
        any(product_name) as product_name,
        count() as impressions,
        sum(was_clicked) as clicks,
        avg(position) as position
    FROM product_impressions 
    WHERE date >= today() - 7
    GROUP BY product_id
)
GROUP BY product_id, product_name
HAVING total_impressions > 100 AND ctr < 2
ORDER BY total_impressions DESC;
```

## 🛠️ Configuration

### Environment Variables

```bash
# ClickHouse
CLICKHOUSE_HOST=localhost
CLICKHOUSE_HTTP_PORT=8123
CLICKHOUSE_DB=nextgen_analytics
CLICKHOUSE_USER=analytics
CLICKHOUSE_PASSWORD=clickhouse_secret_2024

# Analytics Sampling (1.0 = 100%, 0.1 = 10%)
ANALYTICS_SEARCH_SAMPLING=1.0
ANALYTICS_IMPRESSION_SAMPLING=1.0
ANALYTICS_SESSION_SAMPLING=1.0

# Batch Processing
ANALYTICS_BATCH_SIZE=100
ANALYTICS_FLUSH_INTERVAL=10000
```

### Performance Tuning

For high-traffic scenarios:

```bash
# Reduce sampling to handle scale
ANALYTICS_SEARCH_SAMPLING=0.1  # Sample 10% of searches
ANALYTICS_IMPRESSION_SAMPLING=0.05  # Sample 5% of impressions

# Increase batch sizes
ANALYTICS_BATCH_SIZE=1000
ANALYTICS_FLUSH_INTERVAL=5000
```

## 🚨 Monitoring & Alerts

### Health Checks

```typescript
// Add to your health check endpoint
@Get('health')
async healthCheck() {
  const clickhouseHealthy = await this.analyticsService.healthCheck();
  
  return {
    status: clickhouseHealthy ? 'healthy' : 'unhealthy',
    services: {
      clickhouse: clickhouseHealthy,
    },
  };
}
```

### Key Metrics to Monitor

1. **Search failure rate** > 20% (investigate search engine)
2. **Average search time** > 200ms (performance issue)
3. **Analytics ingestion lag** > 30 seconds (ClickHouse issue)
4. **Failed search volume** spikes (new product opportunities)

## 🎯 Next Steps

1. **Start the services**: `docker-compose -f docker-compose.clickhouse.yml up -d`
2. **Run the test**: `pnpm tsx scripts/test-clickhouse-analytics.ts`
3. **Integrate with your search API** using `AnalyticsSearchService`
4. **Build analytics dashboards** using the provided queries
5. **Set up monitoring** for key business metrics

## 🤝 Why This Approach?

- **Real-time insights**: Understand user behavior as it happens
- **Business intelligence**: Turn search data into revenue opportunities
- **Performance monitoring**: Ensure search experience stays fast
- **Scalable**: ClickHouse handles millions of events efficiently
- **Cost-effective**: Open source, runs on your infrastructure

Your search analytics system is now ready to provide deep insights into user behavior and business opportunities! 🚀