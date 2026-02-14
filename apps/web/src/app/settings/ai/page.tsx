'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { Sparkles } from 'lucide-react';

interface AiSettings {
  enabled: boolean;
  autoReplySuggestions: boolean;
  bookingAssistant: boolean;
  personality: string;
}

export default function AiSettingsPage() {
  const { t } = useI18n();
  const [settings, setSettings] = useState<AiSettings>({
    enabled: false,
    autoReplySuggestions: true,
    bookingAssistant: true,
    personality: 'friendly and professional',
  });
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<AiSettings>('/ai/settings').then((s) => {
      setSettings(s);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    await api.patch('/ai/settings', settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (loading) return <div className="p-6"><p className="text-gray-400">{t('common.loading')}</p></div>;

  return (
    <div className="p-6 max-w-2xl">
      <div className="flex items-center gap-2 mb-6">
        <Sparkles size={24} className="text-purple-600" />
        <h1 className="text-2xl font-bold">{t('ai.settings_title')}</h1>
      </div>

      <div className="bg-white border rounded-lg p-6 space-y-6">
        <p className="text-sm text-gray-500">{t('ai.settings_description')}</p>

        {/* Master toggle */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">{t('ai.enable_ai')}</p>
            <p className="text-xs text-gray-500">{t('ai.enable_ai_desc')}</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={settings.enabled}
              onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-gray-200 peer-focus:ring-2 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600" />
          </label>
        </div>

        {settings.enabled && (
          <>
            <hr />

            {/* Auto reply suggestions */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{t('ai.auto_reply_suggestions')}</p>
                <p className="text-xs text-gray-500">{t('ai.auto_reply_suggestions_desc')}</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.autoReplySuggestions}
                  onChange={(e) => setSettings({ ...settings, autoReplySuggestions: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-gray-200 peer-focus:ring-2 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600" />
              </label>
            </div>

            {/* Booking assistant */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{t('ai.booking_assistant_toggle')}</p>
                <p className="text-xs text-gray-500">{t('ai.booking_assistant_toggle_desc')}</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.bookingAssistant}
                  onChange={(e) => setSettings({ ...settings, bookingAssistant: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-gray-200 peer-focus:ring-2 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600" />
              </label>
            </div>

            <hr />

            {/* Personality */}
            <div>
              <label className="block text-sm font-medium mb-1">{t('ai.personality_label')}</label>
              <p className="text-xs text-gray-500 mb-2">{t('ai.personality_desc')}</p>
              <textarea
                value={settings.personality}
                onChange={(e) => setSettings({ ...settings, personality: e.target.value })}
                rows={3}
                placeholder="e.g. friendly and professional"
                className="w-full border rounded-md px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </>
        )}

        <div className="flex items-center gap-3">
          <button onClick={handleSave} className="bg-purple-600 text-white px-4 py-2 rounded text-sm hover:bg-purple-700">
            {t('settings.save_changes')}
          </button>
          {saved && <span className="text-green-600 text-sm">{t('common.saved')}</span>}
        </div>
      </div>
    </div>
  );
}
