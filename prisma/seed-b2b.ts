/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Database Seed - B2B & Executor Sample Data
 * ═══════════════════════════════════════════════════════════════════════════
 * Purpose: Create sample organizations, executors, and projects for testing
 * ═══════════════════════════════════════════════════════════════════════════
 */

import {
  PrismaClient,
  UserRole,
  OrganizationType,
  ExecutorSkill,
  ProjectStatus,
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, 12);
}

async function main() {
  console.log('🌱 Starting B2B & Executor seeding...\n');

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. CREATE SAMPLE ORGANIZATIONS
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('🏭 Creating sample organizations...');

  const org1 = await prisma.organization.create({
    data: {
      name: 'کارخانه لوله پارس',
      code: 'PPC-001',
      type: OrganizationType.FACTORY,
      registrationNumber: '12345678',
      taxId: 'TAX-001',
      email: 'info@pars-pipe.ir',
      phone: '021-12345678',
      address: 'تهران، کیلومتر 20 جاده قدیم کرج',
      province: 'تهران',
      city: 'تهران',
      postalCode: '1234567890',
      creditLimit: 500000000, // 500 million Rials
      currentCredit: 0,
      isActive: true,
    },
  });

  const org2 = await prisma.organization.create({
    data: {
      name: 'گروه صنعتی مبارکه',
      code: 'MSI-002',
      type: OrganizationType.FACTORY,
      registrationNumber: '87654321',
      taxId: 'TAX-002',
      email: 'contact@mobarakeh.com',
      phone: '031-55512345',
      address: 'اصفهان، شهرک صنعتی',
      province: 'اصفهان',
      city: 'مبارکه',
      postalCode: '9876543210',
      creditLimit: 1000000000, // 1 billion Rials
      currentCredit: 0,
      isActive: true,
    },
  });

  console.log(`✅ Created organizations:`);
  console.log(`   - ${org1.name} (${org1.code})`);
  console.log(`   - ${org2.name} (${org2.code})\n`);

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. CREATE B2B USERS
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('👥 Creating B2B users...');

  const b2bUser1 = await prisma.user.create({
    data: {
      email: 'factory@demo.com',
      mobile: '09121234567',
      passwordHash: await hashPassword('Factory@123'),
      firstName: 'علی',
      lastName: 'محمدی',
      role: UserRole.USER,
      organizationId: org1.id,
      isActive: true,
    },
  });

  const b2bUser2 = await prisma.user.create({
    data: {
      email: 'agent2@mobarakeh.com',
      mobile: '09131234567',
      passwordHash: await hashPassword('Agent@123'),
      firstName: 'رضا',
      lastName: 'احمدی',
      role: UserRole.USER,
      organizationId: org2.id,
      isActive: true,
    },
  });

  console.log(`✅ Created B2B users:`);
  console.log(`   - ${b2bUser1.firstName} ${b2bUser1.lastName} (${b2bUser1.email})`);
  console.log(`   - ${b2bUser2.firstName} ${b2bUser2.lastName} (${b2bUser2.email})\n`);

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. CREATE B2B RELATIONS
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('🤝 Creating B2B relations...');

  const relation = await prisma.b2BRelation.create({
    data: {
      organizationId: org1.id,
      partnerOrganizationId: org2.id,
      relationshipType: 'SUPPLIER',
      creditLimit: 200000000, // 200 million Rials
      currentCredit: 0,
      paymentTermDays: 30,
      isActive: true,
    },
  });

  console.log(`✅ Created B2B relation: ${org1.name} → ${org2.name}\n`);

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. CREATE EXECUTOR USERS
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('👷 Creating executor users...');

  const executorUser1 = await prisma.user.create({
    data: {
      email: 'executor@demo.com',
      mobile: '09141234567',
      passwordHash: await hashPassword('Executor@123'),
      firstName: 'حسین',
      lastName: 'کریمی',
      role: UserRole.EXECUTOR,
      isActive: true,
    },
  });

  const executorUser2 = await prisma.user.create({
    data: {
      email: 'executor2@gmail.com',
      mobile: '09151234567',
      passwordHash: await hashPassword('Executor@123'),
      firstName: 'مهدی',
      lastName: 'نوری',
      role: UserRole.EXECUTOR,
      isActive: true,
    },
  });

  console.log(`✅ Created executor users:`);
  console.log(`   - ${executorUser1.firstName} ${executorUser1.lastName} (${executorUser1.email})`);
  console.log(
    `   - ${executorUser2.firstName} ${executorUser2.lastName} (${executorUser2.email})\n`
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. CREATE EXECUTOR PROFILES
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('⚡ Creating executor profiles...');

  const profile1 = await prisma.executorProfile.create({
    data: {
      userId: executorUser1.id,
      skills: [ExecutorSkill.PLUMBING, ExecutorSkill.HVAC],
      bio: 'لوله‌کش حرفه‌ای با 10 سال تجربه',
      yearsOfExperience: 10,
      licenseNumber: 'LIC-12345',
      isVerified: true,
      verifiedAt: new Date(),
      isAvailable: true,
      serviceRadius: 50, // 50 km
      completedProjects: 45,
      averageRating: 4.8,
    },
  });

  const profile2 = await prisma.executorProfile.create({
    data: {
      userId: executorUser2.id,
      skills: [ExecutorSkill.ELECTRICAL, ExecutorSkill.SMART_HOME],
      bio: 'متخصص برق و هوشمندسازی',
      yearsOfExperience: 7,
      licenseNumber: 'LIC-67890',
      isVerified: true,
      verifiedAt: new Date(),
      isAvailable: true,
      serviceRadius: 30,
      completedProjects: 28,
      averageRating: 4.9,
    },
  });

  console.log(`✅ Created executor profiles:`);
  console.log(`   - ${executorUser1.firstName}: ${profile1.skills.join(', ')}`);
  console.log(`   - ${executorUser2.firstName}: ${profile2.skills.join(', ')}\n`);

  // ═══════════════════════════════════════════════════════════════════════════
  // 6. CREATE SAMPLE PROJECTS
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('📁 Creating sample projects...');

  const project1 = await prisma.project.create({
    data: {
      executorId: profile1.id,
      name: 'ویلای آقای رضایی',
      projectCode: 'PRJ-2025-001',
      description: 'لوله‌کشی کامل ویلا',
      status: ProjectStatus.ACTIVE,
      clientName: 'محمد رضایی',
      clientPhone: '09121111111',
      clientEmail: 'rezaei@example.com',
      province: 'تهران',
      city: 'کرج',
      address: 'کرج، مهرشهر، خیابان گلستان',
      postalCode: '3314567890',
      estimatedBudget: 50000000, // 50 million Rials
      actualSpent: 15000000,
      startDate: new Date('2025-01-01'),
      expectedEndDate: new Date('2025-03-01'),
    },
  });

  const project2 = await prisma.project.create({
    data: {
      executorId: profile2.id,
      name: 'ساختمان تجاری پارس',
      projectCode: 'PRJ-2025-002',
      description: 'برق‌کاری و هوشمندسازی ساختمان 5 طبقه',
      status: ProjectStatus.PURCHASING,
      clientName: 'شرکت سرمایه‌گذاری پارس',
      clientPhone: '02112345678',
      clientEmail: 'info@pars-invest.ir',
      province: 'تهران',
      city: 'تهران',
      address: 'تهران، ولیعصر، نرسیده به ونک',
      postalCode: '1966734567',
      estimatedBudget: 200000000, // 200 million Rials
      actualSpent: 80000000,
      startDate: new Date('2025-02-01'),
      expectedEndDate: new Date('2025-06-01'),
    },
  });

  console.log(`✅ Created projects:`);
  console.log(`   - ${project1.name} (${project1.projectCode})`);
  console.log(`   - ${project2.name} (${project2.projectCode})\n`);

  // ═══════════════════════════════════════════════════════════════════════════
  // 7. SUMMARY
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('✅ Seeding completed successfully!');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('\n📊 Summary:');
  console.log(`   🏭 Organizations: 2`);
  console.log(`   👥 B2B Users: 2`);
  console.log(`   🤝 B2B Relations: 1`);
  console.log(`   👷 Executors: 2`);
  console.log(`   📁 Projects: 2`);
  console.log('\n🔐 Test Credentials:');
  console.log('   B2B Factory Agent:');
  console.log(`     Email: factory@demo.com`);
  console.log(`     Password: Factory@123`);
  console.log('   Executor:');
  console.log(`     Email: executor@demo.com`);
  console.log(`     Password: Executor@123`);
  console.log('\n');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('❌ Seeding failed:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
