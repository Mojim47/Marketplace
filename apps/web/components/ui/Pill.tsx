import type { ReactNode } from "react";

export function Pill({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <span className={`pill rounded-full px-4 py-1 text-xs ${className}`}>{children}</span>;
}
