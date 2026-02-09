// ═══════════════════════════════════════════════════════════════════════════
// NextGen Design System - Enterprise UI Components
// ═══════════════════════════════════════════════════════════════════════════
// WCAG 2.2 AA/AAA Compliant | RTL Support | SC³ Data Flow Ready
// ═══════════════════════════════════════════════════════════════════════════

// Tokens
export * from './tokens';

// Themes
export * from './themes';
export type { ThemeMode, ThemeColors, ThemeContextValue } from './themes';

// Hooks
export { useTheme } from './hooks/useTheme';
export type { UseThemeReturn } from './hooks/useTheme';

// Utils
export { cn } from './utils/cn';

// Components - Header
export { Header } from './components/Header/Header';
export type {
  HeaderProps,
  NavItem,
  SearchSuggestion,
  UserMenuItem,
} from './components/Header/Header';

// Components - Sidebar
export { Sidebar } from './components/Sidebar/Sidebar';
export type { SidebarProps, SidebarItem } from './components/Sidebar/Sidebar';

// Components - Footer
export { Footer } from './components/Footer/Footer';
export type {
  FooterProps,
  FooterSection,
  FooterLink,
  SocialLink,
} from './components/Footer/Footer';

// Components - Notifications
export {
  NotificationProvider,
  useNotifications,
} from './components/Notifications/NotificationProvider';
export type {
  NotificationProviderProps,
  NotificationContextValue,
  Notification,
  NotificationType,
  NotificationPosition,
} from './components/Notifications/NotificationProvider';

// Components - KPI Card
export { KPICard } from './components/KPICard/KPICard';
export type { KPICardProps, KPITrend, KPISize, KPIVariant } from './components/KPICard/KPICard';

// Components - Dashboard
export { DashboardLayout } from './components/Dashboard/DashboardLayout';
export type { DashboardLayoutProps, DashboardWidget } from './components/Dashboard/DashboardLayout';

// Components - Charts
export { LineChart } from './components/Charts/LineChart';
export type { LineChartProps, DataPoint } from './components/Charts/LineChart';

export { BarChart } from './components/Charts/BarChart';
export type { BarChartProps, BarDataPoint } from './components/Charts/BarChart';

export { PieChart } from './components/Charts/PieChart';
export type { PieChartProps, PieDataPoint } from './components/Charts/PieChart';

// Components - Quick Actions
export { QuickActions } from './components/QuickActions/QuickActions';
export type { QuickActionsProps, QuickAction } from './components/QuickActions/QuickActions';
