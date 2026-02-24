import type { CheckoutStep } from './checkout.types';

export enum CheckoutGuardReason {
  SHIPPING_SET_REQUIRES_SHIPPING_STEP = 'shipping_set_requires_shipping_step',
  BILLING_SET_FORBIDDEN_STEP = 'billing_set_forbidden_step',
  PAYMENT_SET_REQUIRES_PAYMENT_STEP = 'payment_set_requires_payment_step',
  COMPLETE_REQUIRES_REVIEW_STEP = 'complete_requires_review_step',
}

export type CheckoutAction = 'set_shipping' | 'set_billing' | 'set_payment' | 'complete';

export const FLOW_STATE_BY_STEP: Record<CheckoutStep, string> = {
  CART: 'S5_CART_ACTIVE',
  SHIPPING: 'S6_CHECKOUT_INIT',
  PAYMENT: 'S7_CHECKOUT_SHIPPING_SET',
  REVIEW: 'S8_CHECKOUT_PAYMENT_SET',
  COMPLETE: 'S9_ORDER_CREATED',
} as const;

export const ALLOWED_STEP_TRANSITIONS: Record<CheckoutStep, readonly CheckoutStep[]> = {
  CART: ['SHIPPING'],
  SHIPPING: ['PAYMENT'],
  PAYMENT: ['REVIEW'],
  REVIEW: ['COMPLETE'],
  COMPLETE: [],
} as const;

const ACTION_CONTRACT: Record<
  CheckoutAction,
  {
    allowedCurrent: readonly CheckoutStep[];
    target: CheckoutStep | 'SAME';
    guardReason: CheckoutGuardReason;
  }
> = {
  set_shipping: {
    allowedCurrent: ['SHIPPING'],
    target: 'PAYMENT',
    guardReason: CheckoutGuardReason.SHIPPING_SET_REQUIRES_SHIPPING_STEP,
  },
  set_billing: {
    allowedCurrent: ['SHIPPING', 'PAYMENT', 'REVIEW'],
    target: 'SAME',
    guardReason: CheckoutGuardReason.BILLING_SET_FORBIDDEN_STEP,
  },
  set_payment: {
    allowedCurrent: ['PAYMENT'],
    target: 'REVIEW',
    guardReason: CheckoutGuardReason.PAYMENT_SET_REQUIRES_PAYMENT_STEP,
  },
  complete: {
    allowedCurrent: ['REVIEW'],
    target: 'COMPLETE',
    guardReason: CheckoutGuardReason.COMPLETE_REQUIRES_REVIEW_STEP,
  },
} as const;

export function flowStateFromStep(step: CheckoutStep): string {
  return FLOW_STATE_BY_STEP[step] ?? 'S_ERR';
}

export function resolveTargetStep(action: CheckoutAction, currentStep: CheckoutStep): CheckoutStep {
  const target = ACTION_CONTRACT[action].target;
  return target === 'SAME' ? currentStep : target;
}

export function assertCheckoutActionAllowed(
  action: CheckoutAction,
  currentStep: CheckoutStep
): { allowed: true; targetStep: CheckoutStep } | { allowed: false; targetStep: CheckoutStep; guardReason: CheckoutGuardReason } {
  const contract = ACTION_CONTRACT[action];
  const targetStep = resolveTargetStep(action, currentStep);

  if (!contract.allowedCurrent.includes(currentStep)) {
    return {
      allowed: false,
      targetStep,
      guardReason: contract.guardReason,
    };
  }

  if (targetStep !== currentStep) {
    const allowedTransitions = ALLOWED_STEP_TRANSITIONS[currentStep];
    if (!allowedTransitions.includes(targetStep)) {
      return {
        allowed: false,
        targetStep,
        guardReason: contract.guardReason,
      };
    }
  }

  return { allowed: true, targetStep };
}
