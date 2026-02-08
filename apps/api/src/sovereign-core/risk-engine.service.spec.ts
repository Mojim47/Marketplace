/**
 * ===========================================================================
 * RISK ENGINE UNIT TESTS
 * ===========================================================================
 * Purpose: Validate Lambda decay formula, Risk-sharing vouching, Time-weighted scoring
 * Critical: Must test exponential decay accuracy and cascading penalties
 * ===========================================================================
 */

import { RiskEngine } from './risk-engine.service';
import { Decimal } from '@prisma/client/runtime/library';

type FinancialEventType =
  | 'PAYMENT_LATE'
  | 'PAYMENT_ON_TIME'
  | 'CREDIT_INCREASE'
  | 'CHEQUE_BOUNCED'
  | 'DEFAULT'
  | 'VOUCHED_FAILURE';

type Organization = {
  id: string;
  name: string;
  type: string;
  countryCode: string;
};

type RiskProfile = {
  id: string;
  organizationId: string;
  score: Decimal;
  baseCreditLimit: Decimal;
  creditMultiplier: Decimal;
  currentCreditLimit: Decimal;
  creditUsed: Decimal;
  decayLambda: Decimal;
};

type FinancialEvent = {
  id: string;
  riskProfileId: string;
  eventType: FinancialEventType;
  impactValue: Decimal;
  description: string;
  occurredAt: Date;
  processed: boolean;
  processedAt?: Date | null;
};

type ReputationVouch = {
  id: string;
  voucherProfileId: string;
  voucheeProfileId: string;
  vouchAmount: Decimal;
  riskSharePercentage: Decimal;
  isActive: boolean;
  isDefaulted: boolean;
  expiresAt: Date | null;
  defaultedAt: Date | null;
};

const toDecimal = (value: Decimal | number | string | undefined, fallback = 0) => {
  if (value instanceof Decimal) {
    return value;
  }
  const safeValue = value ?? fallback;
  return new Decimal(safeValue);
};

