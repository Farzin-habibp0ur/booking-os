/**
 * Single source of truth for all navigable routes in apps/web.
 * Consumed by shell.tsx (sidebar + mobile tab bar) and command-palette.tsx.
 */
import {
  LayoutDashboard,
  MessageSquare,
  ListChecks,
  Calendar,
  Users,
  BookOpen,
  Scissors,
  UserCog,
  BarChart3,
  TrendingUp,
  Target,
  Package,
  Kanban,
  Compass,
  Sparkles,
  Receipt,
  Car,
  ListFilter,
  Bot,
  Gauge,
  Blocks,
  Zap,
  Settings as SettingsIcon,
} from 'lucide-react';

export interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  roles: string[];
}

export interface NavConfigOptions {
  t: (key: string, params?: any) => string;
  packName: string;
  packLabels: { customer?: string; booking?: string; service?: string };
  kanbanEnabled?: boolean;
}

export function getNavItems(opts: NavConfigOptions): NavItem[] {
  const { t, packName, packLabels, kanbanEnabled } = opts;
  return [
    {
      href: '/dashboard',
      label: t('nav.dashboard'),
      icon: LayoutDashboard,
      roles: ['ADMIN', 'AGENT', 'SERVICE_PROVIDER'],
    },
    {
      href: '/inbox',
      label: t('nav.inbox'),
      icon: MessageSquare,
      roles: ['ADMIN', 'AGENT', 'SERVICE_PROVIDER'],
    },
    { href: '/waitlist', label: t('nav.waitlist'), icon: ListChecks, roles: ['ADMIN', 'AGENT'] },
    {
      href: '/calendar',
      label: t('nav.calendar'),
      icon: Calendar,
      roles: ['ADMIN', 'AGENT', 'SERVICE_PROVIDER'],
    },
    {
      href: '/customers',
      label: t('nav.customers', { entity: packLabels.customer }),
      icon: Users,
      roles: ['ADMIN', 'AGENT', 'SERVICE_PROVIDER'],
    },
    {
      href: '/bookings',
      label: t('nav.bookings', { entity: packLabels.booking }),
      icon: BookOpen,
      roles: ['ADMIN', 'AGENT', 'SERVICE_PROVIDER'],
    },
    {
      href: '/services',
      label: t('nav.services', { entity: packLabels.service }),
      icon: Scissors,
      roles: ['ADMIN', 'AGENT', 'SERVICE_PROVIDER'],
    },
    { href: '/staff', label: t('nav.staff'), icon: UserCog, roles: ['ADMIN'] },
    ...(packName === 'dealership'
      ? [
          { href: '/inventory', label: t('nav.inventory'), icon: Car, roles: ['ADMIN', 'AGENT'] },
          { href: '/pipeline', label: t('nav.pipeline'), icon: Compass, roles: ['ADMIN', 'AGENT'] },
        ]
      : []),
    { href: '/invoices', label: t('nav.invoices'), icon: Receipt, roles: ['ADMIN'] },
    { href: '/marketing', label: t('nav.marketing'), icon: Target, roles: ['ADMIN'] },
    ...(packName === 'wellness'
      ? [{ href: '/packages', label: t('nav.packages'), icon: Package, roles: ['ADMIN'] }]
      : []),
    ...(kanbanEnabled
      ? [
          {
            href: '/service-board',
            label: t('nav.service_board'),
            icon: Kanban,
            roles: ['ADMIN', 'AGENT', 'SERVICE_PROVIDER'],
          },
        ]
      : []),
    { href: '/reports', label: t('nav.reports'), icon: BarChart3, roles: ['ADMIN', 'AGENT'] },
    ...(packName !== 'general'
      ? [{ href: '/roi', label: t('nav.roi'), icon: TrendingUp, roles: ['ADMIN'] }]
      : []),
    { href: '/ai', label: t('nav.ai'), icon: Sparkles, roles: ['ADMIN'] },
    { href: '/ai/agents', label: t('nav.ai_agents'), icon: Bot, roles: ['ADMIN'] },
    { href: '/ai/actions', label: t('nav.ai_actions'), icon: ListFilter, roles: ['ADMIN'] },
    { href: '/ai/automations', label: t('nav.ai_automations'), icon: Zap, roles: ['ADMIN'] },
    { href: '/ai/settings', label: t('nav.ai_settings'), icon: SettingsIcon, roles: ['ADMIN'] },
    { href: '/ai/performance', label: t('nav.ai_performance'), icon: Gauge, roles: ['ADMIN'] },
    {
      href: '/admin/pack-builder',
      label: 'Pack Builder',
      icon: Blocks,
      roles: ['SUPER_ADMIN'],
    },
  ];
}
