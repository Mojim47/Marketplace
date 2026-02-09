// ═══════════════════════════════════════════════════════════════════════════
// KPI Card Component - Animated Counters with Trend Indicators
// ═══════════════════════════════════════════════════════════════════════════

'use client';

import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '../../utils/cn';

export type KPITrend = 'up' | 'down' | 'neutral';
export type KPISize = 'sm' | 'md' | 'lg';
export type KPIVariant = 'default' | 'gradient' | 'outlined';

export interface KPICardProps {
  /** Card title */
  title: string;
  /** Title in Persian */
  titleFa?: string;
  /** Current value */
  value: number;
  /** Previous value for comparison */
  previousValue?: number;
  /** Value prefix (e.g., $, ریال) */
  prefix?: string;
  /** Value suffix (e.g., %, users) */
  suffix?: string;
  /** Trend direction */
  trend?: KPITrend;
  /** Trend percentage */
  trendValue?: number;
  /** Icon */
  icon?: React.ReactNode;
  /** Icon background color */
  iconBg?: string;
  /** Card size */
  size?: KPISize;
  /** Card variant */
  variant?: KPIVariant;
  /** Gradient colors for gradient variant */
  gradientFrom?: string;
  gradientTo?: string;
  /** Loading state */
  loading?: boolean;
  /** Animation duration in ms */
  animationDuration?: number;
  /** Format number as currency */
  formatAsCurrency?: boolean;
  /** Locale for number formatting */
  locale?: string;
  /** RTL mode */
  rtl?: boolean;
  /** On click handler */
  onClick?: () => void;
  /** Custom class */
  className?: string;
}

