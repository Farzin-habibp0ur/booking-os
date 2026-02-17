'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
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
} from 'lucide-react';
import { useI18n } from '@/lib/i18n';

export default function SettingsPage() {
  const { t } = useI18n();
  const router = useRouter();
  const { user } = useAuth();
  const role = user?.role;
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

  useEffect(() => {
    api.get<any>('/business').then((b) => {
      setBusiness(b);
      setName(b.name);
      setPhone(b.phone || '');
      setTimezone(b.timezone);
    });
  }, []);

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
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-serif font-semibold text-slate-900 mb-6">
        {t('settings.title')}
      </h1>

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
          <label className="block text-sm font-medium mb-1">{t('settings.current_password')}</label>
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
          <label className="block text-sm font-medium mb-1">{t('settings.confirm_password')}</label>
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

      {/* Quick links */}
      <div className="bg-white rounded-2xl shadow-soft p-6 mt-6">
        <h2 className="font-semibold mb-3">{t('settings.more_settings')}</h2>
        <div className="space-y-2">
          {(role === 'ADMIN' || role === 'AGENT') && (
            <button
              onClick={() => router.push('/settings/templates')}
              className="flex items-center gap-3 w-full text-left p-3 rounded-xl hover:bg-slate-50 border border-slate-100 transition-colors"
            >
              <div className="w-9 h-9 bg-sage-50 rounded-lg flex items-center justify-center">
                <FileText size={18} className="text-sage-600" />
              </div>
              <div>
                <p className="text-sm font-medium">{t('settings.message_templates')}</p>
                <p className="text-xs text-slate-500">{t('settings.message_templates_desc')}</p>
              </div>
            </button>
          )}
          {role === 'ADMIN' && (
            <button
              onClick={() => router.push('/settings/notifications')}
              className="flex items-center gap-3 w-full text-left p-3 rounded-xl hover:bg-slate-50 border border-slate-100 transition-colors"
            >
              <div className="w-9 h-9 bg-sage-50 rounded-lg flex items-center justify-center">
                <Bell size={18} className="text-sage-600" />
              </div>
              <div>
                <p className="text-sm font-medium">{t('settings.notifications')}</p>
                <p className="text-xs text-slate-500">{t('settings.notifications_desc')}</p>
              </div>
            </button>
          )}
          {role === 'ADMIN' && (
            <button
              onClick={() => router.push('/settings/policies')}
              className="flex items-center gap-3 w-full text-left p-3 rounded-xl hover:bg-slate-50 border border-slate-100 transition-colors"
            >
              <div className="w-9 h-9 bg-orange-50 rounded-lg flex items-center justify-center">
                <ShieldCheck size={18} className="text-orange-600" />
              </div>
              <div>
                <p className="text-sm font-medium">{t('settings.policies')}</p>
                <p className="text-xs text-slate-500">{t('settings.policies_desc')}</p>
              </div>
            </button>
          )}
          {role === 'ADMIN' && (
            <button
              onClick={() => router.push('/settings/waitlist')}
              className="flex items-center gap-3 w-full text-left p-3 rounded-xl hover:bg-slate-50 border border-slate-100 transition-colors"
            >
              <div className="w-9 h-9 bg-sage-50 rounded-lg flex items-center justify-center">
                <ClipboardList size={18} className="text-sage-600" />
              </div>
              <div>
                <p className="text-sm font-medium">Waitlist</p>
                <p className="text-xs text-slate-500">Configure backfill offers and quiet hours</p>
              </div>
            </button>
          )}
          {role === 'ADMIN' && (
            <button
              onClick={() => router.push('/settings/offers')}
              className="flex items-center gap-3 w-full text-left p-3 rounded-xl hover:bg-slate-50 border border-slate-100 transition-colors"
            >
              <div className="w-9 h-9 bg-sage-50 rounded-lg flex items-center justify-center">
                <Tag size={18} className="text-sage-600" />
              </div>
              <div>
                <p className="text-sm font-medium">Offers</p>
                <p className="text-xs text-slate-500">Create and manage promotional offers</p>
              </div>
            </button>
          )}
          {(role === 'ADMIN' || role === 'SERVICE_PROVIDER') && (
            <button
              onClick={() => router.push('/settings/calendar')}
              className="flex items-center gap-3 w-full text-left p-3 rounded-xl hover:bg-slate-50 border border-slate-100 transition-colors"
            >
              <div className="w-9 h-9 bg-sage-50 rounded-lg flex items-center justify-center">
                <CalendarDays size={18} className="text-sage-600" />
              </div>
              <div>
                <p className="text-sm font-medium">{t('settings.calendar_sync')}</p>
                <p className="text-xs text-slate-500">{t('settings.calendar_sync_desc')}</p>
              </div>
            </button>
          )}
          {role === 'ADMIN' && (
            <button
              onClick={() => router.push('/settings/translations')}
              className="flex items-center gap-3 w-full text-left p-3 rounded-xl hover:bg-slate-50 border border-slate-100 transition-colors"
            >
              <div className="w-9 h-9 bg-lavender-50 rounded-lg flex items-center justify-center">
                <Languages size={18} className="text-lavender-600" />
              </div>
              <div>
                <p className="text-sm font-medium">{t('settings.translations')}</p>
                <p className="text-xs text-slate-500">{t('settings.translations_desc')}</p>
              </div>
            </button>
          )}
          <button
            onClick={() => router.push('/settings/profile-fields')}
            className="flex items-center gap-3 w-full text-left p-3 rounded-xl hover:bg-slate-50 border border-slate-100 transition-colors"
          >
            <div className="w-9 h-9 bg-teal-50 rounded-lg flex items-center justify-center">
              <ClipboardCheck size={18} className="text-teal-600" />
            </div>
            <div>
              <p className="text-sm font-medium">{t('settings.profile_fields')}</p>
              <p className="text-xs text-slate-500">{t('settings.profile_fields_desc')}</p>
            </div>
          </button>
          {role === 'ADMIN' && (
            <button
              onClick={() => router.push('/settings/ai')}
              className="flex items-center gap-3 w-full text-left p-3 rounded-xl hover:bg-slate-50 border border-slate-100 transition-colors"
            >
              <div className="w-9 h-9 bg-lavender-50 rounded-lg flex items-center justify-center">
                <Sparkles size={18} className="text-lavender-600" />
              </div>
              <div>
                <p className="text-sm font-medium">{t('settings.ai_settings')}</p>
                <p className="text-xs text-slate-500">{t('settings.ai_settings_desc')}</p>
              </div>
            </button>
          )}
          <button
            onClick={() => router.push('/settings/account')}
            className="flex items-center gap-3 w-full text-left p-3 rounded-xl hover:bg-slate-50 border border-slate-100 transition-colors"
          >
            <div className="w-9 h-9 bg-green-50 rounded-lg flex items-center justify-center">
              <Upload size={18} className="text-sage-600" />
            </div>
            <div>
              <p className="text-sm font-medium">{t('settings.account_import')}</p>
              <p className="text-xs text-slate-500">{t('settings.account_import_desc')}</p>
            </div>
          </button>
          {role === 'ADMIN' && (
            <button
              onClick={() => router.push('/settings/billing')}
              className="flex items-center gap-3 w-full text-left p-3 rounded-xl hover:bg-slate-50 border border-slate-100 transition-colors"
            >
              <div className="w-9 h-9 bg-amber-50 rounded-lg flex items-center justify-center">
                <CreditCard size={18} className="text-amber-600" />
              </div>
              <div>
                <p className="text-sm font-medium">{t('settings.billing')}</p>
                <p className="text-xs text-slate-500">{t('settings.billing_desc')}</p>
              </div>
            </button>
          )}
          {role === 'ADMIN' && (
            <button
              onClick={() => router.push('/setup')}
              className="flex items-center gap-3 w-full text-left p-3 rounded-xl hover:bg-slate-50 border border-slate-100 transition-colors"
            >
              <div className="w-9 h-9 bg-orange-50 rounded-lg flex items-center justify-center">
                <Settings2 size={18} className="text-orange-600" />
              </div>
              <div>
                <p className="text-sm font-medium">{t('settings.setup_wizard')}</p>
                <p className="text-xs text-slate-500">{t('settings.setup_wizard_desc')}</p>
              </div>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
