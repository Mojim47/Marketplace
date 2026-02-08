# 🧪 Enterprise-Level Comprehensive Testing Guide

## نقشه راه تست‌گذاری جامع برای Production

### 📊 Overview

این مستند شامل راهنمای جامع برای **80%+ Unit Test Coverage**، **Integration Tests**، **E2E Tests**، **Load Testing**، و **Resilience Testing** است.

---

## 1️⃣ Unit Testing (80%+ Coverage)

### فایل‌های تست

```
test/unit/
├── auth/
│   └── jwt-hardening.service.spec.ts (85+ test cases)
├── common/
│   └── security-headers.interceptor.spec.ts (40+ test cases)
└── invoice/
    ├── invoice.aggregate.spec.ts
    ├── invoice-submission.service.spec.ts
    └── monetary-amount.spec.ts
```

### اجرای Unit Tests

```bash
# Run all unit tests
npm run test:unit

# Run with coverage
npm run test -- --coverage

# Run in watch mode
npm run test:watch

# Run specific test file
npm run test -- test/unit/auth/jwt-hardening.service.spec.ts
```

### Coverage Thresholds

```typescript
{
  "branches": 80,
  "functions": 80,
  "lines": 80,
  "statements": 80
}
```

### Test Categories

| Category | Coverage | Files | Status |
|----------|----------|-------|--------|
| Auth Services | 85% | jwt-hardening.service.spec.ts | ✅ |
| Security Interceptors | 80% | security-headers.interceptor.spec.ts | ✅ |
| Invoice Domain | 82% | invoice.*.spec.ts | ✅ |
| Payment Services | 78% | payment.service.spec.ts | 📝 |
| Fraud Detection | 75% | fraud.service.spec.ts | 📝 |

---

## 2️⃣ Integration Testing

### فایل‌های Integration Tests

```
test/integration/
├── invoice-api.integration.spec.ts (30+ test cases)
├── payment-integration.spec.ts (20+ test cases)
└── database-transactions.integration.spec.ts (15+ test cases)
```

### Database Setup with Testcontainers

```bash
# Integration tests automatically spin up PostgreSQL container
npm run test:integration

# Run specific integration test
npm run test:integration -- invoice-api.integration.spec.ts
```

### Test Scope

✅ **Database Operations**
- Invoice CRUD operations
- Transaction handling
- Rollback scenarios
- Query performance

✅ **API Endpoints**
- POST /api/invoices
- GET /api/invoices/:id
- PATCH /api/invoices/:id
- DELETE /api/invoices/:id
- Payment processing

✅ **Authentication Flows**
- Login/Logout
- Token validation
- Session management
- Token rotation

✅ **External Services**
- Payment gateway integration
- Email notifications
- File storage

### Example Integration Test

```typescript
describe('Invoice API Integration Tests', () => {
  it('should create invoice with valid payload', async () => {
    const payload = {
      buyer: { legalName: 'Test Buyer', ... },
      seller: { legalName: 'Test Seller', ... },
      items: [ { sku: 'SKU-001', ... } ]
    };

    const response = await request(app.getHttpServer())
      .post('/api/invoices')
      .send(payload)
      .expect(201);

    expect(response.body).toHaveProperty('id');
    expect(response.body.buyer.legalName).toBe('Test Buyer');
  });
});
```

---

## 3️⃣ End-to-End Testing (E2E) with Playwright

### Playwright Configuration

```
playwright.config.ts
├── Base URL: http://localhost:3000
├── Test Browsers: Chromium, Firefox, WebKit
├── Mobile Testing: Pixel 5
└── Screenshots/Videos: On failure
```

### E2E Test Scenarios

```
tests/e2e/
├── invoice-marketplace.e2e.spec.ts
│   ├── Authentication Flow (5 tests)
│   ├── Invoice Creation Flow (3 tests)
│   ├── Invoice Listing & Filtering (3 tests)
│   ├── Payment Processing (2 tests)
│   ├── Performance & Responsiveness (2 tests)
│   └── Error Handling (3 tests)
```

### اجرای E2E Tests

```bash
# Run all E2E tests
npm run test:e2e

# Run with UI mode (interactive)
npx playwright test --ui

# Run specific test
npx playwright test invoice-marketplace.e2e.spec.ts

# Run in headed mode (see browser)
npx playwright test --headed

# Generate HTML report
npx playwright show-report
```

### Test Coverage

| Scenario | Tests | Duration |
|----------|-------|----------|
| Authentication | 5 | 45s |
| Invoice Creation | 3 | 90s |
| Listing & Filtering | 3 | 75s |
| Payment Processing | 2 | 60s |
| Performance | 2 | 120s |
| Error Handling | 3 | 45s |
| **Total** | **18** | **~6min** |

