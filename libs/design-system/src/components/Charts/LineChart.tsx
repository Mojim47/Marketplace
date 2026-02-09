// ═══════════════════════════════════════════════════════════════════════════
// Line Chart Component - SVG-based with Animations
// ═══════════════════════════════════════════════════════════════════════════

'use client';

import type React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '../../utils/cn';

export interface DataPoint {
  label: string;
  labelFa?: string;
  value: number;
}

export interface LineChartProps {
  data: DataPoint[];
  height?: number;
  showGrid?: boolean;
  showDots?: boolean;
  showArea?: boolean;
  showTooltip?: boolean;
  lineColor?: string;
  areaColor?: string;
  gridColor?: string;
  animate?: boolean;
  animationDuration?: number;
  formatValue?: (value: number) => string;
  rtl?: boolean;
  className?: string;
}

export const LineChart: React.FC<LineChartProps> = ({
  data,
  height = 300,
  showGrid = true,
  showDots = true,
  showArea = true,
  showTooltip = true,
  lineColor = 'var(--color-brand-primary)',
  areaColor = 'var(--color-brand-primary)',
  gridColor = 'var(--color-border-light)',
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
  const svgRef = useRef<SVGSVGElement>(null);

  const padding = { top: 20, right: 20, bottom: 40, left: 50 };
  const chartWidth = 600;
  const chartHeight = height;
  const innerWidth = chartWidth - padding.left - padding.right;
  const innerHeight = chartHeight - padding.top - padding.bottom;

  const { minValue, maxValue, xScale, yScale, points, linePath, areaPath } = useMemo(() => {
    if (data.length === 0) {
      return {
        minValue: 0,
        maxValue: 0,
        xScale: () => 0,
        yScale: () => 0,
        points: [],
        linePath: '',
        areaPath: '',
      };
    }

    const values = data.map((d) => d.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const paddedMin = min - range * 0.1;
    const paddedMax = max + range * 0.1;

    const xScaleFn = (index: number) => padding.left + (index / (data.length - 1)) * innerWidth;
    const yScaleFn = (value: number) =>
      padding.top + innerHeight - ((value - paddedMin) / (paddedMax - paddedMin)) * innerHeight;

    const pts = data.map((d, i) => ({ x: xScaleFn(i), y: yScaleFn(d.value), ...d }));

    const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    const area = `${line} L ${pts[pts.length - 1].x} ${padding.top + innerHeight} L ${pts[0].x} ${padding.top + innerHeight} Z`;

    return {
      minValue: paddedMin,
      maxValue: paddedMax,
      xScale: xScaleFn,
      yScale: yScaleFn,
      points: pts,
      linePath: line,
      areaPath: area,
    };
  }, [data, innerWidth, innerHeight, padding]);

  // Intersection observer
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

  // Animation
  useEffect(() => {
    if (!isVisible || !animate) {
      setAnimationProgress(1);
      return undefined;
    }

    const startTime = performance.now();
    let animationFrame: number;

    const animateProgress = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / animationDuration, 1);
      setAnimationProgress(progress);

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animateProgress);
      }
    };

    animationFrame = requestAnimationFrame(animateProgress);

    return () => cancelAnimationFrame(animationFrame);
  }, [isVisible, animate, animationDuration]);

  const yTicks = useMemo(() => {
    const tickCount = 5;
    const range = maxValue - minValue;
    return Array.from({ length: tickCount }, (_, i) => minValue + (range * i) / (tickCount - 1));
  }, [minValue, maxValue]);

  if (data.length === 0) {
    return (
      <div className={cn('flex items-center justify-center', className)} style={{ height }}>
        <p className="text-[var(--color-text-tertiary)]">No data available</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={cn('relative', className)} dir={rtl ? 'rtl' : 'ltr'}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        className="w-full h-auto"
        style={{ maxHeight: height }}
      >
        {/* Grid Lines */}
        {showGrid && (
          <g className="grid-lines">
            {yTicks.map((tick, i) => (
              <line
                key={i}
                x1={padding.left}
                y1={yScale(tick)}
                x2={chartWidth - padding.right}
                y2={yScale(tick)}
                stroke={gridColor}
                strokeDasharray="4 4"
                opacity={0.5}
              />
            ))}
          </g>
        )}

        {/* Y Axis Labels */}
        <g className="y-axis">
          {yTicks.map((tick, i) => (
            <text
              key={i}
              x={padding.left - 10}
              y={yScale(tick)}
              textAnchor="end"
              dominantBaseline="middle"
              className="text-xs fill-[var(--color-text-tertiary)]"
            >
              {formatValue(tick)}
            </text>
          ))}
        </g>

        {/* X Axis Labels */}
        <g className="x-axis">
          {points.map((point, i) => (
            <text
              key={i}
              x={point.x}
              y={chartHeight - 10}
              textAnchor="middle"
              className="text-xs fill-[var(--color-text-tertiary)]"
            >
              {rtl && point.labelFa ? point.labelFa : point.label}
            </text>
          ))}
        </g>

        {/* Area */}
        {showArea && (
          <path
            d={areaPath}
            fill={`url(#areaGradient-${areaColor.replace(/[^a-zA-Z0-9]/g, '')})`}
            opacity={0.2 * animationProgress}
          />
        )}

        {/* Line */}
        <path
          d={linePath}
          fill="none"
          stroke={lineColor}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={animate ? innerWidth * 2 : 0}
          strokeDashoffset={animate ? innerWidth * 2 * (1 - animationProgress) : 0}
          style={{ transition: animate ? 'none' : 'stroke-dashoffset 0.3s' }}
        />

        {/* Dots */}
        {showDots &&
          points.map((point, i) => (
            <g key={i}>
              <circle
                cx={point.x}
                cy={point.y}
                r={hoveredIndex === i ? 8 : 5}
                fill={lineColor}
                opacity={animationProgress}
                className="transition-all duration-200"
                onMouseEnter={() => setHoveredIndex(i)}
                onMouseLeave={() => setHoveredIndex(null)}
                style={{ cursor: 'pointer' }}
              />
              <circle cx={point.x} cy={point.y} r={3} fill="white" opacity={animationProgress} />
            </g>
          ))}

        {/* Gradient Definition */}
        <defs>
          <linearGradient
            id={`areaGradient-${areaColor.replace(/[^a-zA-Z0-9]/g, '')}`}
            x1="0"
            y1="0"
            x2="0"
            y2="1"
          >
            <stop offset="0%" stopColor={areaColor} stopOpacity={0.4} />
            <stop offset="100%" stopColor={areaColor} stopOpacity={0} />
          </linearGradient>
        </defs>
      </svg>

      {/* Tooltip */}
      {showTooltip && hoveredIndex !== null && (
        <div
          className={cn(
            'absolute px-3 py-2 rounded-lg',
            'bg-[var(--color-surface-default)]',
            'shadow-lg border border-[var(--color-border-light)]',
            'text-sm pointer-events-none',
            'animate-in fade-in zoom-in-95 duration-150'
          )}
          style={{
            left: `${(points[hoveredIndex].x / chartWidth) * 100}%`,
            top: `${(points[hoveredIndex].y / chartHeight) * 100}%`,
            transform: 'translate(-50%, -120%)',
          }}
        >
          <p className="font-medium text-[var(--color-text-primary)]">
            {formatValue(points[hoveredIndex].value)}
          </p>
          <p className="text-[var(--color-text-tertiary)]">
            {rtl && points[hoveredIndex].labelFa
              ? points[hoveredIndex].labelFa
              : points[hoveredIndex].label}
          </p>
        </div>
      )}
    </div>
  );
};

export default LineChart;
