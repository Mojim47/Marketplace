/**
 * ???????????????????????????????????????????????????????????????????????????
 * USER STATE MACHINE & KYB (Know Your Business)
 * ???????????????????????????????????????????????????????????????????????????
 * Purpose: Zero-Touch Onboarding with automatic verification flow
 * Critical: Filter dirty data before it enters RiskEngine
 * ???????????????????????????????????????????????????????????????????????????
 */

export enum VerificationStatus {
  PENDING = 'PENDING',
  PENDING_KYB = 'PENDING_KYB',
  ACTIVE_LIMITED = 'ACTIVE_LIMITED',
  ACTIVE_FULL = 'ACTIVE_FULL',
  SUSPENDED = 'SUSPENDED',
  REJECTED = 'REJECTED',
}

export enum KYBStatus {
  NOT_STARTED = 'NOT_STARTED',
  IN_PROGRESS = 'IN_PROGRESS',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  NEEDS_REVIEW = 'NEEDS_REVIEW',
}

/**
 * State Machine Transitions
 *
 * PENDING ? PENDING_KYB (submit documents)
 * PENDING_KYB ? ACTIVE_LIMITED (auto-approve basic checks)
 * ACTIVE_LIMITED ? ACTIVE_FULL (manual approval or auto after 30 days)
 * ACTIVE_FULL ? SUSPENDED (admin action or risk violation)
 * * ? REJECTED (failed KYB)
 */

export interface UserVerificationDTO {
  userId: string;
  currentStatus: VerificationStatus;
  kybStatus: KYBStatus;
  submittedDocuments?: string[];
  rejectionReason?: string;
  approvedAt?: Date;
  approvedBy?: string;
}

export interface KYBSubmissionDTO {
  userId: string;
  organizationId: string;
  businessName: string;
  taxId: string;
  businessType: 'FACTORY' | 'AGENT' | 'EXECUTOR';
  businessAddress: string;
  businessPhone: string;
  // Documents
  nationalIdDocument?: string; // Base64 or URL
  businessLicenseDocument?: string;
  taxCertificateDocument?: string;
  // Contact person
  contactPersonName: string;
  contactPersonMobile: string;
  contactPersonEmail?: string;
}

export interface KYBApprovalDTO {
  userId: string;
  approved: boolean;
  creditLimitBase?: number; // Initial credit limit if approved
  riskScoreBase?: number; // Initial risk score (default 100)
  approverNotes?: string;
  rejectionReason?: string;
}

export interface StateTransitionDTO {
  userId: string;
  fromStatus: VerificationStatus;
  toStatus: VerificationStatus;
  reason: string;
  triggeredBy: 'USER' | 'SYSTEM' | 'ADMIN';
  metadata?: Record<string, any>;
}

/**
 * Validation Rules for State Transitions
 */
export const STATE_TRANSITION_RULES = {
  [VerificationStatus.PENDING]: [VerificationStatus.PENDING_KYB, VerificationStatus.REJECTED],
  [VerificationStatus.PENDING_KYB]: [
    VerificationStatus.ACTIVE_LIMITED,
    VerificationStatus.REJECTED,
  ],
  [VerificationStatus.ACTIVE_LIMITED]: [
    VerificationStatus.ACTIVE_FULL,
    VerificationStatus.SUSPENDED,
  ],
  [VerificationStatus.ACTIVE_FULL]: [VerificationStatus.SUSPENDED],
  [VerificationStatus.SUSPENDED]: [
    VerificationStatus.ACTIVE_LIMITED,
    VerificationStatus.ACTIVE_FULL,
    VerificationStatus.REJECTED,
  ],
  [VerificationStatus.REJECTED]: [], // Terminal state
} as const;

/**
 * Credit Limit Rules by Verification Status
 */
export const CREDIT_LIMIT_BY_STATUS = {
  [VerificationStatus.PENDING]: 0,
  [VerificationStatus.PENDING_KYB]: 0,
  [VerificationStatus.ACTIVE_LIMITED]: 5_000_000, // 5M Toman
  [VerificationStatus.ACTIVE_FULL]: 50_000_000, // 50M Toman (default, can be customized)
  [VerificationStatus.SUSPENDED]: 0,
  [VerificationStatus.REJECTED]: 0,
} as const;

/**
 * Initial Risk Score by Verification Status
 */
export const RISK_SCORE_BY_STATUS = {
  [VerificationStatus.PENDING]: 0,
  [VerificationStatus.PENDING_KYB]: 50,
  [VerificationStatus.ACTIVE_LIMITED]: 80,
  [VerificationStatus.ACTIVE_FULL]: 100,
  [VerificationStatus.SUSPENDED]: 0,
  [VerificationStatus.REJECTED]: 0,
} as const;
