import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ARViewer } from './ARViewer';

describe('ARViewer', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    delete (process.env as Record<string, string | undefined>).NEXT_PUBLIC_AR_MODEL_BASE_URL;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders helper text and model-viewer element', () => {
    const { container } = render(<ARViewer modelId="sample-model" />);
    expect(screen.getByText(/در حال بارگذاری/i)).toBeTruthy();
    const viewer = container.querySelector('model-viewer');
    expect(viewer).toBeTruthy();
  });

  it('renders USDZ link when provided', () => {
    render(<ARViewer modelId="sample-model" usdzUrl="/models/sample.usdz" />);
    const link = screen.getByText(/دانلود برای iOS/i);
    expect(link).toBeTruthy();
  });

  it('supports disabling AR mode', () => {
    const { container } = render(<ARViewer modelId="sample-model" arEnabled={false} />);
    const viewer = container.querySelector('model-viewer');
    expect(viewer?.getAttribute('ar')).toBeNull();
  });

  it('fails closed when confidence is below guard threshold', () => {
    render(
      <ARViewer modelId="sample-model" trackingConfidence={0.5} minConfidenceThreshold={0.75} />
    );
    expect(screen.getByText(/AR overlay disabled/i)).toBeTruthy();
  });

  it('fails closed when latency budget is breached', () => {
    render(<ARViewer modelId="sample-model" pipelineLatencyMs={85} latencyBudgetMs={50} />);
    expect(screen.getByText(/latency_budget_exceeded/i)).toBeTruthy();
  });

  it('uses explicit modelUrl over modelId resolution', () => {
    const { container } = render(<ARViewer modelId="ignored-id" modelUrl="/assets/direct.glb" />);
    const viewer = container.querySelector('model-viewer');
    expect(viewer?.getAttribute('src')).toBe('/assets/direct.glb');
  });

  it('resolves model from NEXT_PUBLIC_AR_MODEL_BASE_URL when modelId is relative', () => {
    process.env.NEXT_PUBLIC_AR_MODEL_BASE_URL = 'https://cdn.example.com/ar/';
    const { container } = render(<ARViewer modelId="chair-v2" />);
    const viewer = container.querySelector('model-viewer');
    expect(viewer?.getAttribute('src')).toBe('https://cdn.example.com/ar/chair-v2');
  });

  it('keeps absolute modelId unchanged', () => {
    const { container } = render(<ARViewer modelId="https://example.com/models/chair.glb" />);
    const viewer = container.querySelector('model-viewer');
    expect(viewer?.getAttribute('src')).toBe('https://example.com/models/chair.glb');
  });

  it('fires guardrail callback when AR is blocked', () => {
    const onGuardrailTriggered = vi.fn();
    render(
      <ARViewer
        modelId="sample-model"
        trackingConfidence={0.4}
        minConfidenceThreshold={0.75}
        onGuardrailTriggered={onGuardrailTriggered}
      />
    );

    expect(onGuardrailTriggered).toHaveBeenCalledWith('low_confidence');
  });

  it('handles load event, computes latency and emits sendBeacon telemetry', () => {
    const onLoad = vi.fn();
    const onLatencyMeasured = vi.fn();
    const sendBeacon = vi.fn().mockReturnValue(true);
    vi.spyOn(Date, 'now').mockReturnValue(1_000);

    Object.defineProperty(globalThis, 'navigator', {
      value: { sendBeacon },
      configurable: true,
    });

    const { container } = render(
      <ARViewer
        modelId="sample-model"
        captureTimestampMs={900}
        telemetryEndpoint="/telemetry/ar"
        onLoad={onLoad}
        onLatencyMeasured={onLatencyMeasured}
      />
    );

    const viewer = container.querySelector('model-viewer');
    expect(viewer).toBeTruthy();
    fireEvent.load(viewer as Element);

    expect(onLoad).toHaveBeenCalledTimes(1);
    expect(onLatencyMeasured).toHaveBeenCalledWith(100);
    expect(sendBeacon).toHaveBeenCalledTimes(1);
    const [endpoint] = sendBeacon.mock.calls[0];
    expect(endpoint).toBe('/telemetry/ar');
  });

  it('falls back to fetch telemetry when sendBeacon is unavailable', () => {
    const fetchMock = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('fetch', fetchMock);
    Object.defineProperty(globalThis, 'navigator', {
      value: {},
      configurable: true,
    });

    const { container } = render(
      <ARViewer modelId="sample-model" pipelineLatencyMs={40} telemetryEndpoint="/telemetry/ar" />
    );

    const viewer = container.querySelector('model-viewer');
    fireEvent.load(viewer as Element);

    expect(fetchMock).toHaveBeenCalledWith(
      '/telemetry/ar',
      expect.objectContaining({
        method: 'POST',
        keepalive: true,
      })
    );
  });

  it('renders error state and calls onError when model-viewer raises error event', () => {
    const onError = vi.fn();
    const { container } = render(<ARViewer modelId="sample-model" onError={onError} />);
    const viewer = container.querySelector('model-viewer');
    fireEvent.error(viewer as Element);

    expect(onError).toHaveBeenCalled();
    expect(screen.getByText(/خطا در بارگذاری مدل/i)).toBeTruthy();
  });
});
