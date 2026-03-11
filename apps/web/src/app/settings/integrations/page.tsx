'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import {
  Puzzle,
  Calendar,
  CreditCard,
  MessageSquare,
  Mail,
  BarChart3,
  Zap,
  BookOpen,
  Video,
  ExternalLink,
  Settings,
  Check,
  ArrowLeft,
} from 'lucide-react';

interface CalendarConnection {
  id: string;
  provider: string;
  syncEnabled: boolean;
  lastSyncedAt: string | null;
  lastSyncError: string | null;
}

interface BusinessData {
  id: string;
  subscription?: {
    stripeCustomerId?: string;
  };
  notificationSettings?: {
    whatsappEnabled?: boolean;
  };
}

type IntegrationStatus = 'connected' | 'not_connected' | 'configured' | 'coming_soon';

interface Integration {
  id: string;
  name: string;
  description: string;
  icon: any;
  status: IntegrationStatus;
  actionLabel: string;
  actionHref: string;
}

const STATUS_CONFIG: Record<
  IntegrationStatus,
  { bg: string; text: string; dot?: string; label: string }
> = {
  connected: {
    bg: 'bg-sage-50',
    text: 'text-sage-700',
    dot: 'bg-sage-500',
    label: 'Connected',
  },
  not_connected: {
    bg: 'bg-slate-100',
    text: 'text-slate-500',
    label: 'Not Connected',
  },
  configured: {
    bg: 'bg-sage-50',
    text: 'text-sage-700',
    label: 'Configured',
  },
  coming_soon: {
    bg: 'bg-lavender-50',
    text: 'text-lavender-700',
    label: 'Coming Soon',
  },
};

export default function IntegrationsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [calendarConnections, setCalendarConnections] = useState<CalendarConnection[]>([]);
  const [business, setBusiness] = useState<BusinessData | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const [connections, biz] = await Promise.all([
          api.get<CalendarConnection[]>('/calendar-sync/connections').catch(() => []),
          api.get<BusinessData>('/business').catch(() => null),
        ]);
        setCalendarConnections(connections);
        setBusiness(biz);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const isCalendarConnected = (provider: string) =>
    calendarConnections.some((c) => c.provider === provider);

  const hasStripe = !!business?.subscription?.stripeCustomerId;
  const hasWhatsApp = !!business?.notificationSettings?.whatsappEnabled;

  const integrations: Integration[] = [
    {
      id: 'google-calendar',
      name: 'Google Calendar',
      description: 'Two-way sync with Google Calendar events',
      icon: Calendar,
      status: isCalendarConnected('google') ? 'connected' : 'not_connected',
      actionLabel: isCalendarConnected('google') ? 'Settings' : 'Connect',
      actionHref: '/settings/calendar',
    },
    {
      id: 'outlook',
      name: 'Microsoft Outlook',
      description: 'Sync appointments with Outlook Calendar',
      icon: Calendar,
      status: isCalendarConnected('outlook') ? 'connected' : 'not_connected',
      actionLabel: isCalendarConnected('outlook') ? 'Settings' : 'Connect',
      actionHref: '/settings/calendar',
    },
    {
      id: 'stripe',
      name: 'Stripe',
      description: 'Payment processing and subscriptions',
      icon: CreditCard,
      status: hasStripe ? 'connected' : 'not_connected',
      actionLabel: hasStripe ? 'Settings' : 'Connect',
      actionHref: '/settings/billing',
    },
    {
      id: 'whatsapp',
      name: 'WhatsApp Business',
      description: 'Send and receive WhatsApp messages',
      icon: MessageSquare,
      status: hasWhatsApp ? 'connected' : 'not_connected',
      actionLabel: hasWhatsApp ? 'Settings' : 'Connect',
      actionHref: '/settings/notifications',
    },
    {
      id: 'email',
      name: 'Email (Resend/SendGrid)',
      description: 'Transactional and marketing emails',
      icon: Mail,
      status: 'configured',
      actionLabel: 'Settings',
      actionHref: '/settings/notifications',
    },
    {
      id: 'google-analytics',
      name: 'Google Analytics',
      description: 'Track website and portal analytics',
      icon: BarChart3,
      status: 'coming_soon',
      actionLabel: '',
      actionHref: '',
    },
    {
      id: 'zapier',
      name: 'Zapier',
      description: 'Connect to 5,000+ apps',
      icon: Zap,
      status: 'coming_soon',
      actionLabel: '',
      actionHref: '',
    },
    {
      id: 'quickbooks',
      name: 'QuickBooks',
      description: 'Accounting and invoicing',
      icon: BookOpen,
      status: 'coming_soon',
      actionLabel: '',
      actionHref: '',
    },
    {
      id: 'zoom',
      name: 'Zoom',
      description: 'Virtual consultations and meetings',
      icon: Video,
      status: 'coming_soon',
      actionLabel: '',
      actionHref: '',
    },
  ];

  if (loading) {
    return (
      <div className="p-6">
        <p className="text-slate-400">Loading...</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl">
      <Link
        href="/settings"
        className="inline-flex items-center gap-1 text-sm text-sage-600 hover:text-sage-700 dark:text-sage-400 dark:hover:text-sage-300 mb-3 transition-colors"
      >
        <ArrowLeft size={14} />
        Back to Settings
      </Link>

      <div className="flex items-center gap-2 mb-6">
        <Puzzle size={24} className="text-sage-600" />
        <div>
          <h1 className="text-2xl font-serif font-semibold text-slate-900">Integrations</h1>
          <p className="text-sm text-slate-500 mt-0.5">Connect your tools and services</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {integrations.map((integration) => {
          const statusCfg = STATUS_CONFIG[integration.status];
          const isComingSoon = integration.status === 'coming_soon';
          const Icon = integration.icon;

          return (
            <div
              key={integration.id}
              className={cn(
                'rounded-2xl border border-slate-200 p-6 transition-all',
                isComingSoon ? 'opacity-60' : 'hover:border-sage-200 hover:shadow-sm',
              )}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center">
                    <Icon size={20} className="text-slate-600" />
                  </div>
                  <div>
                    <p className="font-medium text-slate-900">{integration.name}</p>
                    <span
                      className={cn(
                        'inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full mt-1',
                        statusCfg.bg,
                        statusCfg.text,
                      )}
                    >
                      {statusCfg.dot && (
                        <span className={cn('w-1.5 h-1.5 rounded-full', statusCfg.dot)} />
                      )}
                      {statusCfg.label}
                    </span>
                  </div>
                </div>
              </div>

              <p className="text-sm text-slate-500 mb-4">{integration.description}</p>

              {!isComingSoon && (
                <Link
                  href={integration.actionHref}
                  className={cn(
                    'inline-flex items-center gap-1.5 text-sm px-4 py-2 rounded-xl transition-colors',
                    integration.status === 'not_connected'
                      ? 'bg-sage-600 text-white hover:bg-sage-700'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200',
                  )}
                >
                  {integration.status === 'not_connected' ? (
                    <ExternalLink size={14} />
                  ) : (
                    <Settings size={14} />
                  )}
                  {integration.actionLabel}
                </Link>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
