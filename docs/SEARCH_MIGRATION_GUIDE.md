# 🔄 Safe Search Migration Guide

## 🎯 Overview

This guide provides a **step-by-step process** for safely migrating from your existing search system to the new **analytics-enhanced search** without any downtime or user impact.

## 🏗️ Migration Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        Safe Migration Strategy                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐         │
│  │   API Request   │───▶│   Migration     │───▶│  Route Decision │         │
│  │                 │    │   Service       │    │                 │         │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘         │
│                                │                         │                 │
│                                ▼                         ▼                 │
│                    ┌─────────────────┐       ┌─────────────────┐           │
│                    │ Circuit Breaker │       │ Traffic Routing │           │
│                    │ Protection      │       │ (0% → 100%)     │           │
│                    └─────────────────┘       └─────────────────┘           │
│                                │                         │                 │
│                                ▼                         ▼                 │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐         │
│  │   Old Search    │    │   Fallback      │    │   New Search    │         │
│  │   Service       │◀───│   Logic         │    │   + Analytics   │         │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 🚀 Migration Steps

### Phase 1: Preparation (Day 0)

#### 1.1 Start ClickHouse Analytics
```bash
# Start analytics infrastructure
docker-compose -f docker-compose.clickhouse.yml up -d

# Verify services are running
docker-compose -f docker-compose.clickhouse.yml ps
```

#### 1.2 Update Environment Variables
```bash
# Enable analytics but keep migration at 0%
SEARCH_ANALYTICS_ENABLED=true
SEARCH_MIGRATION_PERCENTAGE=0

# Circuit breaker settings (conservative)
SEARCH_MIGRATION_MAX_FAILURES=5
SEARCH_MIGRATION_FAILURE_WINDOW=60000
SEARCH_MIGRATION_RECOVERY_TIMEOUT=30000

# Enable monitoring
SEARCH_MIGRATION_LOG_EVENTS=true
SEARCH_MIGRATION_COMPARE_RESULTS=true
```

#### 1.3 Test the Migration System
```bash
# Run comprehensive migration tests
pnpm tsx scripts/test-search-migration.ts

# Run analytics tests
pnpm tsx scripts/test-clickhouse-analytics.ts
```

#### 1.4 Update Your Search Controller

**Before (Old Code):**
```typescript
@Injectable()
export class SearchController {
  constructor(
    private readonly hybridSearchService: HybridSearchService
  ) {}

  @Get('search')
  async search(@Query() query: any) {
    return await this.hybridSearchService.search({
      query: query.q,
      categoryId: query.category,
      // ... other parameters
    });
  }
}
```

**After (Migration-Ready Code):**
```typescript
@Injectable()
export class SearchController {
  constructor(
    private readonly searchMigrationService: SearchMigrationService // 👈 Only change this line
  ) {}

  @Get('search')
  async search(@Query() query: any, @Req() req: Request) {
    return await this.searchMigrationService.search({ // 👈 Same method name
      query: query.q,
      categoryId: query.category,
      // 👇 Add analytics context (optional)
      user_id: req.user?.id,
      session_id: req.sessionID,
      ip_address: req.ip,
      user_agent: req.get('User-Agent'),
    });
  }

  // 👇 New endpoint for click tracking
  @Post('search/:eventId/click')
  async trackClick(
    @Param('eventId') eventId: string,
    @Body() body: { productId: string; position: number; timeToClick?: number }
  ) {
    return await this.searchMigrationService.trackSearchClick(
      eventId,
      body.productId,
      body.position,
      body.timeToClick
    );
  }
}
```

### Phase 2: Shadow Mode (Days 1-3)

#### 2.1 Deploy with 0% Migration
```bash
# Deploy your updated code
# Migration percentage is still 0%, so all traffic goes to old service
# But analytics infrastructure is ready

# Monitor logs for any issues
tail -f logs/application.log | grep "Migration"
```

