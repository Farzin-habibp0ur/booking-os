'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/cn';
import { FormSkeleton } from '@/components/skeleton';
import { trackEvent } from '@/lib/posthog';
import {
  ArrowLeft,
  Gift,
  Users,
  Check,
  DollarSign,
  Copy,
  MessageSquare,
  Mail,
  Phone,
  Radio,
  Info,
} from 'lucide-react';

interface ReferralSettings {
  creditAmount: number;
  messageTemplate: string;
  sharingMethod: string;
  emailSubject: string;
}

interface ReferralStats {
  referralCode: string;
  referralLink: string;
  totalInvites: number;
  successfulReferrals: number;
  pendingReferrals: number;
  totalCreditsEarned: number;
  referrals: {
    id: string;
    status: string;
    creditAmount: number;
    businessName: string;
    createdAt: string;
    convertedAt: string | null;
    creditedAt: string | null;
  }[];
}

const SHARING_OPTIONS = [
  {
    value: 'manual',
    label: 'Manual (Copy Link)',
    desc: 'Business owner copies and shares the link themselves',
    icon: Copy,
    comingSoon: false,
  },
  {
    value: 'whatsapp',
    label: 'WhatsApp',
    desc: 'Send referral invites via WhatsApp',
    icon: MessageSquare,
    comingSoon: true,
  },
  {
    value: 'sms',
    label: 'SMS',
    desc: 'Send referral invites via text message',
    icon: Phone,
    comingSoon: true,
  },
  {
    value: 'email',
    label: 'Email',
    desc: 'Send referral invites via email',
    icon: Mail,
    comingSoon: true,
  },
];

const MERGE_VARS = ['{businessName}', '{creditAmount}', '{referralLink}', '{ownerName}'];

