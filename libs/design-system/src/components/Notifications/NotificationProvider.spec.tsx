import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NotificationProvider, useNotifications } from './NotificationProvider';

// Test component that uses the notification context
const TestConsumer: React.FC = () => {
  const {
    notifications,
    success,
    error,
    warning,
    info,
    dismiss,
    clearAll,
    markAsRead,
    unreadCount,
  } = useNotifications();

  return (
    <div>
      <button onClick={() => success('Success Title', 'Test message')}>Add Success</button>
      <button onClick={() => error('Error Title', 'Error message')}>Add Error</button>
      <button onClick={() => warning('Warning Title', 'Warning message')}>Add Warning</button>
      <button onClick={() => info('Info Title', 'Info message')}>Add Info</button>
      <button onClick={clearAll}>Clear All</button>
      <div data-testid="notification-count">{notifications.length}</div>
      <div data-testid="unread-count">{unreadCount}</div>
      {notifications.map((n) => (
        <div key={n.id} data-testid={`notification-item-${n.id}`}>
          <button onClick={() => dismiss(n.id)}>Remove {n.id}</button>
          <button onClick={() => markAsRead(n.id)}>Mark Read {n.id}</button>
        </div>
      ))}
    </div>
  );
};

describe('NotificationProvider', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('should render children', () => {
    render(
      <NotificationProvider>
        <div data-testid="child">Child Content</div>
      </NotificationProvider>
    );

    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('should add success notification', () => {
    render(
      <NotificationProvider>
        <TestConsumer />
      </NotificationProvider>
    );

    fireEvent.click(screen.getByText('Add Success'));

    // Check toast is rendered
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Success Title')).toBeInTheDocument();
    expect(screen.getByText('Test message')).toBeInTheDocument();
    expect(screen.getByTestId('notification-count')).toHaveTextContent('1');
  });

  it('should add error notification', () => {
    render(
      <NotificationProvider>
        <TestConsumer />
      </NotificationProvider>
    );

    fireEvent.click(screen.getByText('Add Error'));

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Error Title')).toBeInTheDocument();
  });

  it('should add warning notification', () => {
    render(
      <NotificationProvider>
        <TestConsumer />
      </NotificationProvider>
    );

    fireEvent.click(screen.getByText('Add Warning'));

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Warning Title')).toBeInTheDocument();
  });

  it('should add info notification', () => {
    render(
      <NotificationProvider>
        <TestConsumer />
      </NotificationProvider>
    );

    fireEvent.click(screen.getByText('Add Info'));

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Info Title')).toBeInTheDocument();
  });

  it('should dismiss toast notification', () => {
    render(
      <NotificationProvider>
        <TestConsumer />
      </NotificationProvider>
    );

    fireEvent.click(screen.getByText('Add Success'));
    expect(screen.getByRole('alert')).toBeInTheDocument();

    // Find dismiss button in toast
    const dismissButton = screen.getByLabelText('Dismiss notification');
    fireEvent.click(dismissButton);

    // Toast should be dismissed immediately
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    // But notification still in list
    expect(screen.getByTestId('notification-count')).toHaveTextContent('1');
  });

  it('should clear all notifications', () => {
    render(
      <NotificationProvider>
        <TestConsumer />
      </NotificationProvider>
    );

    fireEvent.click(screen.getByText('Add Success'));
    fireEvent.click(screen.getByText('Add Error'));

    expect(screen.getByTestId('notification-count')).toHaveTextContent('2');

    fireEvent.click(screen.getByText('Clear All'));

    expect(screen.getByTestId('notification-count')).toHaveTextContent('0');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('should auto-dismiss notifications after duration', () => {
    render(
      <NotificationProvider defaultDuration={3000}>
        <TestConsumer />
      </NotificationProvider>
    );

    fireEvent.click(screen.getByText('Add Success'));
    expect(screen.getByRole('alert')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(3500);
    });

    // Toast should be auto-dismissed
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('should respect maxVisible limit for toasts', () => {
    render(
      <NotificationProvider maxVisible={2}>
        <TestConsumer />
      </NotificationProvider>
    );

    fireEvent.click(screen.getByText('Add Success'));
    fireEvent.click(screen.getByText('Add Error'));
    fireEvent.click(screen.getByText('Add Warning'));

    // All notifications stored
    expect(screen.getByTestId('notification-count')).toHaveTextContent('3');

    // But only 2 toasts visible
    const alerts = screen.getAllByRole('alert');
    expect(alerts.length).toBeLessThanOrEqual(2);
  });

  it('should track unread count', () => {
    render(
      <NotificationProvider>
        <TestConsumer />
      </NotificationProvider>
    );

    fireEvent.click(screen.getByText('Add Success'));
    fireEvent.click(screen.getByText('Add Error'));

    expect(screen.getByTestId('unread-count')).toHaveTextContent('2');
  });

  it('should render in different positions', () => {
    const { container, rerender } = render(
      <NotificationProvider position="top-right">
        <TestConsumer />
      </NotificationProvider>
    );

    let toastContainer = container.querySelector('.fixed');
    expect(toastContainer).toHaveClass('top-4');
    expect(toastContainer).toHaveClass('right-4');

    rerender(
      <NotificationProvider position="bottom-left">
        <TestConsumer />
      </NotificationProvider>
    );

    toastContainer = container.querySelector('.fixed');
    expect(toastContainer).toHaveClass('bottom-4');
    expect(toastContainer).toHaveClass('left-4');
  });

  it('should render in RTL mode', () => {
    const { container } = render(
      <NotificationProvider rtl={true}>
        <TestConsumer />
      </NotificationProvider>
    );

    const toastContainer = container.querySelector('[dir="rtl"]');
    expect(toastContainer).toBeInTheDocument();
  });

  it('should have aria-live for accessibility', () => {
    const { container } = render(
      <NotificationProvider>
        <TestConsumer />
      </NotificationProvider>
    );

    const toastContainer = container.querySelector('[aria-live="polite"]');
    expect(toastContainer).toBeInTheDocument();
  });
});

describe('useNotifications hook', () => {
  it('should throw error when used outside provider', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      render(<TestConsumer />);
    }).toThrow('useNotifications must be used within NotificationProvider');

    consoleError.mockRestore();
  });
});
