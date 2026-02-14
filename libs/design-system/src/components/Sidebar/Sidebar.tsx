// ═══════════════════════════════════════════════════════════════════════════
// Sidebar Component - Expand/Collapse with Active Highlighting
// ═══════════════════════════════════════════════════════════════════════════

'use client';

import type React from 'react';
import { useCallback, useMemo, useState } from 'react';
import { cn } from '../../utils/cn';

export interface SidebarItem {
  id: string;
  label: string;
  labelFa?: string;
  icon: React.ReactNode;
  href?: string;
  badge?: string | number;
  badgeColor?: 'primary' | 'success' | 'warning' | 'error' | 'info';
  children?: SidebarItem[];
  disabled?: boolean;
}

export interface SidebarProps {
  /** Navigation items */
  items: SidebarItem[];
  /** Currently active item ID */
  activeId?: string;
  /** Collapsed state */
  collapsed?: boolean;
  /** On collapse toggle */
  onCollapseToggle?: (collapsed: boolean) => void;
  /** On item click */
  onItemClick?: (item: SidebarItem) => void;
  /** Header content */
  header?: React.ReactNode;
  /** Footer content */
  footer?: React.ReactNode;
  /** RTL mode */
  rtl?: boolean;
  /** Custom class */
  className?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  items,
  activeId,
  collapsed = false,
  onCollapseToggle,
  onItemClick,
  header,
  footer,
  rtl = false,
  className,
}) => {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  const toggleGroup = useCallback((id: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const isActive = useCallback(
    (item: SidebarItem): boolean => {
      if (item.id === activeId) {
        return true;
      }
      if (item.children) {
        return item.children.some((child) => isActive(child));
      }
      return false;
    },
    [activeId]
  );

  const badgeColors = useMemo(
    () => ({
      primary: 'bg-[var(--color-brand-primary)] text-white',
      success: 'bg-[var(--color-semantic-success)] text-white',
      warning: 'bg-[var(--color-semantic-warning)] text-black',
      error: 'bg-[var(--color-semantic-error)] text-white',
      info: 'bg-[var(--color-semantic-info)] text-white',
    }),
    []
  );

  const renderItem = (item: SidebarItem, depth = 0) => {
    const hasChildren = item.children && item.children.length > 0;
    const isExpanded = expandedGroups.has(item.id);
    const itemActive = isActive(item);
    const isHovered = hoveredItem === item.id;

    return (
      <div key={item.id} className="relative">
        <button
          onClick={() => {
            if (hasChildren && !collapsed) {
              toggleGroup(item.id);
            } else if (!item.disabled) {
              onItemClick?.(item);
            }
          }}
          onMouseEnter={() => setHoveredItem(item.id)}
          onMouseLeave={() => setHoveredItem(null)}
          disabled={item.disabled}
          className={cn(
            'w-full flex items-center gap-3 rounded-xl transition-all duration-200',
            collapsed ? 'justify-center px-3 py-3' : 'px-4 py-3',
            depth > 0 && !collapsed && 'ml-4',
            itemActive &&
              !item.disabled && [
                'bg-[var(--color-brand-primary)]/10',
                'text-[var(--color-brand-primary)]',
                'font-medium',
              ],
            !itemActive &&
              !item.disabled && [
                'text-[var(--color-text-secondary)]',
                'hover:bg-[var(--color-interactive-hover)]',
                'hover:text-[var(--color-text-primary)]',
              ],
            item.disabled && [
              'text-[var(--color-text-disabled)]',
              'cursor-not-allowed',
              'opacity-50',
            ]
          )}
          aria-expanded={hasChildren ? isExpanded : undefined}
          aria-current={item.id === activeId ? 'page' : undefined}
        >
          {/* Icon */}
          <span
            className={cn(
              'flex-shrink-0 w-5 h-5',
              itemActive && 'text-[var(--color-brand-primary)]'
            )}
          >
            {item.icon}
          </span>

          {/* Label */}
          {!collapsed && (
            <>
              <span className="flex-1 text-left text-sm truncate">
                {rtl && item.labelFa ? item.labelFa : item.label}
              </span>

              {/* Badge */}
              {item.badge && (
                <span
                  className={cn(
                    'px-2 py-0.5 text-xs font-medium rounded-full',
                    badgeColors[item.badgeColor || 'primary']
                  )}
                >
                  {item.badge}
                </span>
              )}

              {/* Expand Icon */}
              {hasChildren && (
                <ChevronIcon
                  className={cn(
                    'w-4 h-4 transition-transform duration-200',
                    isExpanded && 'rotate-90'
                  )}
                />
              )}
            </>
          )}
        </button>

        {/* Tooltip for collapsed state */}
        {collapsed && isHovered && (
          <div
            className={cn(
              'absolute top-1/2 -translate-y-1/2 z-tooltip',
              'px-3 py-2 rounded-lg',
              'bg-[var(--color-surface-default)]',
              'shadow-lg border border-[var(--color-border-light)]',
              'text-sm text-[var(--color-text-primary)]',
              'whitespace-nowrap',
              'animate-in fade-in slide-in-from-left-2 duration-150',
              rtl ? 'right-full mr-2' : 'left-full ml-2'
            )}
          >
            {rtl && item.labelFa ? item.labelFa : item.label}
            {item.badge && (
              <span
                className={cn(
                  'ml-2 px-1.5 py-0.5 text-xs rounded-full',
                  badgeColors[item.badgeColor || 'primary']
                )}
              >
                {item.badge}
              </span>
            )}
          </div>
        )}

        {/* Children */}
        {hasChildren && !collapsed && (
          <div
            className={cn(
              'overflow-hidden transition-all duration-200',
              isExpanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
            )}
          >
            <div className="py-1">
              {item.children?.map((child) => renderItem(child, depth + 1))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <aside
      className={cn(
        'flex flex-col h-full',
        'bg-[var(--color-background-paper)]',
        'border-r border-[var(--color-border-light)]',
        'transition-all duration-300 ease-easeInOut',
        collapsed ? 'w-[72px]' : 'w-[280px]',
        className
      )}
      dir={rtl ? 'rtl' : 'ltr'}
    >
      {/* Header */}
      {header && (
        <div className={cn('flex-shrink-0 p-4', 'border-b border-[var(--color-border-light)]')}>
          {header}
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        {items.map((item) => renderItem(item))}
      </nav>

      {/* Collapse Toggle */}
      <div className={cn('flex-shrink-0 p-3', 'border-t border-[var(--color-border-light)]')}>
        <button
          onClick={() => onCollapseToggle?.(!collapsed)}
          className={cn(
            'w-full flex items-center gap-3 px-4 py-3 rounded-xl',
            'text-[var(--color-text-secondary)]',
            'hover:bg-[var(--color-interactive-hover)]',
            'hover:text-[var(--color-text-primary)]',
            'transition-colors duration-200',
            collapsed && 'justify-center'
          )}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <CollapseIcon
            className={cn(
              'w-5 h-5 transition-transform duration-300',
              collapsed && 'rotate-180',
              rtl && 'rotate-180',
              collapsed && rtl && 'rotate-0'
            )}
          />
          {!collapsed && <span className="text-sm">{rtl ? 'جمع کردن' : 'Collapse'}</span>}
        </button>
      </div>

      {/* Footer */}
      {footer && !collapsed && (
        <div className={cn('flex-shrink-0 p-4', 'border-t border-[var(--color-border-light)]')}>
          {footer}
        </div>
      )}
    </aside>
  );
};

// Icons
const ChevronIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
);

const CollapseIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M11 19l-7-7 7-7m8 14l-7-7 7-7"
    />
  </svg>
);

export default Sidebar;