const createRiskPrismaMock = () => {
  let idCounter = 0;
  const nextId = () => `risk_${++idCounter}`;

  const organizations = new Map<string, Organization>();
  const riskProfiles = new Map<string, RiskProfile>();
  const financialEvents = new Map<string, FinancialEvent>();
  const reputationVouches = new Map<string, ReputationVouch>();

  const prisma = {
    organization: {
      create: vi.fn(async ({ data }: { data: Omit<Organization, 'id'> }) => {
        const record: Organization = { id: nextId(), ...data };
        organizations.set(record.id, record);
        return record;
      }),
      delete: vi.fn(async ({ where }: { where: { id: string } }) => {
        const record = organizations.get(where.id);
        organizations.delete(where.id);
        return record;
      }),
    },
    riskProfile: {
      create: vi.fn(
        async ({ data }: { data: Partial<RiskProfile> & { organizationId: string } }) => {
          const record: RiskProfile = {
            id: nextId(),
            organizationId: data.organizationId,
            score: toDecimal(data.score, 100),
            baseCreditLimit: toDecimal(data.baseCreditLimit),
            creditMultiplier: toDecimal(data.creditMultiplier, 1),
            currentCreditLimit: toDecimal(
              data.currentCreditLimit,
              toDecimal(data.baseCreditLimit).mul(toDecimal(data.creditMultiplier, 1))
            ),
            creditUsed: toDecimal(data.creditUsed),
            decayLambda: toDecimal(data.decayLambda, 0.1),
          };
          riskProfiles.set(record.id, record);
          return record;
        }
      ),
      findUnique: vi.fn(
        async ({
          where,
          include,
        }: {
          where: { id?: string; organizationId?: string };
          include?: any;
        }) => {
          let record: RiskProfile | undefined;
          if (where.id) {
            record = riskProfiles.get(where.id);
          } else if (where.organizationId) {
            record = Array.from(riskProfiles.values()).find(
              (profile) => profile.organizationId === where.organizationId
            );
          }
          if (!record) {
            return null;
          }
          const result: any = { ...record };
          if (include?.financialEvents) {
            const events = Array.from(financialEvents.values()).filter(
              (event) =>
                event.riskProfileId === record!.id &&
                (!include.financialEvents.where ||
                  event.processed === include.financialEvents.where.processed)
            );
            result.financialEvents = events.sort(
              (a, b) => b.occurredAt.getTime() - a.occurredAt.getTime()
            );
          }
          if (include?.vouchesReceived) {
            const vouches = Array.from(reputationVouches.values()).filter(
              (vouch) =>
                vouch.voucheeProfileId === record!.id &&
                (!include.vouchesReceived.where ||
                  (vouch.isActive === include.vouchesReceived.where.isActive &&
                    vouch.isDefaulted === include.vouchesReceived.where.isDefaulted))
            );
            result.vouchesReceived = vouches.map((vouch) => ({
              ...vouch,
              voucherProfile: riskProfiles.get(vouch.voucherProfileId),
            }));
          }
          return result;
        }
      ),
      update: vi.fn(
        async ({ where, data }: { where: { id: string }; data: Partial<RiskProfile> }) => {
          const existing = riskProfiles.get(where.id);
          if (!existing) {
            return null;
          }
          const updated: RiskProfile = {
            ...existing,
            ...data,
            score: data.score ? toDecimal(data.score) : existing.score,
            baseCreditLimit: data.baseCreditLimit
              ? toDecimal(data.baseCreditLimit)
              : existing.baseCreditLimit,
            creditMultiplier: data.creditMultiplier
              ? toDecimal(data.creditMultiplier)
              : existing.creditMultiplier,
            currentCreditLimit: data.currentCreditLimit
              ? toDecimal(data.currentCreditLimit)
              : existing.currentCreditLimit,
            creditUsed: data.creditUsed ? toDecimal(data.creditUsed) : existing.creditUsed,
            decayLambda: data.decayLambda ? toDecimal(data.decayLambda) : existing.decayLambda,
          };
          riskProfiles.set(where.id, updated);
          return updated;
        }
      ),
      delete: vi.fn(async ({ where }: { where: { id: string } }) => {
        const record = riskProfiles.get(where.id);
        riskProfiles.delete(where.id);
        return record;
      }),
      deleteMany: vi.fn(async ({ where }: { where?: { id?: string } }) => {
        if (!where?.id) {
          const count = riskProfiles.size;
          riskProfiles.clear();
          return { count };
        }
        const existed = riskProfiles.delete(where.id);
        return { count: existed ? 1 : 0 };
      }),
    },
    financialEvent: {
      create: vi.fn(
        async ({
          data,
        }: {
          data: Partial<FinancialEvent> & { riskProfileId: string; eventType: FinancialEventType };
        }) => {
          const record: FinancialEvent = {
            id: nextId(),
            riskProfileId: data.riskProfileId,
            eventType: data.eventType,
            impactValue: toDecimal(data.impactValue),
            description: data.description ?? '',
            occurredAt: data.occurredAt ?? new Date(),
            processed: data.processed ?? false,
            processedAt: data.processedAt ?? null,
          };
          financialEvents.set(record.id, record);
          return record;
        }
      ),
      findMany: vi.fn(async ({ where }: { where?: Partial<FinancialEvent> }) => {
        return Array.from(financialEvents.values()).filter((event) => {
          if (!where) return true;
          return Object.entries(where).every(([key, value]) => (event as any)[key] === value);
        });
      }),
      update: vi.fn(
        async ({ where, data }: { where: { id: string }; data: Partial<FinancialEvent> }) => {
          const existing = financialEvents.get(where.id);
          if (!existing) {
            return null;
          }
          const updated: FinancialEvent = {
            ...existing,
            ...data,
            impactValue: data.impactValue ? toDecimal(data.impactValue) : existing.impactValue,
          };
          financialEvents.set(where.id, updated);
          return updated;
        }
      ),
      deleteMany: vi.fn(
        async ({ where }: { where?: { riskProfileId?: string | { in: string[] } } }) => {
          const ids = Array.from(financialEvents.values())
            .filter((event) => {
              if (!where?.riskProfileId) return true;
              if (typeof where.riskProfileId === 'string') {
                return event.riskProfileId === where.riskProfileId;
              }
              return where.riskProfileId.in.includes(event.riskProfileId);
            })
            .map((event) => event.id);
          ids.forEach((id) => financialEvents.delete(id));
          return { count: ids.length };
        }
      ),
    },
    reputationVouch: {
      create: vi.fn(
        async ({
          data,
        }: {
          data: Partial<ReputationVouch> & {
            voucherProfileId: string;
            voucheeProfileId: string;
            vouchAmount: Decimal;
            riskSharePercentage: Decimal;
          };
        }) => {
          const record: ReputationVouch = {
            id: nextId(),
            voucherProfileId: data.voucherProfileId,
            voucheeProfileId: data.voucheeProfileId,
            vouchAmount: toDecimal(data.vouchAmount),
            riskSharePercentage: toDecimal(data.riskSharePercentage),
            isActive: data.isActive ?? true,
            isDefaulted: data.isDefaulted ?? false,
            expiresAt: data.expiresAt ?? null,
            defaultedAt: data.defaultedAt ?? null,
          };
          reputationVouches.set(record.id, record);
          return record;
        }
      ),
      findMany: vi.fn(async ({ where }: { where?: Partial<ReputationVouch> }) => {
        return Array.from(reputationVouches.values()).filter((vouch) => {
          if (!where) return true;
          return Object.entries(where).every(([key, value]) => (vouch as any)[key] === value);
        });
      }),
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
        return reputationVouches.get(where.id) ?? null;
      }),
      updateMany: vi.fn(async ({ where, data }: { where: Partial<ReputationVouch>; data: any }) => {
        let count = 0;
        reputationVouches.forEach((vouch, id) => {
          const match = Object.entries(where).every(([key, value]) => (vouch as any)[key] === value);
          if (match) {
            reputationVouches.set(id, { ...vouch, ...data });
            count += 1;
          }
        });
        return { count };
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: any }) => {
        const existing = reputationVouches.get(where.id);
        if (!existing) {
          return null;
        }
        const updated = { ...existing, ...data };
        reputationVouches.set(where.id, updated);
        return updated;
      }),
      deleteMany: vi.fn(
        async ({ where }: { where?: { voucherId?: string; id?: string; OR?: any[] } }) => {
          let ids = Array.from(reputationVouches.keys());
          if (where?.id) {
            ids = ids.filter((id) => id === where.id);
          }
          if (where?.voucherId) {
            ids = ids.filter(
              (id) => reputationVouches.get(id)?.voucherProfileId === where.voucherId
            );
          }
          if (where?.OR) {
            ids = ids.filter((id) => {
              const vouch = reputationVouches.get(id);
              if (!vouch) return false;
              return where.OR.some((condition) => {
                if (condition.voucherId) {
                  return vouch.voucherProfileId === condition.voucherId;
                }
                return false;
              });
            });
          }
          ids.forEach((id) => reputationVouches.delete(id));
          return { count: ids.length };
        }
      ),
    },
    $transaction: vi.fn(async (callback: any) => callback(prisma)),
    $disconnect: vi.fn(),
  };

  return prisma;
};

