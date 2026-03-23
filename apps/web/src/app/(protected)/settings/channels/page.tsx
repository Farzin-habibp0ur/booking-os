'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Radio,
  MessageSquare,
  Instagram,
  Facebook,
  Phone,
  Mail,
  Globe,
  Loader2,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/cn';
import { CHANNEL_STYLES } from '@/lib/design-tokens';

interface Location {
  id: string;
  name: string;
  smsConfig?: { phoneNumber?: string; enabled?: boolean } | null;
  facebookConfig?: { pageId?: string; enabled?: boolean } | null;
  emailConfig?: { inboundAddress?: string; enabled?: boolean } | null;
  webChatConfig?: { enabled?: boolean } | null;
  whatsappConfig?: { phoneNumberId?: string } | null;
  instagramConfig?: { pageId?: string } | null;
}

interface ChannelInfo {
  key: string;
  channel: string;
  label: string;
  icon: any;
  settingsPath: string;
  hint?: string;
  isConnected: (locations: Location[], channelSettings: any) => boolean;
}

const CHANNELS: ChannelInfo[] = [
  {
    key: 'whatsapp',
    channel: 'WHATSAPP',
    label: 'WhatsApp',
    icon: MessageSquare,
    settingsPath: '/settings/integrations',
    hint: 'whatsapp_hint',
    isConnected: (locations, cs) =>
      locations.some((l) => l.whatsappConfig?.phoneNumberId) || !!cs?.whatsapp?.enabled,
  },
  {
    key: 'instagram',
    channel: 'INSTAGRAM',
    label: 'Instagram',
    icon: Instagram,
    settingsPath: '/settings/integrations',
    hint: 'instagram_hint',
    isConnected: (locations, cs) =>
      locations.some((l) => l.instagramConfig?.pageId) || !!cs?.instagram?.enabled,
  },
  {
    key: 'facebook',
    channel: 'FACEBOOK',
    label: 'Messenger',
    icon: Facebook,
    settingsPath: '/settings/facebook',
    isConnected: (locations) =>
      locations.some((l) => l.facebookConfig?.pageId && l.facebookConfig?.enabled),
  },
  {
    key: 'sms',
    channel: 'SMS',
    label: 'SMS',
    icon: Phone,
    settingsPath: '/settings/sms',
    isConnected: (locations, cs) =>
      locations.some((l) => l.smsConfig?.phoneNumber && l.smsConfig?.enabled) ||
      !!cs?.sms?.twilioAccountSid,
  },
  {
    key: 'email',
    channel: 'EMAIL',
    label: 'Email',
    icon: Mail,
    settingsPath: '/settings/email-channel',
    isConnected: (locations) =>
      locations.some((l) => l.emailConfig?.inboundAddress && l.emailConfig?.enabled),
  },
  {
    key: 'webchat',
    channel: 'WEB_CHAT',
    label: 'Web Chat',
    icon: Globe,
    settingsPath: '/settings/web-chat',
    isConnected: (locations) => locations.some((l) => l.webChatConfig?.enabled),
  },
];

export default function ChannelsSettingsPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [locations, setLocations] = useState<Location[]>([]);
  const [channelSettings, setChannelSettings] = useState<any>(null);
  const [messageCounts, setMessageCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    Promise.all([
      api.get<any>('/business').then((biz) => {
        setChannelSettings(biz.channelSettings || {});
      }),
      api.get<Location[]>('/locations').then(setLocations),
    ])
      .catch(() => {})
      .finally(() => setLoading(false));

    // Fetch 7-day message counts per channel
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const today = new Date().toISOString().slice(0, 10);
    api
      .get<any>(`/admin/usage/current?startDate=${sevenDaysAgo}&endDate=${today}`)
      .then((usage) => {
        if (usage?.channels) {
          const counts: Record<string, number> = {};
          for (const ch of usage.channels) {
            counts[ch.channel] = (counts[ch.channel] || 0) + (ch.inbound || 0) + (ch.outbound || 0);
          }
          setMessageCounts(counts);
        }
      })
      .catch(() => {});
  }, []);

  return (
    <div className="p-6 max-w-4xl">
      <Link
        href="/settings"
        className="inline-flex items-center gap-1 text-sm text-sage-600 hover:text-sage-700 dark:text-sage-400 dark:hover:text-sage-300 mb-3 transition-colors"
      >
        <ArrowLeft size={14} />
        Back to Settings
      </Link>

      <div className="flex items-center gap-2 mb-2">
        <Radio size={24} className="text-sage-600" />
        <h1
          className="text-2xl font-serif font-semibold text-slate-900 dark:text-white"
          data-testid="channels-title"
        >
          {t('channels.title')}
        </h1>
      </div>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">{t('channels.description')}</p>

      {loading ? (
        <div className="flex items-center gap-2 text-slate-400 text-sm py-8">
          <Loader2 size={16} className="animate-spin" />
          Loading channels...
        </div>
      ) : (
        <div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
          data-testid="channels-grid"
        >
          {CHANNELS.map((ch) => {
            const connected = ch.isConnected(locations, channelSettings);
            const style = CHANNEL_STYLES[ch.channel];
            const Icon = ch.icon;
            const count = messageCounts[ch.channel] || 0;

            return (
              <button
                key={ch.key}
                onClick={() => router.push(ch.settingsPath)}
                data-testid={`channel-card-${ch.key}`}
                className={cn(
                  'flex flex-col items-start p-5 bg-white dark:bg-slate-900 rounded-2xl shadow-soft',
                  'hover:shadow-soft-lg transition-shadow duration-200 btn-press text-left',
                  'border-l-4',
                  connected
                    ? style?.border || 'border-slate-300'
                    : 'border-slate-200 dark:border-slate-700',
                )}
              >
                <div className="flex items-center gap-3 mb-3 w-full">
                  <div
                    className={cn(
                      'w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
                      style?.bg || 'bg-slate-100',
                      style?.text || 'text-slate-600',
                    )}
                  >
                    <Icon size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                      {ch.label}
                    </h3>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 mb-2">
                  {connected ? (
                    <>
                      <CheckCircle size={14} className="text-sage-600" />
                      <span className="text-xs font-medium text-sage-700 dark:text-sage-400">
                        {t('channels.connected')}
                      </span>
                    </>
                  ) : (
                    <>
                      <XCircle size={14} className="text-slate-400" />
                      <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                        {t('channels.not_configured')}
                      </span>
                    </>
                  )}
                </div>

                {count > 0 && (
                  <p className="text-xs text-slate-400 mb-2">
                    {t('channels.messages_7d', { count })}
                  </p>
                )}

                {ch.hint && (
                  <p className="text-xs text-slate-400 italic">{t(`channels.${ch.hint}`)}</p>
                )}

                <span className="text-xs font-medium text-sage-600 dark:text-sage-400 mt-auto pt-2">
                  {t('channels.configure')} &rarr;
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
