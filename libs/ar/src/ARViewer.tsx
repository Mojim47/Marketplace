import { useEffect, useMemo } from 'react';

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
}

function resolveModelUrl(modelId: string, modelUrl?: string): string {
  if (modelUrl) {
    return modelUrl;
  }
  if (modelId.startsWith('http://') || modelId.startsWith('https://')) {
    return modelId;
  }
  if (modelId.startsWith('/')) {
    return modelId;
  }
  const base = process.env.NEXT_PUBLIC_AR_MODEL_BASE_URL?.replace(/\/+$/, '');
  if (base) {
    return `${base}/${modelId}`;
  }
  return `/models/${modelId}.glb`;
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
}: ARViewerProps) {
  useEffect(() => {
    import('@google/model-viewer');
  }, []);

  const resolvedModel = useMemo(() => resolveModelUrl(modelId, modelUrl), [modelId, modelUrl]);

  return (
    <div style={{ width: '100%', background: backgroundColor, borderRadius: 12, padding: 12 }}>
      <model-viewer
        src={resolvedModel}
        poster={posterUrl}
        ar={arEnabled ? 'true' : 'false'}
        ar-modes="webxr scene-viewer quick-look"
        camera-controls={cameraControls ? 'true' : 'false'}
        auto-rotate={autoRotate ? 'true' : 'false'}
        exposure={exposure}
        shadow-intensity="0.7"
        style={{ width: '100%', height: 420, background: backgroundColor, borderRadius: 10 }}
      />
      <div style={{ marginTop: 8, fontSize: 12, color: '#64748b' }}>
        برای تجربه واقعیت افزوده، دکمه AR را روی دستگاه‌های سازگار لمس کنید.
      </div>
      {usdzUrl ? (
        <a
          href={usdzUrl}
          style={{ display: 'inline-block', marginTop: 6, fontSize: 12, color: '#0f172a' }}
        >
          دانلود فایل USDZ برای iOS
        </a>
      ) : null}
    </div>
  );
}
