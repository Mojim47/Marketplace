import { z } from 'zod';

export const telemetryEventSchema = z.object({
  traceId: z.string().min(8),
  spanId: z.string().optional(),
  stage: z.string().min(2),
  status: z.enum(['ok', 'error']),
  latencyMs: z.number().nonnegative(),
  deviceProfile: z
    .object({
      gpuTier: z.string().optional(),
      fps: z.number().optional(),
      ua: z.string().optional(),
    })
    .optional(),
  piiFlag: z.boolean().default(false),
  metadata: z.record(z.any()).optional(),
  timestamp: z.string().datetime().optional(),
});

export type TelemetryEvent = z.infer<typeof telemetryEventSchema>;

export type TelemetryBatcherOptions = {
  maxBatchSize?: number;
  flushIntervalMs?: number;
  maxQueueSize?: number;
  sampleRate?: number; // 0..1
  transport: (batch: TelemetryEvent[]) => Promise<void>;
  onDrop?: (reason: string, event?: TelemetryEvent) => void;
};

export class TelemetryBatcher {
  private buffer: TelemetryEvent[] = [];
  private readonly options: Required<Omit<TelemetryBatcherOptions, 'sampleRate' | 'onDrop'>> & {
    sampleRate: number;
    onDrop?: (reason: string, event?: TelemetryEvent) => void;
  };
  private timer: ReturnType<typeof setInterval> | null = null;
  private dropped = 0;
  private sent = 0;

  constructor(options: TelemetryBatcherOptions) {
    if (!options?.transport) throw new Error('TelemetryBatcher requires a transport function');
    this.options = {
      maxBatchSize: options.maxBatchSize ?? 20,
      flushIntervalMs: options.flushIntervalMs ?? 3000,
      maxQueueSize: options.maxQueueSize ?? 500,
      sampleRate: options.sampleRate ?? 1,
      transport: options.transport,
      onDrop: options.onDrop,
    };

    this.timer = setInterval(() => this.flush(), this.options.flushIntervalMs);
  }

  enqueue(event: TelemetryEvent) {
    const parsed = telemetryEventSchema.parse({
      ...event,
      timestamp: event.timestamp ?? new Date().toISOString(),
      piiFlag: event.piiFlag ?? false,
    });

    if (Math.random() > this.options.sampleRate) return; // sampled out

    if (this.buffer.length >= this.options.maxQueueSize) {
      this.options.onDrop?.('queue_full', parsed);
      this.dropped += 1;
      return;
    }

    this.buffer.push(parsed);

    if (this.buffer.length >= this.options.maxBatchSize) {
      void this.flush();
    }
  }

  async flush() {
    if (!this.buffer.length) return;
    const batch = this.buffer.splice(0, this.options.maxBatchSize);
    await this.options.transport(batch);
    this.sent += batch.length;
  }

  async shutdown() {
    if (this.timer) clearInterval(this.timer);
    await this.flush();
  }

  getStats() {
    return { dropped: this.dropped, sent: this.sent, dropRatio: this.sent === 0 ? 0 : this.dropped / this.sent };
  }
}
