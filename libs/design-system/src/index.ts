// ═══════════════════════════════════════════════════════════════════════════
// NextGen Design System - Enterprise UI Components
// ═══════════════════════════════════════════════════════════════════════════
// WCAG 2.2 AA/AAA Compliant | RTL Support | SC³ Data Flow Ready
// ═══════════════════════════════════════════════════════════════════════════

export type { BarChartProps, BarDataPoint } from './components/Charts/BarChart';
export { BarChart } from './components/Charts/BarChart';
export type { DataPoint, LineChartProps } from './components/Charts/LineChart';
// Components - Charts
export { LineChart } from './components/Charts/LineChart';
export type { PieChartProps, PieDataPoint } from './components/Charts/PieChart';
export { PieChart } from './components/Charts/PieChart';
export type { DashboardLayoutProps, DashboardWidget } from './components/Dashboard/DashboardLayout';
// Components - Dashboard
export { DashboardLayout } from './components/Dashboard/DashboardLayout';
export type {
  FooterLink,
  FooterProps,
  FooterSection,
  SocialLink,
} from './components/Footer/Footer';
// Components - Footer
export { Footer } from './components/Footer/Footer';
export type {
  HeaderProps,
  NavItem,
  SearchSuggestion,
  UserMenuItem,
} from './components/Header/Header';
// Components - Header
export { Header } from './components/Header/Header';
export type { KPICardProps, KPISize, KPITrend, KPIVariant } from './components/KPICard/KPICard';
// Components - KPI Card
export { KPICard } from './components/KPICard/KPICard';
export type {
  Notification,
  NotificationContextValue,
  NotificationPosition,
  NotificationProviderProps,
  NotificationType,
} from './components/Notifications/NotificationProvider';
// Components - Notifications
export {
  NotificationProvider,
  useNotifications,
} from './components/Notifications/NotificationProvider';
export type { QuickAction, QuickActionsProps } from './components/QuickActions/QuickActions';
// Components - Quick Actions
export { QuickActions } from './components/QuickActions/QuickActions';
export type { SidebarItem, SidebarProps } from './components/Sidebar/Sidebar';
// Components - Sidebar
export { Sidebar } from './components/Sidebar/Sidebar';
export type { UseThemeReturn } from './hooks/useTheme';
// Hooks
export { useTheme } from './hooks/useTheme';
export type { ThemeColors, ThemeContextValue, ThemeMode } from './themes';
// Themes
export * from './themes';
// Tokens
export * from './tokens';
// Utils
export { cn } from './utils/cn';