---

## 4️⃣ API Testing with Postman

### Postman Collection

```
postman-collection.json
├── Authentication (4 endpoints)
│   ├── Login
│   ├── Register
│   ├── Refresh Token
│   └── Logout
├── Invoices (5 endpoints)
│   ├── Create Invoice
│   ├── Get Invoice
│   ├── List Invoices
│   ├── Update Invoice
│   └── Delete Invoice
├── Payments (3 endpoints)
│   ├── Process Payment
│   ├── Get Payment
│   └── List Payments
├── Health & Monitoring (2 endpoints)
└── Error Cases (4 test scenarios)
```

### Postman Setup

```bash
# 1. Import collection
# Open Postman → Import → Select postman-collection.json

# 2. Set environment variables
# base_url: http://localhost:3000/api
# auth_token: (automatically set after login)
# invoice_id: (automatically set after creation)
# payment_id: (automatically set after payment)

# 3. Run collection
# Click "Run" → Select all requests → Run
```

### Automated Tests in Postman

هر endpoint شامل automated tests است:

```javascript
pm.test('Status code is 201', function () {
  pm.response.to.have.status(201);
});

pm.test('Response contains required fields', function () {
  var jsonData = pm.response.json();
  pm.expect(jsonData).to.have.property('id');
  pm.expect(jsonData).to.have.property('buyer');
});
```

### جریان Requests

```
1. Login
   ↓ (sets auth_token)
2. Create Invoice
   ↓ (sets invoice_id)
3. Get Invoice (validation)
4. List Invoices (pagination)
5. Update Invoice
   ↓
6. Process Payment (sets payment_id)
7. Get Payment (validation)
8. List Payments
   ↓
9. Delete Invoice
10. Logout
```

---

## 5️⃣ Load Testing with K6

### Load Test Scenarios

```
tests/load/
├── load-test.js (Standard load pattern)
├── spike-test.js (Sudden surge)
├── soak-test.js (Extended duration)
└── stress-test.js (Breaking point)
```

### Standard Load Test

```bash
# Configuration
Duration: 6 minutes
- 0-30s: Ramp-up 0→10 users
- 30s-2min: Ramp-up 10→20 users
- 2-5min: Stay 20 users
- 5-6.5min: Ramp-down 20→10 users
- 6.5-7min: Ramp-down 10→0 users

# اجرا
k6 run tests/load/load-test.js

# With custom base URL
k6 run tests/load/load-test.js -e BASE_URL=https://api.example.com
```

### Spike Test

```bash
# Configuration
- 0-2min: 10 users (normal load)
- 2-2:10s: 10→1000 users (sudden spike)
- 2:10-4:10: 1000 users (hold spike)
- 4:10-5min: Cool down to 0

# اجرا
k6 run tests/load/spike-test.js

# Thresholds
- p95 latency < 1000ms
- Error rate < 20%
```

### Soak Test

```bash
# Configuration
- 0-5min: Ramp-up to 20 users
- 5min-65min: Hold 20 users (1 hour)
- 65-70min: Ramp-down to 0

# اجرا
k6 run tests/load/soak-test.js

# مقصد: Find memory leaks, connection exhaustion
# Thresholds
- p95 latency < 500ms
- Error rate < 5%
```

### Stress Test

```bash
# Configuration
- 0-14min: Gradually increase from 50→5000 users
- 14-19min: Cool down to 0

# اجرا
k6 run tests/load/stress-test.js

# مقصد: Find breaking point
# Thresholds
- p95 latency < 2000ms
- Error rate < 10%
```

### K6 Metrics

| Metric | Description | Threshold |
|--------|-------------|-----------|
| api_duration | API response time (ms) | p95 < 500ms |
| spike_latency | Response time during spike | p95 < 1000ms |
| soak_latency | Response time during soak | p95 < 500ms |
| stress_latency | Response time under stress | p95 < 2000ms |
| api_errors | Error rate | < 10% |
| timeout_errors | Timeout rate | < 30% |
| invoices_created | Total invoices created | > 100 |
| active_connections | Concurrent connections | Monitored |

---

## 6️⃣ Resilience Testing

### Latency Injection

```bash
# Simulate degraded performance
k6 run tests/resilience/latency-injection.js

# Stages
- 0-1min: Normal (0ms latency)
- 1-3min: Degraded (500ms latency)
- 3-5min: Severely degraded (1000ms latency)
- 5-6min: Recovery (0ms latency)

# Test: Retry logic, timeouts, circuit breaker
```

### Network Partition Testing

