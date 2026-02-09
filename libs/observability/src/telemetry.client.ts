import { TelemetryBatcher, TelemetryEvent } from './telemetry';

const hasFetch = typeof fetch !== 'undefined';

const transport = async (batch: TelemetryEvent[]) => {
  if (!hasFetch) {
    // SSR or test: noop
    return;
  }
  await fetch('/api/telemetry', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ events: batch }),
  }).catch((err) => {
    console.warn('Telemetry transport failed', err);
  });
};

export const defaultTelemetryBatcher = new TelemetryBatcher({
  transport,
  maxBatchSize: 25,
  flushIntervalMs: 2000,
  maxQueueSize: 500,
  sampleRate: 1,
});

export function emitTelemetry(event: TelemetryEvent) {
  defaultTelemetryBatcher.enqueue(event);
}
