import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/prisma-server';
import { NextRequest, NextResponse } from 'next/server';

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

type UiEventPayload = {
  name?: UiEventName;
  timestamp?: string;
  payload?: Record<string, unknown>;
  traceId?: string;
};

type CommerceAttribution = {
  surface: string;
  productId: string;
  at: number;
};

const UI_SESSION_COOKIE = 'NG_UI_SESSION';
const UI_ATTR_COOKIE = 'NG_UI_ATTR';
const UI_SESSION_MAX_AGE = 60 * 60 * 24 * 30;
const UI_ATTR_MAX_AGE = 60 * 60 * 24;
const MAX_JSON_BYTES = 3500;

const allowedEvents = new Set<UiEventName>([
  'page_view',
  'cta_click',
  'flow_start',
  'flow_complete',
  'error_shown',
  'flow_transition',
  'guard_blocked',
  'commerce_impression',
  'commerce_click',
  'commerce_conversion',
  'experiment_exposure',
]);

function sanitizeText(value: unknown, max = 120): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  return trimmed.slice(0, max);
}

function sanitizeClientTimestamp(input: unknown): Date | null {
  if (typeof input !== 'string') {
    return null;
  }
  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}

function sanitizePayload(payload: unknown): Record<string, unknown> {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return {};
  }
  const json = JSON.stringify(payload);
  if (json.length > MAX_JSON_BYTES) {
    return {};
  }
  return JSON.parse(json) as Record<string, unknown>;
}

