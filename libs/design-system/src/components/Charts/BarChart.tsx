// ═══════════════════════════════════════════════════════════════════════════
// Bar Chart Component - SVG-based with Animations
// ═══════════════════════════════════════════════════════════════════════════

'use client';

import type React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '../../utils/cn';

export interface BarDataPoint {
  label: string;
  labelFa?: string;
  value: number;
  color?: string;
}

export interface BarChartProps {
  data: BarDataPoint[];
  height?: number;
  horizontal?: boolean;
  showGrid?: boolean;
  showValues?: boolean;
  barColor?: string;
  gridColor?: string;
  animate?: boolean;
  animationDuration?: number;
  formatValue?: (value: number) => string;
  rtl?: boolean;
  className?: string;
}

export const BarChart: React.FC<BarChartProps> = ({
  data,
  height = 300,
  horizontal = false,
  showGrid = true,
  showValues = true,
  barColor = 'var(--color-brand-primary)',
  gridColor = 'var(--color-border-light)',
  animate = true,
  animationDuration = 800,
  formatValue = (v) => v.toLocaleString(),
  rtl = false,
  className,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [animationProgress, setAnimationProgress] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const padding = { top: 20, right: 20, bottom: 60, left: 60 };
  const chartWidth = 600;
  const chartHeight = height;
  const innerWidth = chartWidth - padding.left - padding.right;
  const innerHeight = chartHeight - padding.top - padding.bottom;

  const { maxValue, bars } = useMemo(() => {
    if (data.length === 0) {
      return { maxValue: 0, bars: [] };
    }
    const max = Math.max(...data.map((d) => d.value)) * 1.1;
    const barWidth = (innerWidth / data.length) * 0.7;
    const barGap = (innerWidth / data.length) * 0.3;

    const barsData = data.map((d, i) => {
      const x = padding.left + i * (barWidth + barGap) + barGap / 2;
      const barHeight = (d.value / max) * innerHeight;
      const y = padding.top + innerHeight - barHeight;
      return { ...d, x, y, width: barWidth, height: barHeight };
    });

    return { maxValue: max, bars: barsData };
  }, [data, innerWidth, innerHeight, padding]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isVisible || !animate) {
      setAnimationProgress(1);
      return undefined;
    }
    const startTime = performance.now();
    let frame: number;
    const animateFn = (time: number) => {
      const progress = Math.min((time - startTime) / animationDuration, 1);
      setAnimationProgress(progress);
      if (progress < 1) {
        frame = requestAnimationFrame(animateFn);
      }
    };
    frame = requestAnimationFrame(animateFn);
    return () => cancelAnimationFrame(frame);
  }, [isVisible, animate, animationDuration]);

  const yTicks = useMemo(() => {
    return Array.from({ length: 5 }, (_, i) => (maxValue * i) / 4);
  }, [maxValue]);

  if (data.length === 0) {
    return (
      <div className={cn('flex items-center justify-center', className)} style={{ height }}>
        <p className="text-[var(--color-text-tertiary)]">No data</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={cn('relative', className)} dir={rtl ? 'rtl' : 'ltr'}>
      <svg
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        className="w-full h-auto"
        style={{ maxHeight: height }}
      >
        {showGrid &&
          yTicks.map((tick, i) => (
            <line
              key={i}
              x1={padding.left}
              y1={padding.top + innerHeight - (tick / maxValue) * innerHeight}
              x2={chartWidth - padding.right}
              y2={padding.top + innerHeight - (tick / maxValue) * innerHeight}
              stroke={gridColor}
              strokeDasharray="4 4"
              opacity={0.5}
            />
          ))}

        {yTicks.map((tick, i) => (
          <text
            key={i}
            x={padding.left - 10}
            y={padding.top + innerHeight - (tick / maxValue) * innerHeight}
            textAnchor="end"
            dominantBaseline="middle"
            className="text-xs fill-[var(--color-text-tertiary)]"
          >
            {formatValue(tick)}
          </text>
        ))}

        {bars.map((bar, i) => (
          <g
            key={i}
            onMouseEnter={() => setHoveredIndex(i)}
            onMouseLeave={() => setHoveredIndex(null)}
          >
            <rect
              x={bar.x}
              y={bar.y + bar.height * (1 - animationProgress)}
              width={bar.width}
              height={bar.height * animationProgress}
              fill={bar.color || barColor}
              rx={4}
              className={cn('transition-all duration-200', hoveredIndex === i && 'brightness-110')}
            />
            {showValues && animationProgress === 1 && (
              <text
                x={bar.x + bar.width / 2}
                y={bar.y - 8}
                textAnchor="middle"
                className="text-xs font-medium fill-[var(--color-text-primary)]"
              >
                {formatValue(bar.value)}
              </text>
            )}
            <text
              x={bar.x + bar.width / 2}
              y={chartHeight - 20}
              textAnchor="middle"
              className="text-xs fill-[var(--color-text-tertiary)]"
            >
              {rtl && bar.labelFa ? bar.labelFa : bar.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
};

export default BarChart;
