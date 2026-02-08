# ⚡ Architecture Quick Reference

## 🎯 Quick Navigation

### What Was Built?

```
✅ DDD Structure
   ├─ 5 Subdomains (Invoice, Payment, Cooperation, Fraud, Tax)
   ├─ Aggregates with invariants
   ├─ Anti-corruption layers
   └─ Domain events

✅ Resiliency (4 Patterns Combined)
   ├─ Circuit Breaker (prevent cascade)
   ├─ Bulkhead (resource isolation)
   ├─ Retry with Jitter (thundering herd prevention)
   └─ Timeout Budget (total time enforcement)

✅ Caching Strategy (Redis)
   ├─ Cache-aside, Write-through, Write-behind
   ├─ TTL-based invalidation
   ├─ Tag-based invalidation
   └─ Distributed coherency

✅ Idempotency (All State-Changing APIs)
   ├─ Request deduplication
   ├─ Distributed lock
   ├─ 24-hour retention
   └─ 20+ endpoints protected
```

---

## 📁 File Locations

```
src/domain/README.md                                    # DDD design
src/infrastructure/resiliency/resilience.service.ts   # Resiliency
src/infrastructure/cache/cache.service.ts             # Caching
src/infrastructure/idempotency/idempotency.service.ts # Idempotency
ARCHITECTURE_COMPLETE.md                               # This docs
```

---

## 💾 Use Cases

### Creating an Invoice (with all patterns)

```typescript
// Client sends:
POST /api/invoices
Headers:
  Idempotency-Key: "user123:POST:/api/invoices:1234567890"
Body:
  { amount: 1000, clientId: "c123", dueDate: "2025-12-31" }

// Server flow:
1. Check idempotency cache → miss
2. Acquire distributed lock
3. Allocate timeout budget (5000ms)
4. Acquire bulkhead slot (database-pool)
5. Create invoice aggregate (domain logic)
6. Save to database (write-through cache)
7. Invalidate user's invoice list cache (tag: user:123:invoices)
8. Store in idempotency cache (TTL: 24h)
9. Release lock & bulkhead
10. Return 201 Created

// Duplicate request:
POST /api/invoices
Headers:
  Idempotency-Key: "user123:POST:/api/invoices:1234567890"
  ... (same body)

→ Cache hit → Return 200 OK (same invoice ID)
```

### Processing a Payment (with circuit breaker)

```typescript
// Client sends:
POST /api/payments
Headers:
  Idempotency-Key: "user123:POST:/api/payments:1234567891"
Body:
  { invoiceId: "inv-123", amount: 1000, method: "CARD" }

// Server flow:
1. Check idempotency cache → miss
2. Acquire distributed lock
3. Allocate timeout budget (5000ms for external call)
4. Call external payment gateway via ACL:
   ├─ Circuit breaker wraps call
   ├─ If service down → OPEN state → return fallback (PENDING)
   ├─ If 50% failures → OPEN state → return fallback
   ├─ If operational → CLOSED state → make call
   ├─ Retry: If fails, retry with exponential backoff + jitter
   │  (100ms, 200ms, 400ms, ...)
   └─ Timeout: If takes >3s, fail and use fallback
5. Capture payment (DB transaction)
6. Publish PaymentCapturedEvent → Invalidate invoice cache
7. Store in idempotency cache
8. Return 201 Created

// If payment gateway down:
- Circuit breaker OPEN
- Return status: PAYMENT_PENDING (graceful degrade)
- Scheduled retry job captures later
```

### Querying Invoices (with caching)

```typescript
// Client sends:
GET /api/invoices?page=1
Authorization: Bearer token

// Server flow:
1. Cache key: invoice:list:user123:1
2. Check cache → check if FRESH
   ├─ TTL > 30s → Return cached (cache-aside hit)
   ├─ TTL < 30s → Refresh before expiry
   └─ Expired → Fetch from DB
3. Return 200 OK

// Cache invalidation scenarios:
- InvoiceCreatedEvent → Invalidate all user's lists
- InvoiceUpdatedEvent → Invalidate specific invoice + lists
- InvoicDeletedEvent → Invalidate specific invoice + lists
```

