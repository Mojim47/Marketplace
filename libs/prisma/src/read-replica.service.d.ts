/**
 * ═══════════════════════════════════════════════════════════════════════════
 * NextGen Marketplace - Read Replica Routing Service
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Enterprise database optimization with read replica routing.
 * Automatically routes read queries to replicas for better performance.
 *
 * Features:
 * - Automatic read/write query routing
 * - Connection pooling with PgBouncer support
 * - Health-based replica selection
 * - Lag-aware routing
 * - Failover support
 *
 * @module @nextgen/prisma
 */
import { OnModuleInit, OnModuleDestroy } from '@nestjs/common';
export interface ReplicaConfig {
    url: string;
    name: string;
    weight: number;
    maxLagSeconds: number;
}
export interface ReadReplicaConfig {
    primaryUrl: string;
    replicas: ReplicaConfig[];
    healthCheckInterval: number;
    maxLagThreshold: number;
    enableLoadBalancing: boolean;
    connectionPoolSize: number;
}
export interface ReplicaHealth {
    name: string;
    url: string;
    healthy: boolean;
    lagSeconds: number;
    lastCheck: Date;
    consecutiveFailures: number;
}
export interface QueryContext {
    isReadOnly: boolean;
    requiresConsistency: boolean;
    preferredReplica?: string;
}
export interface PrismaClient {
    $queryRaw<T = unknown>(query: TemplateStringsArray, ...values: unknown[]): Promise<T>;
    $executeRaw(query: TemplateStringsArray, ...values: unknown[]): Promise<number>;
    $connect(): Promise<void>;
    $disconnect(): Promise<void>;
}
export declare class ReadReplicaService implements OnModuleInit, OnModuleDestroy {
    private readonly createClient;
    private config;
    private primaryClient;
    private replicaClients;
    private replicaHealth;
    private healthCheckInterval;
    private currentReplicaIndex;
    constructor(config: ReadReplicaConfig, createClient: (url: string) => PrismaClient);
    onModuleInit(): Promise<void>;
    onModuleDestroy(): Promise<void>;
    /**
     * Get appropriate client based on query context
     */
    getClient(context?: QueryContext): PrismaClient;
    /**
     * Get primary client (for writes)
     */
    getPrimaryClient(): PrismaClient;
    /**
     * Get a read replica client
     */
    getReplicaClient(name?: string): PrismaClient | null;
    /**
     * Execute a read query on replica
     */
    executeRead<T>(queryFn: (client: PrismaClient) => Promise<T>, options?: {
        requiresConsistency?: boolean;
        preferredReplica?: string;
    }): Promise<T>;
    /**
     * Execute a write query on primary
     */
    executeWrite<T>(queryFn: (client: PrismaClient) => Promise<T>): Promise<T>;
    /**
     * Get replica health status
     */
    getReplicaHealth(): ReplicaHealth[];
    /**
     * Get healthy replica count
     */
    getHealthyReplicaCount(): number;
    /**
     * Check if system is in degraded mode (no healthy replicas)
     */
    isDegraded(): boolean;
    private initializeConnections;
    private closeConnections;
    private selectReplica;
    private selectByWeight;
    private startHealthChecks;
    private stopHealthChecks;
    private checkReplicaHealth;
}
/**
 * Decorator to mark a method as read-only (routes to replica)
 */
export declare function ReadOnly(options?: {
    requiresConsistency?: boolean;
}): MethodDecorator;
/**
 * Decorator to mark a method as write (routes to primary)
 */
export declare function WriteOnly(): MethodDecorator;
export declare function createReadReplicaService(config: ReadReplicaConfig, createClient: (url: string) => PrismaClient): ReadReplicaService;
declare const _default: {
    ReadReplicaService: typeof ReadReplicaService;
    createReadReplicaService: typeof createReadReplicaService;
    ReadOnly: typeof ReadOnly;
    WriteOnly: typeof WriteOnly;
};
export default _default;
//# sourceMappingURL=read-replica.service.d.ts.map