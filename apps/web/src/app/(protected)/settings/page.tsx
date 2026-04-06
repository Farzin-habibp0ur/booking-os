'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/cn';
import {
  FileText,
  Languages,
  Sparkles,
  Upload,
  Settings2,
  CreditCard,
  Bell,
  Link2,
  CalendarDays,
  ShieldCheck,
  ClipboardList,
  Tag,
  Palette,
  Shield,
  Bot,
  Star,
  Clock,
} from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { useTheme } from '@/lib/use-theme';
import { SettingsHub } from '@/components/settings-hub';
import { trackEvent } from '@/lib/posthog';

export default function SettingsPage() {
  const { t } = useI18n();
  const router = useRouter();
  const { user } = useAuth();
  const role = user?.role;
  const { theme, setTheme } = useTheme();
  const [business, setBusiness] = useState<any>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [timezone, setTimezone] = useState('');
  const [saved, setSaved] = useState(false);

  // Change password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [googleReviewUrl, setGoogleReviewUrl] = useState('');
  const [reviewSaved, setReviewSaved] = useState(false);

  useEffect(() => {
    api.get<any>('/business').then((b) => {
      setBusiness(b);
      setName(b.name);
      setPhone(b.phone || '');
      setTimezone(b.timezone);
      setGoogleReviewUrl(b.packConfig?.googleReviewUrl || '');
    });
  }, [role]);

  const handleSave = async () => {
    await api.patch('/business', { name, phone, timezone });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleChangePassword = async () => {
    setPasswordError('');
    if (newPassword.length < 8) {
      setPasswordError(t('settings.password_min_length'));
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setPasswordError(t('settings.passwords_no_match'));
      return;
    }
    try {
      await api.post('/auth/change-password', { currentPassword, newPassword });
      setPasswordSaved(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      setTimeout(() => setPasswordSaved(false), 3000);
    } catch (err: any) {
      setPasswordError(err.message || t('settings.password_change_failed'));
    }
  };

  return (
    <div className="p-6 max-w-4xl" data-tour-target="settings-nav">
      <h1 className="text-2xl font-serif font-semibold text-slate-900 mb-6">
        {t('settings.title')}
      </h1>

      {/* Settings Hub — category cards */}
      <div className="mb-8" data-testid="settings-hub-section">
        <SettingsHub />
      </div>

      <div className="max-w-2xl">
        <div className="bg-white rounded-2xl shadow-soft p-6 space-y-4">
          <h2 className="font-semibold">{t('settings.business_info')}</h2>

          <div>
            <label className="block text-sm font-medium mb-1">{t('settings.business_name')}</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">{t('settings.phone')}</label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">{t('settings.timezone')}</label>
            <input
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">{t('settings.vertical_pack')}</label>
            <input
              value={business?.verticalPack || ''}
              disabled
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-slate-50"
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
        {/* Change Password */}
        <div className="bg-white rounded-2xl shadow-soft p-6 mt-6 space-y-4">
          <h2 className="font-semibold">{t('settings.change_password')}</h2>
          {passwordError && (
            <div className="bg-red-50 text-red-600 p-3 rounded text-sm">{passwordError}</div>
          )}
          <div>
            <label className="block text-sm font-medium mb-1">
              {t('settings.current_password')}
            </label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t('settings.new_password')}</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
              minLength={8}
              placeholder={t('settings.password_placeholder')}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              {t('settings.confirm_password')}
            </label>
            <input
              type="password"
              value={confirmNewPassword}
              onChange={(e) => setConfirmNewPassword(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
              minLength={8}
            />
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleChangePassword}
              disabled={!currentPassword || !newPassword || !confirmNewPassword}
              className="bg-sage-600 text-white px-4 py-2 rounded-xl text-sm hover:bg-sage-700 transition-colors disabled:opacity-50"
            >
              {t('settings.update_password')}
            </button>
            {passwordSaved && (
              <span className="text-sage-600 text-sm">{t('settings.password_updated')}</span>
            )}
          </div>
        </div>

        {/* Booking Link */}
        {business?.slug && (
          <div className="bg-sage-50 border border-sage-100 rounded-2xl p-6 mt-6">
            <div className="flex items-center gap-2 mb-1">
              <Link2 size={18} className="text-sage-600" />
              <h3 className="font-semibold text-slate-800">{t('settings.booking_link')}</h3>
            </div>
            <p className="text-sm text-slate-500 mt-1">{t('settings.booking_link_desc')}</p>
            <div className="flex items-center gap-2 mt-3">
              <input
                readOnly
                value={
                  typeof window !== 'undefined'
                    ? `${window.location.origin}/book/${business.slug}`
                    : `/book/${business.slug}`
                }
                className="flex-1 bg-white rounded-xl px-3 py-2 text-sm border border-slate-200"
              />
              <button
                onClick={() => {
                  const url = `${window.location.origin}/book/${business.slug}`;
                  navigator.clipboard.writeText(url);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="bg-sage-600 hover:bg-sage-700 text-white rounded-xl px-4 py-2 text-sm transition-colors"
              >
                {copied ? t('settings.copied') : t('settings.copy_link')}
              </button>
            </div>
          </div>
        )}

        {/* Google Review URL */}
        <div className="bg-white rounded-2xl shadow-soft p-6 mt-6">
          <div className="flex items-center gap-2 mb-1">
            <Star size={18} className="text-amber-500" />
            <h3 className="font-semibold text-slate-800">Google Reviews</h3>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Add your Google Business review link to auto-prompt clients after appointments.
          </p>
          <div className="flex items-center gap-2 mt-3">
            <input
              type="url"
              value={googleReviewUrl}
              onChange={(e) => {
                setGoogleReviewUrl(e.target.value);
                setReviewSaved(false);
              }}
              placeholder="https://g.page/r/your-business/review"
              className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-sage-500 focus:border-transparent outline-none"
            />
            <button
              onClick={async () => {
                await api.patch('/business', { packConfig: { googleReviewUrl } });
                setReviewSaved(true);
                setTimeout(() => setReviewSaved(false), 2000);
              }}
              className="bg-sage-600 hover:bg-sage-700 text-white rounded-xl px-4 py-2 text-sm transition-colors"
            >
              {reviewSaved ? 'Saved!' : 'Save'}
            </button>
          </div>
        </div>
      </div>

      {/* Campaign Preferences */}
      {role === 'ADMIN' || role === 'OWNER' ? <CampaignPreferencesSection /> : null}
    </div>
  );
}

function CampaignPreferencesSection() {
  const { t } = useI18n();
  const [capEnabled, setCapEnabled] = useState(false);
  const [capMax, setCapMax] = useState(3);
  const [capPeriod, setCapPeriod] = useState('week');
  const [quietEnabled, setQuietEnabled] = useState(false);
  const [quietStart, setQuietStart] = useState('21:00');
  const [quietEnd, setQuietEnd] = useState('08:00');
  const [saving, setSaving] = useState(false);
  const [prefsSaved, setPrefsSaved] = useState(false);

  useEffect(() => {
    api
      .get<any>('/business/campaign-preferences')
      .then((prefs) => {
        if (prefs?.frequencyCap) {
          setCapEnabled(true);
          setCapMax(prefs.frequencyCap.max || 3);
          setCapPeriod(prefs.frequencyCap.period || 'week');
        }
        if (prefs?.quietHours) {
          setQuietEnabled(true);
          setQuietStart(prefs.quietHours.start || '21:00');
          setQuietEnd(prefs.quietHours.end || '08:00');
        }
      })
      .catch(() => {});
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.patch('/business/campaign-preferences', {
        frequencyCap: capEnabled ? { max: capMax, period: capPeriod } : null,
        quietHours: quietEnabled
          ? {
              start: quietStart,
              end: quietEnd,
              timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            }
          : null,
      });
      setPrefsSaved(true);
      setTimeout(() => setPrefsSaved(false), 2000);
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-soft p-5 mt-6" data-testid="campaign-preferences">
      <h2 className="text-sm font-semibold text-slate-900 mb-4">
        {t('campaigns.guardrails.campaign_preferences')}
      </h2>

      {/* Frequency Cap */}
      <div className="mb-4">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={capEnabled}
            onChange={(e) => setCapEnabled(e.target.checked)}
            className="rounded text-sage-600"
          />
          {t('campaigns.guardrails.cap_toggle')}
        </label>
        {capEnabled && (
          <div className="flex items-center gap-2 mt-2 ml-6">
            <span className="text-sm text-slate-500">{t('campaigns.guardrails.max_messages')}</span>
            <input
              type="number"
              min={1}
              max={50}
              value={capMax}
              onChange={(e) => setCapMax(Number(e.target.value))}
              className="w-16 text-sm bg-slate-50 border-transparent rounded-xl px-2 py-1.5 focus:bg-white focus:ring-2 focus:ring-sage-500"
            />
            <select
              value={capPeriod}
              onChange={(e) => setCapPeriod(e.target.value)}
              className="text-sm bg-slate-50 border-transparent rounded-xl px-2 py-1.5 focus:bg-white focus:ring-2 focus:ring-sage-500"
            >
              <option value="week">{t('campaigns.guardrails.per_week')}</option>
              <option value="month">{t('campaigns.guardrails.per_month')}</option>
            </select>
          </div>
        )}
      </div>

      {/* Quiet Hours */}
      <div className="mb-4">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={quietEnabled}
            onChange={(e) => setQuietEnabled(e.target.checked)}
            className="rounded text-sage-600"
          />
          {t('campaigns.guardrails.quiet_toggle')}
        </label>
        {quietEnabled && (
          <div className="flex items-center gap-2 mt-2 ml-6">
            <span className="text-sm text-slate-500">{t('campaigns.guardrails.from')}</span>
            <input
              type="time"
              value={quietStart}
              onChange={(e) => setQuietStart(e.target.value)}
              className="text-sm bg-slate-50 border-transparent rounded-xl px-2 py-1.5 focus:bg-white focus:ring-2 focus:ring-sage-500"
            />
            <span className="text-sm text-slate-500">{t('campaigns.guardrails.to')}</span>
            <input
              type="time"
              value={quietEnd}
              onChange={(e) => setQuietEnd(e.target.value)}
              className="text-sm bg-slate-50 border-transparent rounded-xl px-2 py-1.5 focus:bg-white focus:ring-2 focus:ring-sage-500"
            />
          </div>
        )}
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="bg-sage-600 hover:bg-sage-700 text-white rounded-xl px-4 py-2 text-sm transition-colors disabled:opacity-50"
      >
        {prefsSaved ? t('common.saved') : saving ? t('common.saving') : t('common.save')}
      </button>
    </div>
  );
}
