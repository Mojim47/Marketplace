/**
 * Products CQRS Service - CQRS Pattern Implementation
 * Enterprise Scalability Architecture
 * Requirements: 3.1, 3.2, 5.1
 *
 * Features:
 * - Write operations go to PostgreSQL (Write_DB)
 * - Read operations go to MeiliSearch (Read_DB)
 * - Transactional outbox for event publishing
 * - Circuit breaker for Read_DB fault tolerance
 */

import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import type {
  DomainEvent,
  ListOptions,
  PaginatedResult,
  SearchQuery,
  SearchResult,
} from '@nextgen/cqrs';
import { MeiliSearch } from 'meilisearch';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../database/prisma.service';

/** Product entity interface */
interface Product {
  id: string;
  name: string;
  slug: string;
  sku: string;
  description?: string;
  price: number;
  salePrice?: number;
  stock: number;
  status: 'DRAFT' | 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
  categoryId?: string;
  vendorId: string;
  images: string[];
  createdAt: Date;
  updatedAt: Date;
}

/** Create product DTO */
interface CreateProductDTO {
  name: string;
  slug?: string;
  sku?: string;
  description?: string;
  price: number;
  salePrice?: number;
  stock?: number;
  categoryId?: string;
  images?: string[];
}

/** Update product DTO */
interface UpdateProductDTO {
  name?: string;
  slug?: string;
  description?: string;
  price?: number;
  salePrice?: number;
  stock?: number;
  status?: 'DRAFT' | 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
  categoryId?: string;
  images?: string[];
}

/** Circuit breaker state */
interface CircuitBreakerState {
  state: 'closed' | 'open' | 'half-open';
  failures: number;
  lastFailureTime: Date | null;
  successCount: number;
}

@Injectable()
export class ProductsCqrsService implements OnModuleInit {
  private readonly logger = new Logger(ProductsCqrsService.name);
  private meiliClient: MeiliSearch | null = null;
  private circuitBreaker: CircuitBreakerState = {
    state: 'closed',
    failures: 0,
    lastFailureTime: null,
    successCount: 0,
  };
  private readonly FAILURE_THRESHOLD = 5;
  private readonly RESET_TIMEOUT_MS = 30000;
  private readonly HALF_OPEN_REQUESTS = 3;
  private readonly INDEX_NAME = 'products';

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    // Initialize MeiliSearch client
    const meiliHost = process.env.MEILISEARCH_HOST;
    const meiliKey = process.env.MEILISEARCH_API_KEY || '';

    if (!meiliHost) {
      this.logger.warn('MEILISEARCH_HOST not configured, using PostgreSQL for reads');
      return;
    }

