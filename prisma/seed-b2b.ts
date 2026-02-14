/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Database Seed - B2B & Executor Sample Data
 * ═══════════════════════════════════════════════════════════════════════════
 * Purpose: Create sample organizations, executors, and projects for testing
 * ═══════════════════════════════════════════════════════════════════════════
 */

import {
  ExecutorSkill,
  OrganizationType,
  PrismaClient,
  ProjectStatus,
  UserRole,
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, 12);
}

async function main() {
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

  const _b2bUser1 = await prisma.user.create({
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

  const _b2bUser2 = await prisma.user.create({
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

  const _relation = await prisma.b2BRelation.create({
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

  const _project1 = await prisma.project.create({
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

  const _project2 = await prisma.project.create({
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