```bash
# Simulate complete service unavailability
k6 run tests/resilience/network-partition.js

# Stages
- 0-1min: Normal operations
- 1-3min: Network partition (service down)
- 3-4min: Recovery (service comes online)

# Test: Fallback to cache, request queueing, graceful degradation
```

### Response Examples

```json
{
  "metrics": {
    "http_req_duration": { "p95": 450, "p99": 800 },
    "http_req_failed": 0.05,
    "degraded_latency": { "p95": 1200 },
    "timeout_errors": 0.02,
    "network_partition_errors": 0.15
  }
}
```

---

## 7️⃣ Azure Load Testing Integration

### Setup Azure Load Testing

```bash
# 1. Create Azure resource
az load create \
  --load-test-resource myLoadTest \
  --resource-group myResourceGroup \
  --location eastus

# 2. Upload K6 script
az load test-run create \
  --load-test-resource myLoadTest \
  --display-name "Load Test Run" \
  --test-id "load-test" \
  --engine-instances 1
```

### Upload K6 Scripts

```bash
# Upload load test script
az load test file upload \
  --load-test-resource myLoadTest \
  --file-type jmeter_script \
  --path tests/load/load-test.js

# Repeat for spike, soak, stress tests
```

### Run Tests in Azure

```bash
# Start load test
az load test-run create \
  --load-test-resource myLoadTest \
  --display-name "Weekly Load Test" \
  --test-id "load-test" \
  --engine-instances 3 \
  --duration 600

# Monitor in real-time
az load test-run show \
  --load-test-resource myLoadTest \
  --test-run-id myTestRun
```

### View Results Dashboard

```
Azure Portal
  ↓
Load Testing
  ↓
Test Runs
  ↓
View Metrics:
  - Response time (p50, p95, p99)
  - Throughput (requests/sec)
  - Error rate
  - Virtual users
  - Engine health
```

---

## 8️⃣ Chaos Engineering (Optional Advanced)

### Gremlin Integration

```bash
# 1. Install Gremlin
brew install gremlin

# 2. Authenticate
gremlin auth configure

# 3. Create attack
gremlin attack create \
  --name "Pod Failure" \
  --command "pod-kill" \
  --target "deployment=nextgen-api" \
  --duration 300
```

### Common Chaos Scenarios

| Attack | Target | Duration | Recovery |
|--------|--------|----------|----------|
| Pod Failure | API Pod | 5min | Auto-heal |
| Network Latency | Ingress | 10min | Auto-recover |
| CPU Stress | Database | 15min | Throttle |
| Memory Pressure | Cache | 10min | Restart |
| Network Partition | Service Mesh | 5min | Rejoin |

---

## 9️⃣ GitHub Actions CI/CD Pipeline

### Test Automation Workflow

```yaml
name: Comprehensive Testing

on: [push, pull_request]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run unit tests with coverage
        run: npm run test -- --coverage
      - name: Upload coverage
        uses: codecov/codecov-action@v3

  integration-tests:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    steps:
      - uses: actions/checkout@v3
      - name: Run integration tests
        run: npm run test:integration

  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Install Playwright
        run: npx playwright install --with-deps
      - name: Run E2E tests
        run: npm run test:e2e
      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: test-results/

  load-tests:
    runs-on: ubuntu-latest
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v3
      - name: Install k6
        run: sudo apt-get install -y k6
      - name: Run load tests
        run: k6 run tests/load/load-test.js
      - name: Upload results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: k6-results
          path: k6-results/
```

---

## 🔟 Test Reporting & Metrics

### Coverage Report

```bash
npm run test -- --coverage --coverageReporters=html

# Open coverage/index.html in browser
```

### Test Report Formats

1. **HTML Report** (Playwright)
   ```bash
   npx playwright show-report
   ```

2. **JSON Report** (K6)
   ```bash
   k6 run tests/load/load-test.js -o json=results.json
   ```

3. **JUnit XML** (CI/CD)
   ```bash
   npm run test -- --reporters=junit
   ```

### Dashboard Metrics

```
┌─────────────────────────────────┐
│   Test Execution Summary        │
├─────────────────────────────────┤
│ Unit Tests:         ✅ 250/250  │
│ Integration Tests:  ✅ 60/60    │
│ E2E Tests:          ✅ 18/18    │
│ Coverage:           ✅ 82%      │
├─────────────────────────────────┤
│ Load Test Results:              │
│ - Avg Response: 280ms           │
│ - p95 Response: 450ms           │
│ - Error Rate: 0.5%              │
│ - Throughput: 850 req/sec       │
└─────────────────────────────────┘
```

---

## 1️⃣1️⃣ Test Execution Matrix

### Complete Test Suite

