'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { Bell } from 'lucide-react';

interface NotificationSettings {
  channels: 'email' | 'whatsapp' | 'both';
  followUpDelayHours: number;
}

export default function NotificationSettingsPage() {
  const { t } = useI18n();
  const [settings, setSettings] = useState<NotificationSettings>({
    channels: 'both',
    followUpDelayHours: 2,
  });
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<NotificationSettings>('/business/notification-settings')
      .then((s) => {
        setSettings(s);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    await api.patch('/business/notification-settings', settings);
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
        <Bell size={24} className="text-sage-600" />
        <h1 className="text-2xl font-serif font-semibold text-slate-900">
          {t('notification_settings.title')}
        </h1>
      </div>

      <div className="bg-white rounded-2xl shadow-soft p-6 space-y-6">
        <p className="text-sm text-slate-500">{t('notification_settings.description')}</p>

        {/* Channel preference */}
        <div>
          <p className="text-sm font-medium mb-1">
            {t('notification_settings.channel_preference')}
          </p>
          <p className="text-xs text-slate-500 mb-3">
            {t('notification_settings.channel_preference_desc')}
          </p>
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="channels"
                checked={settings.channels === 'both'}
                onChange={() => setSettings({ ...settings, channels: 'both' })}
                className="text-sage-600"
              />
              <span className="text-sm">{t('notification_settings.channel_both')}</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="channels"
                checked={settings.channels === 'email'}
                onChange={() => setSettings({ ...settings, channels: 'email' })}
                className="text-sage-600"
              />
              <span className="text-sm">{t('notification_settings.channel_email')}</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="channels"
                checked={settings.channels === 'whatsapp'}
                onChange={() => setSettings({ ...settings, channels: 'whatsapp' })}
                className="text-sage-600"
              />
              <span className="text-sm">{t('notification_settings.channel_whatsapp')}</span>
            </label>
          </div>
        </div>

        <hr />

        {/* Follow-up delay */}
        <div>
          <p className="text-sm font-medium mb-1">{t('notification_settings.followup_delay')}</p>
          <p className="text-xs text-slate-500 mb-3">
            {t('notification_settings.followup_delay_desc')}
          </p>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={72}
              value={settings.followUpDelayHours}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  followUpDelayHours: Math.max(1, Math.min(72, Number(e.target.value) || 1)),
                })
              }
              className="w-20 border border-slate-200 rounded-xl px-3 py-2 text-sm"
            />
            <span className="text-sm text-slate-500">hours</span>
          </div>
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
