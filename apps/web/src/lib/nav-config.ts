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
  Megaphone,
  Sparkles,
  Receipt,
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

export interface BusinessNavContext {
  /**
   * Feature flag — hides /campaigns from the nav when not explicitly true.
   * Read from `business.packConfig.featureFlags.campaignsEnabled` in shell.tsx.
   * Defaults to false during the AI Front Desk pilot (BCC-PIVOT-MASTER-PLAN.md v3 Phase 6).
   */
  campaignsEnabled?: boolean;
}

export interface NavConfigOptions {
  t: (key: string, params?: any) => string;
  packName: string;
  packLabels: { customer?: string; booking?: string; service?: string };
  business?: BusinessNavContext;
}

export function getNavItems(opts: NavConfigOptions): NavItem[] {
  const { t, packLabels, business } = opts;
  const campaignsEnabled = business?.campaignsEnabled === true;

  // Order matches the section ordering in mode-config.ts (workspace → tools → insights → aiAgents).
  // Primary order per BCC-PIVOT-MASTER-PLAN.md v3 Phase 6:
  //   Inbox, AI Front Desk, Calendar, Waitlist, Customers, Bookings
  const items: NavItem[] = [
    {
      href: '/inbox',
      label: t('nav.inbox'),
      icon: MessageSquare,
      roles: ['ADMIN', 'AGENT', 'SERVICE_PROVIDER'],
    },
    { href: '/ai', label: t('nav.ai'), icon: Sparkles, roles: ['ADMIN'] },
    {
      href: '/calendar',
      label: t('nav.calendar'),
      icon: Calendar,
      roles: ['ADMIN', 'AGENT', 'SERVICE_PROVIDER'],
    },
    { href: '/waitlist', label: t('nav.waitlist'), icon: ListChecks, roles: ['ADMIN', 'AGENT'] },
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
    // Secondary/overflow per BCC-PIVOT-MASTER-PLAN.md v3 Phase 6:
    //   Campaigns (gated), Marketing, Invoices, Reports, Performance, Automations
    ...(campaignsEnabled
      ? [
          {
            href: '/campaigns',
            label: t('nav.campaigns'),
            icon: Megaphone,
            roles: ['ADMIN'],
          } as NavItem,
        ]
      : []),
    { href: '/marketing', label: t('nav.marketing'), icon: Target, roles: ['ADMIN'] },
    { href: '/invoices', label: t('nav.invoices'), icon: Receipt, roles: ['ADMIN'] },
    {
      href: '/dashboard',
      label: t('nav.dashboard'),
      icon: LayoutDashboard,
      roles: ['ADMIN', 'AGENT', 'SERVICE_PROVIDER'],
    },
    { href: '/reports', label: t('nav.reports'), icon: BarChart3, roles: ['ADMIN', 'AGENT'] },
    { href: '/roi', label: t('nav.roi'), icon: TrendingUp, roles: ['ADMIN'] },
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
  return items;
}
