import {
  Controller,
  Get,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  Optional,
  Res,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  HealthCheck,
  HealthCheckError,
  HealthCheckService,
  MemoryHealthIndicator,
  PrismaHealthIndicator,
} from '@nestjs/terminus';
import { PrismaService } from '../database/prisma.service';
import type Redis from 'ioredis';
import * as Minio from 'minio';
import { RuntimeReconciliationService } from '../runtime/runtime-reconciliation.service';

interface Response {
  status(code: number): Response;
  json(body: unknown): void;
}

/**
 * Health check status
 */
export enum HealthStatus {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  UNHEALTHY = 'unhealthy',
}

/**
 * Dependency health status
 */
export interface DependencyHealth {
  name: string;
  status: HealthStatus;
  responseTimeMs?: number;
  message?: string;
  lastChecked: string;
  details?: {
    host?: string;
    port?: number;
    error?: string;
  };
}

/**
 * System metrics
 */
export interface SystemMetrics {
  memoryUsage: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
    percentUsed: number;
  };
  cpuUsage?: {
    user: number;
    system: number;
  };
  uptime: number;
  nodeVersion: string;
  platform: string;
}

/**
 * Health check response
 */
export interface HealthCheckResponse {
  status: HealthStatus;
  timestamp: string;
  service: string;
  version: string;
  uptime: number;
  dependencies: DependencyHealth[];
  metrics?: SystemMetrics;
}

/**
 * Liveness probe response
 */
export interface LivenessResponse {
  status: 'ok';
  timestamp: string;
}

/**
 * Readiness probe response
 */
export interface ReadinessResponse {
  ready: boolean;
  timestamp: string;
  service: string;
  version: string;
  dependencies: DependencyHealth[];
}

export interface StartupResponse {
  started: boolean;
  timestamp: string;
  service: string;
  version: string;
  checks: {
    db: boolean;
    redis: boolean;
    schema: boolean;
    queue: boolean;
  };
}

/**
 * Health check configuration
 */
export interface HealthCheckConfig {
  /** Timeout for dependency checks in ms */
  timeout: number;
  /** Memory usage threshold for degraded status (percentage) */
  memoryThreshold: number;
  /** Include detailed metrics in response */
  includeMetrics: boolean;
}

const DEFAULT_CONFIG: HealthCheckConfig = {
  timeout: 5000,
  memoryThreshold: 90,
  includeMetrics: true,
};

/**
 * Dependency checker interface
 */
export interface DependencyChecker {
  name: string;
  check(): Promise<DependencyHealth>;
}

/**
 * Database health checker - Uses real Prisma queries
 * Validates: Requirements 2.1, 2.4
 */
@Injectable()
export class DatabaseHealthChecker implements DependencyChecker {
  name = 'database';
  private readonly logger = new Logger(DatabaseHealthChecker.name);

  constructor(private readonly prisma: PrismaService) {}

  async check(): Promise<DependencyHealth> {
    const startTime = Date.now();

    try {
      // Execute actual database query - no simulation
      await this.prisma.$queryRaw`SELECT 1`;

      return {
        name: this.name,
        status: HealthStatus.HEALTHY,
        responseTimeMs: Date.now() - startTime,
        lastChecked: new Date().toISOString(),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Database health check failed: ${errorMessage}`);

      // Extract connection details from DATABASE_URL for error reporting
      const databaseUrl = process.env.DATABASE_URL || '';
      let host = 'unknown';
      let port = 5432;

      try {
        const urlMatch = databaseUrl.match(/@([^:]+):(\d+)/);
        if (urlMatch) {
          host = urlMatch[1];
          port = Number.parseInt(urlMatch[2], 10);
        }
      } catch {
        // Ignore parsing errors
      }

      return {
        name: this.name,
        status: HealthStatus.UNHEALTHY,
        responseTimeMs: Date.now() - startTime,
        message: 'اتصال به پايگاه داده برقرار نيست',
        lastChecked: new Date().toISOString(),
        details: {
          host,
          port,
          error: errorMessage,
        },
      };
    }
  }
}

/**
 * Redis health checker - Uses real Redis ping
 * Validates: Requirements 2.2, 2.4
 */
@Injectable()
export class RedisHealthChecker implements DependencyChecker {
  name = 'redis';
  private readonly logger = new Logger(RedisHealthChecker.name);

  constructor(@Inject('REDIS_CLIENT') private readonly redis: Redis) {}

  async check(): Promise<DependencyHealth> {
    const startTime = Date.now();

    try {
      // Execute actual Redis ping - no simulation
      await this.redis.ping();

      return {
        name: this.name,
        status: HealthStatus.HEALTHY,
        responseTimeMs: Date.now() - startTime,
        lastChecked: new Date().toISOString(),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Redis health check failed: ${errorMessage}`);

      // Extract connection details from REDIS_URL for error reporting
      const redisUrl = process.env.REDIS_URL || '';
      let host = 'unknown';
      let port = 6379;

      try {
        const urlMatch = redisUrl.match(/:\/\/([^:@]+)(?::(\d+))?/);
        if (urlMatch) {
          host = urlMatch[1];
          port = urlMatch[2] ? Number.parseInt(urlMatch[2], 10) : 6379;
        } else {
          host = process.env.REDIS_HOST || 'unknown';
          port = Number.parseInt(process.env.REDIS_PORT || '6379', 10);
        }
      } catch {
        // Ignore parsing errors
      }

      return {
        name: this.name,
        status: HealthStatus.UNHEALTHY,
        responseTimeMs: Date.now() - startTime,
        message: 'اتصال به Redis برقرار نيست',
        lastChecked: new Date().toISOString(),
        details: {
          host,
          port,
          error: errorMessage,
        },
      };
    }
  }
}

