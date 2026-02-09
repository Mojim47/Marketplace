import 'reflect-metadata';
import { vi } from 'vitest';

// Mock environment variables
process.env.REDIS_HOST = 'localhost';
process.env.REDIS_PORT = '6379';
process.env.NODE_ENV = 'test';

// Global test setup
beforeEach(() => {
  vi.clearAllMocks();
});
