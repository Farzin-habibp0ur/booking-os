import {
  User,
  ShieldCheck,
  Calendar,
  FileText,
  Scale,
  Bell,
  Languages,
  Sparkles,
  Gauge,
  Bot,
  ClipboardList,
  Gift,
  CreditCard,
  Palette,
  Puzzle,
} from 'lucide-react';

export interface SettingsCategory {
  key: string;
  label: string;
  description: string;
  icon: any;
  /** Accent colour ring for the icon circle */
  accent: 'sage' | 'lavender' | 'amber' | 'slate';
  /** Sub-page slugs (under /settings/) */
  pages: string[];
  /** Roles that can see this category */
  roles: string[];
}

export const SETTINGS_CATEGORIES: SettingsCategory[] = [
  {
    key: 'account',
    label: 'Account & Import',
    description: 'Import customers via CSV, export data, and manage profile fields',
    icon: ShieldCheck,
    accent: 'sage',
    pages: ['account', 'profile-fields', 'audit-log'],
    roles: ['ADMIN', 'AGENT', 'SERVICE_PROVIDER'],
  },
  {
    key: 'operations',
    label: 'Operations',
    description: 'Calendar rules, message templates, and booking policies',
    icon: Calendar,
    accent: 'sage',
    pages: ['calendar', 'templates', 'policies'],
    roles: ['ADMIN'],
  },
  {
    key: 'communication',
    label: 'Communication',
    description: 'Notification preferences and language translations',
    icon: Bell,
    accent: 'sage',
    pages: ['notifications', 'translations'],
    roles: ['ADMIN'],
  },
  {
    key: 'ai',
    label: 'AI & Automation',
    description: 'AI assistant, autonomy levels, and background agents',
    icon: Sparkles,
    accent: 'lavender',
    pages: ['ai', 'autonomy', 'agents'],
    roles: ['ADMIN'],
  },
  {
    key: 'growth',
    label: 'Growth',
    description: 'Waitlist settings and promotional offers',
    icon: Gift,
    accent: 'lavender',
    pages: ['waitlist', 'offers'],
    roles: ['ADMIN'],
  },
  {
    key: 'integrations',
    label: 'Integrations',
    description: 'Connect calendars, payments, and messaging services',
    icon: Puzzle,
    accent: 'sage',
    pages: ['integrations'],
    roles: ['ADMIN'],
  },
  {
    key: 'billing',
    label: 'Billing',
    description: 'Subscription plan, payment method, and invoices',
    icon: CreditCard,
    accent: 'amber',
    pages: ['billing'],
    roles: ['ADMIN'],
  },
  {
    key: 'appearance',
    label: 'Appearance & Branding',
    description: 'Theme, branding, colors, and display preferences',
    icon: Palette,
    accent: 'slate',
    pages: ['branding'],
    roles: ['ADMIN', 'AGENT', 'SERVICE_PROVIDER'],
  },
];

export function getSettingsCategoriesForRole(role: string): SettingsCategory[] {
  return SETTINGS_CATEGORIES.filter((c) => c.roles.includes(role));
}

export function getFirstPageForCategory(cat: SettingsCategory): string {
  if (cat.pages.length === 0) return '/settings';
  return `/settings/${cat.pages[0]}`;
}