@Injectable()
export class SchemaHealthChecker implements DependencyChecker {
  name = 'schema';

  constructor(private readonly prisma: PrismaService) {}

  async check(): Promise<DependencyHealth> {
    const startTime = Date.now();
    const expectedSchemaVersion = process.env.APP_SCHEMA_VERSION;

    try {
      const rows = await this.prisma.$queryRawUnsafe<Array<{ migration_name: string; finished_at: Date | null }>>(
        'SELECT migration_name, finished_at FROM "_prisma_migrations" ORDER BY finished_at DESC NULLS LAST LIMIT 1'
      );

      const latest = rows[0];
      if (!latest?.finished_at) {
        return {
          name: this.name,
          status: HealthStatus.UNHEALTHY,
          responseTimeMs: Date.now() - startTime,
          message: 'migration_pending_or_incomplete',
          lastChecked: new Date().toISOString(),
        };
      }

      if (expectedSchemaVersion && latest.migration_name !== expectedSchemaVersion) {
        return {
          name: this.name,
          status: HealthStatus.UNHEALTHY,
          responseTimeMs: Date.now() - startTime,
          message: 'schema_version_mismatch',
          lastChecked: new Date().toISOString(),
          details: { error: `expected=${expectedSchemaVersion}, actual=${latest.migration_name}` },
        };
      }

      return {
        name: this.name,
        status: HealthStatus.HEALTHY,
        responseTimeMs: Date.now() - startTime,
        lastChecked: new Date().toISOString(),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'unknown';
      return {
        name: this.name,
        status: HealthStatus.UNHEALTHY,
        responseTimeMs: Date.now() - startTime,
        message: 'schema_check_failed',
        lastChecked: new Date().toISOString(),
        details: {
          error: errorMessage,
        },
      };
    }
  }
}

@Injectable()
export class QueueLagHealthChecker implements DependencyChecker {
  name = 'queue';

  constructor(@Inject('REDIS_CLIENT') private readonly redis: Redis) {}

  async check(): Promise<DependencyHealth> {
    const startTime = Date.now();
    const queueWaitKey = process.env.QUEUE_WAIT_KEY || 'bull:email:wait';
    const lagThreshold = Number.parseInt(process.env.QUEUE_LAG_THRESHOLD || '1000', 10);

    try {
      const lag = await this.redis.llen(queueWaitKey);
      if (lag > lagThreshold) {
        return {
          name: this.name,
          status: HealthStatus.UNHEALTHY,
          responseTimeMs: Date.now() - startTime,
          message: 'queue_lag_threshold_exceeded',
          lastChecked: new Date().toISOString(),
          details: {
            error: `lag=${lag} threshold=${lagThreshold}`,
          },
        };
      }

      return {
        name: this.name,
        status: HealthStatus.HEALTHY,
        responseTimeMs: Date.now() - startTime,
        lastChecked: new Date().toISOString(),
      };
    } catch (error) {
      return {
        name: this.name,
        status: HealthStatus.UNHEALTHY,
        responseTimeMs: Date.now() - startTime,
        message: 'queue_check_failed',
        lastChecked: new Date().toISOString(),
        details: {
          error: error instanceof Error ? error.message : 'unknown',
        },
      };
    }
  }
}

/**
 * Storage health checker (S3/MinIO) - Uses real MinIO bucketExists
 * Validates: Requirements 2.3, 2.4
 */
@Injectable()
export class StorageHealthChecker implements DependencyChecker {
  name = 'storage';
  private readonly logger = new Logger(StorageHealthChecker.name);
  private readonly client: Minio.Client | null = null;
  private readonly bucket: string;
  private readonly host: string;
  private readonly port: number;

