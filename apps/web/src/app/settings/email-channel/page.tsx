'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Mail,
  Save,
  AlertTriangle,
  CheckCircle,
  Info,
  Loader2,
  Send,
  Eye,
  Shield,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/cn';

interface Location {
  id: string;
  name: string;
  emailConfig?: {
    inboundAddress?: string;
    enabled?: boolean;
  } | null;
}

interface DnsCheck {
  type: string;
  status: string;
}

export default function EmailChannelSettingsPage() {
  const { t } = useI18n();

  // Provider config state
  const [provider, setProvider] = useState<'resend' | 'sendgrid'>('resend');
  const [apiKey, setApiKey] = useState('');
  const [fromAddress, setFromAddress] = useState('');
  const [fromName, setFromName] = useState('');
  const [replyTo, setReplyTo] = useState('');
  const [signature, setSignature] = useState('');
  const [showSignaturePreview, setShowSignaturePreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle');

  // Location state
  const [locations, setLocations] = useState<Location[]>([]);
  const [loadingLocations, setLoadingLocations] = useState(true);
  const [locationSaveStatus, setLocationSaveStatus] = useState<
    Record<string, 'idle' | 'saved' | 'error'>
  >({});

  // DNS check state
  const [dnsChecks, setDnsChecks] = useState<DnsCheck[]>([]);
  const [checkingDns, setCheckingDns] = useState(false);

  // Test send state
  const [testTo, setTestTo] = useState('');
  const [testSubject, setTestSubject] = useState('');
  const [testMessage, setTestMessage] = useState('');
  const [testSending, setTestSending] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    // Fetch business email settings
    api
      .get<any>('/business')
      .then((biz) => {
        const channelSettings = biz.channelSettings || {};
        const email = channelSettings.email || {};
        setProvider(email.provider || 'resend');
        setApiKey(email.apiKey || '');
        setFromAddress(email.fromAddress || '');
        setFromName(email.fromName || '');
        setReplyTo(email.replyToAddress || '');
        setSignature(email.signature || '');
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
          email: {
            provider,
            apiKey,
            fromAddress,
            fromName,
            replyToAddress: replyTo,
            signature,
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

  const handleSaveLocation = async (locationId: string, inboundAddress: string, enabled: boolean) => {
    setLocationSaveStatus((prev) => ({ ...prev, [locationId]: 'idle' }));
    try {
      await api.patch(`/locations/${locationId}`, {
        emailConfig: { inboundAddress, enabled },
      });
      setLocationSaveStatus((prev) => ({ ...prev, [locationId]: 'saved' }));
      setTimeout(() => {
        setLocationSaveStatus((prev) => ({ ...prev, [locationId]: 'idle' }));
      }, 3000);
    } catch {
      setLocationSaveStatus((prev) => ({ ...prev, [locationId]: 'error' }));
    }
  };

  const handleCheckDns = async () => {
    if (!fromAddress) return;
    const domain = fromAddress.split('@')[1];
    if (!domain) return;

    setCheckingDns(true);
    try {
      const result = await api.get<{ checks: DnsCheck[] }>(
        `/messaging/email/dns-check?domain=${encodeURIComponent(domain)}`,
      );
      setDnsChecks(result.checks || []);
    } catch {
      setDnsChecks([
        { type: 'MX', status: 'pending' },
        { type: 'SPF', status: 'pending' },
        { type: 'DKIM', status: 'pending' },
        { type: 'DMARC', status: 'pending' },
      ]);
    } finally {
      setCheckingDns(false);
    }
  };

  const handleTestSend = async () => {
    setTestSending(true);
    setTestResult(null);
    try {
      await api.post('/messaging/email/test', {
        to: testTo,
        subject: testSubject,
        message: testMessage,
      });
      setTestResult({ ok: true, message: t('emailChannel.test_success') });
    } catch (err: any) {
      setTestResult({ ok: false, message: err.message || t('emailChannel.test_failed') });
    } finally {
      setTestSending(false);
    }
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
        <Mail size={24} className="text-sky-600" />
        <h1 className="text-2xl font-serif font-semibold text-slate-900 dark:text-white">
          {t('emailChannel.title')}
        </h1>
      </div>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
        {t('emailChannel.description')}
      </p>

      {/* Section 1: Provider Configuration */}
      <div
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-soft p-6 mb-6"
        data-testid="provider-config-section"
      >
        <h2 className="font-semibold text-slate-900 dark:text-white mb-4">
          {t('emailChannel.provider_config')}
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t('emailChannel.provider')}
            </label>
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value as 'resend' | 'sendgrid')}
              data-testid="provider-select"
              className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-700 focus:ring-2 focus:ring-sage-500 focus:border-transparent outline-none"
            >
              <option value="resend">{t('emailChannel.provider_resend')}</option>
              <option value="sendgrid">{t('emailChannel.provider_sendgrid')}</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t('emailChannel.api_key')}
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Your API Key"
              data-testid="api-key-input"
              className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-700 focus:ring-2 focus:ring-sage-500 focus:border-transparent outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t('emailChannel.from_address')}
            </label>
            <input
              type="email"
              value={fromAddress}
              onChange={(e) => setFromAddress(e.target.value)}
              placeholder="support@yourdomain.com"
              data-testid="from-address-input"
              className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-700 focus:ring-2 focus:ring-sage-500 focus:border-transparent outline-none"
            />
            <p className="text-xs text-slate-400 mt-1">{t('emailChannel.from_address_hint')}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t('emailChannel.from_name')}
            </label>
            <input
              type="text"
              value={fromName}
              onChange={(e) => setFromName(e.target.value)}
              placeholder="Glow Aesthetic Clinic"
              data-testid="from-name-input"
              className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-700 focus:ring-2 focus:ring-sage-500 focus:border-transparent outline-none"
            />
            <p className="text-xs text-slate-400 mt-1">{t('emailChannel.from_name_hint')}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t('emailChannel.reply_to')}
            </label>
            <input
              type="email"
              value={replyTo}
              onChange={(e) => setReplyTo(e.target.value)}
              placeholder="reply@yourdomain.com"
              className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-700 focus:ring-2 focus:ring-sage-500 focus:border-transparent outline-none"
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSaveAccount}
              disabled={saving}
              data-testid="save-provider-button"
              className="inline-flex items-center gap-2 bg-sage-600 text-white px-4 py-2 rounded-xl text-sm hover:bg-sage-700 transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {t('emailChannel.save')}
            </button>
            {saveStatus === 'saved' && (
              <span className="inline-flex items-center gap-1 text-sage-600 text-sm">
                <CheckCircle size={14} />
                {t('emailChannel.saved')}
              </span>
            )}
            {saveStatus === 'error' && (
              <span className="inline-flex items-center gap-1 text-red-600 text-sm">
                <AlertTriangle size={14} />
                {t('emailChannel.save_failed')}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Section 2: Per-Location Email Config */}
      <div
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-soft p-6 mb-6"
        data-testid="location-config-section"
      >
        <h2 className="font-semibold text-slate-900 dark:text-white mb-4">
          {t('emailChannel.location_config')}
        </h2>

        {loadingLocations ? (
          <div className="flex items-center gap-2 text-slate-400 text-sm py-4">
            <Loader2 size={16} className="animate-spin" />
            Loading locations...
          </div>
        ) : locations.length === 0 ? (
          <div
            className="text-sm text-slate-500 dark:text-slate-400 py-4 flex items-center gap-2"
            data-testid="no-locations"
          >
            <Info size={16} />
            {t('emailChannel.no_locations')}
          </div>
        ) : (
          <div className="space-y-4">
            {locations.map((location) => (
              <LocationEmailRow
                key={location.id}
                location={location}
                saveStatus={locationSaveStatus[location.id] || 'idle'}
                onSave={handleSaveLocation}
              />
            ))}
          </div>
        )}
      </div>

      {/* Section 3: DNS Verification */}
      <div
        className="bg-sky-50 dark:bg-sky-900/20 border border-sky-200 dark:border-sky-800 rounded-2xl p-5 mb-6"
        data-testid="dns-config-section"
      >
        <div className="flex items-start gap-3">
          <Shield size={20} className="text-sky-600 mt-0.5 shrink-0" />
          <div className="flex-1">
            <h3 className="font-semibold text-sky-900 dark:text-sky-200 text-sm">
              {t('emailChannel.dns_config')}
            </h3>
            <p className="text-sm text-sky-800 dark:text-sky-300 mt-2 mb-2">
              To receive inbound emails, configure SendGrid Inbound Parse:
            </p>
            <ol className="text-sm text-sky-800 dark:text-sky-300 space-y-1 list-decimal list-inside">
              <li>{t('emailChannel.dns_step1')}</li>
              <li>{t('emailChannel.dns_step2')}</li>
              <li>{t('emailChannel.dns_step3')}</li>
              <li>{t('emailChannel.dns_step4')}</li>
            </ol>
            <p className="text-sm text-sky-700 dark:text-sky-400 mt-3 font-medium">
              {t('emailChannel.dns_sending')}
            </p>
            <ul className="text-sm text-sky-800 dark:text-sky-300 space-y-1 list-disc list-inside mt-1">
              <li>{t('emailChannel.dns_spf')}</li>
              <li>{t('emailChannel.dns_dkim')}</li>
              <li>{t('emailChannel.dns_dmarc')}</li>
            </ul>

            <div className="mt-4">
              <button
                onClick={handleCheckDns}
                disabled={checkingDns || !fromAddress}
                data-testid="dns-check-button"
                className="inline-flex items-center gap-2 bg-sky-600 text-white px-4 py-2 rounded-xl text-sm hover:bg-sky-700 transition-colors disabled:opacity-50"
              >
                {checkingDns ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Shield size={14} />
                )}
                {t('emailChannel.dns_check')}
              </button>
            </div>

            {dnsChecks.length > 0 && (
              <div className="mt-4 space-y-2">
                {dnsChecks.map((check) => (
                  <div
                    key={check.type}
                    className="flex items-center justify-between bg-white dark:bg-slate-800 rounded-xl px-4 py-2"
                    data-testid={`dns-check-${check.type.toLowerCase()}`}
                  >
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      {check.type}
                    </span>
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full',
                        check.status === 'verified'
                          ? 'bg-sage-100 text-sage-700'
                          : 'bg-amber-100 text-amber-700',
                      )}
                    >
                      {check.status === 'verified' ? (
                        <CheckCircle size={12} />
                      ) : (
                        <AlertTriangle size={12} />
                      )}
                      {check.status === 'verified'
                        ? t('emailChannel.dns_verified')
                        : t('emailChannel.dns_pending')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Email Signature Editor */}
      <div
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-soft p-6 mb-6"
        data-testid="signature-section"
      >
        <h2 className="font-semibold text-slate-900 dark:text-white mb-4">
          {t('emailChannel.signature')}
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t('emailChannel.signature_hint')}
            </label>
            <textarea
              value={signature}
              onChange={(e) => setSignature(e.target.value)}
              placeholder="<p>Best regards,<br/>Your Team</p>"
              rows={5}
              data-testid="signature-textarea"
              className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-700 focus:ring-2 focus:ring-sage-500 focus:border-transparent outline-none resize-none font-mono"
            />
          </div>

          <button
            onClick={() => setShowSignaturePreview(!showSignaturePreview)}
            data-testid="signature-preview-button"
            className="inline-flex items-center gap-1.5 text-sm text-sage-600 hover:text-sage-700 transition-colors"
          >
            <Eye size={14} />
            {t('emailChannel.signature_preview')}
          </button>

          {showSignaturePreview && signature && (
            <div
              className="border border-slate-200 dark:border-slate-700 rounded-xl p-4 bg-slate-50 dark:bg-slate-800"
              data-testid="signature-preview"
              dangerouslySetInnerHTML={{ __html: signature }}
            />
          )}
        </div>
      </div>

      {/* Test Send */}
      <div
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-soft p-6"
        data-testid="test-send-section"
      >
        <h2 className="font-semibold text-slate-900 dark:text-white mb-4">
          {t('emailChannel.test_send')}
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t('emailChannel.test_to')}
            </label>
            <input
              type="email"
              value={testTo}
              onChange={(e) => setTestTo(e.target.value)}
              placeholder="test@example.com"
              data-testid="test-to-input"
              className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-700 focus:ring-2 focus:ring-sage-500 focus:border-transparent outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t('emailChannel.test_subject')}
            </label>
            <input
              type="text"
              value={testSubject}
              onChange={(e) => setTestSubject(e.target.value)}
              placeholder="Test email from BookingOS"
              data-testid="test-subject-input"
              className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-700 focus:ring-2 focus:ring-sage-500 focus:border-transparent outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t('emailChannel.test_message')}
            </label>
            <textarea
              value={testMessage}
              onChange={(e) => setTestMessage(e.target.value)}
              placeholder="Hello, this is a test email from BookingOS!"
              rows={3}
              data-testid="test-message-input"
              className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-700 focus:ring-2 focus:ring-sage-500 focus:border-transparent outline-none resize-none"
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleTestSend}
              disabled={testSending || !testTo || !testSubject || !testMessage}
              data-testid="test-send-button"
              className="inline-flex items-center gap-2 bg-sage-600 text-white px-4 py-2 rounded-xl text-sm hover:bg-sage-700 transition-colors disabled:opacity-50"
            >
              {testSending ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Send size={14} />
              )}
              {t('emailChannel.test_send_button')}
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

