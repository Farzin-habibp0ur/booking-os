'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Phone,
  Send,
  Save,
  AlertTriangle,
  CheckCircle,
  ClipboardList,
  Info,
  Loader2,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/cn';

interface Location {
  id: string;
  name: string;
  smsConfig?: {
    phoneNumber?: string;
    enabled?: boolean;
  } | null;
}

interface SmsSettings {
  twilioAccountSid: string;
  twilioAuthToken: string;
  defaultFromNumber: string;
}

export default function SmsSettingsPage() {
  const { t } = useI18n();

  // Account config state
  const [accountSid, setAccountSid] = useState('');
  const [authToken, setAuthToken] = useState('');
  const [fromNumber, setFromNumber] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle');

  // Location state
  const [locations, setLocations] = useState<Location[]>([]);
  const [loadingLocations, setLoadingLocations] = useState(true);
  const [locationSaveStatus, setLocationSaveStatus] = useState<Record<string, 'idle' | 'saved' | 'error'>>({});

  // Test send state
  const [testPhone, setTestPhone] = useState('');
  const [testMessage, setTestMessage] = useState('');
  const [testSending, setTestSending] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  // Generate the webhook URL
  const statusCallbackUrl =
    typeof window !== 'undefined'
      ? `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1'}/webhook/sms/inbound`
      : '';

  useEffect(() => {
    // Fetch business SMS settings
    api
      .get<any>('/business')
      .then((biz) => {
        const channelSettings = biz.channelSettings || {};
        const sms = channelSettings.sms || {};
        setAccountSid(sms.twilioAccountSid || '');
        setAuthToken(sms.twilioAuthToken || '');
        setFromNumber(sms.defaultFromNumber || '');
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

  const handleSaveAccount = async () => {
    setSaving(true);
    setSaveStatus('idle');
    try {
      await api.patch('/business', {
        channelSettings: {
          sms: {
            twilioAccountSid: accountSid,
            twilioAuthToken: authToken,
            defaultFromNumber: fromNumber,
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

  const handleSaveLocation = async (locationId: string, phoneNumber: string, enabled: boolean) => {
    setLocationSaveStatus((prev) => ({ ...prev, [locationId]: 'idle' }));
    try {
      await api.patch(`/locations/${locationId}`, {
        smsConfig: { phoneNumber, enabled },
      });
      setLocationSaveStatus((prev) => ({ ...prev, [locationId]: 'saved' }));
      setTimeout(() => {
        setLocationSaveStatus((prev) => ({ ...prev, [locationId]: 'idle' }));
      }, 3000);
    } catch {
      setLocationSaveStatus((prev) => ({ ...prev, [locationId]: 'error' }));
    }
  };

  const handleTestSend = async () => {
    setTestSending(true);
    setTestResult(null);
    try {
      await api.post('/messaging/test-sms', {
        to: testPhone,
        message: testMessage,
      });
      setTestResult({ ok: true, message: t('sms.test_success') });
    } catch (err: any) {
      setTestResult({ ok: false, message: err.message || t('sms.test_failed') });
    } finally {
      setTestSending(false);
    }
  };

  const maskValue = (value: string) => {
    if (value.length <= 4) return value;
    return '*'.repeat(value.length - 4) + value.slice(-4);
  };

  return (
    <div className="p-6 max-w-3xl">
      <Link
        href="/settings"
        className="inline-flex items-center gap-1 text-sm text-sage-600 hover:text-sage-700 dark:text-sage-400 dark:hover:text-sage-300 mb-3 transition-colors"
      >
        <ArrowLeft size={14} />
        Back to Settings
      </Link>

      <div className="flex items-center gap-2 mb-2">
        <Phone size={24} className="text-sage-600" />
        <h1 className="text-2xl font-serif font-semibold text-slate-900 dark:text-white">
          {t('sms.title')}
        </h1>
      </div>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">{t('sms.description')}</p>

      {/* Section 1: Account Configuration */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-soft p-6 mb-6" data-testid="account-config-section">
        <h2 className="font-semibold text-slate-900 dark:text-white mb-4">
          {t('sms.account_config')}
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t('sms.account_sid')}
            </label>
            <input
              type="text"
              value={accountSid}
              onChange={(e) => setAccountSid(e.target.value)}
              placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-700 focus:ring-2 focus:ring-sage-500 focus:border-transparent outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t('sms.auth_token')}
            </label>
            <input
              type="password"
              value={authToken}
              onChange={(e) => setAuthToken(e.target.value)}
              placeholder="Your Twilio Auth Token"
              className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-700 focus:ring-2 focus:ring-sage-500 focus:border-transparent outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t('sms.from_number')}
            </label>
            <input
              type="text"
              value={fromNumber}
              onChange={(e) => setFromNumber(e.target.value)}
              placeholder="+1234567890"
              className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-700 focus:ring-2 focus:ring-sage-500 focus:border-transparent outline-none"
            />
            <p className="text-xs text-slate-400 mt-1">{t('sms.from_number_hint')}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t('sms.status_callback_url')}
            </label>
            <input
              type="text"
              value={statusCallbackUrl}
              readOnly
              className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 cursor-not-allowed"
            />
            <p className="text-xs text-slate-400 mt-1">{t('sms.status_callback_hint')}</p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSaveAccount}
              disabled={saving}
              className="inline-flex items-center gap-2 bg-sage-600 text-white px-4 py-2 rounded-xl text-sm hover:bg-sage-700 transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {t('sms.save')}
            </button>
            {saveStatus === 'saved' && (
              <span className="inline-flex items-center gap-1 text-sage-600 text-sm">
                <CheckCircle size={14} />
                {t('sms.saved')}
              </span>
            )}
            {saveStatus === 'error' && (
              <span className="inline-flex items-center gap-1 text-red-600 text-sm">
                <AlertTriangle size={14} />
                {t('sms.save_failed')}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* A2P 10DLC Compliance Card */}
      <div
        className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-5 mb-6"
        data-testid="a2p-compliance-card"
      >
        <div className="flex items-start gap-3">
          <ClipboardList size={20} className="text-amber-600 mt-0.5 shrink-0" />
          <div>
            <h3 className="font-semibold text-amber-900 dark:text-amber-200 text-sm">
              {t('sms.a2p_title')}{' '}
              <span className="font-normal text-amber-700 dark:text-amber-400">
                ({t('sms.a2p_required')})
              </span>
            </h3>
            <p className="text-sm text-amber-800 dark:text-amber-300 mt-2 mb-2">
              To send business SMS in the US, you must register with The Campaign Registry (TCR):
            </p>
            <ol className="text-sm text-amber-800 dark:text-amber-300 space-y-1 list-decimal list-inside">
              <li>{t('sms.a2p_step1')}</li>
              <li>{t('sms.a2p_step2')}</li>
              <li>{t('sms.a2p_step3')}</li>
              <li>{t('sms.a2p_step4')}</li>
            </ol>
            <p className="text-sm text-amber-700 dark:text-amber-400 mt-3 flex items-start gap-1.5">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              {t('sms.a2p_warning')}
            </p>
          </div>
        </div>
      </div>

      {/* Section 2: Per-Location SMS Config */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-soft p-6 mb-6" data-testid="location-config-section">
        <h2 className="font-semibold text-slate-900 dark:text-white mb-4">
          {t('sms.location_config')}
        </h2>

        {loadingLocations ? (
          <div className="flex items-center gap-2 text-slate-400 text-sm py-4">
            <Loader2 size={16} className="animate-spin" />
            Loading locations...
          </div>
        ) : locations.length === 0 ? (
          <div className="text-sm text-slate-500 dark:text-slate-400 py-4 flex items-center gap-2">
            <Info size={16} />
            {t('sms.no_locations')}
          </div>
        ) : (
          <div className="space-y-4">
            {locations.map((location) => (
              <LocationSmsRow
                key={location.id}
                location={location}
                saveStatus={locationSaveStatus[location.id] || 'idle'}
                onSave={handleSaveLocation}
              />
            ))}
          </div>
        )}
      </div>

      {/* Section 3: Test Send */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-soft p-6" data-testid="test-send-section">
        <h2 className="font-semibold text-slate-900 dark:text-white mb-4">{t('sms.test_send')}</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t('sms.test_phone')}
            </label>
            <input
              type="tel"
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
              placeholder="+1234567890"
              className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-700 focus:ring-2 focus:ring-sage-500 focus:border-transparent outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t('sms.test_message')}
            </label>
            <textarea
              value={testMessage}
              onChange={(e) => setTestMessage(e.target.value)}
              placeholder="Hello, this is a test message from BookingOS!"
              rows={3}
              className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-700 focus:ring-2 focus:ring-sage-500 focus:border-transparent outline-none resize-none"
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleTestSend}
              disabled={testSending || !testPhone || !testMessage}
              className="inline-flex items-center gap-2 bg-sage-600 text-white px-4 py-2 rounded-xl text-sm hover:bg-sage-700 transition-colors disabled:opacity-50"
            >
              {testSending ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Send size={14} />
              )}
              {t('sms.test_send_button')}
            </button>

            {testResult && (
              <span
                className={cn(
                  'inline-flex items-center gap-1 text-sm',
                  testResult.ok ? 'text-sage-600' : 'text-red-600',
                )}
              >
                {testResult.ok ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}
                {testResult.message}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function LocationSmsRow({
  location,
  saveStatus,
  onSave,
}: {
  location: Location;
  saveStatus: 'idle' | 'saved' | 'error';
  onSave: (locationId: string, phoneNumber: string, enabled: boolean) => void;
}) {
  const { t } = useI18n();
  const [phoneNumber, setPhoneNumber] = useState(location.smsConfig?.phoneNumber || '');
  const [enabled, setEnabled] = useState(location.smsConfig?.enabled || false);

  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-slate-900 dark:text-white">{location.name}</h3>
        <label className="inline-flex items-center gap-2 cursor-pointer">
          <span className="text-xs text-slate-500">{t('sms.location_enabled')}</span>
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

      <div className="flex items-end gap-3">
        <div className="flex-1">
          <label className="block text-xs text-slate-500 mb-1">{t('sms.location_phone')}</label>
          <input
            type="tel"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            placeholder="+1234567890"
            className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-700 focus:ring-2 focus:ring-sage-500 focus:border-transparent outline-none"
          />
        </div>
        <button
          onClick={() => onSave(location.id, phoneNumber, enabled)}
          className="inline-flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 px-3 py-2 rounded-xl text-sm transition-colors"
        >
          <Save size={14} />
          {t('sms.save')}
        </button>
      </div>

      {saveStatus === 'saved' && (
        <p className="text-xs text-sage-600 mt-2 flex items-center gap-1">
          <CheckCircle size={12} />
          {t('sms.location_saved')}
        </p>
      )}
      {saveStatus === 'error' && (
        <p className="text-xs text-red-600 mt-2 flex items-center gap-1">
          <AlertTriangle size={12} />
          {t('sms.location_save_failed')}
        </p>
      )}
    </div>
  );
}