    try {
      this.meiliClient = new MeiliSearch({ host: meiliHost, apiKey: meiliKey });

      // Configure index settings
      const index = this.meiliClient.index(this.INDEX_NAME);
      await index.updateSettings({
        searchableAttributes: ['name', 'description', 'sku'],
        filterableAttributes: ['status', 'categoryId', 'vendorId', 'price'],
        sortableAttributes: ['price', 'createdAt', 'name'],
      });

      this.logger.log('MeiliSearch client initialized');
    } catch (error) {
      this.logger.warn('MeiliSearch not available, using PostgreSQL for reads');
    }
  }

  /**
   * Create product - Write to PostgreSQL with Outbox
   * Property 10: Write Operation Routing
   */
  async create(vendorId: string, data: CreateProductDTO): Promise<Product> {
    const productId = uuidv4();
    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      // Create product in Write_DB
      const product = await tx.product.create({
        data: {
          id: productId,
          name: data.name,
          slug: data.slug || data.name.toLowerCase().replace(/\s+/g, '-'),
          sku: data.sku || `SKU-${Date.now()}`,
          description: data.description || '',
          price: data.price,
          salePrice: data.salePrice,
          stock: data.stock || 0,
          status: 'DRAFT',
          categoryId: data.categoryId,
          vendorId,
          images: data.images || [],
        },
        include: { category: true, vendor: { select: { businessName: true } } },
      });

      // Write event to outbox (atomic with product creation)
      const event = this.createDomainEvent('Product', productId, 'product.created', {
        product: product as unknown as Record<string, unknown>,
      });
      await this.writeToOutbox(tx, event);

      return product as unknown as Product;
    });
  }

  /**
   * Update product - Write to PostgreSQL with Outbox
   * Property 10: Write Operation Routing
   */
  async update(id: string, vendorId: string, data: UpdateProductDTO): Promise<Product> {
    return this.prisma.$transaction(async (tx) => {
      // Verify ownership
      const existing = await tx.product.findFirst({ where: { id, vendorId } });
      if (!existing) {
        throw new NotFoundException('����� ���� ��� �� ������ ������');
      }

      // Update in Write_DB
      const product = await tx.product.update({
        where: { id },
        data,
        include: { category: true },
      });

      // Write event to outbox
      const event = this.createDomainEvent('Product', id, 'product.updated', {
        product: product as unknown as Record<string, unknown>,
        changes: data as unknown as Record<string, unknown>,
      });
      await this.writeToOutbox(tx, event);

      return product as unknown as Product;
    });
  }

  /**
   * Delete product - Write to PostgreSQL with Outbox
   * Property 10: Write Operation Routing
   */
  async delete(id: string, vendorId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      // Verify ownership
      const existing = await tx.product.findFirst({ where: { id, vendorId } });
      if (!existing) {
        throw new NotFoundException('����� ���� ��� �� ������ ������');
      }

      // Delete from Write_DB
      await tx.product.delete({ where: { id } });

      // Write event to outbox
      const event = this.createDomainEvent('Product', id, 'product.deleted', { id });
      await this.writeToOutbox(tx, event);
    });
  }

  /**
   * Search products - Read from MeiliSearch (Read_DB)
   * Property 11: Read Operation Routing
   * Property 13: Read Circuit Breaker Behavior
   */
  async search(query: SearchQuery): Promise<SearchResult<Product>> {
    return this.executeWithCircuitBreaker(
      async () => {
        if (!this.meiliClient) {
          throw new Error('MeiliSearch not available');
        }

        const index = this.meiliClient.index(this.INDEX_NAME);
        const options: Record<string, unknown> = {
          limit: query.limit || 20,
          offset: query.offset || 0,
        };

        if (query.filters) {
          options.filter = this.buildFilterString(query.filters);
        }

        if (query.sort && query.sort.length > 0) {
          options.sort = query.sort.map((s) => `${s.field}:${s.direction}`);
        }

        const response = await index.search(query.query, options);

        return {
          hits: response.hits as Product[],
          totalHits: response.estimatedTotalHits || 0,
          processingTimeMs: response.processingTimeMs,
          query: response.query,
        };
      },
      // Fallback: return empty result, never route to Write_DB
      () => ({
        hits: [],
        totalHits: 0,
        processingTimeMs: 0,
        query: query.query,
      })
    );
  }

  /**
   * List products with pagination - Read from MeiliSearch
   * Property 11: Read Operation Routing
   */
  async list(options: ListOptions): Promise<PaginatedResult<Product>> {
    const page = options.page || 1;
    const pageSize = options.pageSize || 20;

    return this.executeWithCircuitBreaker(
      async () => {
        if (!this.meiliClient) {
          throw new Error('MeiliSearch not available');
        }

        const index = this.meiliClient.index(this.INDEX_NAME);
        const searchOptions: Record<string, unknown> = {
          limit: pageSize,
          offset: (page - 1) * pageSize,
        };

        if (options.filters) {
          searchOptions.filter = this.buildFilterString(options.filters);
        }

        if (options.sort && options.sort.length > 0) {
          searchOptions.sort = options.sort.map((s) => `${s.field}:${s.direction}`);
        }

        const response = await index.search('', searchOptions);
        const total = response.estimatedTotalHits || 0;

        return {
          items: response.hits as Product[],
          total,
          page,
          pageSize,
          totalPages: Math.ceil(total / pageSize),
        };
      },
      // Fallback: return empty result
      () => ({
        items: [],
        total: 0,
        page,
        pageSize,
        totalPages: 0,
      })
    );
  }

  /**
   * Find product by ID - Read from MeiliSearch with fallback
   * Property 11: Read Operation Routing
   */
  async findOne(id: string): Promise<Product> {
    const product = await this.executeWithCircuitBreaker(
      async () => {
        if (!this.meiliClient) {
          throw new Error('MeiliSearch not available');
        }

        const index = this.meiliClient.index(this.INDEX_NAME);
        return (await index.getDocument(id)) as Product;
      },
      // Fallback: return null (will throw NotFoundException)
      () => null
    );

    if (!product) {
      throw new NotFoundException('����� ���� ���');
    }

    return product;
  }

  /**
   * Find all products with filters - Read from MeiliSearch
   * Property 11: Read Operation Routing
   */
  async findAll(filters?: { status?: string; categoryId?: string; search?: string }): Promise<
    Product[]
  > {
    const result = await this.search({
      query: filters?.search || '',
      filters: {
        ...(filters?.status && { status: filters.status }),
        ...(filters?.categoryId && { categoryId: filters.categoryId }),
      },
      limit: 100,
    });

    return result.hits;
  }

  /**
   * Update stock - Write to PostgreSQL with Outbox
   */
  async updateStock(id: string, quantity: number): Promise<Product> {
    return this.prisma.$transaction(async (tx) => {
      const product = await tx.product.update({
        where: { id },
        data: { stock: quantity },
      });

      const event = this.createDomainEvent('Product', id, 'product.stock_updated', {
        productId: id,
        newStock: quantity,
      });
      await this.writeToOutbox(tx, event);

      return product as unknown as Product;
    });
  }

  /**
   * Get circuit breaker state
   */
  getCircuitBreakerState(): CircuitBreakerState {
    return { ...this.circuitBreaker };
  }

  /**
   * Check if Read_DB is healthy
   */
  async isReadDbHealthy(): Promise<boolean> {
    if (!this.meiliClient) return false;
    try {
      const health = await this.meiliClient.health();
      return health.status === 'available';
    } catch {
      return false;
    }
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Execute operation with circuit breaker
   * Property 13: Read Circuit Breaker Behavior
   */
  private async executeWithCircuitBreaker<T>(
    operation: () => Promise<T>,
    fallback: () => T
  ): Promise<T> {
    // Check if circuit is open
    if (this.isCircuitOpen()) {
      this.logger.warn('Circuit breaker is open, returning fallback');
      return fallback();
    }

    try {
      const result = await operation();
      this.recordSuccess();
      return result;
    } catch (error) {
      this.recordFailure();
      this.logger.warn(`Read operation failed, using fallback: ${error}`);
      return fallback();
    }
  }

  private isCircuitOpen(): boolean {
    if (this.circuitBreaker.state === 'open') {
      if (this.circuitBreaker.lastFailureTime) {
        const elapsed = Date.now() - this.circuitBreaker.lastFailureTime.getTime();
        if (elapsed >= this.RESET_TIMEOUT_MS) {
          this.circuitBreaker.state = 'half-open';
          this.circuitBreaker.successCount = 0;
          return false;
        }
      }
      return true;
    }
    return false;
  }

  private recordSuccess(): void {
    if (this.circuitBreaker.state === 'half-open') {
      this.circuitBreaker.successCount++;
      if (this.circuitBreaker.successCount >= this.HALF_OPEN_REQUESTS) {
        this.circuitBreaker.state = 'closed';
        this.circuitBreaker.failures = 0;
        this.circuitBreaker.lastFailureTime = null;
      }
    } else if (this.circuitBreaker.state === 'closed') {
      this.circuitBreaker.failures = 0;
    }
  }

  private recordFailure(): void {
    this.circuitBreaker.failures++;
    this.circuitBreaker.lastFailureTime = new Date();

    if (this.circuitBreaker.state === 'half-open') {
      this.circuitBreaker.state = 'open';
    } else if (this.circuitBreaker.failures >= this.FAILURE_THRESHOLD) {
      this.circuitBreaker.state = 'open';
    }
  }

  /**
   * Create domain event
   */
  private createDomainEvent(
    aggregateType: string,
    aggregateId: string,
    eventType: string,
    payload: Record<string, unknown>
  ): DomainEvent {
    return {
      id: uuidv4(),
      aggregateType,
      aggregateId,
      eventType,
      payload,
      timestamp: new Date(),
      version: 1,
    };
  }

  /**
   * Write event to outbox table
   * Property 20: Atomic Outbox Write
   */
  private async writeToOutbox(tx: any, event: DomainEvent): Promise<void> {
    await tx.$executeRaw`
      INSERT INTO outbox_messages (id, aggregate_type, aggregate_id, event_type, payload, created_at, processed_at, retry_count, status)
      VALUES (
        ${event.id}::uuid, 
        ${event.aggregateType}, 
        ${event.aggregateId}, 
        ${event.eventType}, 
        ${JSON.stringify(event.payload)}::jsonb, 
        ${event.timestamp}, 
        NULL, 
        0, 
        'pending'
      )
    `;
  }

  /**
   * Build MeiliSearch filter string
   */
  private buildFilterString(filters: Record<string, unknown>): string {
    const conditions: string[] = [];

    for (const [key, value] of Object.entries(filters)) {
      if (value === null || value === undefined) continue;

      if (Array.isArray(value)) {
        const values = value.map((v) => (typeof v === 'string' ? `"${v}"` : v)).join(', ');
        conditions.push(`${key} IN [${values}]`);
      } else if (typeof value === 'string') {
        conditions.push(`${key} = "${value}"`);
      } else {
        conditions.push(`${key} = ${value}`);
      }
    }

    return conditions.join(' AND ');
  }
}
