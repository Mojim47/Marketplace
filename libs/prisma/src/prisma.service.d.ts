import { OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
/**
 * PrismaService - Database Connection with Connection Pooling
 *
 * Connection pool is configured via DATABASE_URL query parameters:
 * - connection_limit: Maximum number of connections (default: 10)
 * - pool_timeout: Timeout for acquiring a connection from pool in seconds (default: 10)
 *
 * Example DATABASE_URL:
 * postgresql://user:pass@host:5432/db?connection_limit=20&pool_timeout=10
 *
 * Requirements: 10.1, 10.2, 10.3, 10.4
 */
export declare class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
    private readonly logger;
    private connectionPoolMetrics;
    constructor();
    onModuleInit(): Promise<void>;
    onModuleDestroy(): Promise<void>;
    /**
     * Get connection pool metrics for monitoring
     * Requirements: 10.4
     */
    getPoolMetrics(): {
        timestamp: string;
        activeConnections: number;
        waitingRequests: number;
        totalConnections: number;
    };
    /**
     * Execute query with pool exhaustion handling
     * Requirements: 10.3
     */
    executeWithPoolQueue<T>(operation: () => Promise<T>, timeoutMs?: number): Promise<T>;
    cleanDatabase(): Promise<any[]>;
}
//# sourceMappingURL=prisma.service.d.ts.map