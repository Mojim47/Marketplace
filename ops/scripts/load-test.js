import { check, group, sleep } from 'k6';
import http from 'k6/http';
import { Rate } from 'k6/metrics';

/**
 * K6 Load Testing Script for NextGen API
 *
 * Run: k6 run load-test.js --vus 100 --duration 5m
 */

const errorRate = new Rate('errors');

export const options = {
  stages: [
    { duration: '30s', target: 20 }, // Ramp up
    { duration: '1m30s', target: 100 }, // Stay at high load
    { duration: '30s', target: 0 }, // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    http_req_failed: ['rate<0.1'],
    errors: ['rate<0.05'],
  },
};

const API_BASE_URL = __ENV.API_URL || 'http://localhost:3000';
const AUTH_TOKEN = __ENV.AUTH_TOKEN || 'test-token';

export default function () {
  // Test 1: Health Check
  group('Health Check', () => {
    const healthRes = http.get(`${API_BASE_URL}/api/health`);
    check(healthRes, {
      'status is 200': (r) => r.status === 200,
      'response time < 200ms': (r) => r.timings.duration < 200,
      'body has ok field': (r) => r.body.includes('ok'),
    }) || errorRate.add(1);

    sleep(0.5);
  });

  // Test 2: Create Invoice
  group('Create Invoice', () => {
    const invoicePayload = {
      customerId: `cust-${Math.random()}`,
      amount: Math.floor(Math.random() * 10000) + 1000,
      currency: 'USD',
      items: [
        {
          name: 'Product A',
          quantity: Math.floor(Math.random() * 5) + 1,
          price: Math.floor(Math.random() * 1000) + 100,
        },
      ],
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    };

    const params = {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${AUTH_TOKEN}`,
        'Idempotency-Key': `key-${Date.now()}-${Math.random()}`,
      },
    };

    const createRes = http.post(
      `${API_BASE_URL}/api/invoices/pre-invoices`,
      JSON.stringify(invoicePayload),
      params
    );

    check(createRes, {
      'status is 201 or 200': (r) => r.status === 201 || r.status === 200,
      'response time < 500ms': (r) => r.timings.duration < 500,
      'body has id': (r) => r.body.includes('id'),
    }) || errorRate.add(1);

    sleep(1);
  });

  // Test 3: Get Invoice
  group('Get Invoice', () => {
    const invoiceId = '550e8400-e29b-41d4-a716-446655440000';

    const getRes = http.get(`${API_BASE_URL}/api/invoices/${invoiceId}`, {
      headers: {
        Authorization: `Bearer ${AUTH_TOKEN}`,
      },
    });

    check(getRes, {
      'status is 200 or 404': (r) => r.status === 200 || r.status === 404,
      'response time < 200ms': (r) => r.timings.duration < 200,
    });

    sleep(0.5);
  });

  // Test 4: List Invoices
  group('List Invoices', () => {
    const listRes = http.get(
      `${API_BASE_URL}/api/invoices/customer/cust-123/list?page=1&limit=10`,
      {
        headers: {
          Authorization: `Bearer ${AUTH_TOKEN}`,
        },
      }
    );

    check(listRes, {
      'status is 200': (r) => r.status === 200,
      'response time < 300ms': (r) => r.timings.duration < 300,
      'body is array': (r) => r.body.includes('[') || r.body.includes('data'),
    }) || errorRate.add(1);

    sleep(1);
  });

  // Test 5: Metrics
  group('Metrics', () => {
    const metricsRes = http.get(`${API_BASE_URL}/api/metrics`);

    check(metricsRes, {
      'status is 200': (r) => r.status === 200,
      'has prometheus format': (r) => r.body.includes('requests_total') || r.body.includes('#'),
    });

    sleep(0.5);
  });

  // Test 6: Rate Limiting (Stress Test)
  group('Rate Limiting', () => {
    for (let i = 0; i < 120; i++) {
      const res = http.get(`${API_BASE_URL}/api/health`);

      if (res.status === 429) {
        break;
      }
    }
  });

  sleep(Math.random() * 3);
}

export function handleSummary(data) {
  return {
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
    'load-test-results.json': JSON.stringify(data),
  };
}

function textSummary(data, options) {
  const indent = options.indent || ' ';
  let summary = '\n╔════════════════════════════════════════╗\n';
  summary += '║   K6 Load Testing Summary              ║\n';
  summary += '╚════════════════════════════════════════╝\n\n';

  // Metrics
  if (data.metrics) {
    summary += 'HTTP Requests:\n';
    const httpMetrics = data.metrics.http_reqs || {};
    if (httpMetrics.value !== undefined) {
      summary += `${indent}Total: ${httpMetrics.value} requests\n`;
    }

    const httpDuration = data.metrics.http_req_duration || {};
    if (httpDuration.values) {
      summary += `${indent}Avg Duration: ${Math.round(httpDuration.values.avg || 0)}ms\n`;
      summary += `${indent}P95 Duration: ${Math.round(httpDuration.values['p(95)'] || 0)}ms\n`;
      summary += `${indent}P99 Duration: ${Math.round(httpDuration.values['p(99)'] || 0)}ms\n`;
    }

    const httpFailed = data.metrics.http_req_failed || {};
    if (httpFailed.value !== undefined) {
      summary += `${indent}Failed: ${httpFailed.value} (${((httpFailed.value / (httpMetrics.value || 1)) * 100).toFixed(2)}%)\n`;
    }

    const errors = data.metrics.errors || {};
    if (errors.value !== undefined) {
      summary += `\nErrors: ${errors.value}\n`;
    }
  }

  summary += '\n✅ Load testing complete\n';
  return summary;
}
