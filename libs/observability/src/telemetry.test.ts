import { describe, expect, it, vi } from 'vitest';
import { TelemetryBatcher } from './telemetry';

describe('TelemetryBatcher', () => {
  it('flushes on batch size', async () => {
    const transport = vi.fn().mockResolvedValue(undefined);
    const batcher = new TelemetryBatcher({ maxBatchSize: 2, flushIntervalMs: 1000, transport });

    batcher.enqueue({
      traceId: 'trace-1234',
      stage: 'render',
      status: 'ok',
      latencyMs: 5,
    });
    batcher.enqueue({
      traceId: 'trace-5678',
      stage: 'render',
      status: 'ok',
      latencyMs: 6,
    });

    await batcher.flush();

    expect(transport).toHaveBeenCalledTimes(1);
    expect(transport.mock.calls[0][0]).toHaveLength(2);

    await batcher.shutdown();
  });

  it('drops when queue full and calls onDrop', () => {
    const drops: string[] = [];
    const batcher = new TelemetryBatcher({
      maxBatchSize: 10,
      maxQueueSize: 1,
      flushIntervalMs: 1000,
      transport: async () => undefined,
      onDrop: (reason) => drops.push(reason),
    });

    batcher.enqueue({ traceId: 'trace-0001', stage: 'render', status: 'ok', latencyMs: 1 });
    batcher.enqueue({ traceId: 'trace-0002', stage: 'render', status: 'ok', latencyMs: 1 });

    expect(drops).toContain('queue_full');
  });

  it('enforces schema', () => {
    const batcher = new TelemetryBatcher({
      transport: async () => undefined,
    });

    // @ts-expect-error testing runtime guard
    expect(() => batcher.enqueue({ traceId: '', stage: 'x', status: 'ok', latencyMs: -1 })).toThrow();
    void batcher.shutdown();
  });
});
