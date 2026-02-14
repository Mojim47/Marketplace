// ═══════════════════════════════════════════════════════════════════════════
// Header Component - Sticky Navbar with Smart Search
// ═══════════════════════════════════════════════════════════════════════════

'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTheme } from '../../hooks/useTheme';
import { cn } from '../../utils/cn';

export interface HeaderProps {
  /** Logo element or URL */
  logo?: React.ReactNode;
  /** Navigation items */
  navItems?: NavItem[];
  /** Search placeholder */
  searchPlaceholder?: string;
  /** Search handler */
  onSearch?: (query: string) => void;
  /** Search suggestions */
  searchSuggestions?: SearchSuggestion[];
  /** User menu items */
  userMenuItems?: UserMenuItem[];
  /** User avatar URL */
  userAvatar?: string;
  /** User name */
  userName?: string;
  /** Wallet balance (Rials) */
  walletBalance?: number;
  /** Notification count */
  notificationCount?: number;
  /** On notification click */
  onNotificationClick?: () => void;
  /** On wallet click */
  onWalletClick?: () => void;
  /** On user menu item click */
  onUserMenuClick?: (item: UserMenuItem) => void;
  /** RTL mode */
  rtl?: boolean;
  /** Custom class */
  className?: string;
}

export interface NavItem {
  id: string;
  label: string;
  labelFa?: string;
  href?: string;
  icon?: React.ReactNode;
  children?: NavItem[];
  badge?: string | number;
}

export interface SearchSuggestion {
  id: string;
  text: string;
  type: 'product' | 'category' | 'brand' | 'recent';
  icon?: React.ReactNode;
  meta?: string;
}

