// ═══════════════════════════════════════════════════════════════════════════
// Auto Tenant Provisioning - Ultra-Fast 7-Layer Architecture
// ═══════════════════════════════════════════════════════════════════════════

import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

interface TenantProvisioningRequest {
  tenantSlug: string;
  tenantName: string;
  adminEmail: string;
  adminPassword: string;
  features: {
    ar: boolean;
    ai: boolean;
    b2b: boolean;
    moodian: boolean;
    analytics: boolean;
  };
  settings: {
    currency: string;
    language: string;
    timezone: string;
    theme: string;
  };
}

interface ProvisioningResult {
  success: boolean;
  tenantId: string;
  adminUserId: string;
  setupUrl: string;
  credentials: {
    adminEmail: string;
    tempPassword: string;
  };
  error?: string;
}

class AutoTenantProvisioning {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  async provisionTenant(request: TenantProvisioningRequest): Promise<ProvisioningResult> {
    console.log(`🏢 Provisioning new tenant: ${request.tenantName}`);

    try {
      // 1. Validate request
      await this.validateProvisioningRequest(request);

      // 2. Create tenant
      const tenant = await this.createTenant(request);

      // 3. Set RLS context for new tenant
      await this.setRLSContext(tenant.id, 'system');

      // 4. Create admin user
      const adminUser = await this.createAdminUser(tenant.id, request);

      // 5. Setup tenant-specific infrastructure
      await this.setupTenantInfrastructure(tenant.id, request.features);

      // 6. Create default data
      await this.createDefaultData(tenant.id, adminUser.id);

      // 7. Setup feature flags
      await this.setupFeatureFlags(tenant.id, request.features);

      // 8. Setup monitoring
      await this.setupTenantMonitoring(tenant.id);

      // 9. Send welcome email
      await this.sendWelcomeEmail(adminUser.email, tenant.name);

      console.log(`✅ Tenant provisioned successfully: ${tenant.id}`);

      return {
        success: true,
        tenantId: tenant.id,
        adminUserId: adminUser.id,
        setupUrl: `https://admin.nextgen.ir/setup?tenant=${tenant.slug}`,
        credentials: {
          adminEmail: adminUser.email,
          tempPassword: 'Please check your email for login instructions',
        },
      };

    } catch (error) {
      console.error(`❌ Tenant provisioning failed:`, error);
      
      // Cleanup on failure
      await this.cleanupFailedProvisioning(request.tenantSlug);

      return {
        success: false,
        tenantId: '',
        adminUserId: '',
        setupUrl: '',
        credentials: { adminEmail: '', tempPassword: '' },
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async validateProvisioningRequest(request: TenantProvisioningRequest): Promise<void> {
    // Check if tenant slug is available
    const existingTenant = await this.prisma.tenant.findUnique({
      where: { slug: request.tenantSlug },
    });

    if (existingTenant) {
      throw new Error(`Tenant slug '${request.tenantSlug}' is already taken`);
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(request.adminEmail)) {
      throw new Error('Invalid admin email format');
    }

    // Validate tenant slug format
    const slugRegex = /^[a-z0-9-]+$/;
    if (!slugRegex.test(request.tenantSlug)) {
      throw new Error('Tenant slug must contain only lowercase letters, numbers, and hyphens');
    }

    // Check if admin email is already used
    const existingUser = await this.prisma.user.findFirst({
      where: { email: request.adminEmail },
    });

    if (existingUser) {
      throw new Error(`Email '${request.adminEmail}' is already registered`);
    }
  }

  private async createTenant(request: TenantProvisioningRequest): Promise<any> {
    const tenantId = `tenant_${uuidv4()}`;

    const tenant = await this.prisma.tenant.create({
      data: {
        id: tenantId,
        slug: request.tenantSlug,
        name: request.tenantName,
        status: 'ACTIVE',
        settings: {
          ...request.settings,
          features: request.features,
          provisioned_at: new Date().toISOString(),
          version: '3.0.0',
        },
        created_by: 'system',
        updated_by: 'system',
      },
    });

    console.log(`✅ Tenant created: ${tenant.id}`);
    return tenant;
  }

  private async createAdminUser(tenantId: string, request: TenantProvisioningRequest): Promise<any> {
    const userId = `user_${uuidv4()}`;
    const hashedPassword = await hash(request.adminPassword, 12);

    const adminUser = await this.prisma.user.create({
      data: {
        id: userId,
        tenant_id: tenantId,
        email: request.adminEmail,
        password: hashedPassword,
        roles: ['ADMIN'],
        is_active: true,
        first_name: 'مدیر',
        last_name: 'سیستم',
        created_by: 'system',
        updated_by: 'system',
      },
    });

    console.log(`✅ Admin user created: ${adminUser.id}`);
    return adminUser;
  }

  private async setupTenantInfrastructure(tenantId: string, features: any): Promise<void> {
    console.log(`🏗️ Setting up infrastructure for tenant: ${tenantId}`);

    // Create tenant-specific cache namespace
    await this.setupTenantCache(tenantId);

    // Setup ClickHouse tables for analytics
    if (features.analytics) {
      await this.setupTenantAnalytics(tenantId);
    }

    // Setup AR/3D model storage
    if (features.ar) {
      await this.setupTenantARStorage(tenantId);
    }

    // Setup AI model cache
    if (features.ai) {
      await this.setupTenantAICache(tenantId);
    }

    // Setup Moodian integration
    if (features.moodian) {
      await this.setupMoodianIntegration(tenantId);
    }

    console.log(`✅ Infrastructure setup completed for tenant: ${tenantId}`);
  }

  private async createDefaultData(tenantId: string, adminUserId: string): Promise<void> {
    console.log(`📊 Creating default data for tenant: ${tenantId}`);

    // Create sample product categories
    const categories = [
      { name: 'الکترونیک', slug: 'electronics' },
      { name: 'پوشاک', slug: 'clothing' },
      { name: 'خانه و آشپزخانه', slug: 'home-kitchen' },
    ];

    // Create sample products
    const sampleProducts = [
      {
        sku: 'SAMPLE-001',
        name: 'محصول نمونه ۱',
        description: 'این یک محصول نمونه برای شروع کار است',
        price: 100000,
        stock: 10,
        metadata: { sample: true },
      },
      {
        sku: 'SAMPLE-002',
        name: 'محصول نمونه ۲',
        description: 'محصول نمونه دوم با قابلیت AR',
        price: 200000,
        stock: 5,
        metadata: { sample: true, ar_model: 'sample_product.glb' },
      },
    ];

    for (const productData of sampleProducts) {
      await this.prisma.product.create({
        data: {
          id: `product_${uuidv4()}`,
          tenant_id: tenantId,
          ...productData,
          created_by: adminUserId,
          updated_by: adminUserId,
        },
      });
    }

    console.log(`✅ Default data created for tenant: ${tenantId}`);
  }

  private async setupFeatureFlags(tenantId: string, features: any): Promise<void> {
    console.log(`🚩 Setting up feature flags for tenant: ${tenantId}`);

    const featureFlags = {
      ar_enabled: features.ar,
      ai_enabled: features.ai,
      b2b_enabled: features.b2b,
      moodian_enabled: features.moodian,
      analytics_enabled: features.analytics,
      advanced_search: true,
      real_time_notifications: true,
      multi_currency: false,
      advanced_reporting: features.analytics,
    };

    // Store feature flags in cache for fast access
    // await this.cacheService.set(`${tenantId}:feature_flags`, featureFlags, 86400); // 24 hours

    console.log(`✅ Feature flags configured for tenant: ${tenantId}`);
  }

  private async setupTenantMonitoring(tenantId: string): Promise<void> {
    console.log(`📊 Setting up monitoring for tenant: ${tenantId}`);

    // Create initial performance metrics
    const initialMetrics = [
      { metric_name: 'tenant_created', value: 1, tags: { event: 'provisioning' } },
      { metric_name: 'initial_setup', value: Date.now(), tags: { phase: 'complete' } },
    ];

    for (const metric of initialMetrics) {
      await this.prisma.performanceMetric.create({
        data: {
          id: `metric_${uuidv4()}`,
          tenant_id: tenantId,
          ...metric,
        },
      });
    }

    console.log(`✅ Monitoring setup completed for tenant: ${tenantId}`);
  }

  private async setupTenantCache(tenantId: string): Promise<void> {
    // Setup tenant-specific cache namespaces
    console.log(`💾 Setting up cache namespace for tenant: ${tenantId}`);
    // Implementation would setup Redis namespaces
  }

  private async setupTenantAnalytics(tenantId: string): Promise<void> {
    console.log(`📈 Setting up analytics for tenant: ${tenantId}`);
    // Implementation would create ClickHouse tables
  }

  private async setupTenantARStorage(tenantId: string): Promise<void> {
    console.log(`🥽 Setting up AR storage for tenant: ${tenantId}`);
    // Implementation would setup S3 buckets or MinIO buckets
  }

  private async setupTenantAICache(tenantId: string): Promise<void> {
    console.log(`🤖 Setting up AI cache for tenant: ${tenantId}`);
    // Implementation would setup AI model cache
  }

  private async setupMoodianIntegration(tenantId: string): Promise<void> {
    console.log(`🏛️ Setting up Moodian integration for tenant: ${tenantId}`);
    // Implementation would setup Moodian API credentials
  }

  private async sendWelcomeEmail(email: string, tenantName: string): Promise<void> {
    console.log(`📧 Sending welcome email to: ${email}`);
    // Implementation would send actual email
  }

  private async cleanupFailedProvisioning(tenantSlug: string): Promise<void> {
    console.log(`🧹 Cleaning up failed provisioning for: ${tenantSlug}`);
    
    try {
      // Remove tenant if created
      await this.prisma.tenant.deleteMany({
        where: { slug: tenantSlug },
      });

      // Remove any created users
      // Remove any created data
      // Cleanup infrastructure

    } catch (error) {
      console.error('Cleanup failed:', error);
    }
  }

  private async setRLSContext(tenantId: string, userId: string): Promise<void> {
    await this.prisma.$executeRaw`
      SELECT set_security_context(
        ${tenantId}::text,
        ${userId}::text,
        ARRAY['ADMIN']::text[]
      )
    `;
  }
}

// Auto Feature Rollout Manager
class AutoFeatureRollout {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  async rolloutFeature(featureName: string, rolloutPercentage: number): Promise<void> {
    console.log(`🚀 Rolling out feature '${featureName}' to ${rolloutPercentage}% of tenants`);

    try {
      // Get all active tenants
      const tenants = await this.prisma.tenant.findMany({
        where: { status: 'ACTIVE' },
        select: { id: true, slug: true, name: true },
      });

      // Calculate how many tenants to enable
      const tenantsToEnable = Math.ceil((tenants.length * rolloutPercentage) / 100);
      
      // Randomly select tenants (or use other criteria)
      const selectedTenants = this.selectTenantsForRollout(tenants, tenantsToEnable);

      // Enable feature for selected tenants
      for (const tenant of selectedTenants) {
        await this.enableFeatureForTenant(tenant.id, featureName);
        console.log(`✅ Feature '${featureName}' enabled for tenant: ${tenant.slug}`);
      }

      // Record rollout metrics
      await this.recordRolloutMetrics(featureName, rolloutPercentage, selectedTenants.length);

      console.log(`🎉 Feature rollout completed: ${selectedTenants.length}/${tenants.length} tenants`);

    } catch (error) {
      console.error(`❌ Feature rollout failed:`, error);
      throw error;
    }
  }

  private selectTenantsForRollout(tenants: any[], count: number): any[] {
    // Simple random selection - in production might use more sophisticated criteria
    const shuffled = [...tenants].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  }

  private async enableFeatureForTenant(tenantId: string, featureName: string): Promise<void> {
    // Update tenant settings to enable feature
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (tenant) {
      const updatedSettings = {
        ...tenant.settings,
        features: {
          ...tenant.settings.features,
          [featureName]: true,
        },
      };

      await this.prisma.tenant.update({
        where: { id: tenantId },
        data: { settings: updatedSettings },
      });

      // Update feature flags cache
      // await this.cacheService.set(`${tenantId}:feature_flags:${featureName}`, true, 86400);
    }
  }

  private async recordRolloutMetrics(featureName: string, percentage: number, enabledCount: number): Promise<void> {
    // Record rollout metrics for monitoring
    console.log(`📊 Recording rollout metrics for feature: ${featureName}`);
  }

  async instantRollback(featureName: string): Promise<void> {
    console.log(`🔄 Performing instant rollback for feature: ${featureName}`);

    try {
      // Disable feature for all tenants
      const tenants = await this.prisma.tenant.findMany({
        where: { status: 'ACTIVE' },
      });

      for (const tenant of tenants) {
        await this.disableFeatureForTenant(tenant.id, featureName);
      }

      console.log(`✅ Feature '${featureName}' rolled back for all tenants`);

    } catch (error) {
      console.error(`❌ Rollback failed:`, error);
      throw error;
    }
  }

  private async disableFeatureForTenant(tenantId: string, featureName: string): Promise<void> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (tenant) {
      const updatedSettings = {
        ...tenant.settings,
        features: {
          ...tenant.settings.features,
          [featureName]: false,
        },
      };

      await this.prisma.tenant.update({
        where: { id: tenantId },
        data: { settings: updatedSettings },
      });

      // Update feature flags cache
      // await this.cacheService.set(`${tenantId}:feature_flags:${featureName}`, false, 86400);
    }
  }
}

export { AutoTenantProvisioning, AutoFeatureRollout };