  constructor() {
    const sanitize = (value?: string) =>
      value && value !== 'undefined' && value.trim().length > 0 ? value : undefined;

    const endpoint = sanitize(process.env.MINIO_ENDPOINT);
    const accessKey = sanitize(process.env.MINIO_ROOT_USER || process.env.MINIO_ACCESS_KEY);
    const secretKey = sanitize(process.env.MINIO_ROOT_PASSWORD || process.env.MINIO_SECRET_KEY);

    this.host = endpoint || 'unknown';
    this.port = Number.parseInt(process.env.MINIO_API_PORT || process.env.MINIO_PORT || '9000', 10);
    this.bucket = process.env.MINIO_BUCKET_UPLOADS || process.env.MINIO_BUCKET || 'uploads';

    if (endpoint && accessKey && secretKey) {
      this.client = new Minio.Client({
        endPoint: endpoint,
        port: this.port,
        useSSL: process.env.MINIO_USE_SSL === 'true',
        accessKey,
        secretKey,
      });
    }
  }

  async check(): Promise<DependencyHealth> {
    const startTime = Date.now();

    if (!this.client) {
      return {
        name: this.name,
        status: HealthStatus.UNHEALTHY,
        responseTimeMs: Date.now() - startTime,
        message: 'سرويس ذخيره‌سازي پيکربندي نشده است',
        lastChecked: new Date().toISOString(),
        details: {
          host: this.host,
          port: this.port,
          error:
            'MinIO client not configured - missing MINIO_ENDPOINT, MINIO_ROOT_USER, or MINIO_ROOT_PASSWORD',
        },
      };
    }

    try {
      // Execute actual MinIO bucket check - no simulation
      const bucketExists = await this.client.bucketExists(this.bucket);

      if (!bucketExists) {
        return {
          name: this.name,
          status: HealthStatus.UNHEALTHY,
          responseTimeMs: Date.now() - startTime,
          message: 'سطل ذخيره‌سازي موجود نيست',
          lastChecked: new Date().toISOString(),
          details: {
            host: this.host,
            port: this.port,
            error: `Bucket '${this.bucket}' does not exist`,
          },
        };
      }

      // Test read/write permissions with a small health check object
      const healthCheckKey = `health-check-${Date.now()}.json`;
      const healthCheckData = JSON.stringify({
        timestamp: new Date().toISOString(),
        service: 'health-check',
      });

      try {
        // Test write permission
        await this.client.putObject(
          this.bucket,
          healthCheckKey,
          healthCheckData,
          healthCheckData.length,
          {
            'Content-Type': 'application/json',
          }
        );

        // Test read permission
        const stream = await this.client.getObject(this.bucket, healthCheckKey);

        // Consume the stream to ensure read works
        let _data = '';
        stream.on('data', (chunk) => {
          _data += chunk;
        });
        await new Promise((resolve, reject) => {
          stream.on('end', resolve);
          stream.on('error', reject);
        });

        // Clean up test object
        await this.client.removeObject(this.bucket, healthCheckKey);

        return {
          name: this.name,
          status: HealthStatus.HEALTHY,
          responseTimeMs: Date.now() - startTime,
          lastChecked: new Date().toISOString(),
        };
      } catch (permissionError) {
        const permissionMessage =
          permissionError instanceof Error ? permissionError.message : 'Unknown permission error';
        this.logger.error(`Storage permission check failed: ${permissionMessage}`);

        return {
          name: this.name,
          status: HealthStatus.UNHEALTHY,
          responseTimeMs: Date.now() - startTime,
          message: 'دسترسي خواندن/نوشتن به سرويس ذخيره‌سازي وجود ندارد',
          lastChecked: new Date().toISOString(),
          details: {
            host: this.host,
            port: this.port,
            error: `Permission error: ${permissionMessage}`,
          },
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Storage health check failed: ${errorMessage}`);

      return {
        name: this.name,
        status: HealthStatus.UNHEALTHY,
        responseTimeMs: Date.now() - startTime,
        message: 'اتصال به سرويس ذخيره‌سازي برقرار نيست',
        lastChecked: new Date().toISOString(),
        details: {
          host: this.host,
          port: this.port,
          error: errorMessage,
        },
      };
    }
  }
}

/**
 * Get system metrics
 */
function getSystemMetrics(): SystemMetrics {
  const memoryUsage = process.memoryUsage();
  const heapUsedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
  const heapTotalMB = Math.round(memoryUsage.heapTotal / 1024 / 1024);

  return {
    memoryUsage: {
      heapUsed: heapUsedMB,
      heapTotal: heapTotalMB,
      external: Math.round(memoryUsage.external / 1024 / 1024),
      rss: Math.round(memoryUsage.rss / 1024 / 1024),
      percentUsed: Math.round((heapUsedMB / heapTotalMB) * 100),
    },
    uptime: Math.round(process.uptime()),
    nodeVersion: process.version,
    platform: process.platform,
  };
}

/**
 * Determine overall health status from dependencies
 */
function determineOverallStatus(
  dependencies: DependencyHealth[],
  metrics: SystemMetrics,
  config: HealthCheckConfig
): HealthStatus {
  // Check for any unhealthy dependencies
  const hasUnhealthy = dependencies.some((d) => d.status === HealthStatus.UNHEALTHY);
  if (hasUnhealthy) {
    return HealthStatus.UNHEALTHY;
  }

  // Check for degraded dependencies
  const hasDegraded = dependencies.some((d) => d.status === HealthStatus.DEGRADED);
  if (hasDegraded) {
    return HealthStatus.DEGRADED;
  }

  // Check memory threshold
  if (metrics.memoryUsage.percentUsed > config.memoryThreshold) {
    return HealthStatus.DEGRADED;
  }

  return HealthStatus.HEALTHY;
}

/**
 * Check dependency with timeout
 */
async function checkWithTimeout(
  checker: DependencyChecker,
  timeout: number
): Promise<DependencyHealth> {
  const timeoutPromise = new Promise<DependencyHealth>((_, reject) => {
    setTimeout(() => {
      reject(new Error('Health check timeout'));
    }, timeout);
  });

  try {
    return await Promise.race([checker.check(), timeoutPromise]);
  } catch (error) {
    return {
      name: checker.name,
      status: HealthStatus.UNHEALTHY,
      message: error instanceof Error ? error.message : 'بررسي سلامت با خطا مواجه شد',
      lastChecked: new Date().toISOString(),
    };
  }
}

/**
 * Comprehensive Health Check Controller
 *
 * Features:
 * - Liveness probe for Kubernetes
 * - Readiness probe with dependency checks
 * - Detailed health status with metrics
 * - Configurable timeouts
 * - Memory and CPU monitoring
 * - Degraded status support
 * - Real dependency checks (no simulation)
 *
 * Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5
 */
@ApiTags('health')
@Controller('health')
export class HealthController {
  private readonly startTime = Date.now();
  private readonly config: HealthCheckConfig;
  private readonly dependencyCheckers: DependencyChecker[];

  constructor(
    private readonly healthCheckService: HealthCheckService,
    private readonly prismaIndicator: PrismaHealthIndicator,
    private readonly prismaService: PrismaService,
    private readonly memory: MemoryHealthIndicator,
    @Optional() private readonly databaseChecker?: DatabaseHealthChecker,
    @Optional() private readonly redisChecker?: RedisHealthChecker,
    @Optional() private readonly storageChecker?: StorageHealthChecker,
    @Optional() private readonly schemaChecker?: SchemaHealthChecker,
    @Optional() private readonly queueChecker?: QueueLagHealthChecker,
    @Optional() private readonly runtimeReconciliation?: RuntimeReconciliationService
  ) {
    this.config = DEFAULT_CONFIG;
    this.dependencyCheckers = [];

    if (this.databaseChecker) {
      this.dependencyCheckers.push(this.databaseChecker);
    }
    if (this.redisChecker) {
      this.dependencyCheckers.push(this.redisChecker);
    }
    if (this.storageChecker) {
      this.dependencyCheckers.push(this.storageChecker);
    }
    if (this.schemaChecker) {
      this.dependencyCheckers.push(this.schemaChecker);
    }
    if (this.queueChecker) {
      this.dependencyCheckers.push(this.queueChecker);
    }
  }

  /**
   * Liveness probe - checks if the application is running
   * Used by Kubernetes to determine if the pod should be restarted
   */
  @Get('live')
  @ApiOperation({ summary: 'Liveness probe - is the application running?' })
  @ApiResponse({ status: 200, description: 'Application is alive' })
  liveness(@Res() res: Response): void {
    const response: LivenessResponse = {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };

    res.status(HttpStatus.OK).json(response);
  }

  /**
   * Readiness probe - checks if the application is ready to serve traffic
   * Used by Kubernetes to determine if the pod should receive traffic
   */
  @Get('ready')
  @ApiOperation({ summary: 'Readiness probe - is the application ready to serve?' })
  @ApiResponse({ status: 200, description: 'Application is ready' })
  @ApiResponse({ status: 503, description: 'Application is not ready' })
  @HealthCheck()
  async readiness(@Res() res: Response): Promise<void> {
    if (this.runtimeReconciliation) {
      const snapshot = await this.runtimeReconciliation.reconcileNow('readiness_probe');
      const dependencies = snapshot.dependencies.map((dependency) => ({
        name: dependency.name,
        status: dependency.healthy ? HealthStatus.HEALTHY : HealthStatus.UNHEALTHY,
        responseTimeMs: dependency.latencyMs,
        message: dependency.reason,
        lastChecked: dependency.lastCheckedAt,
        details: {
          error: dependency.circuitState !== 'CLOSED' ? `circuit=${dependency.circuitState}` : undefined,
        },
      }));
      const response: ReadinessResponse = {
        ready: snapshot.ready,
        timestamp: new Date().toISOString(),
        service: 'nextgen-api',
        version: process.env.APP_VERSION || '1.0.0',
        dependencies,
      };
      res.status(snapshot.ready ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE).json(response);
      return;
    }

    try {
      await this.healthCheckService.check([
        async () => this.prismaIndicator.pingCheck('database', this.prismaService),
        async () => this.memory.checkHeap('memory_heap', 300 * 1024 * 1024),
        async () => this.redisReadinessCheck(),
        async () => this.schemaReadinessCheck(),
        async () => this.queueReadinessCheck(),
      ]);

      const dependencies = await this.checkAllDependencies();
      const response: ReadinessResponse = {
        ready: true,
        timestamp: new Date().toISOString(),
        service: 'nextgen-api',
        version: process.env.APP_VERSION || '1.0.0',
        dependencies,
      };

      res.status(HttpStatus.OK).json(response);
    } catch {
      const dependencies = await this.checkAllDependencies();
      const response: ReadinessResponse = {
        ready: false,
        timestamp: new Date().toISOString(),
        service: 'nextgen-api',
        version: process.env.APP_VERSION || '1.0.0',
        dependencies,
      };

      res.status(HttpStatus.SERVICE_UNAVAILABLE).json(response);
    }
  }

  @Get('startup')
  @ApiOperation({ summary: 'Startup probe - cold boot + dependency contract check' })
  @ApiResponse({ status: 200, description: 'Application startup contract satisfied' })
  @ApiResponse({ status: 503, description: 'Startup contract failed' })
  async startup(@Res() res: Response): Promise<void> {
    if (this.runtimeReconciliation) {
      const snapshot = await this.runtimeReconciliation.reconcileNow('startup_probe');
      const checks = {
        db: snapshot.dependencies.some((d) => d.name === 'db' && d.healthy),
        redis: snapshot.dependencies.some((d) => d.name === 'redis' && d.healthy),
        schema: snapshot.dependencies.some((d) => d.name === 'migration' && d.healthy),
        queue: snapshot.dependencies.some((d) => d.name === 'queue' && d.healthy),
      };
      const response: StartupResponse = {
        started: snapshot.ready,
        timestamp: new Date().toISOString(),
        service: 'nextgen-api',
        version: process.env.APP_VERSION || '1.0.0',
        checks,
      };
      res.status(snapshot.ready ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE).json(response);
      return;
    }

    const dependencies = await this.checkAllDependencies();
    const checks = {
      db: dependencies.some((d) => d.name === 'database' && d.status === HealthStatus.HEALTHY),
      redis: dependencies.some((d) => d.name === 'redis' && d.status === HealthStatus.HEALTHY),
      schema: dependencies.some((d) => d.name === 'schema' && d.status === HealthStatus.HEALTHY),
      queue: dependencies.some((d) => d.name === 'queue' && d.status === HealthStatus.HEALTHY),
    };
    const started = checks.db && checks.redis && checks.schema && checks.queue;

    const response: StartupResponse = {
      started,
      timestamp: new Date().toISOString(),
      service: 'nextgen-api',
      version: process.env.APP_VERSION || '1.0.0',
      checks,
    };

    res.status(started ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE).json(response);
  }

  /**
   * Comprehensive health check with metrics
   */
  @Get()
  @ApiOperation({ summary: 'Comprehensive health check with metrics' })
  @ApiResponse({ status: 200, description: 'System is healthy' })
  @ApiResponse({ status: 503, description: 'System is unhealthy' })
  async health(@Res() res: Response): Promise<void> {
    const dependencies = await this.checkAllDependencies();
    const metrics = getSystemMetrics();
    const overallStatus = determineOverallStatus(dependencies, metrics, this.config);

    const response: HealthCheckResponse = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      service: 'nextgen-api',
      version: process.env.APP_VERSION || '1.0.0',
      uptime: Math.round((Date.now() - this.startTime) / 1000),
      dependencies,
    };

    if (this.config.includeMetrics) {
      response.metrics = metrics;
    }

    const httpStatus =
      overallStatus === HealthStatus.UNHEALTHY ? HttpStatus.SERVICE_UNAVAILABLE : HttpStatus.OK;

    res.status(httpStatus).json(response);
  }

  /**
   * Simple ping endpoint
   */
  @Get('ping')
  @ApiOperation({ summary: 'Simple ping-pong' })
  ping() {
    return { pong: true, timestamp: new Date().toISOString() };
  }

  /**
   * Check all dependencies
   */
  private async checkAllDependencies(): Promise<DependencyHealth[]> {
    if (this.dependencyCheckers.length === 0) {
      return [];
    }

    const checks = this.dependencyCheckers.map((checker) =>
      checkWithTimeout(checker, this.config.timeout)
    );

    return Promise.all(checks);
  }

  private async redisReadinessCheck() {
    if (!this.redisChecker) {
      return {
        redis: {
          status: 'up',
        },
      };
    }

    const redisHealth = await checkWithTimeout(this.redisChecker, this.config.timeout);
    if (redisHealth.status === HealthStatus.UNHEALTHY) {
      throw new HealthCheckError('Redis health check failed', {
        redis: {
          status: 'down',
          message: redisHealth.message || 'Redis is unavailable',
        },
      });
    }

    return {
      redis: {
        status: 'up',
      },
    };
  }

  private async schemaReadinessCheck() {
    if (!this.schemaChecker) {
      throw new HealthCheckError('Schema checker unavailable', {
        schema: {
          status: 'down',
          message: 'schema_checker_unavailable',
        },
      });
    }

    const schemaHealth = await checkWithTimeout(this.schemaChecker, this.config.timeout);
    if (schemaHealth.status === HealthStatus.UNHEALTHY) {
      throw new HealthCheckError('Schema health check failed', {
        schema: {
          status: 'down',
          message: schemaHealth.message || 'schema_unavailable',
        },
      });
    }

    return {
      schema: {
        status: 'up',
      },
    };
  }

  private async queueReadinessCheck() {
    if (!this.queueChecker) {
      throw new HealthCheckError('Queue checker unavailable', {
        queue: {
          status: 'down',
          message: 'queue_checker_unavailable',
        },
      });
    }

    const queueHealth = await checkWithTimeout(this.queueChecker, this.config.timeout);
    if (queueHealth.status === HealthStatus.UNHEALTHY) {
      throw new HealthCheckError('Queue health check failed', {
        queue: {
          status: 'down',
          message: queueHealth.message || 'queue_unavailable',
        },
      });
    }

    return {
      queue: {
        status: 'up',
      },
    };
  }
}

/**
 * Export for testing
 */
export const __testing = {
  getSystemMetrics,
  determineOverallStatus,
  checkWithTimeout,
  DEFAULT_CONFIG,
  DatabaseHealthChecker,
  RedisHealthChecker,
  StorageHealthChecker,
};