function LocationEmailRow({
  location,
  saveStatus,
  onSave,
}: {
  location: Location;
  saveStatus: 'idle' | 'saved' | 'error';
  onSave: (locationId: string, inboundAddress: string, enabled: boolean) => void;
}) {
  const { t } = useI18n();
  const [inboundAddress, setInboundAddress] = useState(
    location.emailConfig?.inboundAddress || '',
  );
  const [enabled, setEnabled] = useState(location.emailConfig?.enabled || false);

  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-slate-900 dark:text-white">{location.name}</h3>
        <label className="inline-flex items-center gap-2 cursor-pointer">
          <span className="text-xs text-slate-500">{t('emailChannel.location_enabled')}</span>
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
          <label className="block text-xs text-slate-500 mb-1">
            {t('emailChannel.inbound_address')}
          </label>
          <input
            type="email"
            value={inboundAddress}
            onChange={(e) => setInboundAddress(e.target.value)}
            placeholder="inbox-location@yourdomain.com"
            className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-700 focus:ring-2 focus:ring-sage-500 focus:border-transparent outline-none"
          />
          <p className="text-xs text-slate-400 mt-1">{t('emailChannel.inbound_address_hint')}</p>
        </div>
        <button
          onClick={() => onSave(location.id, inboundAddress, enabled)}
          className="inline-flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 px-3 py-2 rounded-xl text-sm transition-colors"
        >
          <Save size={14} />
          {t('emailChannel.save')}
        </button>
      </div>

      {saveStatus === 'saved' && (
        <p className="text-xs text-sage-600 mt-2 flex items-center gap-1">
          <CheckCircle size={12} />
          {t('emailChannel.location_saved')}
        </p>
      )}
      {saveStatus === 'error' && (
        <p className="text-xs text-red-600 mt-2 flex items-center gap-1">
          <AlertTriangle size={12} />
          {t('emailChannel.location_save_failed')}
        </p>
      )}
    </div>
  );
}
