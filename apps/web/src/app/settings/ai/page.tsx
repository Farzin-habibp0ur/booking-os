'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { useToast } from '@/lib/toast';
import { Sparkles, ArrowLeft, Bot, Bell, Shield } from 'lucide-react';
import { captureEvent } from '@/lib/posthog';
import { cn } from '@/lib/cn';
import { FormSkeleton } from '@/components/skeleton';

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

interface MarketingAutonomy {
  actionType: string;
  autonomyLevel: string;
  description?: string;
  scope?: string;
}

const INTENT_OPTIONS = [
  { key: 'GENERAL', labelKey: 'ai.intent_general' },
  { key: 'BOOK_APPOINTMENT', labelKey: 'ai.intent_book_appointment' },
  { key: 'CANCEL', labelKey: 'ai.intent_cancel' },
  { key: 'RESCHEDULE', labelKey: 'ai.intent_reschedule' },
  { key: 'INQUIRY', labelKey: 'ai.intent_inquiry' },
];

const AUTONOMY_LEVELS = [
  { value: 'OFF', label: 'Off', description: 'All actions require manual approval' },
  { value: 'SUGGEST', label: 'Suggest', description: 'AI suggests, you decide' },
  { value: 'AUTO_WITH_REVIEW', label: 'Auto + Review', description: 'AI acts, you review after' },
  { value: 'FULL_AUTO', label: 'Full Auto', description: 'AI acts autonomously' },
];

const REVIEW_MODES = [
  {
    value: 'STRICT',
    label: 'Strict',
    description: 'All content requires manual review before publishing',
  },
  {
    value: 'NORMAL',
    label: 'Normal',
    description: 'Tier-based: GREEN auto-publishes, YELLOW/RED need review',
  },
  {
    value: 'RELAXED',
    label: 'Relaxed',
    description: 'GREEN auto-publishes, YELLOW auto-publishes with review window',
  },
];

const NOTIFICATION_EVENTS = [
  { key: 'CONTENT_READY', label: 'Content ready for review', defaultOn: true },
  { key: 'AGENT_ERROR', label: 'Agent run failures', defaultOn: true },
  { key: 'BUDGET_THRESHOLD', label: 'Budget threshold reached', defaultOn: true },
  { key: 'ESCALATION', label: 'Escalation events', defaultOn: true },
  { key: 'CONTENT_PUBLISHED', label: 'Content published', defaultOn: false },
  { key: 'WEEKLY_DIGEST', label: 'Weekly performance digest', defaultOn: true },
];

