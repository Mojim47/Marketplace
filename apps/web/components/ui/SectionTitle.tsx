import type { ReactNode } from 'react';

export function SectionTitle({
  children,
  className = '',
}: { children: ReactNode; className?: string }) {
  return <h2 className={`section-title ${className}`}>{children}</h2>;
}
