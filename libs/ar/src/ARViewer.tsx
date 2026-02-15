import { useEffect, useMemo, useState, useCallback } from 'react';

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
  className?: string;
  style?: React.CSSProperties;
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
  className,
  style,
}: ARViewerProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

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

  const handleLoad = useCallback(() => {
    setIsLoading(false);
    onLoad?.();
  }, [onLoad]);

  const handleError = useCallback(() => {
    setHasError(true);
    onError?.(new Error('Failed to load model'));
  }, [onError]);

  if (hasError) {
    return (
      <div style={{
        width: '100%',
        height: 420,
        background: backgroundColor,
        borderRadius: 12,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#ef4444',
        ...style,
      }}>
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
        <div style={{
          width: '100%',
          height: 420,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#64748b',
        }}>
          در حال بارگذاری...
        </div>
      )}

      <model-viewer
        src={resolvedModel}
        poster={posterUrl}
        ar={arEnabled}
        ar-modes="webxr scene-viewer quick-look"
        camera-controls={cameraControls}
        auto-rotate={autoRotate}
        exposure={exposure}
        shadow-intensity={0.7}  // ✅ number
        style={{
          width: '100%',
          height: 420,
          background: backgroundColor,
          borderRadius: 10,
          display: isLoading ? 'none' : 'block',
        }}
        onLoad={handleLoad}
        onError={handleError}
      />

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