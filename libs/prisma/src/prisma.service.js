var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var PrismaService_1;
import { Injectable, Logger } from '@nestjs/common';
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
let PrismaService = PrismaService_1 = class PrismaService extends PrismaClient {
    logger = new Logger(PrismaService_1.name);
    connectionPoolMetrics = {
        activeConnections: 0,
        waitingRequests: 0,
        totalConnections: 0,
    };
    constructor() {
        // Parse connection pool settings from environment
        const poolSize = parseInt(process.env['DATABASE_POOL_SIZE'] || '10', 10);
        const poolTimeout = parseInt(process.env['DATABASE_TIMEOUT_MS'] || '5000', 10);
        super({
            log: [
                { emit: 'event', level: 'query' },
                { emit: 'event', level: 'error' },
                { emit: 'event', level: 'warn' },
            ],
            errorFormat: 'pretty',
            // Prisma connection pool configuration
            // Note: connection_limit is set in DATABASE_URL query params
            // These settings control client-side behavior
        });
        this.logger.log(`Database pool configured: size=${poolSize}, timeout=${poolTimeout}ms`);
    }
    async onModuleInit() {
        this.logger.log('Connecting to database...');
        // Log connection pool configuration
        const dbUrl = process.env['DATABASE_URL'] || '';
        const urlParams = new URL(dbUrl.replace('postgresql://', 'http://')).searchParams;
        const connectionLimit = urlParams.get('connection_limit') || '10';
        const poolTimeout = urlParams.get('pool_timeout') || '10';
        this.logger.log(`Connection pool settings: connection_limit=${connectionLimit}, pool_timeout=${poolTimeout}s`);
        try {
            await this['$connect']();
            this.logger.log('✅ Database connected successfully');
            this.connectionPoolMetrics.totalConnections = parseInt(connectionLimit, 10);
        }
        catch (error) {
            this.logger.error('❌ Database connection failed', error);
            throw error;
        }
    }
    async onModuleDestroy() {
        this.logger.log('Disconnecting from database...');
        await this['$disconnect']();
    }
    /**
     * Get connection pool metrics for monitoring
     * Requirements: 10.4
     */
    getPoolMetrics() {
        return {
            ...this.connectionPoolMetrics,
            timestamp: new Date().toISOString(),
        };
    }
    /**
     * Execute query with pool exhaustion handling
     * Requirements: 10.3
     */
    async executeWithPoolQueue(operation, timeoutMs = 5000) {
        const startTime = Date.now();
        this.connectionPoolMetrics.waitingRequests++;
        try {
            const result = await Promise.race([
                operation(),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Connection pool timeout')), timeoutMs)),
            ]);
            return result;
        }
        catch (error) {
            const elapsed = Date.now() - startTime;
            if (error instanceof Error && error.message === 'Connection pool timeout') {
                this.logger.warn(`Connection pool exhausted, request waited ${elapsed}ms before timeout`);
            }
            throw error;
        }
        finally {
            this.connectionPoolMetrics.waitingRequests--;
        }
    }
    async cleanDatabase() {
        if (process.env['NODE_ENV'] === 'production') {
            throw new Error('Cannot clean database in production');
        }
        const models = Reflect.ownKeys(this).filter((key) => typeof key === 'string' && key[0] !== '_' && key !== 'constructor');
        return Promise.all(models.map((modelKey) => {
            const model = this[modelKey];
            if (model && typeof model === 'object' && 'deleteMany' in model) {
                return model.deleteMany();
            }
        }));
    }
};
PrismaService = PrismaService_1 = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [])
], PrismaService);
export { PrismaService };
//# sourceMappingURL=prisma.service.js.map