export interface UserMenuItem {
  id: string;
  label: string;
  labelFa?: string;
  icon?: React.ReactNode;
  href?: string;
  danger?: boolean;
  divider?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  logo,
  navItems = [],
  searchPlaceholder = 'Search products...',
  onSearch,
  searchSuggestions = [],
  userMenuItems = [],
  userAvatar,
  userName,
  walletBalance,
  notificationCount = 0,
  onNotificationClick,
  onWalletClick,
  onUserMenuClick,
  rtl = false,
  className,
}) => {
  const { mode, toggleMode, isDark } = useTheme();
  const [isScrolled, setIsScrolled] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

  const searchRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Handle scroll for sticky shadow
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setIsSearchFocused(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery && onSearch) {
        onSearch(searchQuery);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, onSearch]);

  const formatCurrency = useCallback((amount: number) => {
    return `${new Intl.NumberFormat('fa-IR').format(amount)} ریال`;
  }, []);

  return (
    <header
      className={cn(
        'fixed top-0 left-0 right-0 z-sticky',
        'bg-[var(--color-background-default)]',
        'transition-shadow duration-normal ease-easeOut',
        isScrolled && 'shadow-md',
        className
      )}
      dir={rtl ? 'rtl' : 'ltr'}
    >
      <div className="container mx-auto px-4 lg:px-8">
        <div className="flex items-center justify-between h-16 lg:h-20">
          {/* Logo */}
          <div className="flex-shrink-0">
            {logo || (
              <span className="text-xl font-bold text-[var(--color-brand-primary)]">NextGen</span>
            )}
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-1">
            {navItems.map((item) => (
              <div
                key={item.id}
                className="relative"
                onMouseEnter={() => item.children && setActiveDropdown(item.id)}
                onMouseLeave={() => setActiveDropdown(null)}
              >
                <a
                  href={item.href || '#'}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-lg',
                    'text-[var(--color-text-primary)]',
                    'hover:bg-[var(--color-interactive-hover)]',
                    'transition-colors duration-fast',
                    'font-medium text-sm'
                  )}
                >
                  {item.icon}
                  <span>{rtl && item.labelFa ? item.labelFa : item.label}</span>
                  {item.badge && (
                    <span className="px-1.5 py-0.5 text-xs rounded-full bg-[var(--color-semantic-error)] text-white">
                      {item.badge}
                    </span>
                  )}
                  {item.children && <ChevronDownIcon className="w-4 h-4" />}
                </a>

                {/* Dropdown Menu */}
                {item.children && activeDropdown === item.id && (
                  <div
                    className={cn(
                      'absolute top-full mt-1 py-2 min-w-[200px]',
                      'bg-[var(--color-surface-default)] rounded-xl',
                      'shadow-lg border border-[var(--color-border-light)]',
                      'animate-in fade-in slide-in-from-top-2 duration-200',
                      rtl ? 'right-0' : 'left-0'
                    )}
                  >
                    {item.children.map((child) => (
                      <a
                        key={child.id}
                        href={child.href || '#'}
                        className={cn(
                          'flex items-center gap-3 px-4 py-2.5',
                          'text-[var(--color-text-primary)]',
                          'hover:bg-[var(--color-interactive-hover)]',
                          'transition-colors duration-fast'
                        )}
                      >
                        {child.icon}
                        <span>{rtl && child.labelFa ? child.labelFa : child.label}</span>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </nav>

          {/* Search Bar */}
          <div ref={searchRef} className="hidden md:block flex-1 max-w-xl mx-8">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setIsSearchFocused(true)}
                placeholder={searchPlaceholder}
                className={cn(
                  'w-full h-11 pl-12 pr-4 rounded-xl',
                  'bg-[var(--color-background-sunken)]',
                  'border-2 border-transparent',
                  'text-[var(--color-text-primary)]',
                  'placeholder:text-[var(--color-text-tertiary)]',
                  'focus:border-[var(--color-border-focus)]',
                  'focus:bg-[var(--color-surface-default)]',
                  'transition-all duration-normal',
                  'outline-none'
                )}
              />
              <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--color-text-tertiary)]" />

              {/* Search Suggestions Dropdown */}
              {isSearchFocused && (searchQuery || searchSuggestions.length > 0) && (
                <div
                  className={cn(
                    'absolute top-full mt-2 w-full py-2',
                    'bg-[var(--color-surface-default)] rounded-xl',
                    'shadow-xl border border-[var(--color-border-light)]',
                    'animate-in fade-in slide-in-from-top-2 duration-200',
                    'max-h-[400px] overflow-y-auto'
                  )}
                >
                  {searchSuggestions.map((suggestion) => (
                    <button
                      key={suggestion.id}
                      onClick={() => {
                        setSearchQuery(suggestion.text);
                        onSearch?.(suggestion.text);
                        setIsSearchFocused(false);
                      }}
                      className={cn(
                        'w-full flex items-center gap-3 px-4 py-3',
                        'text-left hover:bg-[var(--color-interactive-hover)]',
                        'transition-colors duration-fast'
                      )}
                    >
                      {suggestion.icon || (
                        <SearchIcon className="w-4 h-4 text-[var(--color-text-tertiary)]" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-[var(--color-text-primary)] truncate">
                          {suggestion.text}
                        </p>
                        {suggestion.meta && (
                          <p className="text-xs text-[var(--color-text-tertiary)]">
                            {suggestion.meta}
                          </p>
                        )}
                      </div>
                      <span
                        className={cn(
                          'text-xs px-2 py-0.5 rounded-full',
                          suggestion.type === 'product' &&
                            'bg-[var(--color-semantic-infoBg)] text-[var(--color-semantic-info)]',
                          suggestion.type === 'category' &&
                            'bg-[var(--color-semantic-successBg)] text-[var(--color-semantic-success)]',
                          suggestion.type === 'brand' &&
                            'bg-[var(--color-semantic-warningBg)] text-[var(--color-semantic-warning)]',
                          suggestion.type === 'recent' &&
                            'bg-[var(--color-background-sunken)] text-[var(--color-text-tertiary)]'
                        )}
                      >
                        {suggestion.type}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-2">
            {/* Theme Toggle */}
            <button
              onClick={toggleMode}
              className={cn(
                'p-2.5 rounded-xl',
                'hover:bg-[var(--color-interactive-hover)]',
                'transition-colors duration-fast'
              )}
              aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {isDark ? <SunIcon className="w-5 h-5" /> : <MoonIcon className="w-5 h-5" />}
            </button>

            {/* Wallet Quick Access */}
            {walletBalance !== undefined && (
              <button
                onClick={onWalletClick}
                className={cn(
                  'hidden sm:flex items-center gap-2 px-3 py-2 rounded-xl',
                  'bg-[var(--color-semantic-successBg)]',
                  'hover:bg-[var(--color-semantic-success)]/20',
                  'transition-colors duration-fast'
                )}
              >
                <WalletIcon className="w-5 h-5 text-[var(--color-semantic-success)]" />
                <span className="text-sm font-medium text-[var(--color-semantic-success)]">
                  {formatCurrency(walletBalance)}
                </span>
              </button>
            )}

            {/* Notifications */}
            <button
              onClick={onNotificationClick}
              className={cn(
                'relative p-2.5 rounded-xl',
                'hover:bg-[var(--color-interactive-hover)]',
                'transition-colors duration-fast'
              )}
              aria-label={`Notifications${notificationCount > 0 ? ` (${notificationCount} unread)` : ''}`}
            >
              <BellIcon className="w-5 h-5" />
              {notificationCount > 0 && (
                <span
                  className={cn(
                    'absolute -top-0.5 -right-0.5',
                    'min-w-[18px] h-[18px] px-1',
                    'flex items-center justify-center',
                    'text-xs font-bold text-white',
                    'bg-[var(--color-semantic-error)] rounded-full',
                    'animate-in zoom-in duration-200'
                  )}
                >
                  {notificationCount > 99 ? '99+' : notificationCount}
                </span>
              )}
            </button>

            {/* User Menu */}
            <div ref={userMenuRef} className="relative">
              <button
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className={cn(
                  'flex items-center gap-2 p-1.5 rounded-xl',
                  'hover:bg-[var(--color-interactive-hover)]',
                  'transition-colors duration-fast'
                )}
              >
                {userAvatar ? (
                  <img
                    src={userAvatar}
                    alt={userName || 'User'}
                    className="w-8 h-8 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-[var(--color-brand-primary)] flex items-center justify-center">
                    <span className="text-sm font-medium text-white">
                      {userName?.charAt(0).toUpperCase() || 'U'}
                    </span>
                  </div>
                )}
                <ChevronDownIcon
                  className={cn(
                    'w-4 h-4 transition-transform duration-fast',
                    isUserMenuOpen && 'rotate-180'
                  )}
                />
              </button>

              {/* User Dropdown */}
              {isUserMenuOpen && (
                <div
                  className={cn(
                    'absolute top-full mt-2 py-2 min-w-[220px]',
                    'bg-[var(--color-surface-default)] rounded-xl',
                    'shadow-xl border border-[var(--color-border-light)]',
                    'animate-in fade-in slide-in-from-top-2 duration-200',
                    rtl ? 'left-0' : 'right-0'
                  )}
                >
                  {/* User Info */}
                  {userName && (
                    <div className="px-4 py-3 border-b border-[var(--color-border-light)]">
                      <p className="font-medium text-[var(--color-text-primary)]">{userName}</p>
                    </div>
                  )}

                  {userMenuItems.map((item, index) => (
                    <React.Fragment key={item.id}>
                      {item.divider && index > 0 && (
                        <div className="my-1 border-t border-[var(--color-border-light)]" />
                      )}
                      <button
                        onClick={() => {
                          onUserMenuClick?.(item);
                          setIsUserMenuOpen(false);
                        }}
                        className={cn(
                          'w-full flex items-center gap-3 px-4 py-2.5',
                          'text-left transition-colors duration-fast',
                          item.danger
                            ? 'text-[var(--color-semantic-error)] hover:bg-[var(--color-semantic-errorBg)]'
                            : 'text-[var(--color-text-primary)] hover:bg-[var(--color-interactive-hover)]'
                        )}
                      >
                        {item.icon}
                        <span>{rtl && item.labelFa ? item.labelFa : item.label}</span>
                      </button>
                    </React.Fragment>
                  ))}
                </div>
              )}
            </div>

            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className={cn(
                'lg:hidden p-2.5 rounded-xl',
                'hover:bg-[var(--color-interactive-hover)]',
                'transition-colors duration-fast'
              )}
              aria-label="Toggle menu"
            >
              {isMobileMenuOpen ? (
                <CloseIcon className="w-5 h-5" />
              ) : (
                <MenuIcon className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div
          className={cn(
            'lg:hidden border-t border-[var(--color-border-light)]',
            'bg-[var(--color-background-default)]',
            'animate-in slide-in-from-top duration-200'
          )}
        >
          {/* Mobile Search */}
          <div className="p-4 md:hidden">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className={cn(
                'w-full h-11 px-4 rounded-xl',
                'bg-[var(--color-background-sunken)]',
                'border-2 border-transparent',
                'text-[var(--color-text-primary)]',
                'placeholder:text-[var(--color-text-tertiary)]',
                'focus:border-[var(--color-border-focus)]',
                'transition-all duration-normal',
                'outline-none'
              )}
            />
          </div>

          {/* Mobile Nav Items */}
          <nav className="px-4 pb-4">
            {navItems.map((item) => (
              <a
                key={item.id}
                href={item.href || '#'}
                className={cn(
                  'flex items-center gap-3 px-4 py-3 rounded-xl',
                  'text-[var(--color-text-primary)]',
                  'hover:bg-[var(--color-interactive-hover)]',
                  'transition-colors duration-fast'
                )}
              >
                {item.icon}
                <span className="font-medium">
                  {rtl && item.labelFa ? item.labelFa : item.label}
                </span>
                {item.badge && (
                  <span className="ml-auto px-2 py-0.5 text-xs rounded-full bg-[var(--color-semantic-error)] text-white">
                    {item.badge}
                  </span>
                )}
              </a>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
};

// Icon Components
const SearchIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
    />
  </svg>
);

const BellIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
    />
  </svg>
);

const WalletIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
    />
  </svg>
);

const SunIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
    />
  </svg>
);

const MoonIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
    />
  </svg>
);

const ChevronDownIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);

const MenuIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M4 6h16M4 12h16M4 18h16"
    />
  </svg>
);

const CloseIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

export default Header;
