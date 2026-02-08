import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';
import { randomString } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

/**
 * NextGen Marketplace - Stress Test Script (Ruthless Mode)
 *
 * Test scenarios:
 * - 500 concurrent users
 * - Simultaneous product listing requests
 * - Simultaneous authentication attempts
 * - Identifies breaking point (max RPS before errors)
 *
 * Usage:
 *   k6 run stress-test.js --out json=stress-test-results.json
 */

// Custom Metrics
const errorRate = new Rate('errors');
const loginRate = new Rate('login_success');
const productFetchRate = new Rate('product_fetch_success');
const apiLatency = new Trend('api_latency_ms');
const reqCounter = new Counter('total_requests');

// Test Configuration
export const options = {
  scenarios: {
    // Scenario 1: Gradual Ramp-up to 500 users
    stress_test: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 50 }, // Warm-up: 50 users
        { duration: '2m', target: 200 }, // Ramp to 200 users
        { duration: '2m', target: 500 }, // Stress: 500 concurrent users
        { duration: '3m', target: 500 }, // Hold at peak load
        { duration: '1m', target: 0 }, // Graceful shutdown
      ],
      gracefulRampDown: '30s',
    },
    // Scenario 2: Spike Test (sudden traffic burst)
    spike_test: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '10s', target: 300 }, // Immediate spike
        { duration: '1m', target: 300 }, // Hold spike
        { duration: '10s', target: 0 }, // Drop
      ],
      startTime: '5m', // Start after stress test
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<2000', 'p(99)<5000'], // 95% under 2s, 99% under 5s
    http_req_failed: ['rate<0.05'], // Error rate below 5%
    errors: ['rate<0.1'], // Custom error rate below 10%
    login_success: ['rate>0.8'], // 80% login success
    product_fetch_success: ['rate>0.9'], // 90% product fetch success
    http_reqs: ['rate>50'], // At least 50 RPS
  },
};

// Environment Variables
const API_BASE_URL = __ENV.API_URL || 'http://localhost:3000';
const WEB_BASE_URL = __ENV.WEB_URL || 'http://localhost:3001';

// Test Data
const TEST_USERS = generateTestUsers(100);
const PRODUCT_IDS = Array.from({ length: 50 }, (_, i) => `product-${i + 1}`);

function generateTestUsers(count) {
  return Array.from({ length: count }, (_, i) => ({
    phone: `09${String(Math.floor(Math.random() * 1000000000)).padStart(9, '0')}`,
    password: 'Test@123456',
    email: `user${i}@test.com`,
  }));
}

export function setup() {
  console.log('🚀 Starting Stress Test...');
  console.log(`Target: ${API_BASE_URL}`);
  console.log('Peak Load: 500 concurrent users');

  // Verify API is up
  const healthCheck = http.get(`${API_BASE_URL}/health`);
  if (healthCheck.status !== 200) {
    console.error('❌ API is not healthy. Aborting test.');
    return { skipTest: true };
  }

  console.log('✅ API is healthy. Proceeding...\n');
  return { skipTest: false };
}

