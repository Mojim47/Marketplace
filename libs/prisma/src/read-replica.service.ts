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

import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { InternalError } from '@nextgen/errors';

// ═══════════════════════════════════════════════════════════════════════════
// Types and Interfaces
// ═══════════════════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════════════════
// Default Configuration
// ═══════════════════════════════════════════════════════════════════════════

const DEFAULT_CONFIG: Partial<ReadReplicaConfig> = {
  healthCheckInterval: 10000, // 10 seconds
  maxLagThreshold: 5, // 5 seconds
  enableLoadBalancing: true,
  connectionPoolSize: 10,
};

// ═══════════════════════════════════════════════════════════════════════════
// Read Replica Service
// ═══════════════════════════════════════════════════════════════════════════

@Injectable()
export class ReadReplicaService implements OnModuleInit, OnModuleDestroy {
  private config: ReadReplicaConfig;
  private primaryClient: PrismaClient | null = null;
  private replicaClients: Map<string, PrismaClient> = new Map();
  private replicaHealth: Map<string, ReplicaHealth> = new Map();
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private currentReplicaIndex = 0;

  constructor(
    config: ReadReplicaConfig,
    private readonly createClient: (url: string) => PrismaClient
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config } as ReadReplicaConfig;
  }

  async onModuleInit(): Promise<void> {
    await this.initializeConnections();
    this.startHealthChecks();
  }

  async onModuleDestroy(): Promise<void> {
    this.stopHealthChecks();
    await this.closeConnections();
  }

  /**
   * Get appropriate client based on query context
   */
  getClient(
    context: QueryContext = { isReadOnly: false, requiresConsistency: false }
  ): PrismaClient {
    // Always use primary for writes or when consistency is required
    if (!context.isReadOnly || context.requiresConsistency) {
      return this.getPrimaryClient();
    }

    // Try to get a healthy replica
    const replica = this.selectReplica(context.preferredReplica);
    if (replica) {
      return replica;
    }

    // Fallback to primary if no healthy replicas
    return this.getPrimaryClient();
  }

  /**
   * Get primary client (for writes)
   */
  getPrimaryClient(): PrismaClient {
    if (!this.primaryClient) {
      throw InternalError.database('Primary database client not initialized');
    }
    return this.primaryClient;
  }

  /**
   * Get a read replica client
   */
  getReplicaClient(name?: string): PrismaClient | null {
    if (name) {
      return this.replicaClients.get(name) ?? null;
    }
    return this.selectReplica();
  }

  /**
   * Execute a read query on replica
   */
  async executeRead<T>(
    queryFn: (client: PrismaClient) => Promise<T>,
    options: { requiresConsistency?: boolean; preferredReplica?: string } = {}
  ): Promise<T> {
    const context: QueryContext = {
      isReadOnly: true,
      requiresConsistency: options.requiresConsistency ?? false,
    };
    if (options.preferredReplica !== undefined) {
      context.preferredReplica = options.preferredReplica;
    }
    const client = this.getClient(context);

    return queryFn(client);
  }

  /**
   * Execute a write query on primary
   */
  async executeWrite<T>(queryFn: (client: PrismaClient) => Promise<T>): Promise<T> {
    return queryFn(this.getPrimaryClient());
  }

  /**
   * Get replica health status
   */
  getReplicaHealth(): ReplicaHealth[] {
    return Array.from(this.replicaHealth.values());
  }

  /**
   * Get healthy replica count
   */
  getHealthyReplicaCount(): number {
    let count = 0;
    for (const health of this.replicaHealth.values()) {
      if (health.healthy) {
        count++;
      }
    }
    return count;
  }

  /**
   * Check if system is in degraded mode (no healthy replicas)
   */
  isDegraded(): boolean {
    return this.getHealthyReplicaCount() === 0;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Private Methods
  // ═══════════════════════════════════════════════════════════════════════════

  private async initializeConnections(): Promise<void> {
    // Initialize primary connection
    this.primaryClient = this.createClient(this.config.primaryUrl);
    await this.primaryClient.$connect();

    // Initialize replica connections
    for (const replica of this.config.replicas) {
      try {
        const client = this.createClient(replica.url);
        await client.$connect();
        this.replicaClients.set(replica.name, client);

        this.replicaHealth.set(replica.name, {
          name: replica.name,
          url: replica.url,
          healthy: true,
          lagSeconds: 0,
          lastCheck: new Date(),
          consecutiveFailures: 0,
        });
      } catch (error) {
        console.error(`[ReadReplica] Failed to connect to replica ${replica.name}:`, error);

        this.replicaHealth.set(replica.name, {
          name: replica.name,
          url: replica.url,
          healthy: false,
          lagSeconds: -1,
          lastCheck: new Date(),
          consecutiveFailures: 1,
        });
      }
    }
  }

  private async closeConnections(): Promise<void> {
    if (this.primaryClient) {
      await this.primaryClient.$disconnect();
    }

    for (const client of this.replicaClients.values()) {
      await client.$disconnect();
    }
  }

  private selectReplica(preferredName?: string): PrismaClient | null {
    // Try preferred replica first
    if (preferredName) {
      const health = this.replicaHealth.get(preferredName);
      if (health?.healthy) {
        return this.replicaClients.get(preferredName) ?? null;
      }
    }

    // Get healthy replicas
    const healthyReplicas: Array<{ name: string; weight: number }> = [];
    for (const replica of this.config.replicas) {
      const health = this.replicaHealth.get(replica.name);
      if (health?.healthy && health.lagSeconds <= this.config.maxLagThreshold) {
        healthyReplicas.push({ name: replica.name, weight: replica.weight });
      }
    }

    if (healthyReplicas.length === 0) {
      return null;
    }

    // Load balancing
    if (this.config.enableLoadBalancing) {
      return this.selectByWeight(healthyReplicas);
    }

    // Round-robin
    this.currentReplicaIndex = (this.currentReplicaIndex + 1) % healthyReplicas.length;
    const replica = healthyReplicas[this.currentReplicaIndex];
    return replica ? (this.replicaClients.get(replica.name) ?? null) : null;
  }

  private selectByWeight(replicas: Array<{ name: string; weight: number }>): PrismaClient | null {
    const totalWeight = replicas.reduce((sum, r) => sum + r.weight, 0);
    let random = Math.random() * totalWeight;

    for (const replica of replicas) {
      random -= replica.weight;
      if (random <= 0) {
        return this.replicaClients.get(replica.name) ?? null;
      }
    }

    const firstReplica = replicas[0];
    return firstReplica ? (this.replicaClients.get(firstReplica.name) ?? null) : null;
  }

  private startHealthChecks(): void {
    this.healthCheckInterval = setInterval(async () => {
      await this.checkReplicaHealth();
    }, this.config.healthCheckInterval);
  }

  private stopHealthChecks(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  private async checkReplicaHealth(): Promise<void> {
    for (const [name, client] of this.replicaClients.entries()) {
      const health = this.replicaHealth.get(name);
      if (!health) {
        continue;
      }

      try {
        // Check connectivity and get replication lag
        const result = await client.$queryRaw<Array<{ lag_seconds: number }>>`
          SELECT EXTRACT(EPOCH FROM (NOW() - pg_last_xact_replay_timestamp()))::integer as lag_seconds
        `;

        const lagSeconds = result[0]?.lag_seconds ?? 0;

        health.healthy = lagSeconds <= this.config.maxLagThreshold;
        health.lagSeconds = lagSeconds;
        health.lastCheck = new Date();
        health.consecutiveFailures = 0;

        if (!health.healthy) {
          console.warn(`[ReadReplica] Replica ${name} has high lag: ${lagSeconds}s`);
        }
      } catch (_error) {
        health.consecutiveFailures++;
        health.lastCheck = new Date();

        if (health.consecutiveFailures >= 3) {
          health.healthy = false;
          console.error(
            `[ReadReplica] Replica ${name} marked unhealthy after ${health.consecutiveFailures} failures`
          );
        }
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Query Router Decorator
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Decorator to mark a method as read-only (routes to replica)
 */
export function ReadOnly(options?: { requiresConsistency?: boolean }): MethodDecorator {
  return (
    _target: object,
    _propertyKey: string | symbol,
    descriptor: PropertyDescriptor
  ): PropertyDescriptor => {
    const originalMethod = descriptor.value;

    descriptor.value = async function (
      this: { readReplicaService?: ReadReplicaService },
      ...args: unknown[]
    ) {
      const service = this.readReplicaService;
      if (!service) {
        return originalMethod.apply(this, args);
      }

      const client = service.getClient({
        isReadOnly: true,
        requiresConsistency: options?.requiresConsistency ?? false,
      });

      // Inject client into method context if needed
      return originalMethod.apply(this, [...args, client]);
    };

    return descriptor;
  };
}

/**
 * Decorator to mark a method as write (routes to primary)
 */
export function WriteOnly(): MethodDecorator {
  return (
    _target: object,
    _propertyKey: string | symbol,
    descriptor: PropertyDescriptor
  ): PropertyDescriptor => {
    const originalMethod = descriptor.value;

    descriptor.value = async function (
      this: { readReplicaService?: ReadReplicaService },
      ...args: unknown[]
    ) {
      const service = this.readReplicaService;
      if (!service) {
        return originalMethod.apply(this, args);
      }

      const client = service.getPrimaryClient();
      return originalMethod.apply(this, [...args, client]);
    };

    return descriptor;
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Factory Function
// ═══════════════════════════════════════════════════════════════════════════

export function createReadReplicaService(
  config: ReadReplicaConfig,
  createClient: (url: string) => PrismaClient
): ReadReplicaService {
  return new ReadReplicaService(config, createClient);
}

export default {
  ReadReplicaService,
  createReadReplicaService,
  ReadOnly,
  WriteOnly,
};
