// ═══════════════════════════════════════════════════════════════════════════
// E2E Scenario Engine - Critical Business Flow Validation
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { Logger } from '@nestjs/common';

const logger = new Logger('ScenarioEngine');
import { hash } from 'bcryptjs';

interface ScenarioResult {
  scenarioName: string;
  success: boolean;
  duration: number;
  steps: StepResult[];
  error?: string;
}

interface StepResult {
  stepName: string;
  success: boolean;
  duration: number;
  data?: any;
  error?: string;
}

interface TestTenant {
  id: string;
  slug: string;
  name: string;
  adminUser: TestUser;
  sellerUser: TestUser;
  buyerUser: TestUser;
}

interface TestUser {
  id: string;
  email: string;
  password: string;
  roles: string[];
  token?: string;
}

class E2EScenarioEngine {
  private prisma: PrismaClient;
  private apiBaseUrl: string;
  private testTenant: TestTenant | null = null;

  constructor() {
    this.prisma = new PrismaClient();
    this.apiBaseUrl = process.env.API_URL || 'http://localhost:3001/api/v3';
  }

  async setupTestEnvironment(): Promise<void> {
    logger.log('🏗️ Setting up E2E test environment...');

    // Create test tenant
    const tenantId = `tenant_e2e_${Date.now()}`;
    const tenant = await this.prisma.tenant.create({
      data: {
        id: tenantId,
        slug: `e2e-test-${Date.now()}`,
        name: 'E2E Test Tenant',
        status: 'ACTIVE',
        settings: {
          currency: 'IRR',
          language: 'fa',
          features: {
            ar: true,
            ai: true,
            b2b: true,
            moodian: true,
          },
        },
        created_by: 'e2e-system',
        updated_by: 'e2e-system',
      },
    });

    // Set RLS context
    await this.prisma.$executeRaw`
      SELECT set_security_context(${tenantId}, 'e2e-system', ARRAY['ADMIN'])
    `;

    // Create test users
    const adminUser = await this.createTestUser(tenantId, 'admin', ['ADMIN']);
    const sellerUser = await this.createTestUser(tenantId, 'seller', ['SELLER']);
    const buyerUser = await this.createTestUser(tenantId, 'buyer', ['USER']);

    this.testTenant = {
      id: tenantId,
      slug: tenant.slug,
      name: tenant.name,
      adminUser,
      sellerUser,
      buyerUser,
    };

    logger.log(`✅ Test environment ready: ${tenant.slug}`);
  }

  async cleanupTestEnvironment(): Promise<void> {
    if (this.testTenant) {
      logger.log('🧹 Cleaning up E2E test environment...');
      
      // Delete test tenant and all related data (CASCADE)
      await this.prisma.tenant.delete({
        where: { id: this.testTenant.id },
      });
      
      logger.log('✅ Test environment cleaned up');
    }
  }

  /**
   * Scenario 1: Complete Product Lifecycle
   */
  async runProductLifecycleScenario(): Promise<ScenarioResult> {
    const scenarioName = 'Product Lifecycle';
    const startTime = Date.now();
    const steps: StepResult[] = [];

    try {
      // Step 1: Seller creates product
      const createProductStep = await this.executeStep('Create Product', async () => {
        const response = await fetch(`${this.apiBaseUrl}/products`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Tenant-ID': this.testTenant!.id,
            'X-User-ID': this.testTenant!.sellerUser.id,
            'X-User-Roles': 'SELLER',
          },
          body: JSON.stringify({
            sku: `E2E-PRODUCT-${Date.now()}`,
            name: 'محصول تست E2E',
            description: 'این محصول برای تست E2E ایجاد شده است',
            price: 150000,
            stock: 10,
            metadata: {
              category: 'electronics',
              brand: 'TestBrand',
              ar_model: 'test_product.glb',
            },
          }),
        });

        if (!response.ok) {
          throw new Error(`Product creation failed: ${response.statusText}`);
        }

        return await response.json();
      });
      steps.push(createProductStep);

