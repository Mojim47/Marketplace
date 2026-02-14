/**
 * Jest Global Setup
 * NextGen Marketplace Test Suite
 */

import 'reflect-metadata';

// Extend Jest matchers
expect.extend({
  toBeWithinRange(received: number, floor: number, ceiling: number) {
    const pass = received >= floor && received <= ceiling;
    if (pass) {
      return {
        message: () => `expected ${received} not to be within range ${floor} - ${ceiling}`,
        pass: true,
      };
    }
    return {
      message: () => `expected ${received} to be within range ${floor} - ${ceiling}`,
      pass: false,
    };
  },
});

// Mock environment variables for testing
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_jwt_secret__very_long_and_secure__64chars_minimum__v1';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-minimum-32-characters';
process.env.DATABASE_URL = 'postgresql://test:test_password_123!@localhost:5432/test_db';
process.env.REDIS_URL = 'redis://localhost:6379';

// Global test timeout
jest.setTimeout(30000);

// Clean up after all tests
afterAll(async () => {
  // Allow async cleanup
  await new Promise((resolve) => setTimeout(resolve, 100));
});

// Declare custom matchers for TypeScript
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeWithinRange(floor: number, ceiling: number): R;
    }
  }
}