describe('RiskEngine Service - Risk Management & Lambda Decay Tests', () => {
  let riskEngine: RiskEngine;
  let prisma: ReturnType<typeof createRiskPrismaMock>;

  beforeAll(async () => {
    const mockPrismaService = createRiskPrismaMock();
    riskEngine = new RiskEngine(mockPrismaService as unknown as any);
    prisma = mockPrismaService;
  });

  afterAll(async () => {
    vi.clearAllMocks();
  });

  /**
   * Test 1: Lambda Decay Formula Validation
   * Critical: Must accurately implement e^(-? × t) decay
   */
  describe('Lambda Decay Formula Tests', () => {
    it('should apply exponential decay correctly for old events', async () => {
      // Create test organization
      const org = await prisma.organization.create({
        data: {
          name: 'Test Decay Org',
          type: 'AGENT',
          countryCode: 'IR',
        },
      });

      // Create risk profile with Lambda = 0.1
      const profile = await prisma.riskProfile.create({
        data: {
          organizationId: org.id,
          score: new Decimal('100'),
          baseCreditLimit: new Decimal('10000'),
          decayLambda: new Decimal('0.1'),
        },
      });

      // Create old event (12 months ago)
      const oldEventDate = new Date();
      oldEventDate.setMonth(oldEventDate.getMonth() - 12);

      await prisma.financialEvent.create({
        data: {
          riskProfileId: profile.id,
          eventType: 'PAYMENT_LATE',
          impactValue: new Decimal('-20'),
          description: 'Late payment 12 months ago',
          occurredAt: oldEventDate,
          processed: false,
        },
      });

      // Process event
      const result = await riskEngine.processFinancialEvent({
        organizationId: org.id,
        eventType: 'PAYMENT_LATE',
        impactValue: 0,
        description: 'Test event (no additional impact)',
      });

      // Manual calculation: score = 100 + (-20 × e^(-0.1 × 12))
      const lambda = 0.1;
      const months =
        (Date.now() - oldEventDate.getTime()) / (1000 * 60 * 60 * 24 * 30);
      const decayFactor = Math.exp(-lambda * months);
      const expectedImpact = -20 * decayFactor;
      const expectedScore = 100 + expectedImpact;

      // Assert score matches decay formula
      expect(result.riskProfile.score.toNumber()).toBeCloseTo(expectedScore, 2);

      // Cleanup
      await prisma.financialEvent.deleteMany({ where: { riskProfileId: profile.id } });
      await prisma.riskProfile.delete({ where: { id: profile.id } });
      await prisma.organization.delete({ where: { id: org.id } });
    });

    it('should apply full impact for recent events (decay factor ≈ 1)', async () => {
      const org = await prisma.organization.create({
        data: {
          name: 'Test Recent Event Org',
          type: 'AGENT',
          countryCode: 'IR',
        },
      });

      const profile = await prisma.riskProfile.create({
        data: {
          organizationId: org.id,
          score: new Decimal('100'),
          baseCreditLimit: new Decimal('10000'),
          decayLambda: new Decimal('0.1'),
        },
      });

      // Process recent event
      const result = await riskEngine.processFinancialEvent({
        organizationId: org.id,
        eventType: 'PAYMENT_ON_TIME',
        impactValue: 10,
        description: 'On-time payment today',
      });

      // Recent event (< 1 month) should apply almost full impact
      // score = 100 + (10 × e^(-0.1 × 0)) = 100 + 10 = 110
      expect(result.riskProfile.score.toNumber()).toBeCloseTo(110, 1);

      // Cleanup
      await prisma.financialEvent.deleteMany({ where: { riskProfileId: profile.id } });
      await prisma.riskProfile.delete({ where: { id: profile.id } });
      await prisma.organization.delete({ where: { id: org.id } });
    });

    it('should clamp score between 0 and 200', async () => {
      const org = await prisma.organization.create({
        data: {
          name: 'Test Clamping Org',
          type: 'AGENT',
          countryCode: 'IR',
        },
      });

      const profile = await prisma.riskProfile.create({
        data: {
          organizationId: org.id,
          score: new Decimal('190'),
          baseCreditLimit: new Decimal('10000'),
          decayLambda: new Decimal('0.1'),
        },
      });

      // Apply large positive impact to test upper clamping
      const result = await riskEngine.processFinancialEvent({
        organizationId: org.id,
        eventType: 'CREDIT_INCREASE',
        impactValue: 50,
        description: 'Large credit increase',
      });

      // Should clamp to 200
      expect(result.riskProfile.score.toNumber()).toBe(200);

      // Cleanup
      await prisma.financialEvent.deleteMany({ where: { riskProfileId: profile.id } });
      await prisma.riskProfile.delete({ where: { id: profile.id } });
      await prisma.organization.delete({ where: { id: org.id } });
    });
  });

  /**
   * Test 2: Dynamic Credit Limit Calculation
   */
  describe('Dynamic Credit Limit Tests', () => {
    it('should calculate credit limit as baseCreditLimit × (score / 100)', async () => {
      const org = await prisma.organization.create({
        data: {
          name: 'Test Credit Limit Org',
          type: 'AGENT',
          countryCode: 'IR',
        },
      });

      const profile = await prisma.riskProfile.create({
        data: {
          organizationId: org.id,
          score: new Decimal('150'), // Score = 150
          baseCreditLimit: new Decimal('10000'), // Base = 10,000
          decayLambda: new Decimal('0.1'),
        },
      });

      // Process event to trigger credit recalculation
      await riskEngine.processFinancialEvent({
        organizationId: org.id,
        eventType: 'PAYMENT_ON_TIME',
        impactValue: 0,
        description: 'Test credit recalculation',
      });

      const updatedProfile = await prisma.riskProfile.findUnique({
        where: { id: profile.id },
      });

      // Credit = 10,000 × (150 / 100) = 15,000
      expect(updatedProfile?.currentCreditLimit.toNumber()).toBe(15000);

      // Cleanup
      await prisma.financialEvent.deleteMany({ where: { riskProfileId: profile.id } });
      await prisma.riskProfile.delete({ where: { id: profile.id } });
      await prisma.organization.delete({ where: { id: org.id } });
    });

    it('should decrease credit limit when score drops', async () => {
      const org = await prisma.organization.create({
        data: {
          name: 'Test Credit Decrease Org',
          type: 'AGENT',
          countryCode: 'IR',
        },
      });

      const profile = await prisma.riskProfile.create({
        data: {
          organizationId: org.id,
          score: new Decimal('100'),
          baseCreditLimit: new Decimal('10000'),
          decayLambda: new Decimal('0.1'),
        },
      });

      // Apply negative event
      await riskEngine.processFinancialEvent({
        organizationId: org.id,
        eventType: 'CHEQUE_BOUNCED',
        impactValue: -30,
        description: 'Bounced cheque',
      });

      const updatedProfile = await prisma.riskProfile.findUnique({
        where: { id: profile.id },
      });

      // Score dropped to ~70, so credit = 10,000 × 0.7 = 7,000
      expect(updatedProfile?.currentCreditLimit.toNumber()).toBeLessThan(10000);
      expect(updatedProfile?.currentCreditLimit.toNumber()).toBeCloseTo(7000, -2);

      // Cleanup
      await prisma.financialEvent.deleteMany({ where: { riskProfileId: profile.id } });
      await prisma.riskProfile.delete({ where: { id: profile.id } });
      await prisma.organization.delete({ where: { id: org.id } });
    });
  });

  /**
   * Test 3: Risk-Sharing Vouch System
   */
  describe('Risk-Sharing Vouch Tests', () => {
    it('should create vouch and increase vouchee credit limit', async () => {
      // Create voucher organization
      const voucherOrg = await prisma.organization.create({
        data: {
          name: 'Voucher Org',
          type: 'FACTORY',
          countryCode: 'IR',
        },
      });

      const voucherProfile = await prisma.riskProfile.create({
        data: {
          organizationId: voucherOrg.id,
          score: new Decimal('150'),
          baseCreditLimit: new Decimal('50000'),
          currentCreditLimit: new Decimal('75000'), // 50,000 × 1.5
          decayLambda: new Decimal('0.1'),
        },
      });

      // Create vouchee organization
      const voucheeOrg = await prisma.organization.create({
        data: {
          name: 'Vouchee Org',
          type: 'AGENT',
          countryCode: 'IR',
        },
      });

      const voucheeProfile = await prisma.riskProfile.create({
        data: {
          organizationId: voucheeOrg.id,
          score: new Decimal('80'),
          baseCreditLimit: new Decimal('10000'),
          currentCreditLimit: new Decimal('8000'), // 10,000 × 0.8
          decayLambda: new Decimal('0.1'),
        },
      });

      // Voucher vouches for vouchee with 20,000 at 50% risk share
      const result = await riskEngine.vouchForOrganization({
        voucherOrganizationId: voucherOrg.id,
        voucheeOrganizationId: voucheeOrg.id,
        vouchAmount: 20000,
        riskSharePercentage: 50,
        expirationDays: 180,
      });

      expect(result.success).toBe(true);
      expect(result.vouch).toBeDefined();

      // Check vouchee credit increased by vouch amount
      const updatedVoucheeProfile = await prisma.riskProfile.findUnique({
        where: { id: voucheeProfile.id },
      });

      expect(updatedVoucheeProfile?.currentCreditLimit.toNumber()).toBe(28000); // 8,000 + 20,000

      // Cleanup
      await prisma.reputationVouch.deleteMany({ where: { voucherId: voucherProfile.id } });
      await prisma.riskProfile.delete({ where: { id: voucherProfile.id } });
      await prisma.riskProfile.delete({ where: { id: voucheeProfile.id } });
      await prisma.organization.delete({ where: { id: voucherOrg.id } });
      await prisma.organization.delete({ where: { id: voucheeOrg.id } });
    });

    it('should reject vouch if voucher has insufficient credit', async () => {
      const voucherOrg = await prisma.organization.create({
        data: {
          name: 'Poor Voucher Org',
          type: 'AGENT',
          countryCode: 'IR',
        },
      });

      const voucherProfile = await prisma.riskProfile.create({
        data: {
          organizationId: voucherOrg.id,
          score: new Decimal('50'), // Low score
          baseCreditLimit: new Decimal('10000'),
          currentCreditLimit: new Decimal('5000'), // 10,000 × 0.5
          decayLambda: new Decimal('0.1'),
        },
      });

      const voucheeOrg = await prisma.organization.create({
        data: {
          name: 'Vouchee Org 2',
          type: 'AGENT',
          countryCode: 'IR',
        },
      });

      const voucheeProfile = await prisma.riskProfile.create({
        data: {
          organizationId: voucheeOrg.id,
          score: new Decimal('100'),
          baseCreditLimit: new Decimal('10000'),
          decayLambda: new Decimal('0.1'),
        },
      });

      // Try to vouch 10,000 but only has 5,000 credit
      await expect(
        riskEngine.vouchForOrganization({
          voucherOrganizationId: voucherOrg.id,
          voucheeOrganizationId: voucheeOrg.id,
          vouchAmount: 10000,
          riskSharePercentage: 50,
        })
      ).rejects.toThrow(/insufficient credit/i);

      // Cleanup
      await prisma.riskProfile.delete({ where: { id: voucherProfile.id } });
      await prisma.riskProfile.delete({ where: { id: voucheeProfile.id } });
      await prisma.organization.delete({ where: { id: voucherOrg.id } });
      await prisma.organization.delete({ where: { id: voucheeOrg.id } });
    });
  });

  /**
   * Test 4: Vouchee Default Cascading Penalties
   */
  describe('Vouchee Default Cascading Penalty Tests', () => {
    it('should penalize vouchers proportionally when vouchee defaults', async () => {
      // Create voucher 1
      const voucher1Org = await prisma.organization.create({
        data: {
          name: 'Voucher 1',
          type: 'FACTORY',
          countryCode: 'IR',
        },
      });

      const voucher1Profile = await prisma.riskProfile.create({
        data: {
          organizationId: voucher1Org.id,
          score: new Decimal('150'),
          baseCreditLimit: new Decimal('100000'),
          currentCreditLimit: new Decimal('150000'),
          decayLambda: new Decimal('0.1'),
        },
      });

      // Create voucher 2
      const voucher2Org = await prisma.organization.create({
        data: {
          name: 'Voucher 2',
          type: 'FACTORY',
          countryCode: 'IR',
        },
      });

      const voucher2Profile = await prisma.riskProfile.create({
        data: {
          organizationId: voucher2Org.id,
          score: new Decimal('130'),
          baseCreditLimit: new Decimal('80000'),
          currentCreditLimit: new Decimal('104000'),
          decayLambda: new Decimal('0.1'),
        },
      });

      // Create vouchee
      const voucheeOrg = await prisma.organization.create({
        data: {
          name: 'Defaulting Vouchee',
          type: 'AGENT',
          countryCode: 'IR',
        },
      });

      const voucheeProfile = await prisma.riskProfile.create({
        data: {
          organizationId: voucheeOrg.id,
          score: new Decimal('100'),
          baseCreditLimit: new Decimal('10000'),
          currentCreditLimit: new Decimal('10000'),
          decayLambda: new Decimal('0.1'),
        },
      });

      // Voucher 1 vouches 30,000 at 60% risk share
      await riskEngine.vouchForOrganization({
        voucherOrganizationId: voucher1Org.id,
        voucheeOrganizationId: voucheeOrg.id,
        vouchAmount: 30000,
        riskSharePercentage: 60,
      });

      // Voucher 2 vouches 20,000 at 40% risk share
      await riskEngine.vouchForOrganization({
        voucherOrganizationId: voucher2Org.id,
        voucheeOrganizationId: voucheeOrg.id,
        vouchAmount: 20000,
        riskSharePercentage: 40,
      });

      // Vouchee defaults with 25,000
      const result = await riskEngine.processVoucheeDefault(voucheeOrg.id, 25000);

      expect(result.success).toBe(true);
      expect(result.vouchesAffected).toBe(2);

      // Voucher losses are based on each vouch's risk share percentage
      // Voucher 1 loss = 25,000 × 0.60 = 15,000
      // Voucher 2 loss = 25,000 × 0.40 = 10,000

      const updatedVoucher1 = await prisma.riskProfile.findUnique({
        where: { id: voucher1Profile.id },
      });

      const updatedVoucher2 = await prisma.riskProfile.findUnique({
        where: { id: voucher2Profile.id },
      });

      // Voucher 1 credit should decrease by 15,000
      expect(updatedVoucher1?.currentCreditLimit.toNumber()).toBeCloseTo(135000, -2);

      // Voucher 2 credit should decrease by 10,000
      expect(updatedVoucher2?.currentCreditLimit.toNumber()).toBeCloseTo(94000, -2);

      // Cleanup
      await prisma.reputationVouch.deleteMany({
        where: {
          OR: [{ voucherId: voucher1Profile.id }, { voucherId: voucher2Profile.id }],
        },
      });
      await prisma.financialEvent.deleteMany({
        where: {
          riskProfileId: {
            in: [voucher1Profile.id, voucher2Profile.id, voucheeProfile.id],
          },
        },
      });
      await prisma.riskProfile.delete({ where: { id: voucher1Profile.id } });
      await prisma.riskProfile.delete({ where: { id: voucher2Profile.id } });
      await prisma.riskProfile.delete({ where: { id: voucheeProfile.id } });
      await prisma.organization.delete({ where: { id: voucher1Org.id } });
      await prisma.organization.delete({ where: { id: voucher2Org.id } });
      await prisma.organization.delete({ where: { id: voucheeOrg.id } });
    });

    it('should deactivate vouches after processing default', async () => {
      const voucherOrg = await prisma.organization.create({
        data: {
          name: 'Voucher for Deactivation Test',
          type: 'FACTORY',
          countryCode: 'IR',
        },
      });

      const voucherProfile = await prisma.riskProfile.create({
        data: {
          organizationId: voucherOrg.id,
          score: new Decimal('150'),
          baseCreditLimit: new Decimal('100000'),
          currentCreditLimit: new Decimal('150000'),
          decayLambda: new Decimal('0.1'),
        },
      });

      const voucheeOrg = await prisma.organization.create({
        data: {
          name: 'Vouchee for Deactivation Test',
          type: 'AGENT',
          countryCode: 'IR',
        },
      });

      const voucheeProfile = await prisma.riskProfile.create({
        data: {
          organizationId: voucheeOrg.id,
          score: new Decimal('100'),
          baseCreditLimit: new Decimal('10000'),
          currentCreditLimit: new Decimal('10000'),
          decayLambda: new Decimal('0.1'),
        },
      });

      // Create vouch
      const vouchResult = await riskEngine.vouchForOrganization({
        voucherOrganizationId: voucherOrg.id,
        voucheeOrganizationId: voucheeOrg.id,
        vouchAmount: 20000,
        riskSharePercentage: 50,
      });

      const vouchId = vouchResult.vouch!.id;

      // Process default
      await riskEngine.processVoucheeDefault(voucheeOrg.id, 10000);

      // Check vouch is deactivated
      const deactivatedVouch = await prisma.reputationVouch.findUnique({
        where: { id: vouchId },
      });

      expect(deactivatedVouch?.isActive).toBe(false);

      // Cleanup
      await prisma.reputationVouch.deleteMany({ where: { id: vouchId } });
      await prisma.financialEvent.deleteMany({
        where: {
          riskProfileId: { in: [voucherProfile.id, voucheeProfile.id] },
        },
      });
      await prisma.riskProfile.delete({ where: { id: voucherProfile.id } });
      await prisma.riskProfile.delete({ where: { id: voucheeProfile.id } });
      await prisma.organization.delete({ where: { id: voucherOrg.id } });
      await prisma.organization.delete({ where: { id: voucheeOrg.id } });
    });
  });
});
