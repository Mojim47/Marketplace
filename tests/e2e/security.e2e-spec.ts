import type { INestApplication } from '@nestjs/common';
/**
 * Security E2E Tests
 * Focus: Verifying security features like rate limiting.
 */
import { Test, type TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Security (E2E)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Rate Limiting (Throttler)', () => {
    it('should block requests after exceeding the limit', async () => {
      // The global limit is 10 requests per minute.
      // We will send 11 requests to a simple endpoint.
      const agent = request(app.getHttpServer());
      const endpoint = '/health'; // Use the health-check endpoint as a reliable target

      // Send 10 successful requests
      for (let i = 0; i < 10; i++) {
        await agent.get(endpoint).expect((res) => {
          if (res.status === 429) {
            throw new Error(`Request ${i + 1} was unexpectedly throttled.`);
          }
          // The health check might return 503 if DB is not connected, which is fine for this test.
          // We only care that it's not 429.
          expect(res.status).not.toBe(429);
        });
      }

      // The 11th request should be blocked
      const response = await agent.get(endpoint);
      expect(response.status).toBe(429);
      expect(response.body.message).toContain('Too Many Requests');
    }, 15000); // Increase timeout for this test
  });

  describe('Security Headers (Helmet)', () => {
    it('should include important security headers', async () => {
      const response = await request(app.getHttpServer()).get('/health');

      expect(response.headers['x-dns-prefetch-control']).toBe('off');
      expect(response.headers['x-frame-options']).toBe('SAMEORIGIN');
      expect(response.headers['strict-transport-security']).toBeDefined();
      expect(response.headers['x-download-options']).toBe('noopen');
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-xss-protection']).toBe('0'); // Modern browsers recommend disabling this in favor of strong CSP
      expect(response.headers['cross-origin-embedder-policy']).toBe('require-corp');
    });
  });
});
