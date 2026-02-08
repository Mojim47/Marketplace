/**
 * Prisma Schema Validation Script
 * Tests core models for correct relations and data integrity
 *
 * Run: npx tsx prisma/validate-seed.ts
 */

import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient({
  log: ['error'],
});

interface ValidationResult {
  model: string;
  status: 'success' | 'error';
  error?: string;
  createdId?: string;
}

const results: ValidationResult[] = [];

function generateTestData() {
  const rand = crypto.randomBytes(4).toString('hex');
  return {
    email: `test-${rand}@example.com`,
    phone: `09${rand.slice(0, 9)}`,
    nationalId: `${rand}${rand}`.slice(0, 10),
    slug: `test-${rand}`,
    name: `Test ${rand}`,
    title: `Test Title ${rand}`,
    description: `Test description for ${rand}`,
  };
}

async function validateModel(modelName: string, createFn: () => Promise<any>): Promise<void> {
  try {
    const created = await createFn();
    results.push({
      model: modelName,
      status: 'success',
      createdId: created.id || created.uid || 'N/A',
    });
    console.log(`✅ ${modelName}: Success`);
  } catch (error: any) {
    results.push({
      model: modelName,
      status: 'error',
      error: error.message,
    });
    console.error(`❌ ${modelName}: ${error.message}`);
  }
}