function encodeAttribution(value: CommerceAttribution): string {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

function decodeAttribution(cookieValue: string | undefined): CommerceAttribution | null {
  if (!cookieValue) {
    return null;
  }

  try {
    const decoded = Buffer.from(cookieValue, 'base64url').toString('utf8');
    const parsed = JSON.parse(decoded) as Partial<CommerceAttribution>;
    if (
      typeof parsed.surface !== 'string' ||
      typeof parsed.productId !== 'string' ||
      typeof parsed.at !== 'number'
    ) {
      return null;
    }
    if (!parsed.surface || !parsed.productId) {
      return null;
    }
    return {
      surface: parsed.surface.slice(0, 60),
      productId: parsed.productId.slice(0, 120),
      at: parsed.at,
    };
  } catch {
    return null;
  }
}

function dedupeWindowSeconds(name: UiEventName): number {
  switch (name) {
    case 'commerce_impression':
      return 20 * 60;
    case 'commerce_click':
      return 10;
    case 'commerce_conversion':
      return 5 * 60;
    case 'experiment_exposure':
      return 24 * 60 * 60;
    default:
      return 0;
  }
}

function isCommerceEvent(name: UiEventName): boolean {
  return (
    name === 'commerce_impression' || name === 'commerce_click' || name === 'commerce_conversion'
  );
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as UiEventPayload | null;
  if (!body || typeof body.name !== 'string' || !allowedEvents.has(body.name)) {
    return NextResponse.json({ ok: false, message: 'invalid_ui_event' }, { status: 400 });
  }

  const payload = sanitizePayload(body.payload);
  const traceId = sanitizeText(body.traceId, 120);
  const occurredAt = new Date();
  const clientTimestamp = sanitizeClientTimestamp(body.timestamp);

  const incomingSession = sanitizeText(payload.sessionId, 80);
  const cookieSession = request.cookies.get(UI_SESSION_COOKIE)?.value;
  const sessionId = incomingSession || cookieSession || randomUUID();

  const eventType = `ui:${body.name}`;
  let surface = sanitizeText(payload.surface, 60);
  let productId = sanitizeText(payload.productId, 120);
  const experiment = sanitizeText(payload.experiment, 80);
  const variant = sanitizeText(payload.variant, 80);

  if (body.name === 'commerce_conversion' && (!surface || !productId)) {
    const attribution = decodeAttribution(request.cookies.get(UI_ATTR_COOKIE)?.value);
    if (attribution) {
      surface = surface || attribution.surface;
      productId = productId || attribution.productId;
    }
  }

  const incomingDedupeKey = sanitizeText(payload.dedupeKey, 220);
  const dedupeSeconds = dedupeWindowSeconds(body.name);
  const dedupeKey =
    dedupeSeconds > 0
      ? (incomingDedupeKey ||
          [eventType, sessionId, surface || 'unknown', productId || 'unknown', experiment || '']
            .join(':')
            .slice(0, 220))
      : undefined;

  const normalizedPayload = {
    ...payload,
    ...(surface ? { surface } : {}),
    ...(productId ? { productId } : {}),
    ...(experiment ? { experiment } : {}),
    ...(variant ? { variant } : {}),
    ...(dedupeKey ? { dedupeKey } : {}),
    sessionId,
    ...(traceId ? { traceId } : {}),
    receivedAt: occurredAt.toISOString(),
    ...(clientTimestamp
      ? {
          clientTimestamp: clientTimestamp.toISOString(),
          clientLagMs: Math.max(0, occurredAt.getTime() - clientTimestamp.getTime()),
        }
      : {}),
  };

  const entityType = body.name === 'experiment_exposure' ? 'experiment' : 'ui_surface';
  const entityId = body.name === 'experiment_exposure' ? experiment || 'unknown' : surface || 'unknown';
  let insertedRows = 0;

  try {
    insertedRows = await prisma.$executeRawUnsafe(
      `INSERT INTO system_events (
        id,
        tenant_id,
        event_type,
        entity_type,
        entity_id,
        user_id,
        data,
        occurred_at
      )
      SELECT
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7::jsonb,
        $8::timestamptz
      WHERE NOT EXISTS (
        SELECT 1
        FROM system_events se
        WHERE se.tenant_id = $2
          AND se.event_type = $3
          AND se.entity_type = $4
          AND se.entity_id = $5
          AND $11::int > 0
          AND COALESCE(se.data->>'sessionId', '') = $9
          AND COALESCE(se.data->>'dedupeKey', '') = COALESCE($10, '')
          AND se.occurred_at >= NOW() - ($11::int * interval '1 second')
      )`,
      randomUUID(),
      'public',
      eventType,
      entityType,
      entityId,
      null,
      JSON.stringify(normalizedPayload),
      occurredAt.toISOString(),
      sessionId,
      dedupeKey,
      dedupeSeconds
    );

    if (insertedRows > 0 && isCommerceEvent(body.name) && surface) {
      const bucketDate = occurredAt.toISOString().slice(0, 10);

      await prisma.$executeRawUnsafe(
        `INSERT INTO ui_funnel_event_rollups (
          bucket_date,
          tenant_id,
          surface,
          event_type,
          event_count,
          updated_at
        )
        VALUES ($1::date, $2, $3, $4, 1, NOW())
        ON CONFLICT (bucket_date, tenant_id, surface, event_type)
        DO UPDATE SET event_count = ui_funnel_event_rollups.event_count + 1, updated_at = NOW()`,
        bucketDate,
        'public',
        surface,
        eventType
      );

      await prisma.$executeRawUnsafe(
        `INSERT INTO ui_funnel_surface_sessions (
          bucket_date,
          tenant_id,
          surface,
          session_id,
          first_seen_at
        )
        VALUES ($1::date, $2, $3, $4, NOW())
        ON CONFLICT (bucket_date, tenant_id, surface, session_id) DO NOTHING`,
        bucketDate,
        'public',
        surface,
        sessionId
      );
    }
  } catch {
    // Best-effort telemetry ingestion; failures are intentionally non-blocking.
  }

  const response = new NextResponse(null, { status: 204 });

  if (!cookieSession) {
    response.cookies.set({
      name: UI_SESSION_COOKIE,
      value: sessionId,
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: UI_SESSION_MAX_AGE,
    });
  }

  if (insertedRows > 0 && body.name === 'commerce_click' && surface && productId) {
    response.cookies.set({
      name: UI_ATTR_COOKIE,
      value: encodeAttribution({
        surface,
        productId,
        at: Date.now(),
      }),
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: UI_ATTR_MAX_AGE,
    });
  }

  if (insertedRows > 0 && body.name === 'commerce_conversion') {
    response.cookies.set({
      name: UI_ATTR_COOKIE,
      value: '',
      path: '/',
      maxAge: 0,
    });
  }

  return response;
}
