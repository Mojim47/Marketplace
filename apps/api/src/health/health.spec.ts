import type { Response } from 'express';
import * as fc from 'fast-check';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DatabaseHealthChecker,
  type DependencyHealth,
  HealthController,
  HealthStatus,
  RedisHealthChecker,
  StorageHealthChecker,
  type SystemMetrics,
  __testing,
} from './health.controller';

const { getSystemMetrics, determineOverallStatus, checkWithTimeout, DEFAULT_CONFIG } = __testing;

// Mock PrismaService
const mockPrismaService = {
  $queryRaw: vi.fn(),
};

// Mock Redis client
const mockRedisClient = {
  ping: vi.fn(),
};

describe('Health Check', () => {
  describe('Property 16: Health Check Dependency Reporting', () => {
    // Arbitrary for dependency health status
    const healthStatusArb = fc.constantFrom(
      HealthStatus.HEALTHY,
      HealthStatus.DEGRADED,
      HealthStatus.UNHEALTHY
    );

    // Arbitrary for dependency health
    const dependencyHealthArb = fc.record({
      name: fc.constantFrom('database', 'redis', 'cache', 'queue'),
      status: healthStatusArb,
      responseTimeMs: fc.option(fc.integer({ min: 1, max: 5000 })),
      message: fc.option(fc.string({ minLength: 1, maxLength: 100 })),
      lastChecked: fc.constant(new Date().toISOString()),
    }) as fc.Arbitrary<DependencyHealth>;

    // Arbitrary for system metrics
    const systemMetricsArb = fc.record({
      memoryUsage: fc.record({
        heapUsed: fc.integer({ min: 50, max: 500 }),
        heapTotal: fc.integer({ min: 500, max: 1000 }),
        external: fc.integer({ min: 0, max: 100 }),
        rss: fc.integer({ min: 100, max: 1000 }),
        percentUsed: fc.integer({ min: 0, max: 100 }),
      }),
      uptime: fc.integer({ min: 0, max: 86400 }),
      nodeVersion: fc.constant('v18.0.0'),
      platform: fc.constantFrom('linux', 'darwin', 'win32'),
    }) as fc.Arbitrary<SystemMetrics>;

    it('should report unhealthy when any dependency is unhealthy', () => {
      fc.assert(
        fc.property(
          fc.array(dependencyHealthArb, { minLength: 1, maxLength: 5 }),
          systemMetricsArb,
          (dependencies, metrics) => {
            // Ensure at least one unhealthy dependency
            const unhealthyDeps = dependencies.map((d, i) =>
              i === 0 ? { ...d, status: HealthStatus.UNHEALTHY } : d
            );

            const status = determineOverallStatus(unhealthyDeps, metrics, DEFAULT_CONFIG);
            expect(status).toBe(HealthStatus.UNHEALTHY);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should report degraded when any dependency is degraded and none unhealthy', () => {
      fc.assert(
        fc.property(
          fc.array(dependencyHealthArb, { minLength: 1, maxLength: 5 }),
          systemMetricsArb,
          (dependencies, metrics) => {
            // Ensure at least one degraded, none unhealthy
            const degradedDeps = dependencies.map((d, i) => ({
              ...d,
              status: i === 0 ? HealthStatus.DEGRADED : HealthStatus.HEALTHY,
            }));

            // Ensure memory is below threshold
            const safeMetrics = {
              ...metrics,
              memoryUsage: { ...metrics.memoryUsage, percentUsed: 50 },
            };

            const status = determineOverallStatus(degradedDeps, safeMetrics, DEFAULT_CONFIG);
            expect(status).toBe(HealthStatus.DEGRADED);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should report healthy when all dependencies are healthy', () => {
      fc.assert(
        fc.property(
          fc.array(dependencyHealthArb, { minLength: 1, maxLength: 5 }),
          systemMetricsArb,
          (dependencies, metrics) => {
            // Make all dependencies healthy
            const healthyDeps = dependencies.map((d) => ({
              ...d,
              status: HealthStatus.HEALTHY,
            }));

            // Ensure memory is below threshold
            const safeMetrics = {
              ...metrics,
              memoryUsage: { ...metrics.memoryUsage, percentUsed: 50 },
            };

            const status = determineOverallStatus(healthyDeps, safeMetrics, DEFAULT_CONFIG);
            expect(status).toBe(HealthStatus.HEALTHY);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should report degraded when memory exceeds threshold', () => {
      fc.assert(
        fc.property(
          fc.array(dependencyHealthArb, { minLength: 1, maxLength: 5 }),
          fc.integer({ min: 91, max: 100 }),
          (dependencies, memoryPercent) => {
            // Make all dependencies healthy
            const healthyDeps = dependencies.map((d) => ({
              ...d,
              status: HealthStatus.HEALTHY,
            }));

            const highMemoryMetrics: SystemMetrics = {
              memoryUsage: {
                heapUsed: 900,
                heapTotal: 1000,
                external: 50,
                rss: 1000,
                percentUsed: memoryPercent,
              },
              uptime: 3600,
              nodeVersion: 'v18.0.0',
              platform: 'linux',
            };

            const status = determineOverallStatus(healthyDeps, highMemoryMetrics, DEFAULT_CONFIG);
            expect(status).toBe(HealthStatus.DEGRADED);
          }
        ),
        { numRuns: 30 }
      );
    });

    it('should include all dependency statuses in response', () => {
      fc.assert(
        fc.property(
          fc.array(dependencyHealthArb, { minLength: 2, maxLength: 5 }),
          (dependencies) => {
            // Each dependency should have required fields
            for (const dep of dependencies) {
              expect(dep.name).toBeDefined();
              expect(dep.status).toBeDefined();
              expect(dep.lastChecked).toBeDefined();
              expect(Object.values(HealthStatus)).toContain(dep.status);
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should include response time when available', () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 5000 }), (responseTime) => {
          const dep: DependencyHealth = {
            name: 'database',
            status: HealthStatus.HEALTHY,
            responseTimeMs: responseTime,
            lastChecked: new Date().toISOString(),
          };

          expect(dep.responseTimeMs).toBe(responseTime);
          expect(dep.responseTimeMs).toBeGreaterThan(0);
        }),
        { numRuns: 30 }
      );
    });

    it('should include error message for unhealthy dependencies', () => {
      fc.assert(
        fc.property(fc.string({ minLength: 1, maxLength: 200 }), (errorMessage) => {
          const dep: DependencyHealth = {
            name: 'database',
            status: HealthStatus.UNHEALTHY,
            message: errorMessage,
            lastChecked: new Date().toISOString(),
          };

          expect(dep.message).toBe(errorMessage);
        }),
        { numRuns: 30 }
      );
    });
  });

  describe('System Metrics', () => {
    it('should return valid memory metrics', () => {
      const metrics = getSystemMetrics();

      expect(metrics.memoryUsage).toBeDefined();
      expect(metrics.memoryUsage.heapUsed).toBeGreaterThanOrEqual(0);
      expect(metrics.memoryUsage.heapTotal).toBeGreaterThan(0);
      expect(metrics.memoryUsage.percentUsed).toBeGreaterThanOrEqual(0);
      expect(metrics.memoryUsage.percentUsed).toBeLessThanOrEqual(100);
    });

    it('should return valid uptime', () => {
      const metrics = getSystemMetrics();

      expect(metrics.uptime).toBeGreaterThanOrEqual(0);
      expect(typeof metrics.uptime).toBe('number');
    });

    it('should return node version', () => {
      const metrics = getSystemMetrics();

      expect(metrics.nodeVersion).toBeDefined();
      expect(metrics.nodeVersion).toMatch(/^v\d+\.\d+\.\d+/);
    });

    it('should return platform', () => {
      const metrics = getSystemMetrics();

      expect(metrics.platform).toBeDefined();
      expect(['linux', 'darwin', 'win32', 'freebsd']).toContain(metrics.platform);
    });
  });

  describe('Dependency Checkers with Real Services', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should return healthy status for successful database check', async () => {
      mockPrismaService.$queryRaw.mockResolvedValueOnce([{ '?column?': 1 }]);

      const checker = new DatabaseHealthChecker(mockPrismaService as any);
      const result = await checker.check();

      expect(result.name).toBe('database');
      expect(result.status).toBe(HealthStatus.HEALTHY);
      expect(result.responseTimeMs).toBeDefined();
      expect(result.lastChecked).toBeDefined();
      expect(mockPrismaService.$queryRaw).toHaveBeenCalled();
    });

    it('should return unhealthy status when database fails', async () => {
      mockPrismaService.$queryRaw.mockRejectedValueOnce(new Error('Connection refused'));

      const checker = new DatabaseHealthChecker(mockPrismaService as any);
      const result = await checker.check();

      expect(result.name).toBe('database');
      expect(result.status).toBe(HealthStatus.UNHEALTHY);
      expect(result.message).toBe('اتصال به پايگاه داده برقرار نيست');
      expect(result.details).toBeDefined();
      expect(result.details?.error).toBe('Connection refused');
    });

    it('should return healthy status for successful redis check', async () => {
      mockRedisClient.ping.mockResolvedValueOnce('PONG');

      const checker = new RedisHealthChecker(mockRedisClient as any);
      const result = await checker.check();

      expect(result.name).toBe('redis');
      expect(result.status).toBe(HealthStatus.HEALTHY);
      expect(result.responseTimeMs).toBeDefined();
      expect(result.lastChecked).toBeDefined();
      expect(mockRedisClient.ping).toHaveBeenCalled();
    });

    it('should return unhealthy status when redis fails', async () => {
      mockRedisClient.ping.mockRejectedValueOnce(new Error('ECONNREFUSED'));

      const checker = new RedisHealthChecker(mockRedisClient as any);
      const result = await checker.check();

      expect(result.name).toBe('redis');
      expect(result.status).toBe(HealthStatus.UNHEALTHY);
      expect(result.message).toBe('اتصال به Redis برقرار نيست');
      expect(result.details).toBeDefined();
      expect(result.details?.error).toBe('ECONNREFUSED');
    });

    it('should return unhealthy status when storage is not configured', async () => {
      // StorageHealthChecker checks env vars in constructor
      const originalEnv = { ...process.env };
      process.env.MINIO_ENDPOINT = undefined;
      process.env.MINIO_ROOT_USER = undefined;
      process.env.MINIO_ROOT_PASSWORD = undefined;

      const checker = new StorageHealthChecker();
      const result = await checker.check();

      expect(result.name).toBe('storage');
      expect(result.status).toBe(HealthStatus.UNHEALTHY);
      expect(result.message).toBe('سرويس ذخيره‌سازي پيکربندي نشده است');
      expect(result.details?.error).toContain('MinIO client not configured');

      // Restore env
      process.env = originalEnv;
    });

    it('should return unhealthy status when bucket does not exist', async () => {
      // Mock MinIO client that returns false for bucketExists
      const mockMinioClient = {
        bucketExists: vi.fn().mockResolvedValue(false),
      };

      // Create a mock StorageHealthChecker with the mocked client
      const checker = new StorageHealthChecker();
      (checker as any).client = mockMinioClient;
      (checker as any).bucket = 'test-bucket';

      const result = await checker.check();

      expect(result.name).toBe('storage');
      expect(result.status).toBe(HealthStatus.UNHEALTHY);
      expect(result.message).toBe('سطل ذخيره‌سازي موجود نيست');
      expect(result.details?.error).toContain('does not exist');
    });

    it('should return healthy status for successful storage check with read/write permissions', async () => {
      // Mock MinIO client with successful operations
      const mockStream = {
        on: vi.fn((event, callback) => {
          if (event === 'data') {
            callback('{"timestamp":"2024-01-01T00:00:00.000Z","service":"health-check"}');
          } else if (event === 'end') {
            callback();
          }
          return mockStream;
        }),
      };

      const mockMinioClient = {
        bucketExists: vi.fn().mockResolvedValue(true),
        putObject: vi.fn().mockResolvedValue({}),
        getObject: vi.fn().mockResolvedValue(mockStream),
        removeObject: vi.fn().mockResolvedValue({}),
      };

      // Create a mock StorageHealthChecker with the mocked client
      const checker = new StorageHealthChecker();
      (checker as any).client = mockMinioClient;
      (checker as any).bucket = 'test-bucket';

      const result = await checker.check();

      expect(result.name).toBe('storage');
      expect(result.status).toBe(HealthStatus.HEALTHY);
      expect(result.responseTimeMs).toBeDefined();
      expect(result.lastChecked).toBeDefined();
      expect(mockMinioClient.bucketExists).toHaveBeenCalled();
      expect(mockMinioClient.putObject).toHaveBeenCalled();
      expect(mockMinioClient.getObject).toHaveBeenCalled();
      expect(mockMinioClient.removeObject).toHaveBeenCalled();
    });

    it('should return unhealthy status when storage permissions fail', async () => {
      const mockMinioClient = {
        bucketExists: vi.fn().mockResolvedValue(true),
        putObject: vi.fn().mockRejectedValue(new Error('Access denied')),
      };

      // Create a mock StorageHealthChecker with the mocked client
      const checker = new StorageHealthChecker();
      (checker as any).client = mockMinioClient;
      (checker as any).bucket = 'test-bucket';

      const result = await checker.check();

      expect(result.name).toBe('storage');
      expect(result.status).toBe(HealthStatus.UNHEALTHY);
      expect(result.message).toBe('دسترسي خواندن/نوشتن به سرويس ذخيره‌سازي وجود ندارد');
      expect(result.details?.error).toContain('Access denied');
    });

    it('should handle timeout gracefully', async () => {
      const slowChecker = {
        name: 'slow-service',
        check: async () => {
          await new Promise((resolve) => setTimeout(resolve, 10000));
          return {
            name: 'slow-service',
            status: HealthStatus.HEALTHY,
            lastChecked: new Date().toISOString(),
          };
        },
      };

      const result = await checkWithTimeout(slowChecker, 100);

      expect(result.status).toBe(HealthStatus.UNHEALTHY);
      expect(result.message).toContain('timeout');
    });

    it('should handle checker errors gracefully', async () => {
      const errorChecker = {
        name: 'error-service',
        check: async () => {
          throw new Error('Connection refused');
        },
      };

      const result = await checkWithTimeout(errorChecker, 5000);

      expect(result.status).toBe(HealthStatus.UNHEALTHY);
      expect(result.message).toBe('Connection refused');
    });
  });

  describe('Health Controller', () => {
    let controller: HealthController;

    beforeEach(() => {
      vi.clearAllMocks();
      // Create controller without dependency checkers for basic tests
      controller = new HealthController();
    });

    it('should return alive status for liveness probe', () => {
      const mockResponse = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as unknown as Response;

      controller.liveness(mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          alive: true,
          timestamp: expect.any(String),
        })
      );
    });

    it('should return pong for ping endpoint', () => {
      const result = controller.ping();

      expect(result.pong).toBe(true);
      expect(result.timestamp).toBeDefined();
    });

    it('should include service info in readiness response', async () => {
      const mockResponse = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as unknown as Response;

      await controller.readiness(mockResponse);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          ready: expect.any(Boolean),
          service: 'nextgen-api',
          version: expect.any(String),
          dependencies: expect.any(Array),
        })
      );
    });

    it('should include metrics in health response', async () => {
      const mockResponse = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as unknown as Response;

      await controller.health(mockResponse);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: expect.any(String),
          timestamp: expect.any(String),
          service: 'nextgen-api',
          uptime: expect.any(Number),
          dependencies: expect.any(Array),
          metrics: expect.objectContaining({
            memoryUsage: expect.any(Object),
            uptime: expect.any(Number),
            nodeVersion: expect.any(String),
            platform: expect.any(String),
          }),
        })
      );
    });

    it('should return 503 when unhealthy', async () => {
      // Create mock checkers that return unhealthy
      const mockDbChecker = {
        name: 'database',
        check: vi.fn().mockResolvedValue({
          name: 'database',
          status: HealthStatus.UNHEALTHY,
          message: 'Service unavailable',
          lastChecked: new Date().toISOString(),
        }),
      } as unknown as DatabaseHealthChecker;

      const unhealthyController = new HealthController(mockDbChecker);

      const mockResponse = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as unknown as Response;

      await unhealthyController.health(mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(503);
    });

    it('should return 200 when all dependencies are healthy', async () => {
      mockPrismaService.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      mockRedisClient.ping.mockResolvedValue('PONG');

      const dbChecker = new DatabaseHealthChecker(mockPrismaService as any);
      const redisChecker = new RedisHealthChecker(mockRedisClient as any);

      const healthyController = new HealthController(dbChecker, redisChecker);

      const mockResponse = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as unknown as Response;

      await healthyController.health(mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
    });
  });

  describe('Status Determination Logic', () => {
    const config = DEFAULT_CONFIG;

    it('should prioritize unhealthy over degraded', () => {
      const dependencies: DependencyHealth[] = [
        { name: 'db', status: HealthStatus.UNHEALTHY, lastChecked: new Date().toISOString() },
        { name: 'redis', status: HealthStatus.DEGRADED, lastChecked: new Date().toISOString() },
        { name: 'cache', status: HealthStatus.HEALTHY, lastChecked: new Date().toISOString() },
      ];

      const metrics: SystemMetrics = {
        memoryUsage: { heapUsed: 100, heapTotal: 500, external: 10, rss: 200, percentUsed: 20 },
        uptime: 3600,
        nodeVersion: 'v18.0.0',
        platform: 'linux',
      };

      const status = determineOverallStatus(dependencies, metrics, config);
      expect(status).toBe(HealthStatus.UNHEALTHY);
    });

    it('should return healthy only when all conditions are met', () => {
      const dependencies: DependencyHealth[] = [
        { name: 'db', status: HealthStatus.HEALTHY, lastChecked: new Date().toISOString() },
        { name: 'redis', status: HealthStatus.HEALTHY, lastChecked: new Date().toISOString() },
      ];

      const metrics: SystemMetrics = {
        memoryUsage: { heapUsed: 100, heapTotal: 500, external: 10, rss: 200, percentUsed: 20 },
        uptime: 3600,
        nodeVersion: 'v18.0.0',
        platform: 'linux',
      };

      const status = determineOverallStatus(dependencies, metrics, config);
      expect(status).toBe(HealthStatus.HEALTHY);
    });
  });

  describe('Error Details in Health Responses', () => {
    it('should include host and port in database error details', async () => {
      const originalEnv = process.env.DATABASE_URL;
      process.env.DATABASE_URL = 'postgresql://user:pass@db-host:5432/mydb';

      mockPrismaService.$queryRaw.mockRejectedValueOnce(new Error('Connection timeout'));

      const checker = new DatabaseHealthChecker(mockPrismaService as any);
      const result = await checker.check();

      expect(result.details).toBeDefined();
      expect(result.details?.host).toBe('db-host');
      expect(result.details?.port).toBe(5432);
      expect(result.details?.error).toBe('Connection timeout');

      process.env.DATABASE_URL = originalEnv;
    });

    it('should include host and port in redis error details', async () => {
      const originalUrl = process.env.REDIS_URL;
      process.env.REDIS_URL = 'redis://redis-host:6380';

      mockRedisClient.ping.mockRejectedValueOnce(new Error('Connection refused'));

      const checker = new RedisHealthChecker(mockRedisClient as any);
      const result = await checker.check();

      expect(result.details).toBeDefined();
      expect(result.details?.host).toBe('redis-host');
      expect(result.details?.port).toBe(6380);
      expect(result.details?.error).toBe('Connection refused');

      process.env.REDIS_URL = originalUrl;
    });
  });
});