      // Step 2: Verify product is visible to buyers
      const viewProductStep = await this.executeStep('View Product', async () => {
        const productId = createProductStep.data.data.id;
        
        const response = await fetch(`${this.apiBaseUrl}/products/${productId}`, {
          headers: {
            'X-Tenant-ID': this.testTenant!.id,
            'X-User-ID': this.testTenant!.buyerUser.id,
            'X-User-Roles': 'USER',
          },
        });

        if (!response.ok) {
          throw new Error(`Product view failed: ${response.statusText}`);
        }

        return await response.json();
      });
      steps.push(viewProductStep);

      // Step 3: Update product inventory
      const updateInventoryStep = await this.executeStep('Update Inventory', async () => {
        const productId = createProductStep.data.data.id;
        
        const response = await fetch(`${this.apiBaseUrl}/products/${productId}/inventory`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'X-Tenant-ID': this.testTenant!.id,
            'X-User-ID': this.testTenant!.sellerUser.id,
            'X-User-Roles': 'SELLER',
          },
          body: JSON.stringify({
            stock: 15,
            reserved: 2,
          }),
        });

        if (!response.ok) {
          throw new Error(`Inventory update failed: ${response.statusText}`);
        }

        return await response.json();
      });
      steps.push(updateInventoryStep);

      // Step 4: Search for product
      const searchProductStep = await this.executeStep('Search Product', async () => {
        const response = await fetch(`${this.apiBaseUrl}/products/search?q=تست`, {
          headers: {
            'X-Tenant-ID': this.testTenant!.id,
            'X-User-ID': this.testTenant!.buyerUser.id,
            'X-User-Roles': 'USER',
          },
        });

        if (!response.ok) {
          throw new Error(`Product search failed: ${response.statusText}`);
        }

        return await response.json();
      });
      steps.push(searchProductStep);

      const duration = Date.now() - startTime;
      const success = steps.every(step => step.success);

      return {
        scenarioName,
        success,
        duration,
        steps,
      };

    } catch (error) {
      return {
        scenarioName,
        success: false,
        duration: Date.now() - startTime,
        steps,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Scenario 2: Complete Order Flow
   */
  async runOrderFlowScenario(): Promise<ScenarioResult> {
    const scenarioName = 'Complete Order Flow';
    const startTime = Date.now();
    const steps: StepResult[] = [];

    try {
      // Step 1: Create product first
      const product = await this.createTestProduct();

      // Step 2: Create order
      const createOrderStep = await this.executeStep('Create Order', async () => {
        const response = await fetch(`${this.apiBaseUrl}/orders`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Tenant-ID': this.testTenant!.id,
            'X-User-ID': this.testTenant!.buyerUser.id,
            'X-User-Roles': 'USER',
          },
          body: JSON.stringify({
            items: [
              {
                productId: product.id,
                quantity: 2,
                unitPrice: product.price,
              },
            ],
            shippingAddress: {
              city: 'تهران',
              address: 'خیابان ولیعصر، پلاک ۱۲۳',
              postalCode: '1234567890',
            },
          }),
        });

        if (!response.ok) {
          throw new Error(`Order creation failed: ${response.statusText}`);
        }

        return await response.json();
      });
      steps.push(createOrderStep);

      // Step 3: View order
      const viewOrderStep = await this.executeStep('View Order', async () => {
        const orderId = createOrderStep.data.data.id;
        
        const response = await fetch(`${this.apiBaseUrl}/orders/${orderId}`, {
          headers: {
            'X-Tenant-ID': this.testTenant!.id,
            'X-User-ID': this.testTenant!.buyerUser.id,
            'X-User-Roles': 'USER',
          },
        });

        if (!response.ok) {
          throw new Error(`Order view failed: ${response.statusText}`);
        }

        return await response.json();
      });
      steps.push(viewOrderStep);

      // Step 4: Update order status (seller)
      const updateOrderStep = await this.executeStep('Update Order Status', async () => {
        const orderId = createOrderStep.data.data.id;
        
        const response = await fetch(`${this.apiBaseUrl}/orders/${orderId}/status`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'X-Tenant-ID': this.testTenant!.id,
            'X-User-ID': this.testTenant!.sellerUser.id,
            'X-User-Roles': 'SELLER',
          },
          body: JSON.stringify({
            status: 'CONFIRMED',
            notes: 'سفارش تأیید شد',
          }),
        });

        if (!response.ok) {
          throw new Error(`Order status update failed: ${response.statusText}`);
        }

        return await response.json();
      });
      steps.push(updateOrderStep);

      // Step 5: Process payment
      const processPaymentStep = await this.executeStep('Process Payment', async () => {
        const orderId = createOrderStep.data.data.id;
        
        // This would integrate with actual payment gateway in production
        const response = await fetch(`${this.apiBaseUrl}/payments`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Tenant-ID': this.testTenant!.id,
            'X-User-ID': this.testTenant!.buyerUser.id,
            'X-User-Roles': 'USER',
          },
          body: JSON.stringify({
            orderId,
            amount: createOrderStep.data.data.total,
            gateway: 'zarinpal',
            paymentMethod: 'card',
          }),
        });

        if (!response.ok) {
          throw new Error(`Payment processing failed: ${response.statusText}`);
        }

        return await response.json();
      });
      steps.push(processPaymentStep);

      const duration = Date.now() - startTime;
      const success = steps.every(step => step.success);

      return {
        scenarioName,
        success,
        duration,
        steps,
      };

    } catch (error) {
      return {
        scenarioName,
        success: false,
        duration: Date.now() - startTime,
        steps,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Scenario 3: Multi-Tenant Isolation Test
   */
  async runTenantIsolationScenario(): Promise<ScenarioResult> {
    const scenarioName = 'Multi-Tenant Isolation';
    const startTime = Date.now();
    const steps: StepResult[] = [];

    try {
      // Step 1: Create product in tenant A
      const createProductTenantAStep = await this.executeStep('Create Product Tenant A', async () => {
        const response = await fetch(`${this.apiBaseUrl}/products`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Tenant-ID': this.testTenant!.id,
            'X-User-ID': this.testTenant!.sellerUser.id,
            'X-User-Roles': 'SELLER',
          },
          body: JSON.stringify({
            sku: `TENANT-A-${Date.now()}`,
            name: 'محصول تنانت A',
            price: 100000,
            stock: 5,
          }),
        });

        if (!response.ok) {
          throw new Error(`Product creation failed: ${response.statusText}`);
        }

        return await response.json();
      });
      steps.push(createProductTenantAStep);

      // Step 2: Create second tenant
      const tenantBId = `tenant_b_${Date.now()}`;
      await this.prisma.tenant.create({
        data: {
          id: tenantBId,
          slug: `tenant-b-${Date.now()}`,
          name: 'Tenant B',
          status: 'ACTIVE',
          settings: {},
          created_by: 'e2e-system',
          updated_by: 'e2e-system',
        },
      });

      const userB = await this.createTestUser(tenantBId, 'user-b', ['USER']);

      // Step 3: Try to access Tenant A's product from Tenant B (should fail)
      const crossTenantAccessStep = await this.executeStep('Cross-Tenant Access Test', async () => {
        const productId = createProductTenantAStep.data.data.id;
        
        const response = await fetch(`${this.apiBaseUrl}/products/${productId}`, {
          headers: {
            'X-Tenant-ID': tenantBId, // Different tenant
            'X-User-ID': userB.id,
            'X-User-Roles': 'USER',
          },
        });

        // Should return 404 or empty result due to RLS
        if (response.status === 404) {
          return { isolated: true, message: 'Product not accessible from different tenant' };
        } else if (response.ok) {
          const data = await response.json();
          if (!data.data) {
            return { isolated: true, message: 'RLS working - no data returned' };
          } else {
            throw new Error('SECURITY VIOLATION: Cross-tenant data leak detected!');
          }
        } else {
          throw new Error(`Unexpected response: ${response.statusText}`);
        }
      });
      steps.push(crossTenantAccessStep);

      // Step 4: Verify Tenant B can access its own data
      const tenantBDataStep = await this.executeStep('Tenant B Own Data Access', async () => {
        const response = await fetch(`${this.apiBaseUrl}/products`, {
          headers: {
            'X-Tenant-ID': tenantBId,
            'X-User-ID': userB.id,
            'X-User-Roles': 'USER',
          },
        });

        if (!response.ok) {
          throw new Error(`Tenant B data access failed: ${response.statusText}`);
        }

        const data = await response.json();
        return { productCount: data.data?.length || 0, message: 'Tenant B can access own data' };
      });
      steps.push(tenantBDataStep);

      // Cleanup tenant B
      await this.prisma.tenant.delete({ where: { id: tenantBId } });

      const duration = Date.now() - startTime;
      const success = steps.every(step => step.success);

      return {
        scenarioName,
        success,
        duration,
        steps,
      };

    } catch (error) {
      return {
        scenarioName,
        success: false,
        duration: Date.now() - startTime,
        steps,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Scenario 4: AR Streaming Test
   */
  async runARStreamingScenario(): Promise<ScenarioResult> {
    const scenarioName = 'AR Streaming';
    const startTime = Date.now();
    const steps: StepResult[] = [];

    try {
      // Step 1: Create product with AR model
      const createARProductStep = await this.executeStep('Create AR Product', async () => {
        const response = await fetch(`${this.apiBaseUrl}/products`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Tenant-ID': this.testTenant!.id,
            'X-User-ID': this.testTenant!.sellerUser.id,
            'X-User-Roles': 'SELLER',
          },
          body: JSON.stringify({
            sku: `AR-PRODUCT-${Date.now()}`,
            name: 'محصول AR تست',
            price: 200000,
            stock: 3,
            metadata: {
              ar_enabled: true,
              ar_model: 'test_ar_model.glb',
              ar_scale: 1.0,
              ar_position: [0, 0, 0],
            },
          }),
        });

        if (!response.ok) {
          throw new Error(`AR product creation failed: ${response.statusText}`);
        }

        return await response.json();
      });
      steps.push(createARProductStep);

      // Step 2: Request AR model streaming
      const streamARModelStep = await this.executeStep('Stream AR Model', async () => {
        const productId = createARProductStep.data.data.id;
        
        // Simulate AR model streaming request
        const response = await fetch(`${this.apiBaseUrl}/ar/models/${productId}/stream`, {
          headers: {
            'X-Tenant-ID': this.testTenant!.id,
            'X-User-ID': this.testTenant!.buyerUser.id,
            'X-User-Roles': 'USER',
            'Accept': 'application/octet-stream',
          },
        });

        // In a real implementation, this would stream the 3D model
        if (response.status === 200 || response.status === 206) { // 206 for partial content
          return { 
            streaming: true, 
            contentType: response.headers.get('content-type'),
            contentLength: response.headers.get('content-length'),
          };
        } else {
          throw new Error(`AR streaming failed: ${response.statusText}`);
        }
      });
      steps.push(streamARModelStep);

      // Step 3: Cache AR model for faster access
      const cacheARModelStep = await this.executeStep('Cache AR Model', async () => {
        const productId = createARProductStep.data.data.id;
        
        // Simulate AR model caching
        const response = await fetch(`${this.apiBaseUrl}/ar/models/${productId}/cache`, {
          method: 'POST',
          headers: {
            'X-Tenant-ID': this.testTenant!.id,
            'X-User-ID': this.testTenant!.buyerUser.id,
            'X-User-Roles': 'USER',
          },
        });

        if (response.ok) {
          const data = await response.json();
          return { cached: true, cacheKey: data.cacheKey };
        } else {
          throw new Error(`AR caching failed: ${response.statusText}`);
        }
      });
      steps.push(cacheARModelStep);

      const duration = Date.now() - startTime;
      const success = steps.every(step => step.success);

      return {
        scenarioName,
        success,
        duration,
        steps,
      };

    } catch (error) {
      return {
        scenarioName,
        success: false,
        duration: Date.now() - startTime,
        steps,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Run all critical scenarios
   */
  async runAllScenarios(): Promise<ScenarioResult[]> {
    logger.log('🚀 Running all E2E scenarios...');

    await this.setupTestEnvironment();

    try {
      const scenarios = await Promise.all([
        this.runProductLifecycleScenario(),
        this.runOrderFlowScenario(),
        this.runTenantIsolationScenario(),
        this.runARStreamingScenario(),
      ]);

      // Generate summary
      const totalScenarios = scenarios.length;
      const successfulScenarios = scenarios.filter(s => s.success).length;
      const totalDuration = scenarios.reduce((sum, s) => sum + s.duration, 0);

      logger.log('\n📊 E2E Scenarios Summary:');
      logger.log(`   Total Scenarios: ${totalScenarios}`);
      logger.log(`   Successful: ${successfulScenarios}`);
      logger.log(`   Failed: ${totalScenarios - successfulScenarios}`);
      logger.log(`   Total Duration: ${totalDuration}ms`);
      logger.log(`   Average Duration: ${(totalDuration / totalScenarios).toFixed(2)}ms`);

      // Log failed scenarios
      const failedScenarios = scenarios.filter(s => !s.success);
      if (failedScenarios.length > 0) {
        logger.log('\n❌ Failed Scenarios:');
        failedScenarios.forEach(scenario => {
          logger.log(`   - ${scenario.scenarioName}: ${scenario.error}`);
        });
      }

      return scenarios;

    } finally {
      await this.cleanupTestEnvironment();
    }
  }

  // Helper methods
  private async executeStep(stepName: string, stepFunction: () => Promise<any>): Promise<StepResult> {
    const startTime = Date.now();
    
    try {
      const data = await stepFunction();
      const duration = Date.now() - startTime;
      
      return {
        stepName,
        success: true,
        duration,
        data,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      
      return {
        stepName,
        success: false,
        duration,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async createTestUser(tenantId: string, userType: string, roles: string[]): Promise<TestUser> {
    const userId = `user_${userType}_${Date.now()}`;
    const email = `${userType}@e2e-test.com`;
    const password = 'E2ETest123!@#';
    const hashedPassword = await hash(password, 12);

    await this.prisma.user.create({
      data: {
        id: userId,
        tenant_id: tenantId,
        email,
        password: hashedPassword,
        roles: roles as any,
        is_active: true,
        first_name: `Test ${userType}`,
        last_name: 'User',
        created_by: 'e2e-system',
        updated_by: 'e2e-system',
      },
    });

    return {
      id: userId,
      email,
      password,
      roles,
    };
  }

  private async createTestProduct(): Promise<any> {
    // Set RLS context
    await this.prisma.$executeRaw`
      SELECT set_security_context(${this.testTenant!.id}, ${this.testTenant!.sellerUser.id}, ARRAY['SELLER'])
    `;

    return await this.prisma.product.create({
      data: {
        id: `product_${Date.now()}`,
        tenant_id: this.testTenant!.id,
        sku: `TEST-PRODUCT-${Date.now()}`,
        name: 'محصول تست',
        price: 150000,
        stock: 10,
        created_by: this.testTenant!.sellerUser.id,
        updated_by: this.testTenant!.sellerUser.id,
      },
    });
  }
}

export { E2EScenarioEngine, ScenarioResult, StepResult };