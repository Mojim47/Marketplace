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
const __decorate =
  (this && this.__decorate) ||
  ((decorators, target, key, desc) => {
    const c = arguments.length;
    let r =
      c < 3 ? target : desc === null ? (desc = Object.getOwnPropertyDescriptor(target, key)) : desc;
    let d;
    if (typeof Reflect === 'object' && typeof Reflect.decorate === 'function') {
      r = Reflect.decorate(decorators, target, key, desc);
    } else {
      for (let i = decorators.length - 1; i >= 0; i--) {
        if ((d = decorators[i])) {
          r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
        }
      }
    }
    return c > 3 && r && Object.defineProperty(target, key, r), r;
  });
const __metadata =
  (this && this.__metadata) ||
  ((k, v) => {
    if (typeof Reflect === 'object' && typeof Reflect.metadata === 'function') {
      return Reflect.metadata(k, v);
    }
  });
import { Injectable } from '@nestjs/common';
// ═══════════════════════════════════════════════════════════════════════════
// Default Configuration
// ═══════════════════════════════════════════════════════════════════════════
const DEFAULT_CONFIG = {
  healthCheckInterval: 10000, // 10 seconds
  maxLagThreshold: 5, // 5 seconds
  enableLoadBalancing: true,
  connectionPoolSize: 10,
};
// ═══════════════════════════════════════════════════════════════════════════
// Read Replica Service
// ═══════════════════════════════════════════════════════════════════════════
let ReadReplicaService = class ReadReplicaService {
  createClient;
  config;
  primaryClient = null;
  replicaClients = new Map();
  replicaHealth = new Map();
  healthCheckInterval = null;
  currentReplicaIndex = 0;
  constructor(config, createClient) {
    this.createClient = createClient;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }
  async onModuleInit() {
    await this.initializeConnections();
    this.startHealthChecks();
  }
  async onModuleDestroy() {
    this.stopHealthChecks();
    await this.closeConnections();
  }
  /**
   * Get appropriate client based on query context
   */
  getClient(context = { isReadOnly: false, requiresConsistency: false }) {
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
  getPrimaryClient() {
    if (!this.primaryClient) {
      throw new Error('Primary database client not initialized');
    }
    return this.primaryClient;
  }
  /**
   * Get a read replica client
   */
  getReplicaClient(name) {
    if (name) {
      return this.replicaClients.get(name) ?? null;
    }
    return this.selectReplica();
  }
  /**
   * Execute a read query on replica
   */
  async executeRead(queryFn, options = {}) {
    const client = this.getClient({
      isReadOnly: true,
      requiresConsistency: options.requiresConsistency ?? false,
      preferredReplica: options.preferredReplica,
    });
    return queryFn(client);
  }
  /**
   * Execute a write query on primary
   */
  async executeWrite(queryFn) {
    return queryFn(this.getPrimaryClient());
  }
  /**
   * Get replica health status
   */
  getReplicaHealth() {
    return Array.from(this.replicaHealth.values());
  }
  /**
   * Get healthy replica count
   */
  getHealthyReplicaCount() {
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
  isDegraded() {
    return this.getHealthyReplicaCount() === 0;
  }
  // ═══════════════════════════════════════════════════════════════════════════
  // Private Methods
  // ═══════════════════════════════════════════════════════════════════════════
  async initializeConnections() {
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
  async closeConnections() {
    if (this.primaryClient) {
      await this.primaryClient.$disconnect();
    }
    for (const client of this.replicaClients.values()) {
      await client.$disconnect();
    }
  }
  selectReplica(preferredName) {
    // Try preferred replica first
    if (preferredName) {
      const health = this.replicaHealth.get(preferredName);
      if (health?.healthy) {
        return this.replicaClients.get(preferredName) ?? null;
      }
    }
    // Get healthy replicas
    const healthyReplicas = [];
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
    return this.replicaClients.get(healthyReplicas[this.currentReplicaIndex].name) ?? null;
  }
  selectByWeight(replicas) {
    const totalWeight = replicas.reduce((sum, r) => sum + r.weight, 0);
    let random = Math.random() * totalWeight;
    for (const replica of replicas) {
      random -= replica.weight;
      if (random <= 0) {
        return this.replicaClients.get(replica.name) ?? null;
      }
    }
    return this.replicaClients.get(replicas[0].name) ?? null;
  }
  startHealthChecks() {
    this.healthCheckInterval = setInterval(async () => {
      await this.checkReplicaHealth();
    }, this.config.healthCheckInterval);
  }
  stopHealthChecks() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }
  async checkReplicaHealth() {
    for (const [name, client] of this.replicaClients.entries()) {
      const health = this.replicaHealth.get(name);
      if (!health) {
        continue;
      }
      try {
        // Check connectivity and get replication lag
        const result = await client.$queryRaw`
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
};
ReadReplicaService = __decorate(
  [Injectable(), __metadata('design:paramtypes', [Object, Function])],
  ReadReplicaService
);
export { ReadReplicaService };
// ═══════════════════════════════════════════════════════════════════════════
// Query Router Decorator
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Decorator to mark a method as read-only (routes to replica)
 */
export function ReadOnly(options) {
  return (_target, _propertyKey, descriptor) => {
    const originalMethod = descriptor.value;
    descriptor.value = async function (...args) {
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
export function WriteOnly() {
  return (_target, _propertyKey, descriptor) => {
    const originalMethod = descriptor.value;
    descriptor.value = async function (...args) {
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
export function createReadReplicaService(config, createClient) {
  return new ReadReplicaService(config, createClient);
}
export default {
  ReadReplicaService,
  createReadReplicaService,
  ReadOnly,
  WriteOnly,
};
//# sourceMappingURL=read-replica.service.js.map
