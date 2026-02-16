'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { ShieldCheck } from 'lucide-react';

interface PolicySettings {
  policyEnabled: boolean;
  cancellationWindowHours: number;
  rescheduleWindowHours: number;
  cancellationPolicyText: string;
  reschedulePolicyText: string;
}

export default function PolicySettingsPage() {
  const { t } = useI18n();
  const [settings, setSettings] = useState<PolicySettings>({
    policyEnabled: false,
    cancellationWindowHours: 24,
    rescheduleWindowHours: 24,
    cancellationPolicyText: '',
    reschedulePolicyText: '',
  });
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<PolicySettings>('/business/policy-settings')
      .then((s) => {
        setSettings(s);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    await api.patch('/business/policy-settings', settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (loading)
    return (
      <div className="p-6">
        <p className="text-slate-400">{t('common.loading')}</p>
      </div>
    );

  return (
    <div className="p-6 max-w-2xl">
      <div className="flex items-center gap-2 mb-6">
        <ShieldCheck size={24} className="text-orange-600" />
        <h1 className="text-2xl font-serif font-semibold text-slate-900">
          {t('policy_settings.title')}
        </h1>
      </div>

      <div className="bg-white rounded-2xl shadow-soft p-6 space-y-6">
        <p className="text-sm text-slate-500">{t('policy_settings.description')}</p>

        {/* Enable toggle */}
        <div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.policyEnabled}
              onChange={(e) => setSettings({ ...settings, policyEnabled: e.target.checked })}
              className="w-4 h-4 text-sage-600 rounded"
            />
            <div>
              <p className="text-sm font-medium">{t('policy_settings.enable_policy')}</p>
              <p className="text-xs text-slate-500">{t('policy_settings.enable_policy_desc')}</p>
            </div>
          </label>
        </div>

        <hr />

        {/* Cancellation window */}
        <div>
          <p className="text-sm font-medium mb-1">{t('policy_settings.cancellation_window')}</p>
          <p className="text-xs text-slate-500 mb-3">
            {t('policy_settings.cancellation_window_desc')}
          </p>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={168}
              value={settings.cancellationWindowHours}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  cancellationWindowHours: Math.max(1, Math.min(168, Number(e.target.value) || 1)),
                })
              }
              className="w-20 border border-slate-200 rounded-xl px-3 py-2 text-sm"
            />
            <span className="text-sm text-slate-500">
              {t('policy_settings.cancellation_window_unit')}
            </span>
          </div>
        </div>

        <hr />

        {/* Cancellation policy text */}
        <div>
          <p className="text-sm font-medium mb-1">{t('policy_settings.cancellation_text')}</p>
          <p className="text-xs text-slate-500 mb-3">
            {t('policy_settings.cancellation_text_desc')}
          </p>
          <textarea
            value={settings.cancellationPolicyText}
            onChange={(e) =>
              setSettings({ ...settings, cancellationPolicyText: e.target.value })
            }
            placeholder={t('policy_settings.cancellation_text_placeholder')}
            rows={3}
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm resize-none"
          />
        </div>

        <hr />

        {/* Reschedule window */}
        <div>
          <p className="text-sm font-medium mb-1">{t('policy_settings.reschedule_window')}</p>
          <p className="text-xs text-slate-500 mb-3">
            {t('policy_settings.reschedule_window_desc')}
          </p>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={168}
              value={settings.rescheduleWindowHours}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  rescheduleWindowHours: Math.max(1, Math.min(168, Number(e.target.value) || 1)),
                })
              }
              className="w-20 border border-slate-200 rounded-xl px-3 py-2 text-sm"
            />
            <span className="text-sm text-slate-500">
              {t('policy_settings.reschedule_window_unit')}
            </span>
          </div>
        </div>

        <hr />

        {/* Reschedule policy text */}
        <div>
          <p className="text-sm font-medium mb-1">{t('policy_settings.reschedule_text')}</p>
          <p className="text-xs text-slate-500 mb-3">
            {t('policy_settings.reschedule_text_desc')}
          </p>
          <textarea
            value={settings.reschedulePolicyText}
            onChange={(e) =>
              setSettings({ ...settings, reschedulePolicyText: e.target.value })
            }
            placeholder={t('policy_settings.reschedule_text_placeholder')}
            rows={3}
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm resize-none"
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            className="bg-sage-600 text-white px-4 py-2 rounded-xl text-sm hover:bg-sage-700 transition-colors"
          >
            {t('settings.save_changes')}
          </button>
          {saved && <span className="text-sage-600 text-sm">{t('common.saved')}</span>}
        </div>
      </div>
    </div>
  );
}