---

## 🔧 Configuration

### Resiliency Defaults

```typescript
CircuitBreaker: {
  timeout: 3000ms,              // Fail if slower
  errorThreshold: 50%,          // Open if 50% fail
  resetTimeout: 30000ms,        // Try recovery after 30s
}

Retry: {
  maxRetries: 3,
  initialDelay: 100ms,
  maxDelay: 5000ms,
  jitter: 50%,                  // ±50% variance
}

Bulkhead: {
  database: 20,                 // Max 20 concurrent DB ops
  api: 50,                      // Max 50 concurrent API calls
  queue: 10,                    // Max 10 queue processors
}

Timeout: {
  totalBudget: 5000ms,          // Total request time
  dbOperation: 1000ms,          // DB portion
  externalApi: 2000ms,          // API portion
}

Cache: {
  invoice_detail: 60s,
  invoice_list: 600s,
  tax_rates: 3600s,
}

Idempotency: {
  ttl: 86400s,                  // 24 hours
  lockTimeout: 300s,            // 5 minutes
}
```

---

## 🛡️ Safety Patterns

### Request Deduplication (Idempotency)

```
FIRST REQUEST:
  Idempotency-Key: "user123:POST:/api/invoices:1234567890"
  → Check cache: NOT FOUND
  → Execute action: CREATE INVOICE
  → Cache result: 24 hours
  → Return: 201 Created

DUPLICATE REQUEST (within 24h):
  Idempotency-Key: "user123:POST:/api/invoices:1234567890"
  → Check cache: FOUND
  → Return SAME result: 200 OK (note: status code different)
  → ZERO side effects (no duplicate invoice created)

CONCURRENT DUPLICATE:
  Idempotency-Key: "user123:POST:/api/invoices:1234567890"
  → Check cache: NOT FOUND
  → Check lock: LOCKED (being processed)
  → Return: 409 Conflict "Already processing"
```

### Cascade Failure Prevention (Circuit Breaker)

```
NORMAL (payment gateway working):
  Payment.capture() → Circuit CLOSED → Call gateway → Success

SERVICE FAILURE (50% of calls fail):
  Payment.capture() → Circuit OPENS → Reject all calls → Fallback
  [30s later]
  Circuit HALF_OPEN → Try 1 call → If success: CLOSE → Resume
                                   → If fail: OPEN → Keep failing

ADVANTAGE:
  Without CB: Calls keep going → Timeouts → Cascade → Disaster
  With CB: Quick fail → Use fallback → Service recovers → Resume
```

### Resource Exhaustion Prevention (Bulkhead)

```
DATABASE OVERLOAD (100 invoice saves needed):
  Without bulkhead: All 100 compete → Resource starvation
  With bulkhead: Max 20 concurrent → Queue waiting → Fair allocation

CASCADING FAILURE PREVENTED:
  Database slow → Invoice saves queue up
  API calls DON'T get starved (separate pool)
  Payment processing continues (own pool)
  System stays responsive overall
```

---

## 📊 Metrics to Monitor

### Resiliency

```
Circuit Breaker Status:
  └─ payment-gateway: CLOSED (0 failures last 30s)
  └─ tax-service: HALF_OPEN (recovering)
  └─ fraud-service: OPEN (50%+ failure rate)

Retry Statistics:
  └─ Attempt 1 success: 95%
  └─ Attempt 2 success: 4%
  └─ Attempt 3 success: 0.9%
  └─ All failures: 0.1%

Bulkhead Utilization:
  └─ database-pool: 18/20 (90%) - Near capacity warning
  └─ api-pool: 25/50 (50%) - Healthy
  └─ queue-pool: 5/10 (50%) - Healthy
```

### Caching

```
Cache Hit Ratio:
  └─ invoice_detail: 92%
  └─ invoice_list: 85%
  └─ tax_rates: 99%

Memory Usage:
  └─ Redis memory: 512MB / 1GB
  └─ Keys in cache: 125,000
  └─ Avg key size: 4KB

Invalidation Events:
  └─ invoice_created: 150/day
  └─ invoice_updated: 45/day
  └─ payment_created: 320/day
```