async function runValidation() {
  console.log('🔍 Starting Prisma Schema Validation...\n');

  const testData = generateTestData();

  // 1. User & Auth
  await validateModel('User', async () => {
    return prisma.user.create({
      data: {
        email: testData.email,
        firstName: testData.name,
        phone: testData.phone,
        mobile: testData.phone,
        passwordHash: 'hashed_password_' + testData.slug,
        role: 'USER',
        isTwoFactorEnabled: false,
        emailVerified: new Date(),
        phoneVerified: new Date(),
      },
    });
  });

  const testUser = await prisma.user.findFirst({ where: { email: testData.email } });
  if (!testUser) throw new Error('Test user not found');

  await validateModel('Session', async () => {
    return prisma.session.create({
      data: {
        userId: testUser.id,
        token: `session_${testData.slug}`,
        expiresAt: new Date(Date.now() + 86400000),
        ipAddress: '127.0.0.1',
        userAgent: 'Test Agent',
      },
    });
  });

  await validateModel('OtpVerification', async () => {
    return prisma.otpVerification.create({
      data: {
        userId: testUser.id,
        mobile: testData.phone,
        code: '123456',
        purpose: 'verify_mobile',
        expiresAt: new Date(Date.now() + 300000),
      },
    });
  });

  // 2. Address
  await validateModel('Address', async () => {
    return prisma.address.create({
      data: {
        userId: testUser.id,
        label: 'Home',
        recipientName: testData.name,
        recipientPhone: testData.phone,
        province: 'Tehran',
        city: 'Tehran',
        postalCode: '1234567890',
        addressLine1: 'Test Address',
        isDefault: false,
      },
    });
  });

  // 3. Vendor & Wallet
  await validateModel('Vendor', async () => {
    return prisma.vendor.create({
      data: {
        userId: testUser.id,
        storeName: `Shop ${testData.slug}`,
        slug: testData.slug,
        businessLegalName: 'Test Business',
        taxNumber: testData.nationalId,
        status: 'PENDING',
      },
    });
  });

  const testVendor = await prisma.vendor.findFirst({ where: { slug: testData.slug } });

  if (testVendor) {
    await validateModel('Wallet', async () => {
      return prisma.wallet.create({
        data: {
          vendorId: testVendor.id,
          balance: 0,
          lockedBalance: 0,
        },
      });
    });

    await validateModel('Transaction', async () => {
      return prisma.transaction.create({
        data: {
          vendorId: testVendor.id,
          type: 'PAYMENT',
          amount: 1000,
          description: 'Test transaction',
        },
      });
    });
  }

  // 4. Category & Product
  await validateModel('Category', async () => {
    return prisma.category.create({
      data: {
        name: `Category ${testData.slug}`,
        slug: `cat-${testData.slug}`,
        isActive: true,
      },
    });
  });

  const testCategory = await prisma.category.findFirst({ where: { slug: `cat-${testData.slug}` } });

  if (testVendor && testCategory) {
    await validateModel('Product', async () => {
      return prisma.product.create({
        data: {
          vendorId: testVendor.id,
          categoryId: testCategory.id,
          name: testData.title,
          slug: `product-${testData.slug}`,
          description: testData.description,
          price: 100000,
          costPrice: 80000,
          stock: 10,
          sku: testData.slug,
          status: 'DRAFT',
        },
      });
    });

    const testProduct = await prisma.product.findFirst({
      where: { slug: `product-${testData.slug}` },
    });

    if (testProduct) {
      await validateModel('ProductVariant', async () => {
        return prisma.productVariant.create({
          data: {
            productId: testProduct.id,
            name: 'Default Variant',
            sku: `${testData.slug}-var`,
            price: 100000,
            costPrice: 80000,
            stock: 10,
          },
        });
      });

      await validateModel('InventoryLog', async () => {
        return prisma.inventoryLog.create({
          data: {
            productId: testProduct.id,
            type: 'SALE',
            quantity: 1,
            notes: 'Test sale',
          },
        });
      });

      await validateModel('Review', async () => {
        return prisma.review.create({
          data: {
            productId: testProduct.id,
            userId: testUser.id,
            stars: 5,
            comment: 'Great product!',
            status: 'APPROVED',
          },
        });
      });

      // Cart & Wishlist
      await validateModel('Cart', async () => {
        return prisma.cart.create({
          data: {
            userId: testUser.id,
            items: {
              create: {
                productId: testProduct.id,
                quantity: 1,
              },
            },
          },
        });
      });

      await validateModel('Wishlist', async () => {
        return prisma.wishlist.create({
          data: {
            userId: testUser.id,
            productId: testProduct.id,
          },
        });
      });

      // Order
      await validateModel('Order', async () => {
        const address = await prisma.address.findFirst({ where: { userId: testUser.id } });
        return prisma.order.create({
          data: {
            userId: testUser.id,
            orderNumber: `ORD-${testData.slug}`,
            totalAmount: 100000,
            status: 'PENDING',
            paymentStatus: 'PENDING',
            shippingAddressId: address?.id || testUser.id,
            items: {
              create: {
                productId: testProduct.id,
                quantity: 1,
                unitPrice: 100000,
                totalPrice: 100000,
              },
            },
          },
        });
      });

      // AI Embedding (skip if model doesn't exist in schema)
      // AR Asset (skip if model doesn't exist in schema)
    }
  }

  // 5. B2B System
  await validateModel('Organization', async () => {
    return prisma.organization.create({
      data: {
        name: `Org ${testData.slug}`,
        slug: `org-${testData.slug}`,
        registrationNumber: testData.nationalId,
        type: 'CORPORATION',
        status: 'ACTIVE',
      },
    });
  });

  const testOrg = await prisma.organization.findFirst({ where: { slug: `org-${testData.slug}` } });

  if (testOrg && testVendor) {
    await validateModel('B2BRelation', async () => {
      return prisma.b2BRelation.create({
        data: {
          buyerId: testOrg.id,
          sellerId: testVendor.id,
          status: 'ACTIVE',
          type: 'SUPPLIER',
        },
      });
    });
  }

  // 6. Executor System
  await validateModel('ExecutorProfile', async () => {
    return prisma.executorProfile.create({
      data: {
        userId: testUser.id,
        displayName: testData.name,
        bio: 'Test executor bio',
        hourlyRate: 50000,
        skills: ['WEB_DEVELOPMENT', 'MOBILE_DEVELOPMENT'],
        status: 'PENDING',
      },
    });
  });

  const testExecutor = await prisma.executorProfile.findFirst({ where: { userId: testUser.id } });

  if (testExecutor) {
    await validateModel('Project', async () => {
      return prisma.project.create({
        data: {
          clientId: testUser.id,
          name: testData.title,
          description: testData.description,
          budget: 1000000,
          deadline: new Date(Date.now() + 30 * 86400000),
          status: 'DRAFT',
        },
      });
    });
  }

  // 7. Admin & Security (skip if models don't match schema)
  console.log('⏭️  Skipping Admin, Role, AuditLog, ApiKey (models may differ from actual schema)');

  // 8. Payment & Misc (skip if models don't match schema)
  console.log(
    '⏭️  Skipping PaymentTransaction, FeatureFlag, SupportTicket (models may differ from actual schema)'
  );

  // Generate Report
  console.log('\n' + '='.repeat(60));
  console.log('📊 VALIDATION REPORT');
  console.log('='.repeat(60));

  const successCount = results.filter((r) => r.status === 'success').length;
  const errorCount = results.filter((r) => r.status === 'error').length;
  const totalCount = results.length;

  console.log(`\n✅ Success: ${successCount}/${totalCount}`);
  console.log(`❌ Errors: ${errorCount}/${totalCount}`);
  console.log(`📈 Success Rate: ${((successCount / totalCount) * 100).toFixed(1)}%\n`);

  if (errorCount > 0) {
    console.log('Error Details:');
    console.log('-'.repeat(60));
    results
      .filter((r) => r.status === 'error')
      .forEach((r) => {
        console.log(`❌ ${r.model}: ${r.error}`);
      });
  }

  console.log('\n' + '='.repeat(60));

  // Cleanup
  console.log('\n🧹 Cleaning up test data...');
  await prisma.user.deleteMany({ where: { email: { contains: 'test-' } } });
  console.log('✅ Cleanup complete\n');

  return {
    total: totalCount,
    success: successCount,
    errors: errorCount,
    successRate: (successCount / totalCount) * 100,
    results,
  };
}

// Run validation
runValidation()
  .then((report) => {
    console.log('Schema validation completed!');

    if (report.errors > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  })
  .catch((error) => {
    console.error('Fatal error during validation:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
