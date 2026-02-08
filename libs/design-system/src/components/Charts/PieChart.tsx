// ═══════════════════════════════════════════════════════════════════════════
// Pie Chart Component - SVG-based with Animations
// ═══════════════════════════════════════════════════════════════════════════

'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { cn } from '../../utils/cn';

export interface PieDataPoint {
  label: string;
  labelFa?: string;
  value: number;
  color: string;
}

export interface PieChartProps {
  data: PieDataPoint[];
  size?: number;
  donut?: boolean;
  donutWidth?: number;
  showLabels?: boolean;
  showLegend?: boolean;
  showTooltip?: boolean;
  animate?: boolean;
  animationDuration?: number;
  formatValue?: (value: number) => string;
  rtl?: boolean;
  className?: string;
}


export const PieChart: React.FC<PieChartProps> = ({
  data,
  size = 300,
  donut = false,
  donutWidth = 60,
  showLabels = true,
  showLegend = true,
  showTooltip = true,
  animate = true,
  animationDuration = 1000,
  formatValue = (v) => v.toLocaleString(),
  rtl = false,
  className,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [animationProgress, setAnimationProgress] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const total = useMemo(() => data.reduce((sum, d) => sum + d.value, 0), [data]);
  const radius = size / 2 - 10;
  const innerRadius = donut ? radius - donutWidth : 0;
  const center = size / 2;

  const slices = useMemo(() => {
    let currentAngle = -Math.PI / 2;
    return data.map((d) => {
      const angle = (d.value / total) * 2 * Math.PI;
      const startAngle = currentAngle;
      const endAngle = currentAngle + angle;
      currentAngle = endAngle;

      const largeArc = angle > Math.PI ? 1 : 0;
      const x1 = center + radius * Math.cos(startAngle);
      const y1 = center + radius * Math.sin(startAngle);
      const x2 = center + radius * Math.cos(endAngle);
      const y2 = center + radius * Math.sin(endAngle);
      const ix1 = center + innerRadius * Math.cos(startAngle);
      const iy1 = center + innerRadius * Math.sin(startAngle);
      const ix2 = center + innerRadius * Math.cos(endAngle);
      const iy2 = center + innerRadius * Math.sin(endAngle);

      const path = donut
        ? `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} L ${ix2} ${iy2} A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${ix1} ${iy1} Z`
        : `M ${center} ${center} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`;

      const midAngle = startAngle + angle / 2;
      const labelRadius = radius * 0.7;
      const labelX = center + labelRadius * Math.cos(midAngle);
      const labelY = center + labelRadius * Math.sin(midAngle);

      return { ...d, path, startAngle, endAngle, labelX, labelY, percentage: (d.value / total) * 100 };
    });
  }, [data, total, radius, innerRadius, center, donut]);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setIsVisible(true); observer.disconnect(); }
    }, { threshold: 0.1 });
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isVisible || !animate) { setAnimationProgress(1); return undefined; }
    const startTime = performance.now();
    let frame: number;
    const animateFn = (time: number) => {
      const progress = Math.min((time - startTime) / animationDuration, 1);
      setAnimationProgress(1 - Math.pow(1 - progress, 3));
      if (progress < 1) frame = requestAnimationFrame(animateFn);
    };
    frame = requestAnimationFrame(animateFn);
    return () => cancelAnimationFrame(frame);
  }, [isVisible, animate, animationDuration]);

  if (data.length === 0) {
    return <div className={cn('flex items-center justify-center', className)} style={{ width: size, height: size }}>
      <p className="text-[var(--color-text-tertiary)]">No data</p>
    </div>;
  }

  return (
    <div ref={containerRef} className={cn('flex items-center gap-6', className)} dir={rtl ? 'rtl' : 'ltr'}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-full">
          {slices.map((slice, i) => (
            <path key={i} d={slice.path} fill={slice.color}
              opacity={hoveredIndex === null || hoveredIndex === i ? 1 : 0.5}
              transform={`rotate(${-90 + 360 * (1 - animationProgress)}, ${center}, ${center})`}
              className="transition-opacity duration-200 cursor-pointer"
              onMouseEnter={() => setHoveredIndex(i)} onMouseLeave={() => setHoveredIndex(null)} />
          ))}
          {showLabels && animationProgress === 1 && slices.map((slice, i) => slice.percentage > 5 && (
            <text key={i} x={slice.labelX} y={slice.labelY} textAnchor="middle" dominantBaseline="middle"
              className="text-xs font-medium fill-white pointer-events-none">
              {slice.percentage.toFixed(0)}%
            </text>
          ))}
        </svg>

        {showTooltip && hoveredIndex !== null && (
          <div className={cn('absolute px-3 py-2 rounded-lg bg-[var(--color-surface-default)] shadow-lg border border-[var(--color-border-light)] text-sm pointer-events-none z-10')}
            style={{ left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}>
            <p className="font-medium text-[var(--color-text-primary)]">{formatValue(slices[hoveredIndex].value)}</p>
            <p className="text-[var(--color-text-tertiary)]">
              {rtl && slices[hoveredIndex].labelFa ? slices[hoveredIndex].labelFa : slices[hoveredIndex].label}
            </p>
          </div>
        )}
      </div>

      {showLegend && (
        <div className="flex flex-col gap-2">
          {slices.map((slice, i) => (
            <div key={i} className="flex items-center gap-2 cursor-pointer"
              onMouseEnter={() => setHoveredIndex(i)} onMouseLeave={() => setHoveredIndex(null)}>
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: slice.color }} />
              <span className={cn('text-sm', hoveredIndex === i ? 'text-[var(--color-text-primary)] font-medium' : 'text-[var(--color-text-secondary)]')}>
                {rtl && slice.labelFa ? slice.labelFa : slice.label}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PieChart;
