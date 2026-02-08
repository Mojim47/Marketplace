// ═══════════════════════════════════════════════════════════════════════════
// Dashboard Layout - Drag & Drop Grid with Responsive Breakpoints
// ═══════════════════════════════════════════════════════════════════════════

'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { cn } from '../../utils/cn';

export interface DashboardWidget {
  id: string;
  title: string;
  titleFa?: string;
  component: React.ReactNode;
  colSpan?: 1 | 2 | 3 | 4;
  rowSpan?: 1 | 2 | 3;
  minWidth?: number;
  minHeight?: number;
  removable?: boolean;
  collapsible?: boolean;
}

export interface DashboardLayoutProps {
  widgets: DashboardWidget[];
  columns?: 1 | 2 | 3 | 4;
  gap?: 'sm' | 'md' | 'lg';
  onLayoutChange?: (widgets: DashboardWidget[]) => void;
  onWidgetRemove?: (widgetId: string) => void;
  editable?: boolean;
  rtl?: boolean;
  className?: string;
}


export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  widgets: initialWidgets,
  columns = 4,
  gap = 'md',
  onLayoutChange,
  onWidgetRemove,
  editable = false,
  rtl = false,
  className,
}) => {
  const [widgets, setWidgets] = useState(initialWidgets);
  const [draggedWidget, setDraggedWidget] = useState<string | null>(null);
  const [dragOverWidget, setDragOverWidget] = useState<string | null>(null);
  const [collapsedWidgets, setCollapsedWidgets] = useState<Set<string>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setWidgets(initialWidgets);
  }, [initialWidgets]);

  const gapClasses = {
    sm: 'gap-3',
    md: 'gap-4 lg:gap-6',
    lg: 'gap-6 lg:gap-8',
  };

  const columnClasses = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
  };

  const handleDragStart = useCallback((e: React.DragEvent, widgetId: string) => {
    if (!editable) return;
    setDraggedWidget(widgetId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', widgetId);
  }, [editable]);

  const handleDragOver = useCallback((e: React.DragEvent, widgetId: string) => {
    if (!editable || !draggedWidget || draggedWidget === widgetId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverWidget(widgetId);
  }, [editable, draggedWidget]);

  const handleDragLeave = useCallback(() => {
    setDragOverWidget(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, targetId: string) => {
    if (!editable || !draggedWidget || draggedWidget === targetId) return;
    e.preventDefault();

    const newWidgets = [...widgets];
    const draggedIndex = newWidgets.findIndex(w => w.id === draggedWidget);
    const targetIndex = newWidgets.findIndex(w => w.id === targetId);

    if (draggedIndex !== -1 && targetIndex !== -1) {
      const [removed] = newWidgets.splice(draggedIndex, 1);
      newWidgets.splice(targetIndex, 0, removed);
      setWidgets(newWidgets);
      onLayoutChange?.(newWidgets);
    }

    setDraggedWidget(null);
    setDragOverWidget(null);
  }, [editable, draggedWidget, widgets, onLayoutChange]);

  const handleDragEnd = useCallback(() => {
    setDraggedWidget(null);
    setDragOverWidget(null);
  }, []);

  const toggleCollapse = useCallback((widgetId: string) => {
    setCollapsedWidgets(prev => {
      const next = new Set(prev);
      if (next.has(widgetId)) {
        next.delete(widgetId);
      } else {
        next.add(widgetId);
      }
      return next;
    });
  }, []);

  const removeWidget = useCallback((widgetId: string) => {
    const newWidgets = widgets.filter(w => w.id !== widgetId);
    setWidgets(newWidgets);
    onWidgetRemove?.(widgetId);
    onLayoutChange?.(newWidgets);
  }, [widgets, onWidgetRemove, onLayoutChange]);

  const getColSpanClass = (span: number = 1) => {
    const classes: Record<number, string> = {
      1: 'col-span-1',
      2: 'col-span-1 md:col-span-2',
      3: 'col-span-1 md:col-span-2 lg:col-span-3',
      4: 'col-span-1 md:col-span-2 lg:col-span-4',
    };
    return classes[span] || classes[1];
  };

  const getRowSpanClass = (span: number = 1) => {
    const classes: Record<number, string> = {
      1: 'row-span-1',
      2: 'row-span-2',
      3: 'row-span-3',
    };
    return classes[span] || classes[1];
  };

  return (
    <div
      ref={containerRef}
      className={cn('grid', columnClasses[columns], gapClasses[gap], className)}
      dir={rtl ? 'rtl' : 'ltr'}
    >
      {widgets.map((widget) => {
        const isCollapsed = collapsedWidgets.has(widget.id);
        const isDragging = draggedWidget === widget.id;
        const isDragOver = dragOverWidget === widget.id;

        return (
          <div
            key={widget.id}
            draggable={editable}
            onDragStart={(e) => handleDragStart(e, widget.id)}
            onDragOver={(e) => handleDragOver(e, widget.id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, widget.id)}
            onDragEnd={handleDragEnd}
            className={cn(
              'rounded-2xl overflow-hidden',
              'bg-[var(--color-surface-default)]',
              'border border-[var(--color-border-light)]',
              'transition-all duration-200',
              getColSpanClass(widget.colSpan),
              !isCollapsed && getRowSpanClass(widget.rowSpan),
              isDragging && 'opacity-50 scale-95',
              isDragOver && 'ring-2 ring-[var(--color-brand-primary)] ring-offset-2',
              editable && 'cursor-move'
            )}
          >
            {/* Widget Header */}
            <div className={cn(
              'flex items-center justify-between px-4 py-3',
              'border-b border-[var(--color-border-light)]',
              'bg-[var(--color-background-paper)]'
            )}>
              <h3 className="font-medium text-[var(--color-text-primary)]">
                {rtl && widget.titleFa ? widget.titleFa : widget.title}
              </h3>
              <div className="flex items-center gap-1">
                {widget.collapsible && (
                  <button
                    onClick={() => toggleCollapse(widget.id)}
                    className={cn(
                      'p-1.5 rounded-lg',
                      'text-[var(--color-text-tertiary)]',
                      'hover:text-[var(--color-text-primary)]',
                      'hover:bg-[var(--color-interactive-hover)]',
                      'transition-colors duration-fast'
                    )}
                    aria-label={isCollapsed ? 'Expand' : 'Collapse'}
                  >
                    <ChevronIcon className={cn(
                      'w-4 h-4 transition-transform duration-200',
                      isCollapsed && 'rotate-180'
                    )} />
                  </button>
                )}
                {widget.removable && editable && (
                  <button
                    onClick={() => removeWidget(widget.id)}
                    className={cn(
                      'p-1.5 rounded-lg',
                      'text-[var(--color-text-tertiary)]',
                      'hover:text-[var(--color-semantic-error)]',
                      'hover:bg-[var(--color-semantic-errorBg)]',
                      'transition-colors duration-fast'
                    )}
                    aria-label="Remove widget"
                  >
                    <XIcon className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Widget Content */}
            <div className={cn(
              'transition-all duration-200 overflow-hidden',
              isCollapsed ? 'max-h-0' : 'max-h-[2000px]'
            )}>
              <div className="p-4">
                {widget.component}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

// Icons
const ChevronIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
  </svg>
);

const XIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

export default DashboardLayout;
