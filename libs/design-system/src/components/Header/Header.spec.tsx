import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Header } from './Header';
import type { NavItem, SearchSuggestion, UserMenuItem } from './Header';

// Mock useTheme hook
vi.mock('../../hooks/useTheme', () => ({
  useTheme: () => ({
    mode: 'light',
    toggleMode: vi.fn(),
    isDark: false,
    theme: {
      background: { default: '#FFFFFF' },
      text: { primary: '#212121' },
    },
  }),
}));

describe('Header Component', () => {
  const mockNavItems: NavItem[] = [
    { id: 'home', label: 'Home', labelFa: 'خانه', href: '/' },
    { id: 'products', label: 'Products', labelFa: 'محصولات', href: '/products', badge: 'New' },
    {
      id: 'categories',
      label: 'Categories',
      children: [
        { id: 'electronics', label: 'Electronics', href: '/categories/electronics' },
        { id: 'clothing', label: 'Clothing', href: '/categories/clothing' },
      ],
    },
  ];

  const mockUserMenuItems: UserMenuItem[] = [
    { id: 'profile', label: 'Profile', labelFa: 'پروفایل' },
    { id: 'settings', label: 'Settings', labelFa: 'تنظیمات' },
    { id: 'logout', label: 'Logout', labelFa: 'خروج', danger: true, divider: true },
  ];

  const mockSearchSuggestions: SearchSuggestion[] = [
    { id: '1', text: 'iPhone 15', type: 'product', meta: 'Electronics' },
    { id: '2', text: 'Electronics', type: 'category' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock window.scrollY
    Object.defineProperty(window, 'scrollY', { value: 0, writable: true });
  });

  it('should render with default logo', () => {
    render(<Header />);
    expect(screen.getByText('NextGen')).toBeInTheDocument();
  });

  it('should render custom logo', () => {
    render(<Header logo={<span data-testid="custom-logo">Custom Logo</span>} />);
    expect(screen.getByTestId('custom-logo')).toBeInTheDocument();
  });

  it('should render navigation items', () => {
    render(<Header navItems={mockNavItems} />);
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Products')).toBeInTheDocument();
  });

  it('should show badge on nav items', () => {
    render(<Header navItems={mockNavItems} />);
    expect(screen.getByText('New')).toBeInTheDocument();
  });

  it('should render search input with placeholder', () => {
    render(<Header searchPlaceholder="Search products..." />);
    expect(screen.getByPlaceholderText('Search products...')).toBeInTheDocument();
  });

  it('should call onSearch when typing in search', async () => {
    const onSearch = vi.fn();
    render(<Header onSearch={onSearch} />);
    
    const searchInput = screen.getByPlaceholderText('Search products...');
    fireEvent.change(searchInput, { target: { value: 'test query' } });
    
    await waitFor(() => {
      expect(onSearch).toHaveBeenCalledWith('test query');
    }, { timeout: 500 });
  });

  it('should display notification count', () => {
    render(<Header notificationCount={5} />);
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('should display 99+ for large notification counts', () => {
    render(<Header notificationCount={150} />);
    expect(screen.getByText('99+')).toBeInTheDocument();
  });

  it('should call onNotificationClick when notification button clicked', () => {
    const onNotificationClick = vi.fn();
    render(<Header notificationCount={3} onNotificationClick={onNotificationClick} />);
    
    const notificationButton = screen.getByLabelText(/Notifications/);
    fireEvent.click(notificationButton);
    
    expect(onNotificationClick).toHaveBeenCalled();
  });

  it('should display wallet balance formatted', () => {
    render(<Header walletBalance={1500000} />);
    expect(screen.getByText(/۱٬۵۰۰٬۰۰۰ ریال/)).toBeInTheDocument();
  });

  it('should call onWalletClick when wallet button clicked', () => {
    const onWalletClick = vi.fn();
    render(<Header walletBalance={1000000} onWalletClick={onWalletClick} />);
    
    const walletButton = screen.getByText(/ریال/).closest('button');
    fireEvent.click(walletButton!);
    
    expect(onWalletClick).toHaveBeenCalled();
  });

  it('should render user avatar when provided', () => {
    render(<Header userAvatar="https://example.com/avatar.jpg" userName="John" />);
    const avatar = screen.getByAltText('John');
    expect(avatar).toHaveAttribute('src', 'https://example.com/avatar.jpg');
  });

  it('should render user initial when no avatar', () => {
    render(<Header userName="John Doe" />);
    expect(screen.getByText('J')).toBeInTheDocument();
  });

  it('should toggle user menu on click', () => {
    render(<Header userName="John" userMenuItems={mockUserMenuItems} />);
    
    const userButton = screen.getByText('J').closest('button');
    fireEvent.click(userButton!);
    
    expect(screen.getByText('Profile')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
    expect(screen.getByText('Logout')).toBeInTheDocument();
  });

  it('should call onUserMenuClick when menu item clicked', () => {
    const onUserMenuClick = vi.fn();
    render(
      <Header 
        userName="John" 
        userMenuItems={mockUserMenuItems} 
        onUserMenuClick={onUserMenuClick} 
      />
    );
    
    const userButton = screen.getByText('J').closest('button');
    fireEvent.click(userButton!);
    
    const profileItem = screen.getByText('Profile');
    fireEvent.click(profileItem);
    
    expect(onUserMenuClick).toHaveBeenCalledWith(mockUserMenuItems[0]);
  });

  it('should render in RTL mode with Persian labels', () => {
    render(<Header navItems={mockNavItems} rtl={true} />);
    expect(screen.getByText('خانه')).toBeInTheDocument();
    expect(screen.getByText('محصولات')).toBeInTheDocument();
  });

  it('should toggle mobile menu', () => {
    render(<Header navItems={mockNavItems} />);
    
    const menuButton = screen.getByLabelText('Toggle menu');
    fireEvent.click(menuButton);
    
    // Mobile menu should be visible
    const mobileNav = screen.getAllByText('Home');
    expect(mobileNav.length).toBeGreaterThan(0);
  });

  it('should have proper accessibility attributes', () => {
    render(<Header notificationCount={5} />);
    
    const notificationButton = screen.getByLabelText('Notifications (5 unread)');
    expect(notificationButton).toBeInTheDocument();
    
    const themeButton = screen.getByLabelText('Switch to dark mode');
    expect(themeButton).toBeInTheDocument();
  });
});
