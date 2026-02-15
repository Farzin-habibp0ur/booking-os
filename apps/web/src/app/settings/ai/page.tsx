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
  autoReply: {
    enabled: boolean;
    mode: 'all' | 'selected';
    selectedIntents: string[];
  };
}

const INTENT_OPTIONS = [
  { key: 'GENERAL', labelKey: 'ai.intent_general' },
  { key: 'BOOK_APPOINTMENT', labelKey: 'ai.intent_book_appointment' },
  { key: 'CANCEL', labelKey: 'ai.intent_cancel' },
  { key: 'RESCHEDULE', labelKey: 'ai.intent_reschedule' },
  { key: 'INQUIRY', labelKey: 'ai.intent_inquiry' },
];

export default function AiSettingsPage() {
  const { t } = useI18n();
  const [settings, setSettings] = useState<AiSettings>({
    enabled: false,
    autoReplySuggestions: true,
    bookingAssistant: true,
    personality: 'friendly and professional',
    autoReply: {
      enabled: false,
      mode: 'all',
      selectedIntents: ['GENERAL', 'BOOK_APPOINTMENT', 'CANCEL', 'RESCHEDULE', 'INQUIRY'],
    },
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

  const toggleIntent = (intent: string) => {
    const current = settings.autoReply.selectedIntents;
    const updated = current.includes(intent)
      ? current.filter((i) => i !== intent)
      : [...current, intent];
    setSettings({
      ...settings,
      autoReply: { ...settings.autoReply, selectedIntents: updated },
    });
  };

  if (loading) return <div className="p-6"><p className="text-slate-400">{t('common.loading')}</p></div>;

  return (
    <div className="p-6 max-w-2xl">
      <div className="flex items-center gap-2 mb-6">
        <Sparkles size={24} className="text-lavender-600" />
        <h1 className="text-2xl font-serif font-semibold text-slate-900">{t('ai.settings_title')}</h1>
      </div>

      <div className="bg-white rounded-2xl shadow-soft p-6 space-y-6">
        <p className="text-sm text-slate-500">{t('ai.settings_description')}</p>

        {/* Master toggle */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">{t('ai.enable_ai')}</p>
            <p className="text-xs text-slate-500">{t('ai.enable_ai_desc')}</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={settings.enabled}
              onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-slate-200 peer-focus:ring-2 peer-focus:ring-lavender-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-lavender-600" />
          </label>
        </div>

        {settings.enabled && (
          <>
            <hr />

            {/* Auto reply suggestions */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{t('ai.auto_reply_suggestions')}</p>
                <p className="text-xs text-slate-500">{t('ai.auto_reply_suggestions_desc')}</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.autoReplySuggestions}
                  onChange={(e) => setSettings({ ...settings, autoReplySuggestions: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-200 peer-focus:ring-2 peer-focus:ring-lavender-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-lavender-600" />
              </label>
            </div>

            {/* Booking assistant */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{t('ai.booking_assistant_toggle')}</p>
                <p className="text-xs text-slate-500">{t('ai.booking_assistant_toggle_desc')}</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.bookingAssistant}
                  onChange={(e) => setSettings({ ...settings, bookingAssistant: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-200 peer-focus:ring-2 peer-focus:ring-lavender-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-lavender-600" />
              </label>
            </div>

            <hr />

            {/* Auto-Reply Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{t('ai.auto_reply_toggle')}</p>
                  <p className="text-xs text-slate-500">{t('ai.auto_reply_toggle_desc')}</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.autoReply.enabled}
                    onChange={(e) => setSettings({
                      ...settings,
                      autoReply: { ...settings.autoReply, enabled: e.target.checked },
                    })}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-200 peer-focus:ring-2 peer-focus:ring-lavender-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-lavender-600" />
                </label>
              </div>

              {settings.autoReply.enabled && (
                <div className="ml-4 space-y-3 border-l-2 border-lavender-200 pl-4">
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="autoReplyMode"
                        checked={settings.autoReply.mode === 'all'}
                        onChange={() => setSettings({
                          ...settings,
                          autoReply: { ...settings.autoReply, mode: 'all' },
                        })}
                        className="text-lavender-600"
                      />
                      <span className="text-sm">{t('ai.auto_reply_mode_all')}</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="autoReplyMode"
                        checked={settings.autoReply.mode === 'selected'}
                        onChange={() => setSettings({
                          ...settings,
                          autoReply: { ...settings.autoReply, mode: 'selected' },
                        })}
                        className="text-lavender-600"
                      />
                      <span className="text-sm">{t('ai.auto_reply_mode_selected')}</span>
                    </label>
                  </div>

                  {settings.autoReply.mode === 'selected' && (
                    <div className="space-y-2 mt-2">
                      {INTENT_OPTIONS.map((opt) => (
                        <label key={opt.key} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={settings.autoReply.selectedIntents.includes(opt.key)}
                            onChange={() => toggleIntent(opt.key)}
                            className="rounded text-purple-600"
                          />
                          <span className="text-sm">{t(opt.labelKey)}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <hr />

            {/* Personality */}
            <div>
              <label className="block text-sm font-medium mb-1">{t('ai.personality_label')}</label>
              <p className="text-xs text-slate-500 mb-2">{t('ai.personality_desc')}</p>
              <textarea
                value={settings.personality}
                onChange={(e) => setSettings({ ...settings, personality: e.target.value })}
                rows={3}
                placeholder="e.g. friendly and professional"
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-lavender-500"
              />
            </div>
          </>
        )}

        <div className="flex items-center gap-3">
          <button onClick={handleSave} className="bg-lavender-600 text-white px-4 py-2 rounded-xl text-sm hover:bg-lavender-700 transition-colors">
            {t('settings.save_changes')}
          </button>
          {saved && <span className="text-sage-600 text-sm">{t('common.saved')}</span>}
        </div>
      </div>
    </div>
  );
}
