'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { Shield, Bell, Globe, Settings, AlertTriangle } from 'lucide-react';

interface SettingItem {
  key: string;
  value: unknown;
  isDefault: boolean;
}

interface GroupedSettings {
  security: SettingItem[];
  notifications: SettingItem[];
  regional: SettingItem[];
  platform: SettingItem[];
}

const TIMEZONE_OPTIONS = [
  'UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Asia/Tokyo', 'Asia/Shanghai',
  'Australia/Sydney', 'Pacific/Auckland',
];

const LOCALE_OPTIONS = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Spanish' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'pt', label: 'Portuguese' },
  { value: 'ar', label: 'Arabic' },
  { value: 'zh', label: 'Chinese' },
  { value: 'ja', label: 'Japanese' },
];

const CURRENCY_OPTIONS = [
  { value: 'USD', label: 'USD — US Dollar' },
  { value: 'EUR', label: 'EUR — Euro' },
  { value: 'GBP', label: 'GBP — British Pound' },
  { value: 'CAD', label: 'CAD — Canadian Dollar' },
  { value: 'AUD', label: 'AUD — Australian Dollar' },
  { value: 'JPY', label: 'JPY — Japanese Yen' },
];

export default function ConsoleSettingsPage() {
  const [settings, setSettings] = useState<GroupedSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [maintenanceConfirm, setMaintenanceConfirm] = useState(false);
  const [pendingMaintenance, setPendingMaintenance] = useState(false);

  // Track local edits per category
  const [localValues, setLocalValues] = useState<Record<string, unknown>>({});

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      const result = await api.get<GroupedSettings>('/admin/settings');
      setSettings(result);
      // Initialize local values from fetched settings
      const vals: Record<string, unknown> = {};
      for (const items of Object.values(result)) {
        for (const item of items) {
          vals[item.key] = item.value;
        }
      }
      setLocalValues(vals);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const updateLocal = (key: string, value: unknown) => {
    setLocalValues((prev) => ({ ...prev, [key]: value }));
  };

  const saveCategory = async (category: string) => {
    if (!settings) return;
    const categorySettings = settings[category as keyof GroupedSettings];
    if (!categorySettings) return;

    const updates = categorySettings
      .filter((s) => localValues[s.key] !== undefined)
      .map((s) => ({ key: s.key, value: localValues[s.key] }));

    if (updates.length === 0) return;

    try {
      setSaving(category);
      await api.put('/admin/settings/bulk', { settings: updates });
      setSuccessMessage(`${capitalize(category)} settings saved`);
      setTimeout(() => setSuccessMessage(null), 3000);
      await fetchSettings();
    } catch (err: any) {
      setError(err.message || 'Failed to save settings');
    } finally {
      setSaving(null);
    }
  };

  const handleMaintenanceToggle = () => {
    const current = localValues['platform.maintenanceMode'] as boolean;
    if (!current) {
      // Turning ON — show confirmation
      setPendingMaintenance(true);
      setMaintenanceConfirm(true);
    } else {
      // Turning OFF — no confirmation needed
      updateLocal('platform.maintenanceMode', false);
    }
  };

  const confirmMaintenance = () => {
    updateLocal('platform.maintenanceMode', true);
    setMaintenanceConfirm(false);
    setPendingMaintenance(false);
  };

  const cancelMaintenance = () => {
    setMaintenanceConfirm(false);
    setPendingMaintenance(false);
  };

  if (loading) {
    return (
      <div className="p-6 md:p-8 max-w-5xl" data-testid="settings-loading">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-slate-200 dark:bg-slate-800 rounded w-32" />
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-48 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  if (error && !settings) {
    return (
      <div className="p-6 md:p-8 max-w-5xl">
        <h1 className="text-2xl font-serif font-bold text-slate-900 dark:text-white mb-6">Settings</h1>
        <div className="bg-red-50 dark:bg-red-900/20 rounded-2xl p-6 text-red-700 dark:text-red-400" data-testid="settings-error">
          {error}
        </div>
      </div>
    );
  }

  if (!settings) return null;

  return (
    <div className="p-6 md:p-8 max-w-5xl">
      <h1 className="text-2xl font-serif font-bold text-slate-900 dark:text-white mb-6">Platform Settings</h1>

      {successMessage && (
        <div className="mb-4 bg-sage-50 dark:bg-sage-900/20 text-sage-700 dark:text-sage-400 px-4 py-3 rounded-xl text-sm" data-testid="success-toast">
          {successMessage}
        </div>
      )}

      {error && settings && (
        <div className="mb-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 px-4 py-3 rounded-xl text-sm" data-testid="inline-error">
          {error}
        </div>
      )}

      <div className="space-y-6">
        {/* Security Posture */}
        <section className="bg-white dark:bg-slate-900 rounded-2xl shadow-soft p-6" data-testid="section-security">
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2 bg-sage-50 dark:bg-sage-900/20 rounded-xl">
              <Shield className="text-sage-600" size={20} />
            </div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Security Posture</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <NumberField
              label="Session Timeout (minutes)"
              value={localValues['security.sessionTimeoutMins'] as number}
              onChange={(v) => updateLocal('security.sessionTimeoutMins', v)}
              min={5}
              max={1440}
              testId="input-sessionTimeout"
            />
            <ToggleField
              label="Require Email Verification"
              value={localValues['security.requireEmailVerification'] as boolean}
              onChange={(v) => updateLocal('security.requireEmailVerification', v)}
              testId="input-emailVerification"
            />
            <NumberField
              label="Max View-As Duration (minutes)"
              value={localValues['security.maxViewAsSessionMins'] as number}
              onChange={(v) => updateLocal('security.maxViewAsSessionMins', v)}
              min={5}
              max={120}
              testId="input-maxViewAs"
            />
            <NumberField
              label="Max Login Attempts"
              value={localValues['security.maxLoginAttempts'] as number}
              onChange={(v) => updateLocal('security.maxLoginAttempts', v)}
              min={3}
              max={20}
              testId="input-maxLogin"
            />
          </div>
          <div className="mt-4 flex justify-end">
            <button
              onClick={() => saveCategory('security')}
              disabled={saving === 'security'}
              className="px-4 py-2 bg-sage-600 hover:bg-sage-700 text-white rounded-xl text-sm font-medium disabled:opacity-50 transition-colors"
              data-testid="save-security"
            >
              {saving === 'security' ? 'Saving...' : 'Save Security Settings'}
            </button>
          </div>
        </section>

        {/* Notification Defaults */}
        <section className="bg-white dark:bg-slate-900 rounded-2xl shadow-soft p-6" data-testid="section-notifications">
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2 bg-lavender-50 dark:bg-lavender-900/20 rounded-xl">
              <Bell className="text-lavender-600" size={20} />
            </div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Notification Defaults</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <NumberField
              label="Default Reminder Lead Time (hours)"
              value={localValues['notifications.defaultReminderHours'] as number}
              onChange={(v) => updateLocal('notifications.defaultReminderHours', v)}
              min={1}
              max={168}
              testId="input-reminderHours"
            />
            <TimeField
              label="Quiet Hours Start"
              value={localValues['notifications.quietHoursStart'] as string}
              onChange={(v) => updateLocal('notifications.quietHoursStart', v)}
              testId="input-quietStart"
            />
            <TimeField
              label="Quiet Hours End"
              value={localValues['notifications.quietHoursEnd'] as string}
              onChange={(v) => updateLocal('notifications.quietHoursEnd', v)}
              testId="input-quietEnd"
            />
          </div>
          <div className="mt-4 flex justify-end">
            <button
              onClick={() => saveCategory('notifications')}
              disabled={saving === 'notifications'}
              className="px-4 py-2 bg-sage-600 hover:bg-sage-700 text-white rounded-xl text-sm font-medium disabled:opacity-50 transition-colors"
              data-testid="save-notifications"
            >
              {saving === 'notifications' ? 'Saving...' : 'Save Notification Settings'}
            </button>
          </div>
        </section>

        {/* Regional Defaults */}
        <section className="bg-white dark:bg-slate-900 rounded-2xl shadow-soft p-6" data-testid="section-regional">
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-xl">
              <Globe className="text-slate-600 dark:text-slate-400" size={20} />
            </div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Regional Defaults</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <SelectField
              label="Default Timezone"
              value={localValues['regional.defaultTimezone'] as string}
              onChange={(v) => updateLocal('regional.defaultTimezone', v)}
              options={TIMEZONE_OPTIONS.map((tz) => ({ value: tz, label: tz }))}
              testId="input-timezone"
            />
            <SelectField
              label="Default Locale"
              value={localValues['regional.defaultLocale'] as string}
              onChange={(v) => updateLocal('regional.defaultLocale', v)}
              options={LOCALE_OPTIONS}
              testId="input-locale"
            />
            <SelectField
              label="Default Currency"
              value={localValues['regional.defaultCurrency'] as string}
              onChange={(v) => updateLocal('regional.defaultCurrency', v)}
              options={CURRENCY_OPTIONS}
              testId="input-currency"
            />
          </div>
          <div className="mt-4 flex justify-end">
            <button
              onClick={() => saveCategory('regional')}
              disabled={saving === 'regional'}
              className="px-4 py-2 bg-sage-600 hover:bg-sage-700 text-white rounded-xl text-sm font-medium disabled:opacity-50 transition-colors"
              data-testid="save-regional"
            >
              {saving === 'regional' ? 'Saving...' : 'Save Regional Settings'}
            </button>
          </div>
        </section>

        {/* Platform Configuration */}
        <section className="bg-white dark:bg-slate-900 rounded-2xl shadow-soft p-6" data-testid="section-platform">
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-xl">
              <Settings className="text-slate-600 dark:text-slate-400" size={20} />
            </div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Platform Configuration</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Maintenance Mode
              </label>
              <button
                onClick={handleMaintenanceToggle}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  (localValues['platform.maintenanceMode'] as boolean)
                    ? 'bg-red-500'
                    : 'bg-slate-300 dark:bg-slate-600'
                }`}
                data-testid="input-maintenanceMode"
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    (localValues['platform.maintenanceMode'] as boolean) ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
              {(localValues['platform.maintenanceMode'] as boolean) && (
                <p className="mt-1 text-xs text-red-600" data-testid="maintenance-warning">
                  Platform is in maintenance mode — all tenants affected
                </p>
              )}
            </div>
            <NumberField
              label="Max Tenants Allowed"
              value={localValues['platform.maxTenantsAllowed'] as number}
              onChange={(v) => updateLocal('platform.maxTenantsAllowed', v)}
              min={1}
              max={10000}
              testId="input-maxTenants"
            />
            <NumberField
              label="API Rate Limit (per minute)"
              value={localValues['platform.apiRateLimitPerMin'] as number}
              onChange={(v) => updateLocal('platform.apiRateLimitPerMin', v)}
              min={10}
              max={1000}
              testId="input-rateLimit"
            />
          </div>
          <div className="mt-4 flex justify-end">
            <button
              onClick={() => saveCategory('platform')}
              disabled={saving === 'platform'}
              className="px-4 py-2 bg-sage-600 hover:bg-sage-700 text-white rounded-xl text-sm font-medium disabled:opacity-50 transition-colors"
              data-testid="save-platform"
            >
              {saving === 'platform' ? 'Saving...' : 'Save Platform Settings'}
            </button>
          </div>
        </section>
      </div>

      {/* Maintenance Mode Confirmation Modal */}
      {maintenanceConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" data-testid="maintenance-modal">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-lg p-6 max-w-md mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-red-50 dark:bg-red-900/20 rounded-xl">
                <AlertTriangle className="text-red-600" size={20} />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Enable Maintenance Mode?</h3>
            </div>
            <p className="text-sm text-slate-500 mb-6">
              This will prevent all tenant access to the platform. Only super admins will be able to use the console.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={cancelMaintenance}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-medium hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                data-testid="maintenance-cancel"
              >
                Cancel
              </button>
              <button
                onClick={confirmMaintenance}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-medium transition-colors"
                data-testid="maintenance-confirm"
              >
                Enable Maintenance Mode
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Field Components ----

function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  testId,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  testId: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{label}</label>
      <input
        type="number"
        value={value ?? ''}
        onChange={(e) => onChange(Number(e.target.value))}
        min={min}
        max={max}
        className="w-full bg-slate-50 dark:bg-slate-800 border-transparent focus:bg-white dark:focus:bg-slate-700 focus:ring-2 focus:ring-sage-500 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white"
        data-testid={testId}
      />
    </div>
  );
}

function ToggleField({
  label,
  value,
  onChange,
  testId,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  testId: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{label}</label>
      <button
        onClick={() => onChange(!value)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
          value ? 'bg-sage-600' : 'bg-slate-300 dark:bg-slate-600'
        }`}
        data-testid={testId}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            value ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  );
}

function TimeField({
  label,
  value,
  onChange,
  testId,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  testId: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{label}</label>
      <input
        type="time"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-slate-50 dark:bg-slate-800 border-transparent focus:bg-white dark:focus:bg-slate-700 focus:ring-2 focus:ring-sage-500 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white"
        data-testid={testId}
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  testId,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
  testId: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{label}</label>
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-slate-50 dark:bg-slate-800 border-transparent focus:bg-white dark:focus:bg-slate-700 focus:ring-2 focus:ring-sage-500 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white"
        data-testid={testId}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
