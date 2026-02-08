/**
 * ═══════════════════════════════════════════════════════════════════════════
 * NextGen Marketplace - Production Database Seed
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * 🔐 SECURITY NOTES:
 * - This seed creates initial data for production deployment
 * - Admin passwords MUST be changed immediately after first login
 * - All passwords here are temporary and should be rotated
 * - Run this ONLY ONCE during initial deployment
 *
 * Usage: npx prisma db seed
 * ═══════════════════════════════════════════════════════════════════════════
 */

import {
  PrismaClient,
  UserRole,
  ProductStatus,
  ArType,
  OrganizationType,
  DealerTier,
  ExecutorSkill,
  ProjectStatus,
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

// ═══════════════════════════════════════════════════════════════════════════
// Configuration
// ═══════════════════════════════════════════════════════════════════════════

const BCRYPT_ROUNDS = 12;

// Generate secure temporary passwords
function generateSecurePassword(): string {
  return crypto.randomBytes(16).toString('base64').slice(0, 20) + '!Aa1';
}

// ═══════════════════════════════════════════════════════════════════════════
// Main Seed Function
// ═══════════════════════════════════════════════════════════════════════════

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🚀 NextGen Marketplace - Production Database Seed');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // Check if already seeded
  const existingTenant = await prisma.tenant.findFirst();
  if (existingTenant) {
    console.log('⚠️  Database already seeded. Skipping to prevent duplicates.');
    console.log('   To re-seed, run: npx prisma migrate reset\n');
    return;
  }

  const tempPasswords: Record<string, string> = {};

  await prisma.$transaction(
    async (tx) => {
      // ═══════════════════════════════════════════════════════════════════════
      // 1. TENANT (Platform Configuration)
      // ═══════════════════════════════════════════════════════════════════════
      console.log('📦 Creating tenant...');

      const tenant = await tx.tenant.create({
        data: {
          name: 'بازار نکست‌جن',
          slug: 'nextgen-ir',
          ownerEmail: process.env.ADMIN_EMAIL || 'admin@nextgen.ir',
          plan: 'enterprise',
          isActive: true,
          settings: {
            currency: 'IRR',
            timezone: 'Asia/Tehran',
            language: 'fa',
            taxRate: 9,
            minOrderAmount: 100000,
            maxOrderAmount: 100000000000,
            commissionRate: 12,
            features: {
              ar: true,
              ai: true,
              b2b: true,
              executor: true,
              moodian: true,
            },
          },
        },
      });
      console.log(`   ✅ Tenant created: ${tenant.name}`);

      // ═══════════════════════════════════════════════════════════════════════
      // 2. PLATFORM SETTINGS
      // ═══════════════════════════════════════════════════════════════════════
      console.log('⚙️  Creating platform settings...');

      await tx.platformSettings.create({
        data: {
          id: 'default',
          config: {
            maintenanceMode: false,
            enableAR: true,
            enableAI: true,
            commissionRate: 12,
            minOrderAmount: 100000,
            maxOrderAmount: 100000000000,
            supportEmail: 'support@nextgen.ir',
            supportPhone: '021-91009100',
          },
          isActive: true,
        },
      });
      console.log('   ✅ Platform settings created');

      // ═══════════════════════════════════════════════════════════════════════
      // 3. ADMIN USERS
      // ═══════════════════════════════════════════════════════════════════════
      console.log('👤 Creating admin users...');

      const adminEmails = [
        { email: 'admin@nextgen.ir', name: 'مدیر ارشد سیستم', role: 'SUPER_ADMIN' },
        { email: 'support@nextgen.ir', name: 'مدیر پشتیبانی', role: 'SUPPORT' },
        { email: 'finance@nextgen.ir', name: 'مدیر مالی', role: 'FINANCE' },
      ];

      for (const admin of adminEmails) {
        const password = generateSecurePassword();
        tempPasswords[admin.email] = password;

        await tx.admin.create({
          data: {
            tenantId: tenant.id,
            email: admin.email,
            name: admin.name,
            passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS),
            isActive: true,
            isTwoFactorEnabled: false, // Should be enabled after first login
            mustChangePassword: true,
          },
        });
        console.log(`   ✅ Admin: ${admin.email}`);
      }

      // ═══════════════════════════════════════════════════════════════════════
      // 4. CATEGORIES
      // ═══════════════════════════════════════════════════════════════════════
      console.log('📂 Creating categories...');

      const mainCategories = [
        { name: 'موبایل و تبلت', slug: 'mobile', icon: '📱', executorDiscount: 5 },
        { name: 'لپتاپ و کامپیوتر', slug: 'laptop', icon: '💻', executorDiscount: 7 },
        { name: 'لوازم خانگی برقی', slug: 'appliances', icon: '🏠', executorDiscount: 10 },
        { name: 'ابزار و یراق‌آلات', slug: 'tools', icon: '🔧', executorDiscount: 15 },
        { name: 'تاسیسات ساختمانی', slug: 'building', icon: '🏗️', executorDiscount: 12 },
        { name: 'پوشاک و کفش', slug: 'fashion', icon: '👕', executorDiscount: 8 },
        { name: 'کتاب و لوازم تحریر', slug: 'books', icon: '📚', executorDiscount: 5 },
        { name: 'ورزش و سفر', slug: 'sports', icon: '⚽', executorDiscount: 6 },
        { name: 'زیبایی و سلامت', slug: 'beauty', icon: '💄', executorDiscount: 8 },
        { name: 'خودرو و موتورسیکلت', slug: 'automotive', icon: '🚗', executorDiscount: 10 },
      ];

      const cats: Record<string, any> = {};
      for (let i = 0; i < mainCategories.length; i++) {
        const cat = mainCategories[i];
        cats[cat.slug] = await tx.category.create({
          data: {
            name: cat.name,
            slug: cat.slug,
            icon: cat.icon,
            level: 0,
            order: i + 1,
            isActive: true,
            executorDiscount: cat.executorDiscount,
          },
        });
      }
      console.log(`   ✅ Created ${mainCategories.length} main categories`);

      // Subcategories
      const subCategories = [
        // Mobile
        { name: 'گوشی موبایل', slug: 'smartphone', parent: 'mobile' },
        { name: 'تبلت', slug: 'tablet', parent: 'mobile' },
        { name: 'ساعت هوشمند', slug: 'smartwatch', parent: 'mobile' },
        { name: 'لوازم جانبی موبایل', slug: 'mobile-accessories', parent: 'mobile' },
        // Laptop
        { name: 'لپتاپ', slug: 'laptop-sub', parent: 'laptop' },
        { name: 'کامپیوتر دسکتاپ', slug: 'desktop', parent: 'laptop' },
        { name: 'مانیتور', slug: 'monitor', parent: 'laptop' },
        { name: 'قطعات کامپیوتر', slug: 'pc-parts', parent: 'laptop' },
        // Appliances
        { name: 'یخچال و فریزر', slug: 'refrigerator', parent: 'appliances' },
        { name: 'ماشین لباسشویی', slug: 'washing-machine', parent: 'appliances' },
        { name: 'کولر و اسپیلت', slug: 'ac', parent: 'appliances' },
        { name: 'جاروبرقی', slug: 'vacuum', parent: 'appliances' },
        { name: 'ماشین ظرفشویی', slug: 'dishwasher', parent: 'appliances' },
        // Tools
        { name: 'ابزار برقی', slug: 'power-tools', parent: 'tools' },
        { name: 'ابزار دستی', slug: 'hand-tools', parent: 'tools' },
        { name: 'ابزار اندازه‌گیری', slug: 'measuring-tools', parent: 'tools' },
        // Building
        { name: 'لوله و اتصالات', slug: 'pipes', parent: 'building' },
        { name: 'سیم و کابل', slug: 'wires', parent: 'building' },
        { name: 'شیرآلات', slug: 'faucets', parent: 'building' },
        { name: 'کاشی و سرامیک', slug: 'tiles', parent: 'building' },
      ];

      for (let i = 0; i < subCategories.length; i++) {
        const sub = subCategories[i];
        await tx.category.create({
          data: {
            name: sub.name,
            slug: sub.slug,
            parentId: cats[sub.parent].id,
            level: 1,
            order: i + 1,
            isActive: true,
          },
        });
      }
      console.log(`   ✅ Created ${subCategories.length} subcategories`);

      // ═══════════════════════════════════════════════════════════════════════
      // 5. SAMPLE USERS (for testing - should be removed in real production)
      // ═══════════════════════════════════════════════════════════════════════
      if (process.env.SEED_SAMPLE_DATA === 'true') {
        console.log('👥 Creating sample users (SEED_SAMPLE_DATA=true)...');

        const sampleUserPassword = generateSecurePassword();
        tempPasswords['sample_users'] = sampleUserPassword;
        const userHash = await bcrypt.hash(sampleUserPassword, BCRYPT_ROUNDS);

        // Sample customers
        const sampleUsers = [
          {
            email: 'customer1@example.com',
            firstName: 'علی',
            lastName: 'رضایی',
            role: UserRole.USER,
          },
          {
            email: 'customer2@example.com',
            firstName: 'سارا',
            lastName: 'احمدی',
            role: UserRole.USER,
          },
          {
            email: 'vendor1@example.com',
            firstName: 'رضا',
            lastName: 'محمدی',
            role: UserRole.SELLER,
          },
          {
            email: 'executor1@example.com',
            firstName: 'احمد',
            lastName: 'صادقی',
            role: UserRole.EXECUTOR,
          },
        ];

        for (const user of sampleUsers) {
          await tx.user.create({
            data: {
              email: user.email,
              passwordHash: userHash,
              firstName: user.firstName,
              lastName: user.lastName,
              role: user.role,
              isActive: true,
              emailVerified: new Date(),
              mustChangePassword: true,
            },
          });
        }
        console.log(`   ✅ Created ${sampleUsers.length} sample users`);
      }

      // ═══════════════════════════════════════════════════════════════════════
      // 6. B2B ORGANIZATIONS (Sample)
      // ═══════════════════════════════════════════════════════════════════════
      if (process.env.SEED_SAMPLE_DATA === 'true') {
        console.log('🏭 Creating sample B2B organizations...');

        await tx.organization.createMany({
          data: [
            {
              name: 'شرکت نمونه تولیدی',
              code: 'ORG-001',
              type: OrganizationType.FACTORY,
              registrationNumber: '12345678901',
              taxId: '12345678901234',
              email: 'info@sample-factory.ir',
              phone: '021-12345678',
              address: 'تهران، شهرک صنعتی',
              province: 'تهران',
              city: 'تهران',
              postalCode: '1234567890',
              creditLimit: 500000000,
              currentCredit: 0,
              isActive: true,
            },
            {
              name: 'نمایندگی نمونه',
              code: 'ORG-002',
              type: OrganizationType.DEALER,
              registrationNumber: '98765432109',
              taxId: '98765432109876',
              email: 'info@sample-dealer.ir',
              phone: '031-98765432',
              address: 'اصفهان، خیابان اصلی',
              province: 'اصفهان',
              city: 'اصفهان',
              postalCode: '8174673441',
              creditLimit: 200000000,
              currentCredit: 0,
              isActive: true,
            },
          ],
        });
        console.log('   ✅ Created sample B2B organizations');
      }

      // ═══════════════════════════════════════════════════════════════════════
      // 7. AUDIT LOG ENTRY
      // ═══════════════════════════════════════════════════════════════════════
      await tx.auditLog.create({
        data: {
          action: 'DATABASE_SEEDED',
          entityType: 'System',
          entityId: 'production-seed',
          performedBy: 'system',
          details: {
            seedVersion: '1.0.0',
            timestamp: new Date().toISOString(),
            environment: process.env.NODE_ENV || 'production',
          },
          ipAddress: '127.0.0.1',
          userAgent: 'prisma-seed',
        },
      });
    },
    {
      timeout: 60000, // 60 second timeout for large transactions
    }
  );

  // ═══════════════════════════════════════════════════════════════════════
  // OUTPUT TEMPORARY PASSWORDS
  // ═══════════════════════════════════════════════════════════════════════
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('🔐 TEMPORARY PASSWORDS (CHANGE IMMEDIATELY!)');
  console.log('═══════════════════════════════════════════════════════════════');

  for (const [email, password] of Object.entries(tempPasswords)) {
    console.log(`   ${email}: ${password}`);
  }

  console.log('\n⚠️  IMPORTANT SECURITY ACTIONS:');
  console.log('   1. Change all passwords immediately after first login');
  console.log('   2. Enable 2FA for all admin accounts');
  console.log('   3. Delete this output from logs');
  console.log('   4. Store passwords securely in Vault');

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('✅ Production seed completed successfully!');
  console.log('═══════════════════════════════════════════════════════════════\n');
}

// ═══════════════════════════════════════════════════════════════════════════
// Execute
// ═══════════════════════════════════════════════════════════════════════════

main()
  .catch((e) => {
    console.error('\n❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
