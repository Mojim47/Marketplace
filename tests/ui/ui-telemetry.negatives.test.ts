import { describe, expect, it } from 'vitest';
import {
  redactUiPayload,
  validateUiEventName,
  validateUiEventPayload,
} from '../../libs/observability/src/ui';

describe('ui telemetry negative cases', () => {
  it('rejects unknown event names', () => {
    expect(() => validateUiEventName('unknown_event')).toThrow(/not defined/i);
  });

  it('fails when required fields are missing', () => {
    expect(() => validateUiEventPayload('flow_start', {})).toThrow(/missing required/i);
  });

  it('redacts sensitive fields in payloads', () => {
    const redacted = redactUiPayload({
      Authorization: 'Bearer secret',
      password: 'super-secret',
      nested: { token: 'abc' },
    });

    expect(redacted.Authorization).toBe('[REDACTED]');
    expect(redacted.password).toBe('[REDACTED]');
    expect((redacted.nested as { token: string }).token).toBe('[REDACTED]');
  });
});
