/**
 * ???????????????????????????????????????????????????????????????????????????
 * Hierarchy Service - Business Logic for Factory ? Agent ? Executor
 * ???????????????????????????????????????????????????????????????????????????
 */

import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaClient, DealerTier, UserRole, ExecutorSkill } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

@Injectable()
export class HierarchyService {
  private readonly logger = new Logger('HierarchyService');

  /**
   * ·Ì”  ‰„«Ì‰œê«‰ “Ì—„Ã„Ê⁄Â ò«—Œ«‰Â
   */
  async getAgentsByFactory(userId: string) {
    // ÅÌœ« ò—œ‰ Organization ò«—Œ«‰Â
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        organization: {
          include: {
            supplierRelations: {
              where: { isActive: true },
              include: {
                buyer: {
                  include: {
                    members: {
                      select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        mobile: true,
                        email: true,
                        role: true,
                        isActive: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!user?.organization) {
      throw new ForbiddenException('‘„« ⁄÷Ê ÂÌç ”«“„«‰Ì ‰Ì” Ìœ');
    }

    if (user.organization.type !== 'FACTORY') {
      throw new ForbiddenException('›ﬁÿ ò«—Œ«‰Â „Ìù Ê«‰œ ‰„«Ì‰œê«‰ —« „œÌ—Ì  ò‰œ');
    }

    const agents = user.organization.supplierRelations.map((relation) => ({
      id: relation.buyerId,
      name: relation.buyer.name,
      tierLevel: relation.tierLevel,
      creditLimit: relation.creditLimit,
      currentDebt: relation.currentDebt,
      discountPercentage: relation.discountPercentage,
      isActive: relation.isActive,
      startDate: relation.startDate,
      members: relation.buyer.members,
    }));

    return {
      success: true,
      data: agents,
    };
  }

  /**
   * «ÌÃ«œ ‰„«Ì‰œÂ ÃœÌœ  Ê”ÿ ò«—Œ«‰Â
   */
  async createAgent(
    userId: string,
    data: {
      name: string;
      mobile: string;
      email?: string;
      tierLevel: DealerTier;
      creditLimit: number;
      discountPercentage: number;
    }
  ) {
    // »——”Ì ò«—Œ«‰Â
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { organization: true },
    });

    if (!user?.organization || user.organization.type !== 'FACTORY') {
      throw new ForbiddenException('›ﬁÿ ò«—Œ«‰Â „Ìù Ê«‰œ ‰„«Ì‰œÂ «ÌÃ«œ ò‰œ');
    }

    // »——”Ì  ò—«—Ì ‰»Êœ‰ „Ê»«Ì·
    const existingUser = await prisma.user.findUnique({
      where: { mobile: data.mobile },
    });

    let agentUser: any;

    if (existingUser) {
      // «ê— ò«—»— ÊÃÊœ œ«—œ° ”«“„«‰ ÃœÌœ »Â «Ê «Œ ’«’ „ÌùœÂÌ„
      agentUser = existingUser;
    } else {
      // «ÌÃ«œ ò«—»— ÃœÌœ
      const tempPassword = Math.random().toString(36).slice(-8);
      const hashedPassword = await bcrypt.hash(tempPassword, 10);

      agentUser = await prisma.user.create({
        data: {
          mobile: data.mobile,
          email: data.email,
          firstName: data.name.split(' ')[0],
          lastName: data.name.split(' ').slice(1).join(' ') || '',
          passwordHash: hashedPassword,
          role: UserRole.SELLER,
          isActive: true,
        },
      });

      this.logger.log(`Created new agent user: ${agentUser.id} with temp password: ${tempPassword}`);
    }

    // «ÌÃ«œ Organization »—«Ì ‰„«Ì‰œÂ
    const agentOrg = await prisma.organization.create({
      data: {
        name: data.name,
        slug: `agent-${Date.now()}`,
        type: 'AGENT',
        nationalId: `TEMP-${Date.now()}`, // „Êﬁ  - »«Ìœ »⁄œ«  ò„Ì· ‘Êœ
        email: data.email || `${data.mobile}@temp.local`,
        phone: data.mobile,
        address: 'œ— «‰ Ÿ«—  ò„Ì· «ÿ·«⁄« ',
        city: ' Â—«‰',
        province: ' Â—«‰',
        postalCode: '0000000000',
        isActive: true,
        isVerified: false,
      },
    });

    // « ’«· ò«—»— »Â Organization
    await prisma.user.update({
      where: { id: agentUser.id },
      data: { organizationId: agentOrg.id },
    });

    // «ÌÃ«œ —«»ÿÂ B2B
    const relation = await prisma.b2BRelation.create({
      data: {
        supplierId: user.organization.id,
        buyerId: agentOrg.id,
        tierLevel: data.tierLevel,
        creditLimit: data.creditLimit,
        discountPercentage: data.discountPercentage,
        isActive: true,
      },
    });

    return {
      success: true,
      message: '‰„«Ì‰œÂ »« „Ê›ﬁÌ  «ÌÃ«œ ‘œ',
      data: {
        userId: agentUser.id,
        organizationId: agentOrg.id,
        relationId: relation.id,
        tierLevel: data.tierLevel,
      },
    };
  }

  /**
   * ·Ì”  „Ã—Ì«‰ “Ì—„Ã„Ê⁄Â ‰„«Ì‰œÂ
   */
  async getExecutorsByAgent(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        organization: {
          include: {
            supplierRelations: {
              where: { isActive: true },
              include: {
                buyer: {
                  include: {
                    members: {
                      where: { role: UserRole.EXECUTOR },
                      select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        mobile: true,
                        email: true,
                        executorProfile: true,
                        isActive: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!user?.organization) {
      throw new ForbiddenException('‘„« ⁄÷Ê ÂÌç ”«“„«‰Ì ‰Ì” Ìœ');
    }

    const executors = user.organization.supplierRelations.flatMap((relation) =>
      relation.buyer.members.map((member) => ({
        id: member.id,
        name: `${member.firstName} ${member.lastName}`,
        mobile: member.mobile,
        email: member.email,
        specialty: member.executorProfile?.specialty,
        organizationId: relation.buyerId,
        isActive: member.isActive,
      }))
    );

    return {
      success: true,
      data: executors,
    };
  }

  /**
   * «ÌÃ«œ „Ã—Ì ÃœÌœ  Ê”ÿ ‰„«Ì‰œÂ
   */
  async createExecutor(
    userId: string,
    data: {
      name: string;
      mobile: string;
      email?: string;
      specialty?: string;
    }
  ) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { organization: true },
    });

    if (!user?.organization) {
      throw new ForbiddenException('‘„« ⁄÷Ê ÂÌç ”«“„«‰Ì ‰Ì” Ìœ');
    }

    // »——”Ì  ò—«—Ì ‰»Êœ‰ „Ê»«Ì·
    const existingUser = await prisma.user.findUnique({
      where: { mobile: data.mobile },
    });

    if (existingUser) {
      throw new BadRequestException('«Ì‰ ‘„«—Â „Ê»«Ì· ﬁ»·« À»  ‘œÂ «” ');
    }

    // «ÌÃ«œ ò«—»— „Ã—Ì
    const tempPassword = Math.random().toString(36).slice(-8);
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    const executor = await prisma.user.create({
      data: {
        mobile: data.mobile,
        email: data.email,
        firstName: data.name.split(' ')[0],
        lastName: data.name.split(' ').slice(1).join(' ') || '',
        passwordHash: hashedPassword,
        role: UserRole.EXECUTOR,
        organizationId: user.organization.id,
        isActive: true,
        executorProfile: {
          create: {
            specialty: (data.specialty as ExecutorSkill) || ExecutorSkill.GENERAL_CONTRACTOR,
            isVerified: false,
            verificationNotes: 'Pending verification',
          },
        },
      },
    });

    this.logger.log(`Created new executor: ${executor.id} with temp password: ${tempPassword}`);

    return {
      success: true,
      message: '„Ã—Ì »« „Ê›ﬁÌ  «ÌÃ«œ ‘œ',
      data: {
        userId: executor.id,
        mobile: data.mobile,
        tempPassword, // œ— production »«Ìœ «“ ÿ—Ìﬁ SMS «—”«· ‘Êœ
      },
    };
  }
}
