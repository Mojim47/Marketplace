import { describe, expect, it, vi } from 'vitest';
import { defaultTelemetryBatcher, emitTelemetry } from './telemetry.client';

describe('telemetry client', () => {
  it('sends batches via fetch', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    // @ts-expect-error
    global.fetch = mockFetch;

    emitTelemetry({ traceId: 'trace-abc12345', stage: 'ar', status: 'ok', latencyMs: 1 });
    await defaultTelemetryBatcher.flush();

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
    expect(body.events[0].traceId).toBe('trace-abc12345');
  });
});
