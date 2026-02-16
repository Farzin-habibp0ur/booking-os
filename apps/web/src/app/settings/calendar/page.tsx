'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { CalendarDays, RefreshCw, Copy, Check, ExternalLink } from 'lucide-react';

interface Connection {
  id: string;
  provider: string;
  syncEnabled: boolean;
  lastSyncedAt: string | null;
  lastSyncError: string | null;
}

interface Providers {
  google: boolean;
  outlook: boolean;
}

const PROVIDER_INFO: Record<string, { name: string; icon: string }> = {
  google: { name: 'Google Calendar', icon: '📅' },
  outlook: { name: 'Outlook Calendar', icon: '📆' },
};

export default function CalendarSyncPageWrapper() {
  return (
    <Suspense fallback={null}>
      <CalendarSyncPage />
    </Suspense>
  );
}

function CalendarSyncPage() {
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const [connections, setConnections] = useState<Connection[]>([]);
  const [providers, setProviders] = useState<Providers>({ google: false, outlook: false });
  const [icalUrl, setIcalUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [syncing, setSyncing] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const [conns, provs, feed] = await Promise.all([
        api.get<Connection[]>('/calendar-sync/connections'),
        api.get<Providers>('/calendar-sync/providers'),
        api.get<{ url: string | null }>('/calendar-sync/ical-feed-url'),
      ]);
      setConnections(conns);
      setProviders(provs);
      setIcalUrl(feed.url);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    const connected = searchParams.get('connected');
    if (connected) {
      setToast(
        t('calendar_sync.connected_success', {
          provider: PROVIDER_INFO[connected]?.name || connected,
        }),
      );
      setTimeout(() => setToast(null), 4000);
    }
  }, [searchParams, t]);

  const handleConnect = async (provider: string) => {
    try {
      const { url } = await api.post<{ url: string }>(`/calendar-sync/connect/${provider}`);
      window.location.href = url;
    } catch {
      setToast(t('calendar_sync.connect_failed'));
      setTimeout(() => setToast(null), 3000);
    }
  };

  const handleDisconnect = async (provider: string) => {
    try {
      await api.del(`/calendar-sync/connections/${provider}`);
      await fetchData();
      setToast(t('calendar_sync.disconnected'));
      setTimeout(() => setToast(null), 3000);
    } catch {
      // ignore
    }
  };

  const handleCopyIcal = () => {
    if (icalUrl) {
      navigator.clipboard.writeText(icalUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleRegenerateIcal = async () => {
    if (!confirm(t('calendar_sync.regenerate_confirm'))) return;
    setRegenerating(true);
    try {
      const { url } = await api.post<{ url: string }>('/calendar-sync/regenerate-ical-token');
      setIcalUrl(url);
      setToast(t('calendar_sync.regenerated'));
      setTimeout(() => setToast(null), 3000);
    } catch {
      // ignore
    } finally {
      setRegenerating(false);
    }
  };

  const handleSyncNow = async (provider: string) => {
    setSyncing(provider);
    try {
      const { count } = await api.post<{ count: number }>('/calendar-sync/manual-sync');
      setToast(`Synced ${count} external event${count !== 1 ? 's' : ''}`);
      setTimeout(() => setToast(null), 3000);
    } catch {
      setToast('Sync failed. Please try again.');
      setTimeout(() => setToast(null), 3000);
    } finally {
      setSyncing(null);
    }
  };

  const isConnected = (provider: string) => connections.some((c) => c.provider === provider);

  const getConnection = (provider: string) => connections.find((c) => c.provider === provider);

  if (loading) {
    return (
      <div className="p-6">
        <p className="text-slate-400">{t('common.loading')}</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl">
      <div className="flex items-center gap-2 mb-6">
        <CalendarDays size={24} className="text-sage-600" />
        <h1 className="text-2xl font-serif font-semibold text-slate-900">
          {t('calendar_sync.title')}
        </h1>
      </div>

      {toast && <div className="bg-sage-50 text-sage-900 p-3 rounded-xl text-sm mb-4">{toast}</div>}

      {/* Connected Calendars */}
      <div className="bg-white rounded-2xl shadow-soft p-6 space-y-4">
        <div>
          <h2 className="font-semibold">{t('calendar_sync.connected_calendars')}</h2>
          <p className="text-sm text-slate-500 mt-1">
            {t('calendar_sync.connected_calendars_desc')}
          </p>
        </div>

        <div className="space-y-3">
          {Object.entries(PROVIDER_INFO).map(([key, info]) => {
            const connected = isConnected(key);
            const connection = getConnection(key);
            const available = providers[key as keyof Providers];

            return (
              <div
                key={key}
                className="flex items-center justify-between p-4 border border-slate-100 rounded-xl"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{info.icon}</span>
                  <div>
                    <p className="text-sm font-medium">{info.name}</p>
                    {connected && connection?.lastSyncedAt && (
                      <p className="text-xs text-slate-500">
                        {t('calendar_sync.last_synced')}{' '}
                        {new Date(connection.lastSyncedAt).toLocaleString()}
                      </p>
                    )}
                    {connected && connection?.lastSyncError && (
                      <p className="text-xs text-red-500">{connection.lastSyncError}</p>
                    )}
                    {!available && !connected && (
                      <p className="text-xs text-slate-400">{t('calendar_sync.not_available')}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {connected ? (
                    <>
                      <button
                        onClick={() => handleSyncNow(key)}
                        disabled={syncing === key}
                        className="flex items-center gap-1 text-xs text-sage-600 hover:text-sage-700 px-2 py-1 transition-colors disabled:opacity-50"
                      >
                        <RefreshCw size={12} className={syncing === key ? 'animate-spin' : ''} />
                        {syncing === key ? 'Syncing...' : 'Sync Now'}
                      </button>
                      <span className="text-xs bg-sage-50 text-sage-900 px-2 py-1 rounded-lg">
                        {t('calendar_sync.status_connected')}
                      </span>
                      <button
                        onClick={() => handleDisconnect(key)}
                        className="text-xs text-red-500 hover:text-red-700 px-2 py-1"
                      >
                        {t('calendar_sync.disconnect')}
                      </button>
                    </>
                  ) : available ? (
                    <button
                      onClick={() => handleConnect(key)}
                      className="flex items-center gap-1 bg-sage-600 text-white px-3 py-1.5 rounded-xl text-sm hover:bg-sage-700 transition-colors"
                    >
                      <ExternalLink size={14} />
                      {t('calendar_sync.connect')}
                    </button>
                  ) : (
                    <span className="text-xs text-slate-400 px-2 py-1">
                      {t('calendar_sync.status_not_configured')}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* iCal Feed */}
      <div className="bg-white rounded-2xl shadow-soft p-6 mt-6 space-y-4">
        <div>
          <h2 className="font-semibold">{t('calendar_sync.ical_feed')}</h2>
          <p className="text-sm text-slate-500 mt-1">{t('calendar_sync.ical_feed_desc')}</p>
        </div>

        {icalUrl ? (
          <>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={icalUrl}
                className="flex-1 bg-slate-50 border-transparent rounded-xl px-3 py-2 text-sm text-slate-600"
              />
              <button
                onClick={handleCopyIcal}
                className="bg-sage-600 hover:bg-sage-700 text-white rounded-xl px-3 py-2 text-sm transition-colors flex items-center gap-1"
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? t('settings.copied') : t('settings.copy_link')}
              </button>
            </div>
            <button
              onClick={handleRegenerateIcal}
              disabled={regenerating}
              className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 transition-colors disabled:opacity-50"
            >
              <RefreshCw size={14} className={regenerating ? 'animate-spin' : ''} />
              {t('calendar_sync.regenerate_url')}
            </button>
          </>
        ) : (
          <p className="text-sm text-slate-400">{t('calendar_sync.ical_no_connection')}</p>
        )}
      </div>
    </div>
  );
}