export default function AiSettingsPage() {
  const { t } = useI18n();
  const { toast } = useToast();
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

  // Marketing AI state
  const [marketingAutonomy, setMarketingAutonomy] = useState<MarketingAutonomy[]>([]);
  const [marketingEnabled, setMarketingEnabled] = useState(true);
  const [defaultAutonomy, setDefaultAutonomy] = useState('SUGGEST');
  const [reviewMode, setReviewMode] = useState('NORMAL');
  const [notifications, setNotifications] = useState<Record<string, boolean>>(
    Object.fromEntries(NOTIFICATION_EVENTS.map((e) => [e.key, e.defaultOn])),
  );
  const [marketingSaved, setMarketingSaved] = useState(false);

  useEffect(() => {
    captureEvent('ai_settings_viewed');
    Promise.all([
      api.get<AiSettings>('/ai/settings').catch(() => null),
      api.get<MarketingAutonomy[]>('/autonomy-settings').catch(() => []),
    ])
      .then(([aiRes, autonomyRes]) => {
        if (aiRes) setSettings(aiRes);
        const autonomyList = Array.isArray(autonomyRes) ? autonomyRes : [];
        setMarketingAutonomy(autonomyList);
        // Derive defaults from autonomy settings
        if (autonomyList.length > 0) {
          const levels = autonomyList.map((a) => a.autonomyLevel);
          const allOff = levels.every((l) => l === 'OFF');
          setMarketingEnabled(!allOff);
          // Most common level as default
          const counts: Record<string, number> = {};
          levels.forEach((l) => {
            counts[l] = (counts[l] || 0) + 1;
          });
          const mostCommon = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
          if (mostCommon) setDefaultAutonomy(mostCommon);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    await api.patch('/ai/settings', settings);
    captureEvent('ai_enabled', {
      enabled: settings.enabled,
      autoReply: settings.autoReply.enabled,
    });
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

  const handleMarketingToggle = async (enabled: boolean) => {
    setMarketingEnabled(enabled);
    const level = enabled ? defaultAutonomy : 'OFF';
    try {
      for (const a of marketingAutonomy) {
        await api.patch(`/autonomy-settings/${a.actionType}`, { autonomyLevel: level });
      }
      toast(enabled ? 'Marketing agents enabled' : 'Marketing agents disabled', 'success');
    } catch {
      toast('Failed to update', 'error');
    }
  };

  const handleDefaultAutonomyChange = async (level: string) => {
    setDefaultAutonomy(level);
    try {
      for (const a of marketingAutonomy) {
        await api.patch(`/autonomy-settings/${a.actionType}`, { autonomyLevel: level });
      }
      setMarketingAutonomy((prev) => prev.map((a) => ({ ...a, autonomyLevel: level })));
      toast('Default autonomy updated', 'success');
    } catch {
      toast('Failed to update autonomy', 'error');
    }
  };

  const handleNotificationToggle = (key: string) => {
    setNotifications((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSaveMarketing = async () => {
    setMarketingSaved(true);
    setTimeout(() => setMarketingSaved(false), 2000);
  };

  if (loading) return <FormSkeleton rows={4} />;

  return (
    <div className="p-6 max-w-2xl" data-testid="ai-settings-page">
      <Link
        href="/settings"
        className="inline-flex items-center gap-1 text-sm text-sage-600 hover:text-sage-700 dark:text-sage-400 dark:hover:text-sage-300 mb-3 transition-colors"
      >
        <ArrowLeft size={14} />
        Back to Settings
      </Link>
      <div className="flex items-center gap-2 mb-6">
        <Sparkles size={24} className="text-lavender-600" />
        <h1 className="text-2xl font-serif font-semibold text-slate-900">
          {t('ai.settings_title')}
        </h1>
      </div>

      {/* Conversational AI Settings */}
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
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{t('ai.auto_reply_suggestions')}</p>
                <p className="text-xs text-slate-500">{t('ai.auto_reply_suggestions_desc')}</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.autoReplySuggestions}
                  onChange={(e) =>
                    setSettings({ ...settings, autoReplySuggestions: e.target.checked })
                  }
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-200 peer-focus:ring-2 peer-focus:ring-lavender-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-lavender-600" />
              </label>
            </div>

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
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        autoReply: { ...settings.autoReply, enabled: e.target.checked },
                      })
                    }
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
                        onChange={() =>
                          setSettings({
                            ...settings,
                            autoReply: { ...settings.autoReply, mode: 'all' },
                          })
                        }
                        className="text-lavender-600"
                      />
                      <span className="text-sm">{t('ai.auto_reply_mode_all')}</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="autoReplyMode"
                        checked={settings.autoReply.mode === 'selected'}
                        onChange={() =>
                          setSettings({
                            ...settings,
                            autoReply: { ...settings.autoReply, mode: 'selected' },
                          })
                        }
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
          <button
            onClick={handleSave}
            className="bg-lavender-600 text-white px-4 py-2 rounded-xl text-sm hover:bg-lavender-700 transition-colors"
          >
            {t('settings.save_changes')}
          </button>
          {saved && <span className="text-sage-600 text-sm">{t('common.saved')}</span>}
        </div>
      </div>

      {/* Marketing AI Settings */}
      <div className="mt-8" data-testid="marketing-ai-section">
        <div className="flex items-center gap-2 mb-4">
          <Bot size={20} className="text-lavender-600" />
          <h2 className="text-lg font-serif font-semibold text-slate-900">Marketing AI</h2>
        </div>

        <div className="bg-white rounded-2xl shadow-soft p-6 space-y-6">
          {/* Marketing Master Toggle */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Marketing Agents</p>
              <p className="text-xs text-slate-500">
                Enable or disable all 12 marketing AI agents at once
              </p>
            </div>
            <button
              onClick={() => handleMarketingToggle(!marketingEnabled)}
              className={cn(
                'relative w-11 h-6 rounded-full transition-colors',
                marketingEnabled ? 'bg-sage-500' : 'bg-slate-200',
              )}
              data-testid="marketing-master-toggle"
              role="switch"
              aria-checked={marketingEnabled}
            >
              <span
                className={cn(
                  'absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform',
                  marketingEnabled ? 'translate-x-5' : 'translate-x-0',
                )}
              />
            </button>
          </div>

          <hr />

          {/* Default Autonomy Level */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Shield size={16} className="text-lavender-600" />
              <p className="text-sm font-medium">Default Autonomy Level</p>
            </div>
            <p className="text-xs text-slate-500 mb-3">
              Set the default autonomy level for all marketing actions
            </p>
            <div className="grid grid-cols-2 gap-2" data-testid="autonomy-level-selector">
              {AUTONOMY_LEVELS.map((level) => (
                <button
                  key={level.value}
                  onClick={() => handleDefaultAutonomyChange(level.value)}
                  className={cn(
                    'p-3 rounded-xl border text-left transition-all',
                    defaultAutonomy === level.value
                      ? 'border-lavender-300 bg-lavender-50 ring-2 ring-lavender-200'
                      : 'border-slate-200 hover:border-slate-300',
                  )}
                  data-testid={`autonomy-${level.value}`}
                >
                  <p className="text-sm font-medium text-slate-900">{level.label}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{level.description}</p>
                </button>
              ))}
            </div>
          </div>

          <hr />

          {/* Content Review Mode */}
          <div>
            <p className="text-sm font-medium mb-3">Content Review Mode</p>
            <div className="space-y-2" data-testid="review-mode-selector">
              {REVIEW_MODES.map((mode) => (
                <label
                  key={mode.value}
                  className={cn(
                    'flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all',
                    reviewMode === mode.value
                      ? 'border-lavender-300 bg-lavender-50'
                      : 'border-slate-200 hover:border-slate-300',
                  )}
                >
                  <input
                    type="radio"
                    name="reviewMode"
                    value={mode.value}
                    checked={reviewMode === mode.value}
                    onChange={() => setReviewMode(mode.value)}
                    className="mt-0.5 text-lavender-600"
                    data-testid={`review-${mode.value}`}
                  />
                  <div>
                    <p className="text-sm font-medium text-slate-900">{mode.label}</p>
                    <p className="text-xs text-slate-500">{mode.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <hr />

          {/* Notification Preferences */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Bell size={16} className="text-lavender-600" />
              <p className="text-sm font-medium">Notification Preferences</p>
            </div>
            <div className="space-y-3" data-testid="notification-preferences">
              {NOTIFICATION_EVENTS.map((event) => (
                <div key={event.key} className="flex items-center justify-between">
                  <span className="text-sm text-slate-700">{event.label}</span>
                  <button
                    onClick={() => handleNotificationToggle(event.key)}
                    className={cn(
                      'relative w-9 h-5 rounded-full transition-colors',
                      notifications[event.key] ? 'bg-sage-500' : 'bg-slate-200',
                    )}
                    data-testid={`notif-${event.key}`}
                    role="switch"
                    aria-checked={notifications[event.key]}
                  >
                    <span
                      className={cn(
                        'absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform',
                        notifications[event.key] ? 'translate-x-4' : 'translate-x-0',
                      )}
                    />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSaveMarketing}
              className="bg-lavender-600 text-white px-4 py-2 rounded-xl text-sm hover:bg-lavender-700 transition-colors"
              data-testid="save-marketing-btn"
            >
              Save Marketing Settings
            </button>
            {marketingSaved && <span className="text-sage-600 text-sm">Saved!</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
