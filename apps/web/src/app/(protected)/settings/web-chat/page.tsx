'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Globe,
  Save,
  AlertTriangle,
  CheckCircle,
  Info,
  Loader2,
  Copy,
  Check,
  MessageCircle,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/cn';

interface Location {
  id: string;
  name: string;
  webChatConfig?: {
    enabled?: boolean;
    greeting?: string;
  } | null;
}

interface WebChatConfig {
  primaryColor: string;
  title: string;
  subtitle: string;
  placeholder: string;
  position: string;
  preChatFields: string[];
  offlineMessage: string;
  showOfflineForm: boolean;
}

const DEFAULT_CONFIG: WebChatConfig = {
  primaryColor: '#71907C',
  title: 'Chat with us',
  subtitle: 'We typically reply within minutes',
  placeholder: 'Type a message...',
  position: 'bottom-right',
  preChatFields: ['name', 'email'],
  offlineMessage: 'We are currently offline. Leave us a message!',
  showOfflineForm: true,
};

export default function WebChatSettingsPage() {
  const { t } = useI18n();

  // Config state
  const [config, setConfig] = useState<WebChatConfig>(DEFAULT_CONFIG);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle');
  const [loading, setLoading] = useState(true);
  const [businessId, setBusinessId] = useState('');

  // Copy snippet state
  const [copied, setCopied] = useState(false);

  // Location state
  const [locations, setLocations] = useState<Location[]>([]);
  const [loadingLocations, setLoadingLocations] = useState(true);
  const [locationSaveStatus, setLocationSaveStatus] = useState<
    Record<string, 'idle' | 'saved' | 'error'>
  >({});

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

  useEffect(() => {
    // Fetch web chat config
    api
      .get<any>('/messaging/web-chat/config')
      .then((data) => {
        setConfig({
          primaryColor: data.primaryColor || DEFAULT_CONFIG.primaryColor,
          title: data.title || DEFAULT_CONFIG.title,
          subtitle: data.subtitle || DEFAULT_CONFIG.subtitle,
          placeholder: data.placeholder || DEFAULT_CONFIG.placeholder,
          position: data.position || DEFAULT_CONFIG.position,
          preChatFields: data.preChatFields || DEFAULT_CONFIG.preChatFields,
          offlineMessage: data.offlineMessage || DEFAULT_CONFIG.offlineMessage,
          showOfflineForm: data.showOfflineForm !== false,
        });
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });

    // Fetch business ID
    api
      .get<any>('/business')
      .then((biz) => {
        setBusinessId(biz.id || '');
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

  const handleSave = async () => {
    setSaving(true);
    setSaveStatus('idle');
    try {
      await api.put('/messaging/web-chat/config', config);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch {
      setSaveStatus('error');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveLocation = async (locationId: string, enabled: boolean, greeting: string) => {
    setLocationSaveStatus((prev) => ({ ...prev, [locationId]: 'idle' }));
    try {
      await api.patch(`/locations/${locationId}`, {
        webChatConfig: { enabled, greeting },
      });
      setLocationSaveStatus((prev) => ({ ...prev, [locationId]: 'saved' }));
      setTimeout(() => {
        setLocationSaveStatus((prev) => ({ ...prev, [locationId]: 'idle' }));
      }, 3000);
    } catch {
      setLocationSaveStatus((prev) => ({ ...prev, [locationId]: 'error' }));
    }
  };

  const togglePreChatField = (field: string) => {
    setConfig((prev) => {
      const fields = prev.preChatFields.includes(field)
        ? prev.preChatFields.filter((f) => f !== field)
        : [...prev.preChatFields, field];
      return { ...prev, preChatFields: fields };
    });
  };

  const embedSnippet = `<!-- BookingOS Chat Widget -->
<script src="${apiUrl}/chat-widget/booking-os-chat.js"></script>
<script>
  BookingOSChat.init({
    businessId: '${businessId}',
    apiUrl: '${apiUrl}',
    primaryColor: '${config.primaryColor}',
    title: '${config.title}',
    subtitle: '${config.subtitle}',
    position: '${config.position}',
  });
</script>`;

  const handleCopySnippet = async () => {
    try {
      await navigator.clipboard.writeText(embedSnippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = embedSnippet;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loading) {
    return (
      <div className="p-6 max-w-3xl">
        <div className="flex items-center gap-2 text-slate-400 text-sm py-8">
          <Loader2 size={16} className="animate-spin" />
          Loading...
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl">
      <Link
        href="/settings"
        className="inline-flex items-center gap-1 text-sm text-sage-600 hover:text-sage-700 dark:text-sage-400 dark:hover:text-sage-300 mb-3 transition-colors"
      >
        <ArrowLeft size={14} />
        {t('webChat.back_to_settings')}
      </Link>

      <div className="flex items-center gap-2 mb-2">
        <Globe size={24} className="text-lavender-600" />
        <h1 className="text-2xl font-serif font-semibold text-slate-900 dark:text-white">
          {t('webChat.title')}
        </h1>
      </div>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">{t('webChat.description')}</p>

      {/* Section 1: Appearance */}
      <div
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-soft p-6 mb-6"
        data-testid="appearance-section"
      >
        <h2 className="font-semibold text-slate-900 dark:text-white mb-4">
          {t('webChat.appearance')}
        </h2>

        <div className="space-y-4">
          {/* Primary Color */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t('webChat.primary_color')}
            </label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={config.primaryColor}
                onChange={(e) => setConfig((prev) => ({ ...prev, primaryColor: e.target.value }))}
                className="w-10 h-10 rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer"
                data-testid="color-picker"
              />
              <input
                type="text"
                value={config.primaryColor}
                onChange={(e) => setConfig((prev) => ({ ...prev, primaryColor: e.target.value }))}
                placeholder="#71907C"
                className="w-32 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-700 focus:ring-2 focus:ring-sage-500 focus:border-transparent outline-none"
                data-testid="color-input"
              />
              <div
                className="w-10 h-10 rounded-lg border border-slate-200 dark:border-slate-700"
                style={{ backgroundColor: config.primaryColor }}
                data-testid="color-swatch"
              />
            </div>
          </div>

          {/* Widget Title */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t('webChat.widget_title')}
            </label>
            <input
              type="text"
              value={config.title}
              onChange={(e) => setConfig((prev) => ({ ...prev, title: e.target.value }))}
              placeholder="Chat with us"
              className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-700 focus:ring-2 focus:ring-sage-500 focus:border-transparent outline-none"
              data-testid="widget-title-input"
            />
          </div>

          {/* Widget Subtitle */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t('webChat.widget_subtitle')}
            </label>
            <input
              type="text"
              value={config.subtitle}
              onChange={(e) => setConfig((prev) => ({ ...prev, subtitle: e.target.value }))}
              placeholder="We typically reply within minutes"
              className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-700 focus:ring-2 focus:ring-sage-500 focus:border-transparent outline-none"
              data-testid="widget-subtitle-input"
            />
          </div>

          {/* Message Placeholder */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t('webChat.placeholder')}
            </label>
            <input
              type="text"
              value={config.placeholder}
              onChange={(e) => setConfig((prev) => ({ ...prev, placeholder: e.target.value }))}
              placeholder="Type a message..."
              className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-700 focus:ring-2 focus:ring-sage-500 focus:border-transparent outline-none"
              data-testid="placeholder-input"
            />
          </div>

          {/* Position */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              {t('webChat.position')}
            </label>
            <div className="flex items-center gap-4">
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="position"
                  value="bottom-right"
                  checked={config.position === 'bottom-right'}
                  onChange={() => setConfig((prev) => ({ ...prev, position: 'bottom-right' }))}
                  className="text-sage-600 focus:ring-sage-500"
                  data-testid="position-right"
                />
                <span className="text-sm text-slate-700 dark:text-slate-300">
                  {t('webChat.position_right')}
                </span>
              </label>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="position"
                  value="bottom-left"
                  checked={config.position === 'bottom-left'}
                  onChange={() => setConfig((prev) => ({ ...prev, position: 'bottom-left' }))}
                  className="text-sage-600 focus:ring-sage-500"
                  data-testid="position-left"
                />
                <span className="text-sm text-slate-700 dark:text-slate-300">
                  {t('webChat.position_left')}
                </span>
              </label>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              data-testid="save-appearance-button"
              className="inline-flex items-center gap-2 bg-sage-600 text-white px-4 py-2 rounded-xl text-sm hover:bg-sage-700 transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {t('webChat.save')}
            </button>
            {saveStatus === 'saved' && (
              <span className="inline-flex items-center gap-1 text-sage-600 text-sm">
                <CheckCircle size={14} />
                {t('webChat.saved')}
              </span>
            )}
            {saveStatus === 'error' && (
              <span className="inline-flex items-center gap-1 text-red-600 text-sm">
                <AlertTriangle size={14} />
                {t('webChat.save_failed')}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Section 2: Pre-Chat Form */}
      <div
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-soft p-6 mb-6"
        data-testid="prechat-form-section"
      >
        <h2 className="font-semibold text-slate-900 dark:text-white mb-4">
          {t('webChat.prechat_form')}
        </h2>

        <div className="space-y-3">
          {/* Name — always required */}
          <div className="flex items-center justify-between border border-slate-200 dark:border-slate-700 rounded-xl p-3">
            <span className="text-sm text-slate-700 dark:text-slate-300">
              {t('webChat.prechat_name')}
            </span>
            <button
              role="switch"
              aria-checked={true}
              disabled
              className="relative inline-flex h-5 w-9 shrink-0 rounded-full bg-sage-600 cursor-not-allowed opacity-60"
            >
              <span className="inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform duration-200 mt-0.5 translate-x-4 ml-0.5" />
            </button>
          </div>

          {/* Email toggle */}
          <div className="flex items-center justify-between border border-slate-200 dark:border-slate-700 rounded-xl p-3">
            <span className="text-sm text-slate-700 dark:text-slate-300">
              {t('webChat.prechat_email')}
            </span>
            <button
              role="switch"
              aria-checked={config.preChatFields.includes('email')}
              onClick={() => togglePreChatField('email')}
              data-testid="toggle-email"
              className={cn(
                'relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors duration-200',
                config.preChatFields.includes('email')
                  ? 'bg-sage-600'
                  : 'bg-slate-300 dark:bg-slate-600',
              )}
            >
              <span
                className={cn(
                  'inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform duration-200 mt-0.5',
                  config.preChatFields.includes('email')
                    ? 'translate-x-4 ml-0.5'
                    : 'translate-x-0 ml-0.5',
                )}
              />
            </button>
          </div>

          {/* Phone toggle */}
          <div className="flex items-center justify-between border border-slate-200 dark:border-slate-700 rounded-xl p-3">
            <span className="text-sm text-slate-700 dark:text-slate-300">
              {t('webChat.prechat_phone')}
            </span>
            <button
              role="switch"
              aria-checked={config.preChatFields.includes('phone')}
              onClick={() => togglePreChatField('phone')}
              data-testid="toggle-phone"
              className={cn(
                'relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors duration-200',
                config.preChatFields.includes('phone')
                  ? 'bg-sage-600'
                  : 'bg-slate-300 dark:bg-slate-600',
              )}
            >
              <span
                className={cn(
                  'inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform duration-200 mt-0.5',
                  config.preChatFields.includes('phone')
                    ? 'translate-x-4 ml-0.5'
                    : 'translate-x-0 ml-0.5',
                )}
              />
            </button>
          </div>
        </div>

        {/* Pre-chat form preview */}
        <div className="mt-4 border border-slate-200 dark:border-slate-700 rounded-xl p-4 bg-slate-50 dark:bg-slate-800">
          <p className="text-xs text-slate-400 mb-3 uppercase tracking-wider font-medium">
            Preview
          </p>
          <div className="space-y-2">
            <div className="bg-white dark:bg-slate-700 rounded-lg px-3 py-2 text-sm text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-600">
              Name *
            </div>
            {config.preChatFields.includes('email') && (
              <div className="bg-white dark:bg-slate-700 rounded-lg px-3 py-2 text-sm text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-600">
                Email
              </div>
            )}
            {config.preChatFields.includes('phone') && (
              <div className="bg-white dark:bg-slate-700 rounded-lg px-3 py-2 text-sm text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-600">
                Phone
              </div>
            )}
            <button
              disabled
              className="w-full text-white text-sm py-2 rounded-lg"
              style={{ backgroundColor: config.primaryColor }}
            >
              Start Chat
            </button>
          </div>
        </div>
      </div>

      {/* Section 3: Offline Behavior */}
      <div
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-soft p-6 mb-6"
        data-testid="offline-section"
      >
        <h2 className="font-semibold text-slate-900 dark:text-white mb-4">
          {t('webChat.offline')}
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t('webChat.offline_message')}
            </label>
            <textarea
              value={config.offlineMessage}
              onChange={(e) => setConfig((prev) => ({ ...prev, offlineMessage: e.target.value }))}
              placeholder="We are currently offline. Leave us a message!"
              rows={3}
              className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-700 focus:ring-2 focus:ring-sage-500 focus:border-transparent outline-none resize-none"
              data-testid="offline-message-input"
            />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-700 dark:text-slate-300">
              {t('webChat.show_offline_form')}
            </span>
            <button
              role="switch"
              aria-checked={config.showOfflineForm}
              onClick={() =>
                setConfig((prev) => ({ ...prev, showOfflineForm: !prev.showOfflineForm }))
              }
              data-testid="toggle-offline-form"
              className={cn(
                'relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors duration-200',
                config.showOfflineForm ? 'bg-sage-600' : 'bg-slate-300 dark:bg-slate-600',
              )}
            >
              <span
                className={cn(
                  'inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform duration-200 mt-0.5',
                  config.showOfflineForm ? 'translate-x-4 ml-0.5' : 'translate-x-0 ml-0.5',
                )}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Section 4: Embed Snippet */}
      <div
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-soft p-6 mb-6"
        data-testid="embed-snippet-section"
      >
        <h2 className="font-semibold text-slate-900 dark:text-white mb-1">
          {t('webChat.embed_snippet')}
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">{t('webChat.embed_hint')}</p>

        <div className="relative">
          <pre className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 text-xs text-slate-700 dark:text-slate-300 overflow-x-auto whitespace-pre-wrap break-all">
            <code data-testid="embed-code">{embedSnippet}</code>
          </pre>
          <button
            onClick={handleCopySnippet}
            data-testid="copy-snippet-button"
            className="absolute top-3 right-3 inline-flex items-center gap-1.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600 px-3 py-1.5 rounded-lg text-xs transition-colors"
          >
            {copied ? (
              <>
                <Check size={12} className="text-sage-600" />
                {t('webChat.copied')}
              </>
            ) : (
              <>
                <Copy size={12} />
                {t('webChat.copy_snippet')}
              </>
            )}
          </button>
        </div>
      </div>

      {/* Section 5: Per-Location Config */}
      <div
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-soft p-6 mb-6"
        data-testid="location-config-section"
      >
        <h2 className="font-semibold text-slate-900 dark:text-white mb-4">
          {t('webChat.location_config')}
        </h2>

        {loadingLocations ? (
          <div className="flex items-center gap-2 text-slate-400 text-sm py-4">
            <Loader2 size={16} className="animate-spin" />
            {t('webChat.loading_locations')}
          </div>
        ) : locations.length === 0 ? (
          <div
            className="text-sm text-slate-500 dark:text-slate-400 py-4 flex items-center gap-2"
            data-testid="no-locations"
          >
            <Info size={16} />
            {t('webChat.no_locations')}
          </div>
        ) : (
          <div className="space-y-4">
            {locations.map((location) => (
              <LocationWebChatRow
                key={location.id}
                location={location}
                saveStatus={locationSaveStatus[location.id] || 'idle'}
                onSave={handleSaveLocation}
              />
            ))}
          </div>
        )}
      </div>

      {/* How It Works Info Card */}
      <div
        className="bg-lavender-50 dark:bg-lavender-900/20 border border-lavender-200 dark:border-lavender-800 rounded-2xl p-5"
        data-testid="how-it-works-card"
      >
        <div className="flex items-start gap-3">
          <MessageCircle size={20} className="text-lavender-600 mt-0.5 shrink-0" />
          <div>
            <h3 className="font-semibold text-lavender-900 dark:text-lavender-200 text-sm">
              {t('webChat.how_it_works')}
            </h3>
            <ol className="text-sm text-lavender-800 dark:text-lavender-300 space-y-1 list-decimal list-inside mt-2">
              <li>{t('webChat.step1')}</li>
              <li>{t('webChat.step2')}</li>
              <li>{t('webChat.step3')}</li>
              <li>{t('webChat.step4')}</li>
              <li>{t('webChat.step5')}</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}

function LocationWebChatRow({
  location,
  saveStatus,
  onSave,
}: {
  location: Location;
  saveStatus: 'idle' | 'saved' | 'error';
  onSave: (locationId: string, enabled: boolean, greeting: string) => void;
}) {
  const { t } = useI18n();
  const [enabled, setEnabled] = useState(location.webChatConfig?.enabled || false);
  const [greeting, setGreeting] = useState(location.webChatConfig?.greeting || '');

  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-slate-900 dark:text-white">{location.name}</h3>
        <label className="inline-flex items-center gap-2 cursor-pointer">
          <span className="text-xs text-slate-500">{t('webChat.location_enabled')}</span>
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
            {t('webChat.location_greeting')}
          </label>
          <input
            type="text"
            value={greeting}
            onChange={(e) => setGreeting(e.target.value)}
            placeholder="Welcome! How can we help you today?"
            className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-700 focus:ring-2 focus:ring-sage-500 focus:border-transparent outline-none"
          />
        </div>
        <button
          onClick={() => onSave(location.id, enabled, greeting)}
          className="inline-flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 px-3 py-2 rounded-xl text-sm transition-colors"
        >
          <Save size={14} />
          {t('webChat.save')}
        </button>
      </div>

      {saveStatus === 'saved' && (
        <p className="text-xs text-sage-600 mt-2 flex items-center gap-1">
          <CheckCircle size={12} />
          {t('webChat.location_saved')}
        </p>
      )}
      {saveStatus === 'error' && (
        <p className="text-xs text-red-600 mt-2 flex items-center gap-1">
          <AlertTriangle size={12} />
          {t('webChat.location_save_failed')}
        </p>
      )}
    </div>
  );
}
