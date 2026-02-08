import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');
const bypassRate = new Rate('rate_limit_bypass');

export const options = {
  stages: [
    { duration: '30s', target: 20 }, // Ramp up
    { duration: '60s', target: 50 }, // Stay at 50 users
    { duration: '30s', target: 0 }, // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],
    errors: ['rate<0.1'],
    rate_limit_bypass: ['rate<0.01'], // <1% bypass rate
  },
};

export default function () {
  const baseUrl = __ENV.BASE_URL || 'http://localhost:3000';

  // Test IP-based rate limiting (5 req/min)
  for (let i = 0; i < 7; i++) {
    const response = http.post(
      `${baseUrl}/auth/login`,
      {
        username: 'admin',
        password: 'password',
      },
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );

    const isRateLimited = response.status === 429;
    const shouldBeRateLimited = i >= 5;

    // Check for bypass (should get 429 after 5 requests)
    if (shouldBeRateLimited && !isRateLimited) {
      bypassRate.add(1);
      console.log(
        `BYPASS DETECTED: Request ${i + 1} should be rate limited but got ${response.status}`
      );
    } else {
      bypassRate.add(0);
    }

    check(response, {
      'status is 200 or 429': (r) => r.status === 200 || r.status === 429,
      'rate limit headers present': (r) => r.headers['X-RateLimit-Limit'] !== undefined,
    });

    errorRate.add(response.status >= 400 && response.status !== 429);

    if (response.status === 429) {
      console.log(`Rate limited at request ${i + 1}: ${response.body}`);
      break;
    }

    sleep(1);
  }

  // Test user-based rate limiting (10 req/min)
  const token = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'; // Mock token

  for (let i = 0; i < 12; i++) {
    const response = http.post(
      `${baseUrl}/auth/login`,
      {
        username: 'user123',
        password: 'password',
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: token,
        },
      }
    );

    const isRateLimited = response.status === 429;
    const shouldBeRateLimited = i >= 10;

    if (shouldBeRateLimited && !isRateLimited) {
      bypassRate.add(1);
    } else {
      bypassRate.add(0);
    }

    if (response.status === 429) {
      console.log(`User rate limited at request ${i + 1}`);
      break;
    }

    sleep(0.5);
  }

  sleep(Math.random() * 2);
}