export default function (data) {
  if (data.skipTest) return;

  reqCounter.add(1);

  // Randomly select test user
  const user = TEST_USERS[Math.floor(Math.random() * TEST_USERS.length)];

  // === Test 1: API Health Check ===
  group('Health Check', () => {
    const res = http.get(`${API_BASE_URL}/health`, {
      tags: { name: 'HealthCheck' },
    });

    apiLatency.add(res.timings.duration);

    const success = check(res, {
      'health status is 200': (r) => r.status === 200,
      'health response time < 100ms': (r) => r.timings.duration < 100,
    });

    if (!success) errorRate.add(1);
  });

  sleep(0.5);

  // === Test 2: User Login (Authentication) ===
  group('User Authentication', () => {
    const loginPayload = JSON.stringify({
      phone: user.phone,
      password: user.password,
    });

    const params = {
      headers: { 'Content-Type': 'application/json' },
      tags: { name: 'Login' },
    };

    const res = http.post(`${API_BASE_URL}/api/auth/login`, loginPayload, params);
    apiLatency.add(res.timings.duration);

    const success = check(res, {
      'login status is 200 or 201': (r) => [200, 201].includes(r.status),
      'login response contains token': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.token || body.access_token || body.accessToken;
        } catch {
          return false;
        }
      },
      'login response time < 1s': (r) => r.timings.duration < 1000,
    });

    if (success) {
      loginRate.add(1);
    } else {
      loginRate.add(0);
      errorRate.add(1);
    }
  });

  sleep(1);

  // === Test 3: Fetch Product List (High Load Endpoint) ===
  group('Product Listing', () => {
    const res = http.get(`${API_BASE_URL}/api/products?page=1&limit=20`, {
      tags: { name: 'ProductList' },
    });

    apiLatency.add(res.timings.duration);

    const success = check(res, {
      'products status is 200': (r) => r.status === 200,
      'products response is JSON': (r) => {
        try {
          JSON.parse(r.body);
          return true;
        } catch {
          return false;
        }
      },
      'products response time < 500ms': (r) => r.timings.duration < 500,
    });

    if (success) {
      productFetchRate.add(1);
    } else {
      productFetchRate.add(0);
      errorRate.add(1);
    }
  });

  sleep(0.5);

  // === Test 4: Fetch Single Product Detail ===
  group('Product Detail', () => {
    const productId = PRODUCT_IDS[Math.floor(Math.random() * PRODUCT_IDS.length)];
    const res = http.get(`${API_BASE_URL}/api/products/${productId}`, {
      tags: { name: 'ProductDetail' },
    });

    apiLatency.add(res.timings.duration);

    check(res, {
      'product detail status is 200 or 404': (r) => [200, 404].includes(r.status),
      'product detail response time < 300ms': (r) => r.timings.duration < 300,
    });
  });

  sleep(1);

  // === Test 5: Search (MeiliSearch Load) ===
  group('Product Search', () => {
    const searchQuery = ['لپ', 'موبایل', 'کتاب', 'لباس'][Math.floor(Math.random() * 4)];
    const res = http.get(`${API_BASE_URL}/api/search?q=${searchQuery}`, {
      tags: { name: 'Search' },
    });

    apiLatency.add(res.timings.duration);

    check(res, {
      'search status is 200': (r) => r.status === 200,
      'search response time < 200ms': (r) => r.timings.duration < 200,
    });
  });

  sleep(1);

  // === Test 6: Add to Cart (Write Operation) ===
  group('Add to Cart', () => {
    const cartPayload = JSON.stringify({
      productId: PRODUCT_IDS[0],
      quantity: Math.floor(Math.random() * 5) + 1,
    });

    const params = {
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer fake-token-for-load-test',
      },
      tags: { name: 'AddToCart' },
    };

    const res = http.post(`${API_BASE_URL}/api/cart/add`, cartPayload, params);
    apiLatency.add(res.timings.duration);

    check(res, {
      'add to cart response time < 500ms': (r) => r.timings.duration < 500,
    });
  });

  sleep(2);
}

export function teardown(data) {
  console.log('\n📊 ===== STRESS TEST RESULTS =====');
  console.log('Total Duration: 9+ minutes');
  console.log('Peak Concurrent Users: 500');
  console.log('\n🎯 Breaking Point Analysis:');
  console.log('- Check "http_req_failed" rate to identify error threshold');
  console.log('- Check "http_req_duration" p(95) and p(99) for latency degradation');
  console.log('- Check "http_reqs" rate to determine max RPS');
  console.log('\n📈 Recommended Actions:');
  console.log('- If error rate > 5%: Scale up API instances or optimize database queries');
  console.log('- If p(95) > 2s: Enable caching (Redis) or use CDN');
  console.log('- If RPS < 50: Check database connection pool, network latency');
  console.log('\n💾 Export results: stress-test-results.json');
}