#### 2.2 Verify Everything Works
- ✅ All searches work normally
- ✅ No performance degradation
- ✅ Analytics infrastructure is healthy
- ✅ Circuit breaker is in CLOSED state

### Phase 3: Gradual Migration (Days 4-14)

#### 3.1 Start with 5% Traffic
```bash
# Update environment variable
SEARCH_MIGRATION_PERCENTAGE=5

# Restart application
# Monitor for 24 hours
```

**Monitoring Checklist:**
- ✅ Search success rate remains >99%
- ✅ Average response time increase <50ms
- ✅ No circuit breaker activations
- ✅ Analytics data flowing to ClickHouse
- ✅ Error rates remain normal

#### 3.2 Increase to 25% Traffic
```bash
# If 5% is stable for 24 hours
SEARCH_MIGRATION_PERCENTAGE=25

# Monitor for 48 hours
```

#### 3.3 Increase to 50% Traffic
```bash
# If 25% is stable for 48 hours
SEARCH_MIGRATION_PERCENTAGE=50

# Monitor for 72 hours
```

#### 3.4 Full Migration (100%)
```bash
# If 50% is stable for 72 hours
SEARCH_MIGRATION_PERCENTAGE=100

# Monitor for 1 week
```

### Phase 4: Cleanup (Day 21+)

#### 4.1 Remove Old Service Dependencies
Once you're confident the new system is stable:

```typescript
// Remove old HybridSearchService dependency
// Keep only SearchMigrationService
```

#### 4.2 Disable Comparison Mode
```bash
# Stop comparing old vs new results
SEARCH_MIGRATION_COMPARE_RESULTS=false
```

## 🚨 Emergency Rollback Procedures

### Immediate Rollback (0% Migration)
```bash
# Set migration to 0% immediately
SEARCH_MIGRATION_PERCENTAGE=0

# Or disable analytics entirely
SEARCH_ANALYTICS_ENABLED=false

# Restart application
```

### Circuit Breaker Activation
If the circuit breaker opens:
1. **Don't panic** - traffic automatically routes to old service
2. Check ClickHouse and analytics service health
3. Fix the underlying issue
4. Reset circuit breaker: Call `/api/admin/search/reset-circuit-breaker`
5. Gradually increase traffic again

### Performance Issues
If response times increase significantly:
1. Reduce migration percentage by 50%
2. Check ClickHouse performance
3. Verify analytics batch settings
4. Consider increasing `ANALYTICS_BATCH_SIZE` and reducing `ANALYTICS_FLUSH_INTERVAL`

## 📊 Monitoring & Alerts

### Key Metrics to Monitor

#### Search Performance
```sql
-- Average search response time (should be <200ms)
SELECT 
    avg(search_time_ms) as avg_response_time,
    quantile(0.95)(search_time_ms) as p95_response_time
FROM search_events 
WHERE date = today();
```

#### Error Rates
```sql
-- Search failure rate (should be <1%)
SELECT 
    count() as total_searches,
    countIf(total_results = 0) as failed_searches,
    (failed_searches / total_searches) * 100 as failure_rate
FROM search_events 
WHERE date = today();
```

#### Circuit Breaker Status
```bash
# Check circuit breaker health
curl http://localhost:3000/api/search/health
```

### Recommended Alerts

1. **Search failure rate > 5%** → Immediate rollback
2. **Average response time > 300ms** → Investigate performance
3. **Circuit breaker OPEN** → Check analytics service
4. **ClickHouse connection failed** → Check database health

## 🔧 Configuration Reference

### Environment Variables

