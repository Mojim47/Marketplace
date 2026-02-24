import { AuthModule } from '@/auth/auth.module';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';

describe('JWT Authentication (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AuthModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/auth/login (POST) - should return JWT with version', () => {
    return request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: 'admin', password: 'password' })
      .expect(200)
      .expect((res) => {
        expect(res.body.access_token).toBeDefined();
        expect(res.body.key_version).toBeDefined();
        expect(res.body.expires_in).toBe(3600);

        // Verify JWT structure
        const token = res.body.access_token;
        const [header, payload, signature] = token.split('.');
        const decodedHeader = JSON.parse(Buffer.from(header, 'base64url').toString());
        const decodedPayload = JSON.parse(Buffer.from(payload, 'base64url').toString());

        expect(decodedHeader.alg).toBe('HS256');
        expect(decodedHeader.kid).toBe(res.body.key_version.toString());
        expect(decodedPayload.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
        expect(signature).toMatch(/^[A-Za-z0-9_-]+$/);
      });
  });

  afterAll(async () => {
    await app.close();
  });
});
