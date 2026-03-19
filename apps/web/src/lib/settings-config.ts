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
  Phone,
  Facebook,
  Mail,
  Globe,
  Radio,
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
    label: 'Calendar & Templates',
    description: 'Calendar sync, message templates, and booking policies',
    icon: Calendar,
    accent: 'sage',
    pages: ['calendar', 'templates', 'policies'],
    roles: ['ADMIN'],
  },
  {
    key: 'communication',
    label: 'Notifications',
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
    label: 'Waitlist & Offers',
    description: 'Waitlist settings and promotional offers',
    icon: Gift,
    accent: 'lavender',
    pages: ['waitlist', 'offers'],
    roles: ['ADMIN'],
  },
  {
    key: 'channels',
    label: 'Messaging Channels',
    description: 'Manage all messaging channels across your locations',
    icon: Radio,
    accent: 'sage',
    pages: ['channels'],
    roles: ['ADMIN'],
  },
  {
    key: 'sms',
    label: 'SMS',
    description: 'Configure Twilio SMS for two-way messaging',
    icon: Phone,
    accent: 'sage',
    pages: ['sms'],
    roles: ['ADMIN'],
  },
  {
    key: 'facebook',
    label: 'Facebook Messenger',
    description: 'Connect Facebook Pages for Messenger conversations',
    icon: Facebook,
    accent: 'lavender',
    pages: ['facebook'],
    roles: ['ADMIN'],
  },
  {
    key: 'email-channel',
    label: 'Email Channel',
    description: 'Send and receive conversational emails in your inbox',
    icon: Mail,
    accent: 'sage',
    pages: ['email-channel'],
    roles: ['ADMIN'],
  },
  {
    key: 'web-chat',
    label: 'Live Chat',
    description: 'Add a chat widget to your website for real-time conversations',
    icon: Globe,
    accent: 'lavender',
    pages: ['web-chat'],
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
    label: 'Branding',
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
