import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { Response } from 'express';
import {
  HealthController,
  HealthStatus,
  DependencyHealth,
  SystemMetrics,
  HealthCheckConfig,
  __testing,
} from './health.controller';

const {
  getSystemMetrics,
  determineOverallStatus,
  checkWithTimeout,
  DEFAULT_CONFIG,
  DatabaseHealthChecker,
  RedisHealthChecker,
} = __testing;

describe('Health Check', () => {
  describe('Property 16: Health Check Dependency Reporting', () => {
    // Arbitrary for dependency health status
    const healthStatusArb = fc.constantFrom(
      HealthStatus.HEALTHY,
      HealthStatus.DEGRADED,
      HealthStatus.UNHEALTHY,
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
            const healthyDeps = dependencies.map(d => ({
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
            const healthyDeps = dependencies.map(d => ({
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

  describe('Dependency Checkers', () => {
    it('should return healthy status for successful database check', async () => {
      // Mock PrismaService
      const mockPrismaService = {
        $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]),
      };
      
      const checker = new DatabaseHealthChecker(mockPrismaService as any);
      const result = await checker.check();

      expect(result.name).toBe('database');
      expect(result.status).toBe(HealthStatus.HEALTHY);
      expect(result.responseTimeMs).toBeDefined();
      expect(result.lastChecked).toBeDefined();
    });

    it('should return healthy status for successful redis check', async () => {
      // Mock Redis client
      const mockRedisClient = {
        ping: vi.fn().mockResolvedValue('PONG'),
      };
      
      const checker = new RedisHealthChecker(mockRedisClient as any);
      const result = await checker.check();

      expect(result.name).toBe('redis');
      expect(result.status).toBe(HealthStatus.HEALTHY);
      expect(result.responseTimeMs).toBeDefined();
      expect(result.lastChecked).toBeDefined();
    });

    it('should handle timeout gracefully', async () => {
      const slowChecker = {
        name: 'slow-service',
        check: async () => {
          await new Promise(resolve => setTimeout(resolve, 10000));
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
      // Create controller with failing dependency
      const unhealthyController = new HealthController();
      
      // Mock the dependency checkers to return unhealthy
      (unhealthyController as any).dependencyCheckers = [{
        name: 'failing-service',
        check: async () => ({
          name: 'failing-service',
          status: HealthStatus.UNHEALTHY,
          message: 'Service unavailable',
          lastChecked: new Date().toISOString(),
        }),
      }];

      const mockResponse = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as unknown as Response;

      await unhealthyController.health(mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(503);
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
});
