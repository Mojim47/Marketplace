// ═══════════════════════════════════════════════════════════════════════════
// NextGen Marketplace - Ultra-Fast 7-Layer Architecture Seed
// ═══════════════════════════════════════════════════════════════════════════

import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Create default tenant
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'default' },
    update: {},
    create: {
      id: 'tenant_default',
      slug: 'default',
      name: 'Default Tenant',
      status: 'ACTIVE',
      settings: {
        currency: 'IRR',
        language: 'fa',
        timezone: 'Asia/Tehran',
        features: {
          ar: true,
          ai: true,
          b2b: true,
          moodian: true,
        },
      },
    },
  });

  // Set RLS context for seeding
  await prisma.$executeRaw`
    SELECT set_security_context(
      ${tenant.id}::text,
      'system'::text,
      ARRAY['ADMIN']::text[]
    )
  `;

  const adminSeedPassword =
    process.env.SEED_ADMIN_PASSWORD || 'default_secure_random_password_admin_123!@#_v1';
  const sellerSeedPassword =
    process.env.SEED_SELLER_PASSWORD || 'default_secure_random_password_seller_123!@#_v1';
  const userSeedPassword =
    process.env.SEED_USER_PASSWORD || 'default_secure_random_password_user_123!@#_v1';

  // Create admin user
  const adminPassword = await hash(adminSeedPassword, 12);
  const _adminUser = await prisma.user.upsert({
    where: {
      tenant_id_email: {
        tenant_id: tenant.id,
        email: 'admin@nextgen.ir',
      },
    },
    update: {},
    create: {
      id: 'user_admin',
      tenant_id: tenant.id,
      email: 'admin@nextgen.ir',
      phone: '+989123456789',
      password: adminPassword,
      roles: ['ADMIN'],
      is_active: true,
      first_name: 'مدیر',
      last_name: 'سیستم',
      created_by: 'system',
      updated_by: 'system',
    },
  });

  // Create seller user
  const sellerPassword = await hash(sellerSeedPassword, 12);
  const sellerUser = await prisma.user.upsert({
    where: {
      tenant_id_email: {
        tenant_id: tenant.id,
        email: 'seller@nextgen.ir',
      },
    },
    update: {},
    create: {
      id: 'user_seller',
      tenant_id: tenant.id,
      email: 'seller@nextgen.ir',
      phone: '+989123456788',
      password: sellerPassword,
      roles: ['SELLER'],
      is_active: true,
      first_name: 'فروشنده',
      last_name: 'نمونه',
      created_by: 'system',
      updated_by: 'system',
    },
  });

  // Create regular user
  const userPassword = await hash(userSeedPassword, 12);
  const regularUser = await prisma.user.upsert({
    where: {
      tenant_id_email: {
        tenant_id: tenant.id,
        email: 'user@nextgen.ir',
      },
    },
    update: {},
    create: {
      id: 'user_regular',
      tenant_id: tenant.id,
      email: 'user@nextgen.ir',
      phone: '+989123456787',
      password: userPassword,
      roles: ['USER'],
      is_active: true,
      first_name: 'کاربر',
      last_name: 'نمونه',
      created_by: 'system',
      updated_by: 'system',
    },
  });

  // Create sample products
  const products = [
    {
      id: 'product_1',
      sku: 'PHONE-001',
      name: 'گوشی هوشمند سامسونگ Galaxy S24',
      description: 'گوشی هوشمند پرچمدار سامسونگ با قابلیت‌های پیشرفته',
      price: 25000000,
      stock: 50,
      metadata: {
        brand: 'Samsung',
        model: 'Galaxy S24',
        color: 'Black',
        storage: '256GB',
        warranty: '18 months',
        ar_model: 'phone_samsung_s24.glb',
      },
    },
    {
      id: 'product_2',
      sku: 'LAPTOP-001',
      name: 'لپ‌تاپ ایسوس ZenBook Pro',
      description: 'لپ‌تاپ حرفه‌ای برای کار و بازی',
      price: 45000000,
      stock: 25,
      metadata: {
        brand: 'ASUS',
        model: 'ZenBook Pro',
        cpu: 'Intel i7',
        ram: '16GB',
        storage: '512GB SSD',
        warranty: '24 months',
        ar_model: 'laptop_asus_zenbook.glb',
      },
    },
    {
      id: 'product_3',
      sku: 'WATCH-001',
      name: 'ساعت هوشمند اپل Watch Series 9',
      description: 'ساعت هوشمند اپل با قابلیت‌های سلامتی پیشرفته',
      price: 15000000,
      stock: 75,
      metadata: {
        brand: 'Apple',
        model: 'Watch Series 9',
        size: '45mm',
        color: 'Space Gray',
        warranty: '12 months',
        ar_model: 'watch_apple_series9.glb',
      },
    },
  ];

  for (const productData of products) {
    const _product = await prisma.product.upsert({
      where: {
        tenant_id_sku: {
          tenant_id: tenant.id,
          sku: productData.sku,
        },
      },
      update: {},
      create: {
        ...productData,
        tenant_id: tenant.id,
        created_by: sellerUser.id,
        updated_by: sellerUser.id,
      },
    });
  }

  // Create sample order
  const order = await prisma.order.create({
    data: {
      id: 'order_1',
      tenant_id: tenant.id,
      user_id: regularUser.id,
      order_number: 'ORD-2024-001',
      status: 'PENDING',
      subtotal: 25000000,
      tax: 2250000,
      total: 27250000,
      metadata: {
        shipping_address: {
          city: 'تهران',
          address: 'خیابان ولیعصر، پلاک ۱۲۳',
          postal_code: '1234567890',
        },
        notes: 'سفارش نمونه برای تست سیستم',
      },
      created_by: regularUser.id,
      updated_by: regularUser.id,
    },
  });

  // Create order item
  const _orderItem = await prisma.orderItem.create({
    data: {
      id: 'order_item_1',
      tenant_id: tenant.id,
      order_id: order.id,
      product_id: 'product_1',
      quantity: 1,
      unit_price: 25000000,
      total_price: 25000000,
      created_by: regularUser.id,
      updated_by: regularUser.id,
    },
  });

  // Create sample payment
  const _payment = await prisma.payment.create({
    data: {
      id: 'payment_1',
      tenant_id: tenant.id,
      order_id: order.id,
      amount: 27250000,
      status: 'PENDING',
      gateway: 'zarinpal',
      metadata: {
        gateway_transaction_id: 'ZP-123456789',
        payment_method: 'card',
      },
      created_by: regularUser.id,
      updated_by: regularUser.id,
    },
  });

  // Create sample system events
  const events = [
    {
      event_type: 'user_registered',
      entity_type: 'user',
      entity_id: regularUser.id,
      user_id: regularUser.id,
      data: { email: regularUser.email, roles: regularUser.roles },
    },
    {
      event_type: 'product_created',
      entity_type: 'product',
      entity_id: 'product_1',
      user_id: sellerUser.id,
      data: { sku: 'PHONE-001', name: 'گوشی هوشمند سامسونگ Galaxy S24' },
    },
    {
      event_type: 'order_created',
      entity_type: 'order',
      entity_id: order.id,
      user_id: regularUser.id,
      data: { order_number: order.order_number, total: order.total },
    },
  ];

  for (const eventData of events) {
    await prisma.systemEvent.create({
      data: {
        id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        tenant_id: tenant.id,
        ...eventData,
      },
    });
  }

  // Create sample performance metrics
  const metrics = [
    { metric_name: 'api_response_time', value: 45.5, tags: { endpoint: '/api/v3/products' } },
    { metric_name: 'cache_hit_rate', value: 85.2, tags: { cache_type: 'redis' } },
    { metric_name: 'database_query_time', value: 12.3, tags: { query_type: 'select' } },
    { metric_name: 'active_users', value: 150, tags: { time_window: '1h' } },
  ];

  for (const metricData of metrics) {
    await prisma.performanceMetric.create({
      data: {
        id: `metric_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        tenant_id: tenant.id,
        ...metricData,
      },
    });
  }
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
