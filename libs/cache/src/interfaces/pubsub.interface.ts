// ═══════════════════════════════════════════════════════════════════════════
// Pub/Sub Interface - Event-Driven Cache Communication
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Message handler callback type
 */
export type PubSubMessageHandler<T = unknown> = (message: T, channel: string) => void | Promise<void>;

/**
 * Pub/Sub subscription
 */
export interface PubSubSubscription {
  /** Subscription ID */
  id: string;
  /** Channel name */
  channel: string;
  /** Pattern subscription (if applicable) */
  pattern?: string;
  /** Unsubscribe function */
  unsubscribe: () => Promise<void>;
}

/**
 * Pub/Sub provider interface
 */
export interface IPubSubProvider {
  /**
   * Publish a message to a channel
   * @param channel - Channel name
   * @param message - Message to publish
   * @returns Number of subscribers that received the message
   */
  publish<T = unknown>(channel: string, message: T): Promise<number>;

  /**
   * Subscribe to a channel
   * @param channel - Channel name
   * @param handler - Message handler callback
   * @returns Subscription object
   */
  subscribe<T = unknown>(channel: string, handler: PubSubMessageHandler<T>): Promise<PubSubSubscription>;

  /**
   * Subscribe to channels matching a pattern
   * @param pattern - Channel pattern (e.g., "user:*")
   * @param handler - Message handler callback
   * @returns Subscription object
   */
  psubscribe<T = unknown>(pattern: string, handler: PubSubMessageHandler<T>): Promise<PubSubSubscription>;

  /**
   * Unsubscribe from a channel
   * @param channel - Channel name
   */
  unsubscribe(channel: string): Promise<void>;

  /**
   * Unsubscribe from a pattern
   * @param pattern - Channel pattern
   */
  punsubscribe(pattern: string): Promise<void>;

  /**
   * Get list of active subscriptions
   */
  getSubscriptions(): PubSubSubscription[];

  /**
   * Close all subscriptions
   */
  closeAll(): Promise<void>;
}

/**
 * Cache health with extended metrics
 */
export interface CacheHealth {
  /** Whether the cache is healthy */
  healthy: boolean;
  /** Provider type */
  provider: string;
  /** Latency in milliseconds */
  latencyMs: number;
  /** Error message if unhealthy */
  error?: string;
  /** Timestamp of the check */
  timestamp: Date;
  /** Extended metrics */
  metrics: CacheHealthMetrics;
}

/**
 * Extended health metrics
 */
export interface CacheHealthMetrics {
  /** Connection pool stats */
  connections?: {
    active: number;
    idle: number;
    total: number;
  };
  /** Memory usage */
  memory?: {
    used: number;
    peak: number;
    fragmentation?: number;
  };
  /** Replication info */
  replication?: {
    role: 'master' | 'slave' | 'standalone';
    connectedSlaves?: number;
    replicationLag?: number;
  };
  /** Cluster info */
  cluster?: {
    enabled: boolean;
    nodes?: number;
    slotsOk?: number;
    slotsFail?: number;
  };
  /** Operations per second */
  opsPerSecond?: number;
  /** Keyspace info */
  keyspace?: {
    keys: number;
    expires: number;
    avgTtl?: number;
  };
}