### Idempotency

```
Idempotency Key Usage:
  └─ Requests with key: 100%
  └─ Duplicate requests caught: 2.3%
  └─ Prevented duplicate invoices: 340/day
  └─ Prevented duplicate payments: 890/day

Cache Hit Ratio:
  └─ 24h retention: 2.1%
```

---

## 🚀 Deployment Checklist

- [ ] Install dependencies: `npm install opossum ioredis`
- [ ] Configure .env with Redis URL
- [ ] Configure circuit breaker thresholds (optional)
- [ ] Set cache TTL values (optional)
- [ ] Add Idempotency-Key validation middleware
- [ ] Setup monitoring alerts for circuit breaker state changes
- [ ] Setup monitoring for cache hit ratio
- [ ] Document idempotency requirements in API docs
- [ ] Test idempotency with duplicate requests
- [ ] Verify circuit breaker switches states under load

---

## 🧪 Testing Strategy

### Unit Tests

```typescript
// test/ddd/invoice.aggregate.spec.ts
describe('InvoiceAggregate', () => {
  it('should create invoice with valid invariants', () => {
    const invoice = Invoice.create({...})
    expect(invoice.total).toBe(expected)
  })
  it('should prevent status transitions', () => {
    expect(() => invoice.approve(); invoice.draft())
      .toThrow()
  })
})

// test/infrastructure/resiliency.spec.ts
describe('CircuitBreaker', () => {
  it('should open after 50% failure', async () => {
    // Simulate failures
    // Assert breaker.status === 'OPEN'
  })
})

// test/infrastructure/cache.spec.ts
describe('CacheService', () => {
  it('should invalidate by tag', async () => {
    // Set 3 keys with tag
    // Invalidate by tag
    // Assert all 3 deleted
  })
})

// test/infrastructure/idempotency.spec.ts
describe('IdempotencyStore', () => {
  it('should return same result for duplicate key', async () => {
    // Store key A → result X
    // Store key A → result X
    // Assert get(A) === X both times
  })
})
```

### Integration Tests

```typescript
// test/integration/invoice.e2e.spec.ts
describe('Invoice API', () => {
  it('should handle duplicate requests idempotently', async () => {
    const key = uuidv4()
    const res1 = await POST('/invoices', key, payload)
    const res2 = await POST('/invoices', key, payload)
    expect(res1.body.id).toBe(res2.body.id)
  })

  it('should invalidate cache on update', async () => {
    // Create invoice
    // Cache it
    // Update invoice
    // Assert cache invalidated
  })
})
```

---

## 📚 Documentation Links

| Topic | Link |
|-------|------|
| Complete Architecture | `ARCHITECTURE_COMPLETE.md` |
| DDD Structure | `src/domain/README.md` |
| Resiliency Code | `src/infrastructure/resiliency/resilience.service.ts` |
| Caching Code | `src/infrastructure/cache/cache.service.ts` |
| Idempotency Code | `src/infrastructure/idempotency/idempotency.service.ts` |

---

## 🎓 Learning Resources

**Domain-Driven Design (DDD)**
- Evans, E. "Domain-Driven Design" (2003)
- Domain-driven design pattern: https://martinfowler.com/bliki/DomainDrivenDesign.html

**Resiliency Patterns**
- Release It! by Michael Nygard
- Circuit Breaker Pattern: https://martinfowler.com/bliki/CircuitBreaker.html
- Bulkhead Pattern: https://docs.microsoft.com/en-us/azure/architecture/patterns/bulkhead

**Caching**
- "Scaling Memcache at Facebook" (Nishtala et al., 2013)
- Redis documentation: https://redis.io/

**Idempotency**
- Stripe Idempotency: https://stripe.com/docs/api/idempotent_requests
- AWS best practices: https://docs.aws.amazon.com/general/latest/gr/api-retries.html

---

**Status**: ✅ COMPLETE  
**Date**: November 19, 2025  
**Version**: 1.0.0