export const KPICard: React.FC<KPICardProps> = ({
  title,
  titleFa,
  value,
  previousValue,
  prefix = '',
  suffix = '',
  trend,
  trendValue,
  icon,
  iconBg = 'bg-[var(--color-brand-primary)]/10',
  size = 'md',
  variant = 'default',
  gradientFrom = 'from-blue-500',
  gradientTo = 'to-purple-600',
  loading = false,
  animationDuration = 1500,
  formatAsCurrency = false,
  locale = 'en-US',
  rtl = false,
  onClick,
  className,
}) => {
  const [displayValue, setDisplayValue] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number>();

  // Calculate trend if not provided
  const calculatedTrend =
    trend ??
    (previousValue !== undefined
      ? value > previousValue
        ? 'up'
        : value < previousValue
          ? 'down'
          : 'neutral'
      : 'neutral');

  const calculatedTrendValue =
    trendValue ??
    (previousValue !== undefined && previousValue !== 0
      ? Math.abs(((value - previousValue) / previousValue) * 100)
      : 0);

  // Format number
  const formatNumber = useCallback(
    (num: number): string => {
      if (formatAsCurrency) {
        return new Intl.NumberFormat(locale, {
          style: 'decimal',
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }).format(num);
      }

      if (num >= 1000000) {
        return new Intl.NumberFormat(locale, {
          notation: 'compact',
          compactDisplay: 'short',
          maximumFractionDigits: 1,
        }).format(num);
      }

      return new Intl.NumberFormat(locale, {
        maximumFractionDigits: 2,
      }).format(num);
    },
    [formatAsCurrency, locale]
  );

  // Animate counter
  useEffect(() => {
    if (!isVisible || loading) {
      return undefined;
    }

    const startTime = performance.now();
    const startValue = 0;
    const endValue = value;

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / animationDuration, 1);

      // Easing function (ease-out-expo)
      const easeOutExpo = 1 - 2 ** (-10 * progress);
      const currentValue = startValue + (endValue - startValue) * easeOutExpo;

      setDisplayValue(currentValue);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isVisible, value, animationDuration, loading]);

  // Intersection observer for animation trigger
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

    if (cardRef.current) {
      observer.observe(cardRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const sizeClasses = {
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
  };

  const valueSizeClasses = {
    sm: 'text-2xl',
    md: 'text-3xl',
    lg: 'text-4xl',
  };

  const iconSizeClasses = {
    sm: 'w-10 h-10',
    md: 'w-12 h-12',
    lg: 'w-14 h-14',
  };

  const variantClasses = {
    default: 'bg-[var(--color-surface-default)] border border-[var(--color-border-light)]',
    gradient: cn('bg-gradient-to-br text-white', gradientFrom, gradientTo),
    outlined: 'bg-transparent border-2 border-[var(--color-brand-primary)]',
  };

  const trendColors = {
    up: 'text-[var(--color-semantic-success)]',
    down: 'text-[var(--color-semantic-error)]',
    neutral: 'text-[var(--color-text-tertiary)]',
  };

  const trendBgColors = {
    up: 'bg-[var(--color-semantic-successBg)]',
    down: 'bg-[var(--color-semantic-errorBg)]',
    neutral: 'bg-[var(--color-background-sunken)]',
  };

  return (
    <div
      ref={cardRef}
      onClick={onClick}
      className={cn(
        'rounded-2xl transition-all duration-300',
        sizeClasses[size],
        variantClasses[variant],
        onClick && 'cursor-pointer hover:shadow-lg hover:-translate-y-1',
        className
      )}
      dir={rtl ? 'rtl' : 'ltr'}
    >
      {loading ? (
        <KPICardSkeleton size={size} />
      ) : (
        <>
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <p
                className={cn(
                  'text-sm font-medium',
                  variant === 'gradient' ? 'text-white/80' : 'text-[var(--color-text-secondary)]'
                )}
              >
                {rtl && titleFa ? titleFa : title}
              </p>
            </div>

            {icon && (
              <div
                className={cn(
                  'flex items-center justify-center rounded-xl',
                  iconSizeClasses[size],
                  variant === 'gradient' ? 'bg-white/20' : iconBg
                )}
              >
                {icon}
              </div>
            )}
          </div>

          {/* Value */}
          <div className="mb-3">
            <span
              className={cn(
                'font-bold tracking-tight',
                valueSizeClasses[size],
                variant === 'gradient' ? 'text-white' : 'text-[var(--color-text-primary)]'
              )}
            >
              {prefix}
              {formatNumber(displayValue)}
              {suffix}
            </span>
          </div>

          {/* Trend */}
          {(calculatedTrend !== 'neutral' || calculatedTrendValue > 0) && (
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  'inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium',
                  variant === 'gradient'
                    ? 'bg-white/20 text-white'
                    : [trendBgColors[calculatedTrend], trendColors[calculatedTrend]]
                )}
              >
                {calculatedTrend === 'up' && <TrendUpIcon className="w-3 h-3" />}
                {calculatedTrend === 'down' && <TrendDownIcon className="w-3 h-3" />}
                {calculatedTrendValue.toFixed(1)}%
              </span>
              <span
                className={cn(
                  'text-xs',
                  variant === 'gradient' ? 'text-white/70' : 'text-[var(--color-text-tertiary)]'
                )}
              >
                {rtl ? 'نسبت به دوره قبل' : 'vs previous period'}
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
};

// Skeleton loader
const KPICardSkeleton: React.FC<{ size: KPISize }> = ({ size }) => {
  const sizeClasses = {
    sm: { title: 'w-20 h-4', value: 'w-32 h-8', trend: 'w-16 h-5' },
    md: { title: 'w-24 h-4', value: 'w-40 h-10', trend: 'w-20 h-6' },
    lg: { title: 'w-28 h-5', value: 'w-48 h-12', trend: 'w-24 h-7' },
  };

  const classes = sizeClasses[size];

  return (
    <div className="animate-pulse">
      <div className="flex items-start justify-between mb-4">
        <div className={cn('rounded bg-[var(--color-background-sunken)]', classes.title)} />
        <div className="w-12 h-12 rounded-xl bg-[var(--color-background-sunken)]" />
      </div>
      <div className={cn('rounded bg-[var(--color-background-sunken)] mb-3', classes.value)} />
      <div className={cn('rounded bg-[var(--color-background-sunken)]', classes.trend)} />
    </div>
  );
};

// Icons
const TrendUpIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
    />
  </svg>
);

const TrendDownIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6"
    />
  </svg>
);

export default KPICard;
