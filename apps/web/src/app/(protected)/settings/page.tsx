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
  ClipboardCheck,
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
  Gift,
  Users,
  DollarSign,
  Clock,
  Check,
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
  const [referralStats, setReferralStats] = useState<any>(null);
  const [referralCopied, setReferralCopied] = useState(false);

  useEffect(() => {
    api.get<any>('/business').then((b) => {
      setBusiness(b);
      setName(b.name);
      setPhone(b.phone || '');
      setTimezone(b.timezone);
      setGoogleReviewUrl(b.packConfig?.googleReviewUrl || '');
    });
    if (role === 'ADMIN') {
      api
        .get<any>('/referral/stats')
        .then(setReferralStats)
        .catch(() => {});
    }
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

        {/* Referral Program */}
        {role === 'ADMIN' && referralStats && (
          <div className="bg-white rounded-2xl shadow-soft p-6 mt-6">
            <div className="flex items-center gap-2 mb-1">
              <Gift size={18} className="text-sage-600" />
              <h3 className="font-semibold text-slate-800">Referral Program</h3>
            </div>
            <p className="text-sm text-slate-500 mt-1">
              Give $50, Get $50 — Share your referral link with other businesses. When they
              subscribe, you both get $50 credit.
            </p>

            {/* Referral link */}
            <div className="flex items-center gap-2 mt-4">
              <input
                readOnly
                value={referralStats.referralLink}
                className="flex-1 bg-slate-50 rounded-xl px-3 py-2 text-sm border border-slate-200"
              />
              <button
                onClick={() => {
                  navigator.clipboard.writeText(referralStats.referralLink);
                  setReferralCopied(true);
                  trackEvent('referral_link_copied');
                  setTimeout(() => setReferralCopied(false), 2000);
                }}
                className="bg-sage-600 hover:bg-sage-700 text-white rounded-xl px-4 py-2 text-sm transition-colors whitespace-nowrap"
              >
                {referralCopied ? 'Copied!' : 'Copy Link'}
              </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 mt-5">
              <div className="bg-slate-50 rounded-xl p-3 text-center">
                <div className="flex items-center justify-center gap-1 text-slate-400 mb-1">
                  <Users size={14} />
                  <span className="text-xs">Invites</span>
                </div>
                <p className="text-xl font-serif font-semibold text-slate-900">
                  {referralStats.totalInvites}
                </p>
              </div>
              <div className="bg-slate-50 rounded-xl p-3 text-center">
                <div className="flex items-center justify-center gap-1 text-slate-400 mb-1">
                  <Check size={14} />
                  <span className="text-xs">Converted</span>
                </div>
                <p className="text-xl font-serif font-semibold text-sage-600">
                  {referralStats.successfulReferrals}
                </p>
              </div>
              <div className="bg-slate-50 rounded-xl p-3 text-center">
                <div className="flex items-center justify-center gap-1 text-slate-400 mb-1">
                  <DollarSign size={14} />
                  <span className="text-xs">Credits</span>
                </div>
                <p className="text-xl font-serif font-semibold text-sage-600">
                  ${referralStats.totalCreditsEarned}
                </p>
              </div>
            </div>

            {/* Recent referrals */}
            {referralStats.referrals.length > 0 && (
              <div className="mt-5">
                <h4 className="text-sm font-medium text-slate-700 mb-2">Recent Referrals</h4>
                <div className="space-y-2">
                  {referralStats.referrals.slice(0, 5).map((r: any) => (
                    <div
                      key={r.id}
                      className="flex items-center justify-between bg-slate-50 rounded-xl px-3 py-2"
                    >
                      <div>
                        <p className="text-sm font-medium text-slate-800">{r.businessName}</p>
                        <p className="text-xs text-slate-400">
                          {new Date(r.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <span
                        className={cn(
                          'text-xs px-2 py-1 rounded-full font-medium',
                          r.status === 'CREDITED'
                            ? 'bg-sage-50 text-sage-900'
                            : r.status === 'CONVERTED'
                              ? 'bg-amber-50 text-amber-700'
                              : 'bg-lavender-50 text-lavender-900',
                        )}
                      >
                        {r.status === 'CREDITED'
                          ? `+$${r.creditAmount}`
                          : r.status === 'CONVERTED'
                            ? 'Processing'
                            : 'Pending'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
