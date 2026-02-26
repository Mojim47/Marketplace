import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { evaluateARGuardrail } from './runtime/ar-guardrail';

export interface ARViewerProps {
  modelId: string;
  modelUrl?: string;
  usdzUrl?: string;
  posterUrl?: string;
  arEnabled?: boolean;
  autoRotate?: boolean;
  cameraControls?: boolean;
  backgroundColor?: string;
  exposure?: number;
  onLoad?: () => void;
  onError?: (error: Error) => void;
  onGuardrailTriggered?: (reason: string) => void;
  onLatencyMeasured?: (latencyMs: number) => void;
  className?: string;
  style?: React.CSSProperties;
  trackingConfidence?: number;
  minConfidenceThreshold?: number;
  anchorDriftCm?: number;
  maxAnchorDriftCm?: number;
  pipelineLatencyMs?: number;
  latencyBudgetMs?: number;
  captureTimestampMs?: number;
  processTimestampMs?: number;
  telemetryEndpoint?: string;
  cameraCalibrated?: boolean;
  visualInertialAligned?: boolean;
}

export function ARViewer({
  modelId,
  modelUrl,
  usdzUrl,
  posterUrl,
  arEnabled = true,
  autoRotate = true,
  cameraControls = true,
  backgroundColor = '#f8fafc',
  exposure = 1,
  onLoad,
  onError,
  onGuardrailTriggered,
  onLatencyMeasured,
  className,
  style,
  trackingConfidence,
  minConfidenceThreshold = 0.75,
  anchorDriftCm,
  maxAnchorDriftCm = 3,
  pipelineLatencyMs,
  latencyBudgetMs = 50,
  captureTimestampMs,
  processTimestampMs,
  telemetryEndpoint,
  cameraCalibrated = true,
  visualInertialAligned = true,
}: ARViewerProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [measuredLatencyMs, setMeasuredLatencyMs] = useState<number | undefined>(pipelineLatencyMs);
  const viewerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (Number.isFinite(pipelineLatencyMs)) {
      setMeasuredLatencyMs(pipelineLatencyMs);
    }
  }, [pipelineLatencyMs]);

  useEffect(() => {
    import('@google/model-viewer').catch((err) => {
      setHasError(true);
      onError?.(err instanceof Error ? err : new Error('Failed to load AR library'));
    });
  }, [onError]);

  const resolvedModel = useMemo(() => {
    if (modelUrl) return modelUrl;
    if (modelId.startsWith('http') || modelId.startsWith('/')) return modelId;
    const base = process.env.NEXT_PUBLIC_AR_MODEL_BASE_URL?.replace(/\/+$/, '');
    return base ? `${base}/${modelId}` : `/models/${modelId}.glb`;
  }, [modelId, modelUrl]);

  const guardrail = useMemo(
    () =>
      evaluateARGuardrail({
        arEnabled,
        trackingConfidence,
        minConfidenceThreshold,
        anchorDriftCm,
        maxAnchorDriftCm,
        pipelineLatencyMs: measuredLatencyMs,
        latencyBudgetMs,
        cameraCalibrated,
        visualInertialAligned,
      }),
    [
      arEnabled,
      trackingConfidence,
      minConfidenceThreshold,
      anchorDriftCm,
      maxAnchorDriftCm,
      measuredLatencyMs,
      latencyBudgetMs,
      cameraCalibrated,
      visualInertialAligned,
    ]
  );
  const effectiveArEnabled = guardrail.enabled;

  useEffect(() => {
    if (guardrail.guardReason !== 'none') {
      onGuardrailTriggered?.(guardrail.guardReason);
    }
  }, [guardrail.guardReason, onGuardrailTriggered]);

  const handleLoad = useCallback(() => {
    const overlayTs = Date.now();
    const sourceStart = captureTimestampMs ?? processTimestampMs;
    const measuredValue =
      sourceStart && Number.isFinite(sourceStart) ? overlayTs - sourceStart : pipelineLatencyMs;
    if (typeof measuredValue === 'number' && Number.isFinite(measuredValue)) {
      setMeasuredLatencyMs(measuredValue);
      onLatencyMeasured?.(measuredValue);
      if (telemetryEndpoint) {
        const payload = {
          stage: 'capture_process_overlay',
          latencyMs: measuredValue,
          budgetMs: latencyBudgetMs,
          guardReason:
            measuredValue > latencyBudgetMs ? 'latency_budget_exceeded' : guardrail.guardReason,
          action: measuredValue > latencyBudgetMs ? 'overlay_disabled' : 'none',
        };
        if (typeof navigator !== 'undefined' && 'sendBeacon' in navigator) {
          const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
          navigator.sendBeacon(telemetryEndpoint, blob);
        } else if (typeof fetch !== 'undefined') {
          fetch(telemetryEndpoint, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(payload),
            keepalive: true,
          }).catch(() => undefined);
        }
      }
    }
    setIsLoading(false);
    onLoad?.();
  }, [
    captureTimestampMs,
    processTimestampMs,
    pipelineLatencyMs,
    onLatencyMeasured,
    telemetryEndpoint,
    latencyBudgetMs,
    guardrail.guardReason,
    onLoad,
  ]);

  const handleError = useCallback(() => {
    setHasError(true);
    onError?.(new Error('Failed to load model'));
  }, [onError]);

  useEffect(() => {
    const el = viewerRef.current;
    if (!el) {
      return;
    }

    const onModelLoad = () => handleLoad();
    const onModelError = () => handleError();

    el.addEventListener('load', onModelLoad);
    el.addEventListener('error', onModelError);

    return () => {
      el.removeEventListener('load', onModelLoad);
      el.removeEventListener('error', onModelError);
    };
  }, [handleLoad, handleError]);

  if (hasError) {
    return (
      <div
        style={{
          width: '100%',
          height: 420,
          background: backgroundColor,
          borderRadius: 12,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#ef4444',
          ...style,
        }}
      >
        خطا در بارگذاری مدل
      </div>
    );
  }

  return (
    <div
      className={className}
      style={{
        width: '100%',
        background: backgroundColor,
        borderRadius: 12,
        padding: 12,
        ...style,
      }}
    >
      {isLoading && (
        <div
          style={{
            width: '100%',
            height: 420,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#64748b',
          }}
        >
          در حال بارگذاری...
        </div>
      )}

      <model-viewer
        ref={viewerRef}
        src={resolvedModel}
        poster={posterUrl}
        {...(effectiveArEnabled ? { ar: true } : {})}
        ar-modes="webxr scene-viewer quick-look"
        camera-controls={cameraControls}
        auto-rotate={autoRotate}
        exposure={exposure}
        shadow-intensity={0.7}
        style={{
          width: '100%',
          height: 420,
          background: backgroundColor,
          borderRadius: 10,
          display: isLoading ? 'none' : 'block',
        }}
      />

      {!effectiveArEnabled && guardrail.guardReason !== 'none' && (
        <p style={{ marginTop: 8, fontSize: 12, color: '#b91c1c' }}>
          AR overlay disabled ({guardrail.guardReason})
        </p>
      )}

      {usdzUrl && (
        <a
          href={usdzUrl}
          style={{
            display: 'inline-block',
            marginTop: 8,
            fontSize: 12,
            color: '#0f172a',
          }}
        >
          دانلود برای iOS
        </a>
      )}
    </div>
  );
}
