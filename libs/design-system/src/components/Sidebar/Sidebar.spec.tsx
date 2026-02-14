import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Sidebar } from './Sidebar';
import type { SidebarItem } from './Sidebar';

describe('Sidebar Component', () => {
  const mockIcon = <svg data-testid="mock-icon" />;

  const mockItems: SidebarItem[] = [
    { id: 'dashboard', label: 'Dashboard', labelFa: 'داشبورد', icon: mockIcon },
    {
      id: 'products',
      label: 'Products',
      labelFa: 'محصولات',
      icon: mockIcon,
      badge: 12,
      badgeColor: 'primary',
    },
    {
      id: 'orders',
      label: 'Orders',
      labelFa: 'سفارشات',
      icon: mockIcon,
      children: [
        { id: 'pending', label: 'Pending', icon: mockIcon },
        { id: 'completed', label: 'Completed', icon: mockIcon },
      ],
    },
    { id: 'disabled', label: 'Disabled Item', icon: mockIcon, disabled: true },
  ];

  it('should render all navigation items', () => {
    render(<Sidebar items={mockItems} />);

    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Products')).toBeInTheDocument();
    expect(screen.getByText('Orders')).toBeInTheDocument();
  });

  it('should display badges on items', () => {
    render(<Sidebar items={mockItems} />);
    expect(screen.getByText('12')).toBeInTheDocument();
  });

  it('should highlight active item', () => {
    render(<Sidebar items={mockItems} activeId="dashboard" />);

    const dashboardButton = screen.getByText('Dashboard').closest('button');
    expect(dashboardButton).toHaveClass('bg-[var(--color-brand-primary)]/10');
  });

  it('should expand/collapse groups on click', () => {
    render(<Sidebar items={mockItems} />);

    const ordersButton = screen.getByText('Orders').closest('button');
    fireEvent.click(ordersButton!);

    expect(screen.getByText('Pending')).toBeInTheDocument();
    expect(screen.getByText('Completed')).toBeInTheDocument();

    // Collapse
    fireEvent.click(ordersButton!);
    // Children should be hidden (max-h-0)
  });

  it('should call onItemClick when item clicked', () => {
    const onItemClick = vi.fn();
    render(<Sidebar items={mockItems} onItemClick={onItemClick} />);

    const dashboardButton = screen.getByText('Dashboard').closest('button');
    fireEvent.click(dashboardButton!);

    expect(onItemClick).toHaveBeenCalledWith(mockItems[0]);
  });

  it('should not call onItemClick for disabled items', () => {
    const onItemClick = vi.fn();
    render(<Sidebar items={mockItems} onItemClick={onItemClick} />);

    const disabledButton = screen.getByText('Disabled Item').closest('button');
    fireEvent.click(disabledButton!);

    expect(onItemClick).not.toHaveBeenCalled();
  });

  it('should toggle collapse state', () => {
    const onCollapseToggle = vi.fn();
    render(<Sidebar items={mockItems} collapsed={false} onCollapseToggle={onCollapseToggle} />);

    const collapseButton = screen.getByLabelText('Collapse sidebar');
    fireEvent.click(collapseButton);

    expect(onCollapseToggle).toHaveBeenCalledWith(true);
  });

  it('should render in collapsed state', () => {
    render(<Sidebar items={mockItems} collapsed={true} />);

    // Labels should not be visible in collapsed state
    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
  });

  it('should show tooltip on hover in collapsed state', () => {
    render(<Sidebar items={mockItems} collapsed={true} />);

    const buttons = screen.getAllByRole('button');
    const dashboardButton = buttons[0];

    fireEvent.mouseEnter(dashboardButton);

    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('should render in RTL mode with Persian labels', () => {
    render(<Sidebar items={mockItems} rtl={true} />);

    expect(screen.getByText('داشبورد')).toBeInTheDocument();
    expect(screen.getByText('محصولات')).toBeInTheDocument();
  });

  it('should render header content', () => {
    render(
      <Sidebar items={mockItems} header={<div data-testid="sidebar-header">Header Content</div>} />
    );

    expect(screen.getByTestId('sidebar-header')).toBeInTheDocument();
  });

  it('should render footer content when not collapsed', () => {
    render(
      <Sidebar items={mockItems} footer={<div data-testid="sidebar-footer">Footer Content</div>} />
    );

    expect(screen.getByTestId('sidebar-footer')).toBeInTheDocument();
  });

  it('should hide footer when collapsed', () => {
    render(
      <Sidebar
        items={mockItems}
        collapsed={true}
        footer={<div data-testid="sidebar-footer">Footer Content</div>}
      />
    );

    expect(screen.queryByTestId('sidebar-footer')).not.toBeInTheDocument();
  });

  it('should have proper aria attributes', () => {
    render(<Sidebar items={mockItems} activeId="dashboard" />);

    const dashboardButton = screen.getByText('Dashboard').closest('button');
    expect(dashboardButton).toHaveAttribute('aria-current', 'page');

    const ordersButton = screen.getByText('Orders').closest('button');
    expect(ordersButton).toHaveAttribute('aria-expanded', 'false');
  });

  it('should apply different badge colors', () => {
    const itemsWithBadges: SidebarItem[] = [
      { id: '1', label: 'Success', icon: mockIcon, badge: 5, badgeColor: 'success' },
      { id: '2', label: 'Warning', icon: mockIcon, badge: 3, badgeColor: 'warning' },
      { id: '3', label: 'Error', icon: mockIcon, badge: 1, badgeColor: 'error' },
    ];

    render(<Sidebar items={itemsWithBadges} />);

    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
  });
});
