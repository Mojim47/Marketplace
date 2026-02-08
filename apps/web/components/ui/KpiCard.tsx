import type { ReactNode } from "react";

export function KpiCard({
  label,
  value,
  trend,
  trendClassName = "text-emerald-300",
  className = "",
  children,
}: {
  label: string;
  value: string;
  trend?: string;
  trendClassName?: string;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div className={`glass-card rounded-2xl p-4 kpi-card ${className}`.trim()}>
      <span className="kpi-label">{label}</span>
      <span className="kpi-value">{value}</span>
      {trend ? <span className={`kpi-trend ${trendClassName}`}>{trend}</span> : null}
      {children}
    </div>
  );
}