export function handleSummary(data) {
  const totalRequests = data.metrics.total_requests?.values?.count || 0;
  const errorRateValue = data.metrics.errors?.values?.rate || 0;
  const p95Latency = data.metrics.http_req_duration?.values?.['p(95)'] || 0;
  const avgRPS = data.metrics.http_reqs?.values?.rate || 0;

  return {
    stdout: `
╔════════════════════════════════════════════════════════════════╗
║           NEXTGEN MARKETPLACE - STRESS TEST SUMMARY           ║
╚════════════════════════════════════════════════════════════════╝

📊 LOAD PROFILE:
   Peak Concurrent Users: 500
   Total Requests: ${totalRequests.toFixed(0)}
   Average RPS: ${avgRPS.toFixed(2)}

⏱ LATENCY:
   p(95): ${p95Latency.toFixed(2)} ms
   p(99): ${(data.metrics.http_req_duration?.values?.['p(99)'] || 0).toFixed(2)} ms

❌ ERROR RATE:
   Overall Error Rate: ${(errorRateValue * 100).toFixed(2)}%
   HTTP Failures: ${(data.metrics.http_req_failed?.values?.rate * 100 || 0).toFixed(2)}%

🎯 BREAKING POINT:
   ${avgRPS > 100 ? '✅ System handles 100+ RPS' : '⚠ System max RPS: ' + avgRPS.toFixed(2)}
   ${errorRateValue < 0.05 ? '✅ Error rate below 5%' : '❌ Error rate above threshold'}
   ${p95Latency < 2000 ? '✅ p(95) latency acceptable' : '❌ p(95) latency above 2s'}

📁 Detailed JSON: stress-test-results.json
`,
    'stress-test-results.json': JSON.stringify(data, null, 2),
    'stress-test-summary.html': generateHTMLReport(data),
  };
}

function generateHTMLReport(data) {
  return `
<!DOCTYPE html>
<html dir="rtl" lang="fa">
<head>
  <meta charset="UTF-8">
  <title>گزارش تست فشار NextGen Market</title>
  <style>
    body { font-family: Tahoma, Arial, sans-serif; background: #f5f5f5; padding: 20px; }
    .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; }
    h1 { color: #2c3e50; border-bottom: 3px solid #3498db; padding-bottom: 10px; }
    .metric { background: #ecf0f1; padding: 15px; margin: 10px 0; border-radius: 5px; }
    .metric strong { color: #e74c3c; }
    .success { color: #27ae60; }
    .warning { color: #f39c12; }
    .error { color: #e74c3c; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🚀 گزارش تست فشار - NextGen Marketplace</h1>
    <div class="metric">
      <strong>تعداد کل درخواست‌ها:</strong> ${data.metrics.total_requests?.values?.count || 0}
    </div>
    <div class="metric">
      <strong>میانگین RPS:</strong> ${(data.metrics.http_reqs?.values?.rate || 0).toFixed(2)}
    </div>
    <div class="metric">
      <strong>میانه تاخیر (p95):</strong> ${(data.metrics.http_req_duration?.values?.['p(95)'] || 0).toFixed(2)} ms
    </div>
    <div class="metric">
      <strong>نرخ خطا:</strong> <span class="${(data.metrics.errors?.values?.rate || 0) < 0.05 ? 'success' : 'error'}">
        ${((data.metrics.errors?.values?.rate || 0) * 100).toFixed(2)}%
      </span>
    </div>
    <h2>توصیه‌های بهینه‌سازی</h2>
    <ul>
      <li>در صورت نرخ خطای بیش از ۵٪: افزایش تعداد نمونه‌های API یا بهینه‌سازی کوئری‌های دیتابیس</li>
      <li>در صورت تاخیر بیش از ۲ ثانیه: فعال‌سازی Redis Cache و CDN</li>
      <li>در صورت RPS کمتر از ۵۰: بررسی connection pool و شبکه</li>
    </ul>
  </div>
</body>
</html>
`;
}