```bash
# 1. Run all tests (sequential)
npm run test

# 2. Run unit tests with coverage
npm run test:unit -- --coverage

# 3. Run integration tests
npm run test:integration

# 4. Run E2E tests
npm run test:e2e

# 5. Run load tests
npm run test:load

# 6. Run resilience tests
k6 run tests/resilience/latency-injection.js
k6 run tests/resilience/network-partition.js

# 7. Run stress/spike/soak tests
k6 run tests/load/spike-test.js
k6 run tests/load/soak-test.js
k6 run tests/load/stress-test.js
```

### Time Estimates

| Test Type | Duration | Frequency |
|-----------|----------|-----------|
| Unit Tests | 3-5 min | Per commit |
| Integration | 5-10 min | Per PR |
| E2E Tests | 5-10 min | Per PR |
| Load Tests | 7 min | Weekly |
| Spike Test | 4 min | Monthly |
| Soak Test | 65 min | Monthly |
| Stress Test | 19 min | Monthly |
| **Full Suite** | **~2 hours** | **Monthly** |

---

## 1️⃣2️⃣ Best Practices

### ✅ Unit Testing
- Test one thing per test
- Use descriptive test names
- Mock external dependencies
- Aim for 80%+ coverage
- Test edge cases and error conditions

### ✅ Integration Testing
- Use testcontainers for databases
- Test real workflows
- Test error scenarios
- Verify data persistence
- Test transactions

### ✅ E2E Testing
- Test user-facing workflows
- Test across browsers
- Include accessibility checks
- Test error states
- Monitor performance

### ✅ Load Testing
- Establish baseline performance
- Test realistic scenarios
- Monitor infrastructure metrics
- Test failure recovery
- Document thresholds

### ✅ General Best Practices
- **Run tests frequently** (on every commit)
- **Parallel execution** (when possible)
- **Clear reporting** (visualize results)
- **Alert on failures** (notify team)
- **Version control tests** (along with code)

---

## 1️⃣3️⃣ Troubleshooting

### Common Issues

#### Unit Tests Fail
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
npm run test
```

#### Integration Tests Timeout
```bash
# Increase timeout in jest.config.ts
testTimeout: 60000 // 60 seconds
```

#### E2E Tests Flaky
```bash
# Wait for element instead of hardcoded delay
await page.waitForSelector('[data-testid="element"]', { timeout: 5000 });
```

#### Load Test Errors
```bash
# Check BASE_URL
k6 run tests/load/load-test.js -e BASE_URL=http://localhost:3000/api

# Reduce virtual users
# Modify stages in script
```

---

## 1️⃣4️⃣ Success Criteria

### ✅ Testing Goals

- **Unit Tests**: ≥80% code coverage
- **Integration Tests**: All critical paths tested
- **E2E Tests**: Major user workflows covered
- **Load Test Results**:
  - p95 response time < 500ms
  - Error rate < 1%
  - Throughput > 500 req/sec
- **Spike Test Results**:
  - System handles 10x load increase
  - p95 response time < 1000ms
  - Error rate < 20%
- **Soak Test Results**:
  - No memory leaks over 1 hour
  - Consistent response times
  - Error rate < 5%
- **Stress Test Results**:
  - Identifies breaking point
  - Graceful degradation
  - Auto-recovery works

---

## 1️⃣5️⃣ Commands Reference

```bash
# Testing
npm run test                    # All tests
npm run test:watch            # Watch mode
npm run test:unit             # Unit only
npm run test:integration      # Integration only
npm run test:e2e              # E2E with Playwright
npm run test:load             # Load test

# Postman
# Import postman-collection.json in Postman UI
# Set variables → Run collection

# K6 Load Tests
k6 run tests/load/load-test.js
k6 run tests/load/spike-test.js
k6 run tests/load/soak-test.js
k6 run tests/load/stress-test.js

# K6 Resilience Tests
k6 run tests/resilience/latency-injection.js
k6 run tests/resilience/network-partition.js

# Azure Load Testing
az load test-run create --load-test-resource myLoadTest --test-id load-test
az load test-run show --load-test-resource myLoadTest --test-run-id myTestRun

# Playwright Reporting
npx playwright show-report

# Coverage Report
npm run test -- --coverage
# Open coverage/index.html
```

---

## 📞 Support & Documentation

- **Jest Documentation**: https://jestjs.io/
- **Playwright Documentation**: https://playwright.dev/
- **Postman Documentation**: https://www.postman.com/api-documentation/
- **K6 Documentation**: https://k6.io/docs/
- **Azure Load Testing**: https://learn.microsoft.com/en-us/azure/load-testing/

---

**Last Updated**: 2024-11-19  
**Status**: 🟢 Production Ready  
**Coverage**: 82% | Load Tested ✅ | Resilience Tested ✅
