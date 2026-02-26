'use client';

type UiEventName =
  | 'page_view'
  | 'cta_click'
  | 'flow_start'
  | 'flow_complete'
  | 'error_shown'
  | 'flow_transition'
  | 'guard_blocked'
  | 'commerce_impression'
  | 'commerce_click'
  | 'commerce_conversion'
  | 'experiment_exposure';

export type CommerceEventKind = 'impression' | 'click' | 'conversion';

type UiEvent = {
  name: UiEventName;
  timestamp: string;
  payload: Record<string, unknown>;
  traceId?: string;
};

const recentEventKeys = new Map<string, number>();

const dedupeWindowByEvent: Partial<Record<UiEventName, number>> = {
  commerce_impression: 20 * 60 * 1000,
  commerce_click: 1500,
  commerce_conversion: 45 * 1000,
  experiment_exposure: 24 * 60 * 60 * 1000,
};

function toText(value: unknown, max = 120): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  return trimmed.slice(0, max);
}

function randomId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `evt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function resolveDedupeKey(name: UiEventName, payload: Record<string, unknown>): string | undefined {
  const surface = toText(payload.surface, 60) ?? 'unknown';
  const productId = toText(payload.productId, 120);
  const action = toText(payload.action, 80) ?? 'default';
  const position = String(payload.position ?? '');
  const path = toText(payload.path, 160) ?? '';
  const experiment = toText(payload.experiment, 80) ?? '';
  const variant = toText(payload.variant, 60) ?? '';

  if (name === 'commerce_impression') {
    if (!productId) {
      return undefined;
    }
    return `${name}:${surface}:${productId}:${position || '0'}`;
  }

  if (name === 'commerce_click') {
    if (!productId && !path) {
      return undefined;
    }
    return `${name}:${surface}:${productId || path}:${action}`;
  }

  if (name === 'commerce_conversion') {
    const orderId = toText(payload.orderId, 120) ?? toText(payload.checkoutId, 120);
    return `${name}:${surface}:${productId || orderId || 'unknown'}`;
  }

  if (name === 'experiment_exposure' && experiment && variant) {
    return `${name}:${experiment}:${variant}:${surface}`;
  }

  return undefined;
}

function shouldSkipDedupe(name: UiEventName, dedupeKey: string | undefined): boolean {
  const windowMs = dedupeWindowByEvent[name];
  if (!windowMs || !dedupeKey) {
    return false;
  }

  const now = Date.now();
  for (const [key, expiresAt] of recentEventKeys) {
    if (expiresAt <= now) {
      recentEventKeys.delete(key);
    }
  }

  const existingExpiry = recentEventKeys.get(dedupeKey);
  if (existingExpiry && existingExpiry > now) {
    return true;
  }

  recentEventKeys.set(dedupeKey, now + windowMs);
  return false;
}

export function emitUiEvent(name: UiEventName, payload: Record<string, unknown>, traceId?: string) {
  const dedupeKey = resolveDedupeKey(name, payload);
  if (shouldSkipDedupe(name, dedupeKey)) {
    return null;
  }

  const timestamp = new Date().toISOString();
  const normalizedPayload: Record<string, unknown> = {
    ...payload,
    eventId: randomId(),
    clientTimestamp: timestamp,
    ...(dedupeKey ? { dedupeKey } : {}),
  };

  const event: UiEvent = {
    name,
    timestamp,
    payload: normalizedPayload,
    traceId,
  };

  if (typeof window !== 'undefined') {
    const uiWindow = window as Window & { __uiEvents?: UiEvent[] };
    uiWindow.__uiEvents = uiWindow.__uiEvents ?? [];
    uiWindow.__uiEvents.push(event);
  }

  if (typeof navigator !== 'undefined' && 'sendBeacon' in navigator) {
    const blob = new Blob([JSON.stringify(event)], { type: 'application/json' });
    navigator.sendBeacon('/api/ui-events', blob);
  } else if (typeof fetch !== 'undefined') {
    fetch('/api/ui-events', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(event),
      keepalive: true,
    }).catch(() => undefined);
  }

  return event;
}

export function emitCommerceEvent(
  kind: CommerceEventKind,
  payload: Record<string, unknown>,
  traceId?: string
) {
  const eventName = `commerce_${kind}` as UiEventName;
  return emitUiEvent(eventName, payload, traceId);
}

function hashSeed(input: string): number {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function getExperimentUserSeed() {
  if (typeof window === 'undefined') {
    return 'server';
  }
  const key = 'ng_experiment_uid';
  try {
    const existing = window.localStorage.getItem(key);
    if (existing && existing.length > 0) {
      return existing;
    }
    const created = randomId();
    window.localStorage.setItem(key, created);
    return created;
  } catch {
    return 'stateless';
  }
}

export function assignExperimentVariant(
  experiment: string,
  variants: string[],
  stickinessScope = 'default'
): string {
  if (!variants.length) {
    return 'control';
  }
  const seed = `${getExperimentUserSeed()}:${stickinessScope}:${experiment}`;
  const bucket = hashSeed(seed) % variants.length;
  return variants[bucket] ?? variants[0] ?? 'control';
}

export function emitExperimentExposure(
  experiment: string,
  variant: string,
  payload: Record<string, unknown> = {},
  traceId?: string
) {
  return emitUiEvent(
    'experiment_exposure',
    {
      ...payload,
      experiment,
      variant,
    },
    traceId
  );
}
