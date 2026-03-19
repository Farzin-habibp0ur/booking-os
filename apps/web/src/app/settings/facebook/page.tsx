'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Facebook,
  Save,
  AlertTriangle,
  CheckCircle,
  Info,
  Loader2,
  Plus,
  Trash2,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/cn';

interface Location {
  id: string;
  name: string;
  facebookConfig?: {
    pageId?: string;
    pageAccessToken?: string;
    enabled?: boolean;
  } | null;
}

interface IceBreaker {
  question: string;
  payload: string;
}

export default function FacebookSettingsPage() {
  const { t } = useI18n();

  // Page connection state
  const [pageId, setPageId] = useState('');
  const [pageAccessToken, setPageAccessToken] = useState('');
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<
    'idle' | 'connected' | 'failed'
  >('idle');
  const [connectedPageName, setConnectedPageName] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle');

  // Location state
  const [locations, setLocations] = useState<Location[]>([]);
  const [loadingLocations, setLoadingLocations] = useState(true);
  const [locationSaveStatus, setLocationSaveStatus] = useState<
    Record<string, 'idle' | 'saved' | 'error'>
  >({});

  // Ice breakers state
  const [iceBreakers, setIceBreakers] = useState<IceBreaker[]>([]);
  const [savingIceBreakers, setSavingIceBreakers] = useState(false);
  const [iceBreakersStatus, setIceBreakersStatus] = useState<
    'idle' | 'saved' | 'error'
  >('idle');

  useEffect(() => {
    // Fetch business Facebook settings
    api
      .get<any>('/business')
      .then((biz) => {
        const channelSettings = biz.channelSettings || {};
        const fb = channelSettings.facebook || {};
        setPageId(fb.pageId || '');
        setPageAccessToken(fb.pageAccessToken || '');
        if (fb.iceBreakers) {
          setIceBreakers(fb.iceBreakers);
        }
      })
      .catch(() => {});

    // Fetch locations
    api
      .get<Location[]>('/locations')
      .then((locs) => {
        setLocations(locs);
        setLoadingLocations(false);
      })
      .catch(() => {
        setLoadingLocations(false);
      });
  }, []);

  const handleTestConnection = async () => {
    if (!pageId || !pageAccessToken) return;
    setTestingConnection(true);
    setConnectionStatus('idle');
    try {
      const result = await api.get<{ id: string; name: string }>(
        `/messaging/facebook/page-info?pageId=${encodeURIComponent(pageId)}&accessToken=${encodeURIComponent(pageAccessToken)}`,
      );
      setConnectionStatus('connected');
      setConnectedPageName(result.name || result.id);
    } catch {
      setConnectionStatus('failed');
      setConnectedPageName('');
    } finally {
      setTestingConnection(false);
    }
  };

  const handleSaveAccount = async () => {
    setSaving(true);
    setSaveStatus('idle');
    try {
      await api.patch('/business', {
        channelSettings: {
          facebook: {
            pageId,
            pageAccessToken,
            iceBreakers,
          },
        },
      });
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch {
      setSaveStatus('error');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveLocation = async (
    locationId: string,
    locPageId: string,
    locAccessToken: string,
    enabled: boolean,
  ) => {
    setLocationSaveStatus((prev) => ({ ...prev, [locationId]: 'idle' }));
    try {
      await api.patch(`/locations/${locationId}`, {
        facebookConfig: { pageId: locPageId, pageAccessToken: locAccessToken, enabled },
      });
      setLocationSaveStatus((prev) => ({ ...prev, [locationId]: 'saved' }));
      setTimeout(() => {
        setLocationSaveStatus((prev) => ({ ...prev, [locationId]: 'idle' }));
      }, 3000);
    } catch {
      setLocationSaveStatus((prev) => ({ ...prev, [locationId]: 'error' }));
    }
  };

  const handleAddIceBreaker = () => {
    if (iceBreakers.length >= 4) return;
    setIceBreakers([...iceBreakers, { question: '', payload: '' }]);
  };

  const handleRemoveIceBreaker = (index: number) => {
    setIceBreakers(iceBreakers.filter((_, i) => i !== index));
  };

  const handleIceBreakerChange = (
    index: number,
    field: 'question' | 'payload',
    value: string,
  ) => {
    const updated = [...iceBreakers];
    updated[index] = { ...updated[index], [field]: value };
    setIceBreakers(updated);
  };

  const handleSaveIceBreakers = async () => {
    if (!pageId) return;
    setSavingIceBreakers(true);
    setIceBreakersStatus('idle');
    try {
      await api.post('/messaging/facebook/ice-breakers', {
        pageId,
        prompts: iceBreakers.filter((ib) => ib.question.trim()),
      });
      setIceBreakersStatus('saved');
      setTimeout(() => setIceBreakersStatus('idle'), 3000);
    } catch {
      setIceBreakersStatus('error');
    } finally {
      setSavingIceBreakers(false);
    }
  };

  return (
    <div className="p-6 max-w-3xl">
      <Link
        href="/settings"
        className="inline-flex items-center gap-1 text-sm text-sage-600 hover:text-sage-700 dark:text-sage-400 dark:hover:text-sage-300 mb-3 transition-colors"
      >
        <ArrowLeft size={14} />
        {t('facebook.back_to_settings')}
      </Link>

      <div className="flex items-center gap-2 mb-2">
        <Facebook size={24} className="text-blue-600" />
        <h1 className="text-2xl font-serif font-semibold text-slate-900 dark:text-white">
          {t('facebook.title')}
        </h1>
      </div>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
        {t('facebook.description')}
      </p>

      {/* Section 1: Page Connection */}
      <div
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-soft p-6 mb-6"
        data-testid="page-connection-section"
      >
        <h2 className="font-semibold text-slate-900 dark:text-white mb-4">
          {t('facebook.page_connection')}
        </h2>

        {/* Setup guidance */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 mb-4">
          <div className="flex items-start gap-3">
            <Info size={18} className="text-blue-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm text-blue-800 dark:text-blue-300 mb-2">
                {t('facebook.setup_intro')}
              </p>
              <ol className="text-sm text-blue-800 dark:text-blue-300 space-y-1 list-decimal list-inside">
                <li>{t('facebook.setup_step1')}</li>
                <li>{t('facebook.setup_step2')}</li>
                <li>{t('facebook.setup_step3')}</li>
              </ol>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t('facebook.page_id')}
            </label>
            <input
              type="text"
              value={pageId}
              onChange={(e) => setPageId(e.target.value)}
              placeholder="123456789012345"
              data-testid="page-id-input"
              className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-700 focus:ring-2 focus:ring-sage-500 focus:border-transparent outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t('facebook.page_access_token')}
            </label>
            <input
              type="password"
              value={pageAccessToken}
              onChange={(e) => setPageAccessToken(e.target.value)}
              placeholder="Your Page Access Token"
              data-testid="page-access-token-input"
              className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-700 focus:ring-2 focus:ring-sage-500 focus:border-transparent outline-none"
            />
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={handleTestConnection}
              disabled={testingConnection || !pageId || !pageAccessToken}
              data-testid="test-connection-button"
              className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl text-sm hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {testingConnection ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Wifi size={14} />
              )}
              {t('facebook.test_connection')}
            </button>

            <button
              onClick={handleSaveAccount}
              disabled={saving}
              className="inline-flex items-center gap-2 bg-sage-600 text-white px-4 py-2 rounded-xl text-sm hover:bg-sage-700 transition-colors disabled:opacity-50"
            >
              {saving ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Save size={14} />
              )}
              {t('facebook.save')}
            </button>

            {connectionStatus === 'connected' && (
              <span
                className="inline-flex items-center gap-1 text-sage-600 text-sm"
                data-testid="connection-status-connected"
              >
                <CheckCircle size={14} />
                {t('facebook.connection_success')} — {connectedPageName}
              </span>
            )}
            {connectionStatus === 'failed' && (
              <span
                className="inline-flex items-center gap-1 text-red-600 text-sm"
                data-testid="connection-status-failed"
              >
                <WifiOff size={14} />
                {t('facebook.connection_failed')}
              </span>
            )}
            {saveStatus === 'saved' && (
              <span className="inline-flex items-center gap-1 text-sage-600 text-sm">
                <CheckCircle size={14} />
                {t('facebook.saved')}
              </span>
            )}
            {saveStatus === 'error' && (
              <span className="inline-flex items-center gap-1 text-red-600 text-sm">
                <AlertTriangle size={14} />
                {t('facebook.save_failed')}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Messaging Window Info Card */}
      <div
        className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-5 mb-6"
        data-testid="messaging-window-card"
      >
        <div className="flex items-start gap-3">
          <Info size={20} className="text-blue-600 mt-0.5 shrink-0" />
          <div>
            <h3 className="font-semibold text-blue-900 dark:text-blue-200 text-sm">
              {t('facebook.messaging_window_title')}
            </h3>
            <p className="text-sm text-blue-800 dark:text-blue-300 mt-2">
              {t('facebook.messaging_window_info')}
            </p>
          </div>
        </div>
      </div>

      {/* Section 2: Per-Location Config */}
      <div
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-soft p-6 mb-6"
        data-testid="location-config-section"
      >
        <h2 className="font-semibold text-slate-900 dark:text-white mb-4">
          {t('facebook.location_config')}
        </h2>

        {loadingLocations ? (
          <div className="flex items-center gap-2 text-slate-400 text-sm py-4">
            <Loader2 size={16} className="animate-spin" />
            {t('facebook.loading_locations')}
          </div>
        ) : locations.length === 0 ? (
          <div
            className="text-sm text-slate-500 dark:text-slate-400 py-4 flex items-center gap-2"
            data-testid="no-locations"
          >
            <Info size={16} />
            {t('facebook.no_locations')}
          </div>
        ) : (
          <div className="space-y-4">
            {locations.map((location) => (
              <LocationFacebookRow
                key={location.id}
                location={location}
                saveStatus={locationSaveStatus[location.id] || 'idle'}
                onSave={handleSaveLocation}
              />
            ))}
          </div>
        )}
      </div>

      {/* Section 3: Ice Breakers */}
      <div
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-soft p-6"
        data-testid="ice-breakers-section"
      >
        <h2 className="font-semibold text-slate-900 dark:text-white mb-1">
          {t('facebook.ice_breakers')}
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
          {t('facebook.ice_breakers_hint')}
        </p>

        <div className="space-y-3">
          {iceBreakers.map((ib, index) => (
            <div
              key={index}
              className="border border-slate-200 dark:border-slate-700 rounded-xl p-3"
            >
              <div className="flex items-start gap-3">
                <div className="flex-1 space-y-2">
                  <input
                    type="text"
                    value={ib.question}
                    onChange={(e) =>
                      handleIceBreakerChange(index, 'question', e.target.value)
                    }
                    placeholder={t('facebook.ice_breaker_question')}
                    data-testid={`ice-breaker-question-${index}`}
                    className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-700 focus:ring-2 focus:ring-sage-500 focus:border-transparent outline-none"
                  />
                  <input
                    type="text"
                    value={ib.payload}
                    onChange={(e) =>
                      handleIceBreakerChange(index, 'payload', e.target.value)
                    }
                    placeholder={t('facebook.ice_breaker_payload')}
                    data-testid={`ice-breaker-payload-${index}`}
                    className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-700 focus:ring-2 focus:ring-sage-500 focus:border-transparent outline-none"
                  />
                </div>
                <button
                  onClick={() => handleRemoveIceBreaker(index)}
                  data-testid={`remove-ice-breaker-${index}`}
                  className="text-slate-400 hover:text-red-600 p-1 mt-1 transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-3 mt-4">
          <button
            onClick={handleAddIceBreaker}
            disabled={iceBreakers.length >= 4}
            data-testid="add-ice-breaker-button"
            className="inline-flex items-center gap-1.5 text-sm text-sage-600 hover:text-sage-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Plus size={14} />
            {t('facebook.add_ice_breaker')}
          </button>
          {iceBreakers.length >= 4 && (
            <span className="text-xs text-slate-400">
              {t('facebook.max_ice_breakers')}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 mt-4">
          <button
            onClick={handleSaveIceBreakers}
            disabled={savingIceBreakers || !pageId}
            data-testid="save-ice-breakers-button"
            className="inline-flex items-center gap-2 bg-sage-600 text-white px-4 py-2 rounded-xl text-sm hover:bg-sage-700 transition-colors disabled:opacity-50"
          >
            {savingIceBreakers ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Save size={14} />
            )}
            {t('facebook.save')}
          </button>
          {iceBreakersStatus === 'saved' && (
            <span className="inline-flex items-center gap-1 text-sage-600 text-sm">
              <CheckCircle size={14} />
              {t('facebook.ice_breakers_saved')}
            </span>
          )}
          {iceBreakersStatus === 'error' && (
            <span className="inline-flex items-center gap-1 text-red-600 text-sm">
              <AlertTriangle size={14} />
              {t('facebook.ice_breakers_save_failed')}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function LocationFacebookRow({
  location,
  saveStatus,
  onSave,
}: {
  location: Location;
  saveStatus: 'idle' | 'saved' | 'error';
  onSave: (
    locationId: string,
    pageId: string,
    accessToken: string,
    enabled: boolean,
  ) => void;
}) {
  const { t } = useI18n();
  const [locPageId, setLocPageId] = useState(
    location.facebookConfig?.pageId || '',
  );
  const [locAccessToken, setLocAccessToken] = useState(
    location.facebookConfig?.pageAccessToken || '',
  );
  const [enabled, setEnabled] = useState(
    location.facebookConfig?.enabled || false,
  );

  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-slate-900 dark:text-white">
          {location.name}
        </h3>
        <label className="inline-flex items-center gap-2 cursor-pointer">
          <span className="text-xs text-slate-500">
            {t('facebook.location_enabled')}
          </span>
          <button
            role="switch"
            aria-checked={enabled}
            onClick={() => setEnabled(!enabled)}
            className={cn(
              'relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors duration-200',
              enabled ? 'bg-sage-600' : 'bg-slate-300 dark:bg-slate-600',
            )}
          >
            <span
              className={cn(
                'inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform duration-200 mt-0.5',
                enabled ? 'translate-x-4 ml-0.5' : 'translate-x-0 ml-0.5',
              )}
            />
          </button>
        </label>
      </div>

      <div className="space-y-3">
        <div>
          <label className="block text-xs text-slate-500 mb-1">
            {t('facebook.location_page_id')}
          </label>
          <input
            type="text"
            value={locPageId}
            onChange={(e) => setLocPageId(e.target.value)}
            placeholder="123456789012345"
            className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-700 focus:ring-2 focus:ring-sage-500 focus:border-transparent outline-none"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">
            {t('facebook.location_access_token')}
          </label>
          <input
            type="password"
            value={locAccessToken}
            onChange={(e) => setLocAccessToken(e.target.value)}
            placeholder="Page Access Token"
            className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-700 focus:ring-2 focus:ring-sage-500 focus:border-transparent outline-none"
          />
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => onSave(location.id, locPageId, locAccessToken, enabled)}
            className="inline-flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 px-3 py-2 rounded-xl text-sm transition-colors"
          >
            <Save size={14} />
            {t('facebook.save')}
          </button>
        </div>
      </div>

      {saveStatus === 'saved' && (
        <p className="text-xs text-sage-600 mt-2 flex items-center gap-1">
          <CheckCircle size={12} />
          {t('facebook.location_saved')}
        </p>
      )}
      {saveStatus === 'error' && (
        <p className="text-xs text-red-600 mt-2 flex items-center gap-1">
          <AlertTriangle size={12} />
          {t('facebook.location_save_failed')}
        </p>
      )}
    </div>
  );
}
