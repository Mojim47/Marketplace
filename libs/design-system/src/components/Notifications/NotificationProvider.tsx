// ═══════════════════════════════════════════════════════════════════════════
// Notification System - Real-time Push + WebSocket Support
// ═══════════════════════════════════════════════════════════════════════════

'use client';

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  useMemo,
} from 'react';
import { cn } from '../../utils/cn';

export type NotificationType = 'success' | 'error' | 'warning' | 'info';
export type NotificationPosition = 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  titleFa?: string;
  message?: string;
  messageFa?: string;
  duration?: number;
  dismissible?: boolean;
  action?: {
    label: string;
    labelFa?: string;
    onClick: () => void;
  };
  timestamp: Date;
  read: boolean;
  persistent?: boolean;
}

export interface NotificationContextValue {
  notifications: Notification[];
  unreadCount: number;
  show: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => string;
  success: (title: string, message?: string) => string;
  error: (title: string, message?: string) => string;
  warning: (title: string, message?: string) => string;
  info: (title: string, message?: string) => string;
  dismiss: (id: string) => void;
  dismissAll: () => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearAll: () => void;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

export interface NotificationProviderProps {
  children: React.ReactNode;
  position?: NotificationPosition;
  maxVisible?: number;
  defaultDuration?: number;
  rtl?: boolean;
  websocketUrl?: string;
  onWebSocketMessage?: (data: unknown) => Omit<Notification, 'id' | 'timestamp' | 'read'> | null;
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({
  children,
  position = 'top-right',
  maxVisible = 5,
  defaultDuration = 5000,
  rtl = false,
  websocketUrl,
  onWebSocketMessage,
}) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [toasts, setToasts] = useState<Notification[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();

  const generateId = useCallback(() => {
    return `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  const show = useCallback((notification: Omit<Notification, 'id' | 'timestamp' | 'read'>): string => {
    const id = generateId();
    const newNotification: Notification = {
      ...notification,
      id,
      timestamp: new Date(),
      read: false,
      duration: notification.duration ?? defaultDuration,
      dismissible: notification.dismissible ?? true,
    };

    setNotifications(prev => [newNotification, ...prev]);
    
    if (!notification.persistent) {
      setToasts(prev => [newNotification, ...prev].slice(0, maxVisible));
    }

    return id;
  }, [generateId, defaultDuration, maxVisible]);

  const success = useCallback((title: string, message?: string) => {
    return show({ type: 'success', title, message });
  }, [show]);

  const error = useCallback((title: string, message?: string) => {
    return show({ type: 'error', title, message, duration: 8000 });
  }, [show]);

  const warning = useCallback((title: string, message?: string) => {
    return show({ type: 'warning', title, message });
  }, [show]);

  const info = useCallback((title: string, message?: string) => {
    return show({ type: 'info', title, message });
  }, [show]);

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(n => n.id !== id));
  }, []);

  const dismissAll = useCallback(() => {
    setToasts([]);
  }, []);

  const markAsRead = useCallback((id: string) => {
    setNotifications(prev =>
      prev.map(n => (n.id === id ? { ...n, read: true } : n))
    );
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
    setToasts([]);
  }, []);

  const unreadCount = useMemo(() => {
    return notifications.filter(n => !n.read).length;
  }, [notifications]);

  // WebSocket connection
  useEffect(() => {
    if (!websocketUrl) return undefined;

    const connect = () => {
      try {
        wsRef.current = new WebSocket(websocketUrl);

        wsRef.current.onopen = () => {
          console.log('[Notifications] WebSocket connected');
        };

        wsRef.current.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (onWebSocketMessage) {
              const notification = onWebSocketMessage(data);
              if (notification) {
                show(notification);
              }
            }
          } catch (err) {
            console.error('[Notifications] Failed to parse WebSocket message:', err);
          }
        };

        wsRef.current.onclose = () => {
          console.log('[Notifications] WebSocket disconnected, reconnecting...');
          reconnectTimeoutRef.current = setTimeout(connect, 3000);
        };

        wsRef.current.onerror = (err) => {
          console.error('[Notifications] WebSocket error:', err);
        };
      } catch (err) {
        console.error('[Notifications] Failed to connect WebSocket:', err);
        reconnectTimeoutRef.current = setTimeout(connect, 3000);
      }
    };

    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [websocketUrl, onWebSocketMessage, show]);

  // Auto-dismiss toasts
  useEffect(() => {
    const timers: NodeJS.Timeout[] = [];

    toasts.forEach(toast => {
      if (toast.duration && toast.duration > 0) {
        const timer = setTimeout(() => {
          dismiss(toast.id);
        }, toast.duration);
        timers.push(timer);
      }
    });

    return () => {
      timers.forEach(timer => clearTimeout(timer));
    };
  }, [toasts, dismiss]);

  const value: NotificationContextValue = {
    notifications,
    unreadCount,
    show,
    success,
    error,
    warning,
    info,
    dismiss,
    dismissAll,
    markAsRead,
    markAllAsRead,
    clearAll,
  };

  const positionClasses = {
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4',
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'top-center': 'top-4 left-1/2 -translate-x-1/2',
    'bottom-center': 'bottom-4 left-1/2 -translate-x-1/2',
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
      
      {/* Toast Container */}
      <div
        className={cn(
          'fixed z-toast pointer-events-none',
          positionClasses[position]
        )}
        dir={rtl ? 'rtl' : 'ltr'}
        aria-live="polite"
        aria-label="Notifications"
      >
        <div className="flex flex-col gap-3">
          {toasts.map((toast, index) => (
            <Toast
              key={toast.id}
              notification={toast}
              onDismiss={() => dismiss(toast.id)}
              rtl={rtl}
              style={{
                animationDelay: `${index * 50}ms`,
              }}
            />
          ))}
        </div>
      </div>
    </NotificationContext.Provider>
  );
};

interface ToastProps {
  notification: Notification;
  onDismiss: () => void;
  rtl?: boolean;
  style?: React.CSSProperties;
}

const Toast: React.FC<ToastProps> = ({ notification, onDismiss, rtl, style }) => {
  const typeStyles = {
    success: {
      bg: 'bg-[var(--color-semantic-successBg)]',
      border: 'border-[var(--color-semantic-success)]',
      icon: <CheckCircleIcon className="w-5 h-5 text-[var(--color-semantic-success)]" />,
    },
    error: {
      bg: 'bg-[var(--color-semantic-errorBg)]',
      border: 'border-[var(--color-semantic-error)]',
      icon: <XCircleIcon className="w-5 h-5 text-[var(--color-semantic-error)]" />,
    },
    warning: {
      bg: 'bg-[var(--color-semantic-warningBg)]',
      border: 'border-[var(--color-semantic-warning)]',
      icon: <ExclamationIcon className="w-5 h-5 text-[var(--color-semantic-warning)]" />,
    },
    info: {
      bg: 'bg-[var(--color-semantic-infoBg)]',
      border: 'border-[var(--color-semantic-info)]',
      icon: <InfoIcon className="w-5 h-5 text-[var(--color-semantic-info)]" />,
    },
  };

  const { bg, border, icon } = typeStyles[notification.type];

  return (
    <div
      className={cn(
        'pointer-events-auto w-[380px] max-w-[calc(100vw-2rem)]',
        'flex items-start gap-3 p-4 rounded-xl',
        'bg-[var(--color-surface-default)]',
        'shadow-xl border-l-4',
        border,
        'animate-in slide-in-from-right-full fade-in duration-300'
      )}
      style={style}
      role="alert"
    >
      {/* Icon */}
      <div className={cn('flex-shrink-0 p-1 rounded-lg', bg)}>
        {icon}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-[var(--color-text-primary)]">
          {rtl && notification.titleFa ? notification.titleFa : notification.title}
        </p>
        {notification.message && (
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            {rtl && notification.messageFa ? notification.messageFa : notification.message}
          </p>
        )}
        {notification.action && (
          <button
            onClick={notification.action.onClick}
            className={cn(
              'mt-2 text-sm font-medium',
              'text-[var(--color-brand-primary)]',
              'hover:text-[var(--color-brand-primaryHover)]',
              'transition-colors duration-fast'
            )}
          >
            {rtl && notification.action.labelFa
              ? notification.action.labelFa
              : notification.action.label}
          </button>
        )}
      </div>

      {/* Dismiss Button */}
      {notification.dismissible && (
        <button
          onClick={onDismiss}
          className={cn(
            'flex-shrink-0 p-1 rounded-lg',
            'text-[var(--color-text-tertiary)]',
            'hover:text-[var(--color-text-primary)]',
            'hover:bg-[var(--color-interactive-hover)]',
            'transition-colors duration-fast'
          )}
          aria-label="Dismiss notification"
        >
          <XIcon className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

// Hook
export function useNotifications(): NotificationContextValue {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within NotificationProvider');
  }
  return context;
}

// Icons
const CheckCircleIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const XCircleIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const ExclamationIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
  </svg>
);

const InfoIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const XIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

export default NotificationProvider;
