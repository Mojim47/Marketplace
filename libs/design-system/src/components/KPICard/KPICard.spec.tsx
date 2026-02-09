import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { KPICard } from './KPICard';

describe('KPICard Component', () => {
  let _intersectionCallback: IntersectionObserverCallback;

  beforeEach(() => {
    // Mock IntersectionObserver to trigger visibility immediately
    const mockIntersectionObserver = vi.fn((callback: IntersectionObserverCallback) => {
      _intersectionCallback = callback;
      return {
        observe: vi.fn((element: Element) => {
          // Trigger intersection immediately
          callback(
            [{ isIntersecting: true, target: element } as IntersectionObserverEntry],
            {} as IntersectionObserver
          );
        }),
        unobserve: vi.fn(),
        disconnect: vi.fn(),
      };
    });
    window.IntersectionObserver =
      mockIntersectionObserver as unknown as typeof IntersectionObserver;

    // Mock requestAnimationFrame to execute immediately
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      cb(performance.now() + 2000); // Simulate animation complete
      return 1;
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('should render title', () => {
    render(<KPICard title="Total Sales" value={1000} />);
    expect(screen.getByText('Total Sales')).toBeInTheDocument();
  });

  it('should render Persian title in RTL mode', () => {
    render(<KPICard title="Total Sales" titleFa="فروش کل" value={1000} rtl={true} />);
    expect(screen.getByText('فروش کل')).toBeInTheDocument();
  });

  it('should render value with prefix', () => {
    render(<KPICard title="Revenue" value={5000} prefix="$" />);
    expect(screen.getByText(/\$/)).toBeInTheDocument();
  });

  it('should render value with suffix', () => {
    render(<KPICard title="Users" value={1500} suffix=" users" />);
    expect(screen.getByText(/users/)).toBeInTheDocument();
  });

  it('should show upward trend indicator when value increased', () => {
    render(<KPICard title="Sales" value={1200} previousValue={1000} />);
    expect(screen.getByText(/20\.0%/)).toBeInTheDocument();
    expect(screen.getByText('vs previous period')).toBeInTheDocument();
  });

  it('should show downward trend indicator when value decreased', () => {
    render(<KPICard title="Sales" value={800} previousValue={1000} />);
    expect(screen.getByText(/20\.0%/)).toBeInTheDocument();
  });

  it('should use provided trend value', () => {
    render(<KPICard title="Sales" value={1000} trend="up" trendValue={15.5} />);
    expect(screen.getByText(/15\.5%/)).toBeInTheDocument();
  });

  it('should render icon when provided', () => {
    const icon = <svg data-testid="kpi-icon" />;
    render(<KPICard title="Sales" value={1000} icon={icon} />);
    expect(screen.getByTestId('kpi-icon')).toBeInTheDocument();
  });

  it('should render in small size', () => {
    const { container } = render(<KPICard title="Sales" value={1000} size="sm" />);
    expect(container.querySelector('.p-4')).toBeInTheDocument();
  });

  it('should render in medium size', () => {
    const { container } = render(<KPICard title="Sales" value={1000} size="md" />);
    expect(container.querySelector('.p-6')).toBeInTheDocument();
  });

  it('should render in large size', () => {
    const { container } = render(<KPICard title="Sales" value={1000} size="lg" />);
    expect(container.querySelector('.p-8')).toBeInTheDocument();
  });

  it('should render gradient variant', () => {
    const { container } = render(
      <KPICard
        title="Sales"
        value={1000}
        variant="gradient"
        gradientFrom="from-blue-500"
        gradientTo="to-purple-600"
      />
    );
    expect(container.querySelector('.bg-gradient-to-br')).toBeInTheDocument();
  });

  it('should render outlined variant', () => {
    const { container } = render(<KPICard title="Sales" value={1000} variant="outlined" />);
    expect(container.querySelector('.border-2')).toBeInTheDocument();
  });

  it('should show loading skeleton', () => {
    const { container } = render(<KPICard title="Sales" value={1000} loading={true} />);
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
    // Title should not be visible in loading state
    expect(screen.queryByText('Sales')).not.toBeInTheDocument();
  });

  it('should be clickable when onClick provided', () => {
    const onClick = vi.fn();
    const { container } = render(<KPICard title="Sales" value={1000} onClick={onClick} />);

    const card = container.firstChild as HTMLElement;
    fireEvent.click(card);

    expect(onClick).toHaveBeenCalled();
  });

  it('should have cursor-pointer when clickable', () => {
    const onClick = vi.fn();
    const { container } = render(<KPICard title="Sales" value={1000} onClick={onClick} />);

    const card = container.firstChild as HTMLElement;
    expect(card).toHaveClass('cursor-pointer');
  });

  it('should apply custom className', () => {
    const { container } = render(<KPICard title="Sales" value={1000} className="custom-class" />);
    const card = container.firstChild as HTMLElement;
    expect(card).toHaveClass('custom-class');
  });

  it('should have hover effects when clickable', () => {
    const onClick = vi.fn();
    const { container } = render(<KPICard title="Sales" value={1000} onClick={onClick} />);

    const card = container.firstChild as HTMLElement;
    expect(card).toHaveClass('hover:shadow-lg');
    expect(card).toHaveClass('hover:-translate-y-1');
  });

  it('should show Persian comparison text in RTL', () => {
    render(<KPICard title="Sales" value={1200} previousValue={1000} rtl={true} />);
    expect(screen.getByText('نسبت به دوره قبل')).toBeInTheDocument();
  });

  it('should render default variant with border', () => {
    const { container } = render(<KPICard title="Sales" value={1000} variant="default" />);
    expect(container.querySelector('.border')).toBeInTheDocument();
  });

  it('should apply custom icon background', () => {
    const icon = <svg data-testid="kpi-icon" />;
    const { container } = render(
      <KPICard title="Sales" value={1000} icon={icon} iconBg="bg-red-100" />
    );
    expect(container.querySelector('.bg-red-100')).toBeInTheDocument();
  });
});