export default function ReferralSettingsPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [settings, setSettings] = useState<ReferralSettings>({
    creditAmount: 50,
    messageTemplate:
      "Hey! I've been using {businessName} to manage my appointments and it's been amazing. Sign up with my link and we both get ${creditAmount} credit: {referralLink}",
    sharingMethod: 'manual',
    emailSubject: '',
  });
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [previewChannel, setPreviewChannel] = useState<'whatsapp' | 'sms' | 'email'>('whatsapp');
  const [businessName, setBusinessName] = useState('');

  useEffect(() => {
    Promise.all([
      api.get<ReferralStats>('/referral/stats'),
      api.get<ReferralSettings>('/referral/settings'),
      api.get<any>('/business'),
    ])
      .then(([s, cfg, biz]) => {
        setStats(s);
        setSettings(cfg);
        setBusinessName(biz.name || '');
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    await api.patch('/referral/settings', settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleCopyLink = () => {
    if (!stats) return;
    navigator.clipboard.writeText(stats.referralLink);
    setCopied(true);
    trackEvent('referral_link_copied');
    setTimeout(() => setCopied(false), 2000);
  };

  const insertMergeVar = (v: string) => {
    setSettings((s) => ({
      ...s,
      messageTemplate: s.messageTemplate + v,
    }));
  };

  const resolvePreview = (template: string) => {
    return template
      .replace(/\{businessName\}/g, businessName || 'Your Business')
      .replace(/\{creditAmount\}/g, String(settings.creditAmount))
      .replace(/\{referralLink\}/g, stats?.referralLink || 'https://...')
      .replace(/\{ownerName\}/g, user?.name || 'Owner');
  };

  if (loading) return <FormSkeleton rows={4} />;

  return (
    <div className="p-6 max-w-2xl">
      <Link
        href="/settings"
        className="inline-flex items-center gap-1 text-sm text-sage-600 hover:text-sage-700 dark:text-sage-400 dark:hover:text-sage-300 mb-3 transition-colors"
      >
        <ArrowLeft size={14} />
        Back to Settings
      </Link>
      <div className="flex items-center gap-2 mb-6">
        <Gift size={24} className="text-sage-600" />
        <h1 className="text-2xl font-serif font-semibold text-slate-900">
          {t('settings.referral.title')}
        </h1>
      </div>

      {/* Section 1: Your Referral Link */}
      <div className="bg-white rounded-2xl shadow-soft p-6">
        <h2 className="text-sm font-semibold text-slate-800 mb-1">
          {t('settings.referral.link_title')}
        </h2>
        <p className="text-xs text-slate-500 mb-4">{t('settings.referral.link_desc')}</p>
        <div className="flex items-center gap-2">
          <input
            readOnly
            value={stats?.referralLink || ''}
            className="flex-1 bg-slate-50 rounded-xl px-3 py-2 text-sm border border-slate-200"
          />
          <button
            onClick={handleCopyLink}
            className="bg-sage-600 hover:bg-sage-700 text-white rounded-xl px-4 py-2 text-sm transition-colors whitespace-nowrap"
          >
            {copied ? t('settings.copied') : t('settings.copy_link')}
          </button>
        </div>

        <div className="grid grid-cols-3 gap-4 mt-5">
          <div className="bg-slate-50 rounded-xl p-3 text-center">
            <div className="flex items-center justify-center gap-1 text-slate-400 mb-1">
              <Users size={14} />
              <span className="text-xs">Invites</span>
            </div>
            <p className="text-xl font-serif font-semibold text-slate-900">
              {stats?.totalInvites ?? 0}
            </p>
          </div>
          <div className="bg-slate-50 rounded-xl p-3 text-center">
            <div className="flex items-center justify-center gap-1 text-slate-400 mb-1">
              <Check size={14} />
              <span className="text-xs">Converted</span>
            </div>
            <p className="text-xl font-serif font-semibold text-sage-600">
              {stats?.successfulReferrals ?? 0}
            </p>
          </div>
          <div className="bg-slate-50 rounded-xl p-3 text-center">
            <div className="flex items-center justify-center gap-1 text-slate-400 mb-1">
              <DollarSign size={14} />
              <span className="text-xs">Credits</span>
            </div>
            <p className="text-xl font-serif font-semibold text-sage-600">
              ${stats?.totalCreditsEarned ?? 0}
            </p>
          </div>
        </div>
      </div>

      {/* Section 2: Reward Settings */}
      <div className="bg-white rounded-2xl shadow-soft p-6 mt-6">
        <h2 className="text-sm font-semibold text-slate-800 mb-1">
          {t('settings.referral.reward_title')}
        </h2>
        <p className="text-xs text-slate-500 mb-4">{t('settings.referral.reward_desc')}</p>

        <div>
          <label className="text-sm font-medium text-slate-700 mb-1 block">
            {t('settings.referral.credit_label')}
          </label>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500">$</span>
            <input
              type="number"
              min={5}
              max={500}
              step={5}
              value={settings.creditAmount}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  creditAmount: Math.max(5, Math.min(500, Number(e.target.value) || 5)),
                })
              }
              className="w-24 border border-slate-200 rounded-xl px-3 py-2 text-sm"
            />
          </div>
          <p className="text-xs text-slate-400 mt-2">{t('settings.referral.credit_help')}</p>
        </div>

        <div className="bg-lavender-50 border border-lavender-100 rounded-xl p-3 mt-4 flex items-start gap-2">
          <Info size={14} className="text-lavender-600 mt-0.5 shrink-0" />
          <p className="text-xs text-lavender-800">{t('settings.referral.info_note')}</p>
        </div>
      </div>

      {/* Section 3: Invite Message */}
      <div className="bg-white rounded-2xl shadow-soft p-6 mt-6">
        <h2 className="text-sm font-semibold text-slate-800 mb-1">
          {t('settings.referral.message_title')}
        </h2>
        <p className="text-xs text-slate-500 mb-4">{t('settings.referral.message_desc')}</p>

        <div className="flex flex-wrap gap-1.5 mb-3">
          {MERGE_VARS.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => insertMergeVar(v)}
              className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 px-2 py-1 rounded-lg transition-colors"
            >
              {v}
            </button>
          ))}
        </div>

        <textarea
          value={settings.messageTemplate}
          onChange={(e) =>
            setSettings({ ...settings, messageTemplate: e.target.value.slice(0, 2000) })
          }
          rows={4}
          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-sage-500"
        />
        <div className="flex items-center justify-between mt-1">
          <span className="text-xs text-slate-400">{settings.messageTemplate.length} / 2000</span>
          {settings.messageTemplate.length <= 160 ? (
            <span className="text-xs text-sage-600">{t('settings.referral.sms_friendly')}</span>
          ) : settings.messageTemplate.length > 1600 ? (
            <span className="text-xs text-amber-600">
              {t('settings.referral.sms_multi_segment')}
            </span>
          ) : null}
        </div>

        {/* Live Preview */}
        <div className="mt-4">
          <p className="text-xs font-medium text-slate-600 mb-2">
            {t('settings.referral.preview')}
          </p>
          <div className="flex gap-1.5 mb-3">
            {(['whatsapp', 'sms', 'email'] as const).map((ch) => (
              <button
                key={ch}
                onClick={() => setPreviewChannel(ch)}
                className={cn(
                  'text-xs px-3 py-1 rounded-full transition-colors capitalize',
                  previewChannel === ch
                    ? 'bg-sage-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                )}
              >
                {ch}
              </button>
            ))}
          </div>
          <div
            className={cn(
              'rounded-xl p-3 text-sm',
              previewChannel === 'whatsapp'
                ? 'bg-green-50 text-green-900'
                : previewChannel === 'email'
                  ? 'bg-white border border-slate-200'
                  : 'bg-slate-50 text-slate-800',
            )}
          >
            {previewChannel === 'email' && settings.emailSubject && (
              <p className="text-xs font-medium text-slate-500 mb-2">
                Subject: {settings.emailSubject}
              </p>
            )}
            <p className="whitespace-pre-wrap text-sm">
              {resolvePreview(settings.messageTemplate)}
            </p>
          </div>
        </div>
      </div>

      {/* Section 4: Sharing Method */}
      <div className="bg-white rounded-2xl shadow-soft p-6 mt-6">
        <h2 className="text-sm font-semibold text-slate-800 mb-1">
          {t('settings.referral.sharing_title')}
        </h2>
        <p className="text-xs text-slate-500 mb-4">{t('settings.referral.sharing_desc')}</p>

        <div className="space-y-2">
          {SHARING_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className={cn(
                'flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors',
                settings.sharingMethod === opt.value
                  ? 'border-sage-300 bg-sage-50/50'
                  : 'border-slate-200 hover:bg-slate-50',
              )}
            >
              <input
                type="radio"
                name="sharingMethod"
                value={opt.value}
                checked={settings.sharingMethod === opt.value}
                onChange={(e) => setSettings({ ...settings, sharingMethod: e.target.value })}
                className="accent-sage-600"
              />
              <opt.icon size={16} className="text-slate-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-800">{opt.label}</span>
                  {opt.comingSoon && (
                    <span className="text-[10px] bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded-full font-medium">
                      {t('settings.referral.coming_soon')}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500">{opt.desc}</p>
              </div>
            </label>
          ))}
        </div>

        {settings.sharingMethod !== 'manual' && (
          <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 mt-3 flex items-start gap-2">
            <Info size={14} className="text-amber-600 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-800">{t('settings.referral.channel_note')}</p>
          </div>
        )}

        {previewChannel === 'email' && settings.sharingMethod === 'email' && (
          <div className="mt-4">
            <label className="text-sm font-medium text-slate-700 mb-1 block">Email Subject</label>
            <input
              type="text"
              value={settings.emailSubject}
              onChange={(e) =>
                setSettings({ ...settings, emailSubject: e.target.value.slice(0, 200) })
              }
              placeholder="Join us on BookingOS!"
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-500"
            />
          </div>
        )}
      </div>

      {/* Section 5: Recent Referrals */}
      {stats && stats.referrals.length > 0 && (
        <div className="bg-white rounded-2xl shadow-soft p-6 mt-6">
          <h2 className="text-sm font-semibold text-slate-800 mb-3">
            {t('settings.referral.recent')}
          </h2>
          <div className="space-y-2">
            {stats.referrals.slice(0, 5).map((r) => (
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

      {/* Save Button */}
      <div className="flex items-center gap-3 mt-6">
        <button
          onClick={handleSave}
          className="bg-sage-600 text-white px-4 py-2 rounded-xl text-sm hover:bg-sage-700 transition-colors"
        >
          {t('settings.referral.save')}
        </button>
        {saved && <span className="text-sage-600 text-sm">{t('settings.referral.saved')}</span>}
      </div>
    </div>
  );
}
