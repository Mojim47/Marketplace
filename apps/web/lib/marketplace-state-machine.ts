'use client';

import { emitUiEvent } from '@/lib/ui-telemetry';

export type MarketplaceState =
  | 'S0_ANON'
  | 'S1_AUTHENTICATED'
  | 'S2_TOKEN_EXPIRED'
  | 'S3_SESSION_INVALID'
  | 'S4_CART_EMPTY'
  | 'S5_CART_ACTIVE'
  | 'S6_CHECKOUT_INIT'
  | 'S7_CHECKOUT_SHIPPING_SET'
  | 'S8_CHECKOUT_PAYMENT_SET'
  | 'S9_ORDER_CREATED'
  | 'S10_PAYMENT_PENDING'
  | 'S11_PAYMENT_SUCCESS'
  | 'S12_PAYMENT_FAILED'
  | 'S13_LOGGED_OUT'
  | 'S_ERR';

const FLOW_STATE_KEY = 'ng_marketplace_state';

const allowedTransitions: Record<MarketplaceState, MarketplaceState[]> = {
  S0_ANON: ['S1_AUTHENTICATED', 'S2_TOKEN_EXPIRED', 'S_ERR', 'S13_LOGGED_OUT'],
  S1_AUTHENTICATED: [
    'S2_TOKEN_EXPIRED',
    'S4_CART_EMPTY',
    'S5_CART_ACTIVE',
    'S13_LOGGED_OUT',
    'S_ERR',
  ],
  S2_TOKEN_EXPIRED: ['S1_AUTHENTICATED', 'S3_SESSION_INVALID', 'S_ERR'],
  S3_SESSION_INVALID: ['S13_LOGGED_OUT', 'S_ERR'],
  S4_CART_EMPTY: ['S2_TOKEN_EXPIRED', 'S5_CART_ACTIVE', 'S13_LOGGED_OUT', 'S_ERR'],
  S5_CART_ACTIVE: [
    'S2_TOKEN_EXPIRED',
    'S4_CART_EMPTY',
    'S6_CHECKOUT_INIT',
    'S13_LOGGED_OUT',
    'S_ERR',
  ],
  S6_CHECKOUT_INIT: ['S2_TOKEN_EXPIRED', 'S7_CHECKOUT_SHIPPING_SET', 'S_ERR', 'S13_LOGGED_OUT'],
  S7_CHECKOUT_SHIPPING_SET: [
    'S2_TOKEN_EXPIRED',
    'S8_CHECKOUT_PAYMENT_SET',
    'S_ERR',
    'S13_LOGGED_OUT',
  ],
  S8_CHECKOUT_PAYMENT_SET: ['S2_TOKEN_EXPIRED', 'S9_ORDER_CREATED', 'S_ERR', 'S13_LOGGED_OUT'],
  S9_ORDER_CREATED: [
    'S2_TOKEN_EXPIRED',
    'S10_PAYMENT_PENDING',
    'S11_PAYMENT_SUCCESS',
    'S12_PAYMENT_FAILED',
    'S_ERR',
    'S13_LOGGED_OUT',
  ],
  S10_PAYMENT_PENDING: [
    'S2_TOKEN_EXPIRED',
    'S11_PAYMENT_SUCCESS',
    'S12_PAYMENT_FAILED',
    'S13_LOGGED_OUT',
    'S_ERR',
  ],
  S11_PAYMENT_SUCCESS: ['S2_TOKEN_EXPIRED', 'S13_LOGGED_OUT', 'S_ERR'],
  S12_PAYMENT_FAILED: ['S2_TOKEN_EXPIRED', 'S13_LOGGED_OUT', 'S_ERR'],
  S13_LOGGED_OUT: ['S0_ANON', 'S1_AUTHENTICATED', 'S_ERR'],
  S_ERR: ['S0_ANON', 'S1_AUTHENTICATED', 'S4_CART_EMPTY', 'S5_CART_ACTIVE', 'S13_LOGGED_OUT'],
};

function readState(): MarketplaceState {
  if (typeof window === 'undefined') {
    return 'S0_ANON';
  }
  const raw = window.sessionStorage.getItem(FLOW_STATE_KEY) as MarketplaceState | null;
  return raw && raw in allowedTransitions ? raw : 'S0_ANON';
}

function writeState(state: MarketplaceState) {
  if (typeof window === 'undefined') {
    return;
  }
  window.sessionStorage.setItem(FLOW_STATE_KEY, state);
}

type TransitionMeta = {
  reason: string;
  guard?: string;
  traceId?: string;
  details?: Record<string, unknown>;
};

type FlowTransitionPayload = {
  prev: MarketplaceState | 'INIT';
  next: MarketplaceState;
  reason: string;
  guard?: string;
  guardReason?: string;
  details: Record<string, unknown>;
};

function emitTransitionEvent(
  kind: 'flow_transition' | 'guard_blocked',
  payload: FlowTransitionPayload,
  traceId?: string
) {
  emitUiEvent(kind, payload, traceId);
  const logger = kind === 'guard_blocked' ? console.warn : console.info;
  logger(JSON.stringify({ type: kind, ...payload }));
}

export function initializeFlowState(state: MarketplaceState, meta: Omit<TransitionMeta, 'guard'>) {
  writeState(state);
  const payload: FlowTransitionPayload = {
    prev: 'INIT',
    next: state,
    reason: meta.reason,
    guard: undefined,
    guardReason: undefined,
    details: meta.details || {},
  };
  emitTransitionEvent('flow_transition', payload, meta.traceId);
}

export function transitionFlow(target: MarketplaceState, meta: TransitionMeta) {
  const prev = readState();
  const allowed = allowedTransitions[prev] || [];

  if (!allowed.includes(target)) {
    const payload: FlowTransitionPayload = {
      prev,
      next: target,
      reason: meta.reason,
      guard: meta.guard || 'undefined_transition',
      guardReason: meta.reason,
      details: meta.details || {},
    };
    emitTransitionEvent('guard_blocked', payload, meta.traceId);
    const error = new Error('marketplace_flow_transition_forbidden');
    (error as Error & { details?: FlowTransitionPayload }).details = payload;
    throw error;
  }

  writeState(target);
  const payload: FlowTransitionPayload = {
    prev,
    next: target,
    reason: meta.reason,
    guard: undefined,
    guardReason: undefined,
    details: meta.details || {},
  };
  emitTransitionEvent('flow_transition', payload, meta.traceId);
  return { ok: true as const, prev, next: target };
}

export function getFlowState() {
  return readState();
}