```bash
# Core migration settings
SEARCH_ANALYTICS_ENABLED=true          # Enable/disable analytics
SEARCH_MIGRATION_PERCENTAGE=0          # Traffic percentage (0-100)

# Circuit breaker protection
SEARCH_MIGRATION_MAX_FAILURES=5        # Max failures before opening
SEARCH_MIGRATION_FAILURE_WINDOW=60000  # Time window for failures (ms)
SEARCH_MIGRATION_RECOVERY_TIMEOUT=30000 # Recovery timeout (ms)

# Monitoring and debugging
SEARCH_MIGRATION_LOG_EVENTS=true       # Log migration events
SEARCH_MIGRATION_COMPARE_RESULTS=false # Compare old vs new results

# Analytics performance tuning
ANALYTICS_BATCH_SIZE=100               # Events per batch
ANALYTICS_FLUSH_INTERVAL=10000         # Flush interval (ms)
ANALYTICS_SEARCH_SAMPLING=1.0          # Sampling rate (0.0-1.0)
```

### Runtime Configuration Updates

```typescript
// Update migration percentage at runtime
await searchMigrationService.updateMigrationConfig({
  migrationPercentage: 25,
  logMigrationEvents: true,
});

// Reset circuit breaker
await searchMigrationService.resetCircuitBreaker();
```

## ✅ Success Criteria

### Phase Completion Criteria

**Phase 1 (Preparation):**
- ✅ All tests pass
- ✅ Analytics infrastructure healthy
- ✅ Code deployed without issues

**Phase 2 (Shadow Mode):**
- ✅ 48 hours of stable operation
- ✅ No performance degradation
- ✅ Analytics data flowing correctly

**Phase 3 (Gradual Migration):**
- ✅ Each percentage level stable for required duration
- ✅ Search success rate >99%
- ✅ Response time increase <50ms
- ✅ No circuit breaker activations

**Phase 4 (Full Migration):**
- ✅ 1 week of stable 100% migration
- ✅ Analytics providing business insights
- ✅ Click tracking working correctly

### Business Value Metrics

After successful migration, you should see:
- **Failed search insights** identifying product opportunities
- **Search performance monitoring** ensuring fast user experience
- **User behavior analytics** driving UX improvements
- **Product discovery optimization** increasing conversion rates

## 🎯 Best Practices

### Do's ✅
- **Start small** - Begin with 5% traffic
- **Monitor closely** - Watch metrics during each phase
- **Test thoroughly** - Run migration tests before each phase
- **Document issues** - Keep a log of any problems encountered
- **Communicate** - Inform team about migration progress

### Don'ts ❌
- **Don't rush** - Take time between phases
- **Don't ignore alerts** - Respond to monitoring alerts immediately
- **Don't skip testing** - Always test before increasing traffic
- **Don't disable circuit breaker** - It's your safety net
- **Don't migrate during peak hours** - Choose low-traffic periods

## 🆘 Troubleshooting

### Common Issues

#### "Circuit breaker is OPEN"
**Cause:** Too many failures in new service
**Solution:** 
1. Check ClickHouse health
2. Verify analytics service connectivity
3. Reset circuit breaker after fixing issue

#### "Analytics not tracking"
**Cause:** ClickHouse connection issues
**Solution:**
1. Check ClickHouse container status
2. Verify database credentials
3. Check network connectivity

#### "Performance degradation"
**Cause:** Analytics overhead
**Solution:**
1. Reduce sampling rate: `ANALYTICS_SEARCH_SAMPLING=0.5`
2. Increase batch size: `ANALYTICS_BATCH_SIZE=500`
3. Reduce flush frequency: `ANALYTICS_FLUSH_INTERVAL=30000`

#### "Results differ between old and new"
**Cause:** Different search algorithms or data
**Solution:**
1. Check if both services use same data source
2. Verify search parameters mapping
3. Consider acceptable differences in ranking

---

## 🎉 Conclusion

This migration strategy ensures **zero downtime** and **minimal risk** while adding powerful analytics capabilities to your search system. The gradual approach allows you to catch and fix issues before they affect all users.

**Remember:** The old system continues to work throughout the migration. The new system only enhances it with analytics - it doesn't replace the core functionality until you're 100% confident.

Your NextGen Marketplace will gain valuable insights into user behavior while maintaining the reliable search experience your users expect! 🚀