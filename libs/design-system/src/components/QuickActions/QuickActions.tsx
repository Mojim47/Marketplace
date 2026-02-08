// ═══════════════════════════════════════════════════════════════════════════
// Quick Actions Component - Floating Action Buttons with Tooltips
// ═══════════════════════════════════════════════════════════════════════════

'use client';

import React, { useState, useCallback } from 'react';
import { cn } from '../../utils/cn';

export interface QuickAction {
  id: string;
  label: string;
  labelFa?: string;
  icon: React.ReactNode;
  onClick: () => void;
  color?: 'primary' | 'secondary' | 'success' | 'warning' | 'error';
  disabled?: boolean;
  loading?: boolean;
}

export interface QuickActionsProps {
  actions: QuickAction[];
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  direction?: 'up' | 'down' | 'left' | 'right';
  rtl?: boolean;
  className?: string;
}


export const QuickActions: React.FC<QuickActionsProps> = ({
  actions,
  position = 'bottom-right',
  direction = 'up',
  rtl = false,
  className,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [hoveredAction, setHoveredAction] = useState<string | null>(null);

  const toggleOpen = useCallback(() => setIsOpen(prev => !prev), []);

  const positionClasses = {
    'bottom-right': 'bottom-6 right-6',
    'bottom-left': 'bottom-6 left-6',
    'top-right': 'top-6 right-6',
    'top-left': 'top-6 left-6',
  };

  const directionClasses = {
    up: 'flex-col-reverse',
    down: 'flex-col',
    left: 'flex-row-reverse',
    right: 'flex-row',
  };

  const colorClasses = {
    primary: 'bg-[var(--color-brand-primary)] hover:bg-[var(--color-brand-primaryHover)] text-white',
    secondary: 'bg-[var(--color-brand-secondary)] hover:bg-[var(--color-brand-secondaryHover)] text-white',
    success: 'bg-[var(--color-semantic-success)] hover:brightness-110 text-white',
    warning: 'bg-[var(--color-semantic-warning)] hover:brightness-110 text-black',
    error: 'bg-[var(--color-semantic-error)] hover:brightness-110 text-white',
  };

  return (
    <div className={cn('fixed z-modal', positionClasses[position], className)} dir={rtl ? 'rtl' : 'ltr'}>
      <div className={cn('flex items-center gap-3', directionClasses[direction])}>
        {/* Action Buttons */}
        {actions.map((action, index) => (
          <div key={action.id} className={cn('relative', isOpen ? 'opacity-100 scale-100' : 'opacity-0 scale-75 pointer-events-none')}
            style={{ transitionDelay: isOpen ? `${index * 50}ms` : '0ms', transition: 'all 200ms ease-out' }}>
            <button onClick={() => { action.onClick(); setIsOpen(false); }}
              onMouseEnter={() => setHoveredAction(action.id)} onMouseLeave={() => setHoveredAction(null)}
              disabled={action.disabled || action.loading}
              className={cn('w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-all duration-200',
                colorClasses[action.color || 'primary'],
                action.disabled && 'opacity-50 cursor-not-allowed',
                action.loading && 'animate-pulse')}>
              {action.loading ? <LoadingSpinner className="w-5 h-5" /> : action.icon}
            </button>

            {/* Tooltip */}
            {hoveredAction === action.id && (
              <div className={cn('absolute top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-lg bg-[var(--color-surface-default)] shadow-lg border border-[var(--color-border-light)] text-sm whitespace-nowrap animate-in fade-in duration-150',
                direction === 'up' || direction === 'down' ? (rtl ? 'right-full mr-3' : 'left-full ml-3') : 'bottom-full mb-3 left-1/2 -translate-x-1/2')}>
                {rtl && action.labelFa ? action.labelFa : action.label}
              </div>
            )}
          </div>
        ))}

        {/* Main FAB */}
        <button onClick={toggleOpen}
          className={cn('w-14 h-14 rounded-full flex items-center justify-center shadow-xl transition-all duration-300',
            'bg-[var(--color-brand-primary)] hover:bg-[var(--color-brand-primaryHover)] text-white',
            isOpen && 'rotate-45')}>
          <PlusIcon className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
};

const PlusIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
);

const LoadingSpinner: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={cn(className, 'animate-spin')} fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
  </svg>
);

export default QuickActions;
