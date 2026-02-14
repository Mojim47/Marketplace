// @ts-nocheck
import schema from './ui-event-schema.json';

type UiSchema = typeof schema;

export type UiEventName = keyof UiSchema['events'];

const allowedEvents = new Set(Object.keys(schema.events));
const redactKeys = new Set(schema.redact.map((key) => key.toLowerCase()));

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function validateUiEventName(name: string): asserts name is UiEventName {
  if (!allowedEvents.has(name)) {
    throw new Error(`UI event '${name}' is not defined in schema`);
  }
}

export function validateUiEventPayload(name: UiEventName, payload: Record<string, unknown>): void {
  const required = schema.events[name]?.required ?? [];
  const missing = required.filter((key) => payload[key] === undefined);
  if (missing.length > 0) {
    throw new Error(`UI event '${name}' is missing required keys: ${missing.join(', ')}`);
  }
}

export function redactUiPayload(payload: Record<string, unknown>): Record<string, unknown> {
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (redactKeys.has(key.toLowerCase())) {
      output[key] = '[REDACTED]';
      continue;
    }
    if (Array.isArray(value)) {
      output[key] = value.map((item) => (isPlainObject(item) ? redactUiPayload(item) : item));
      continue;
    }
    if (isPlainObject(value)) {
      output[key] = redactUiPayload(value);
      continue;
    }
    output[key] = value;
  }
  return output;
}

export function trackUiEvent(
  name: UiEventName,
  payload: Record<string, unknown> = {},
  options?: { traceId?: string; now?: () => Date }
) {
  validateUiEventName(name);
  validateUiEventPayload(name, payload);
  const redactedPayload = redactUiPayload(payload);
  const now = options?.now?.() ?? new Date();
  return {
    name,
    traceId: options?.traceId,
    payload: redactedPayload,
    ts: now.toISOString(),
  };
}
