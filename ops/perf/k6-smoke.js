import { check, sleep } from 'k6';
import http from 'k6/http';

export const options = {
  vus: 3,
  duration: '30s',
  thresholds: {
    http_req_duration: ['p(95)<400'],
    checks: ['rate>0.99'],
  },
};

const BASE = __ENV.BASE_URL || 'http://localhost:3000';

export default function () {
  const health = http.get(`${BASE}/api/health`);
  check(health, { 'health 200': (r) => r.status === 200 });
  const home = http.get(`${BASE}/`);
  check(home, { 'home 200': (r) => r.status === 200 });
  sleep(1);
}
