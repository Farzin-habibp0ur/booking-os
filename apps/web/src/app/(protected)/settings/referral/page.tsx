'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { useToast } from '@/lib/toast';
import { cn } from '@/lib/cn';
import { FormSkeleton } from '@/components/skeleton';
import { trackEvent } from '@/lib/posthog';
import {
  ArrowLeft,
  Gift,
  Users,
  Check,
  DollarSign,
  Info,
  MessageSquare,
  Mail,
  Phone,
  ToggleLeft,
  ToggleRight,
  Clock,
  TrendingUp,
  CreditCard,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface ReferralSettings {
  enabled: boolean;
  referrerCredit: number;
  refereeCredit: number;
  maxReferralsPerCustomer: number;
  creditExpiryMonths: number;
  messageTemplate: string;
  emailSubject: string;
}

interface ReferralReferral {
  id: string;
  referrerName: string;
  referredName: string;
  status: string;
  referrerCreditAmount: number;
  refereeCreditAmount: number;
  createdAt: string;
  completedAt: string | null;
}

interface ReferralStats {
  totalReferrals: number;
  completedReferrals: number;
  pendingReferrals: number;
  totalCreditsIssued: number;
  totalCreditsRedeemed: number;
  recentReferrals: ReferralReferral[];
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const MERGE_VARS = ['{businessName}', '{creditAmount}', '{referralLink}', '{customerName}'];

const ALLOWED_VERTICALS = ['AESTHETIC', 'WELLNESS'];

const EXPIRY_OPTIONS = Array.from({ length: 12 }, (_, i) => i + 1);

const DEFAULT_SETTINGS: ReferralSettings = {
  enabled: false,
  referrerCredit: 25,
  refereeCredit: 25,
  maxReferralsPerCustomer: 0,
  creditExpiryMonths: 6,
  messageTemplate:
    'Hey! I love {businessName} and think you will too. Use my link to book and we both get ${creditAmount} credit: {referralLink} — {customerName}',
  emailSubject: "A friend thinks you'll love {businessName}",
};

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function ReferralSettingsPage() {
  const { t } = useI18n();
  const { toast } = useToast();
  const { user } = useAuth();

  const [settings, setSettings] = useState<ReferralSettings>(DEFAULT_SETTINGS);
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewChannel, setPreviewChannel] = useState<'whatsapp' | 'sms' | 'email'>('whatsapp');

  const isVerticalAllowed = ALLOWED_VERTICALS.includes(
    (user?.business?.verticalPack || '').toUpperCase(),
  );

  /* ---- Data fetching ---- */

  useEffect(() => {
    Promise.all([
      api.get<ReferralSettings>('/referral/settings').catch(() => DEFAULT_SETTINGS),
      api.get<ReferralStats>('/referral/stats').catch(() => null),
    ])
      .then(([cfg, s]) => {
        setSettings(cfg);
        setStats(s);
      })
      .finally(() => setLoading(false));
  }, []);

  /* ---- Handlers ---- */

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await api.patch('/referral/settings', settings);
      toast('Referral settings saved', 'success');
      trackEvent('referral_settings_saved');
    } catch {
      toast('Failed to save referral settings', 'error');
    } finally {
      setSaving(false);
    }
  }, [settings, toast]);

  const insertMergeVar = (v: string) => {
    setSettings((s) => ({
      ...s,
      messageTemplate: s.messageTemplate + v,
    }));
  };

  const clampCredit = (value: number) => Math.max(5, Math.min(500, Math.round(value / 5) * 5));

  const resolvePreview = (template: string) => {
    return template
      .replace(/\{businessName\}/g, user?.business?.name || 'Your Business')
      .replace(/\{creditAmount\}/g, String(settings.referrerCredit))
      .replace(/\{referralLink\}/g, 'https://book.example.com/r/abc123')
      .replace(/\{customerName\}/g, 'Sarah');
  };

  /* ---- Loading ---- */

  if (loading) return <FormSkeleton rows={4} />;

  return (
    <div className="p-6 max-w-2xl">
      {/* Back link */}
      <Link
        href="/marketing"
        className="inline-flex items-center gap-1 text-sm text-sage-600 hover:text-sage-700 dark:text-sage-400 dark:hover:text-sage-300 mb-3 transition-colors"
      >
        <ArrowLeft size={14} />
        Back to Marketing
      </Link>

      {/* Page header */}
      <div className="flex items-center gap-2 mb-6">
        <Gift size={24} className="text-sage-600" />
        <h1 className="text-2xl font-serif font-semibold text-slate-900">
          Patient Referral Program
        </h1>
      </div>

      {/* ============================================================ */}
      {/* Section 1: Enable / Disable Toggle                           */}
      {/* ============================================================ */}
      <div className="bg-white rounded-2xl shadow-soft p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-800">Referral Program</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Let your patients refer friends and family for credit rewards
            </p>
          </div>

          {isVerticalAllowed ? (
            <button
              type="button"
              onClick={() => setSettings((s) => ({ ...s, enabled: !s.enabled }))}
              className="shrink-0"
              aria-label={settings.enabled ? 'Disable referral program' : 'Enable referral program'}
            >
              {settings.enabled ? (
                <ToggleRight size={36} className="text-sage-600" />
              ) : (
                <ToggleLeft size={36} className="text-slate-300" />
              )}
            </button>
          ) : (
            <span className="shrink-0 text-xs bg-slate-100 text-slate-500 px-3 py-1.5 rounded-full font-medium">
              Unavailable
            </span>
          )}
        </div>

        {!isVerticalAllowed && (
          <div className="bg-lavender-50 border border-lavender-100 rounded-xl p-3 mt-4 flex items-start gap-2">
            <Info size={14} className="text-lavender-600 mt-0.5 shrink-0" />
            <p className="text-xs text-lavender-800">
              Referral program is available for Aesthetic and Wellness verticals
            </p>
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/* Section 2: Reward Configuration                              */}
      {/* ============================================================ */}
      <div
        className={cn(
          'bg-white rounded-2xl shadow-soft p-6 mt-6',
          !settings.enabled && 'opacity-50 pointer-events-none',
        )}
      >
        <h2 className="text-sm font-semibold text-slate-800 mb-1">Reward Configuration</h2>
        <p className="text-xs text-slate-500 mb-4">
          Set credit amounts for referrers and their friends
        </p>

        {/* Referrer + Referee credits */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1 block">Referrer earns</label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-500">$</span>
              <input
                type="number"
                min={5}
                max={500}
                step={5}
                value={settings.referrerCredit}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    referrerCredit: clampCredit(Number(e.target.value) || 5),
                  }))
                }
                className="w-24 bg-slate-50 border-transparent focus:bg-white focus:ring-2 focus:ring-sage-500 rounded-xl px-3 py-2 text-sm"
              />
            </div>
            <p className="text-xs text-slate-400 mt-1">Credit given to the patient who refers</p>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700 mb-1 block">Friend earns</label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-500">$</span>
              <input
                type="number"
                min={5}
                max={500}
                step={5}
                value={settings.refereeCredit}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    refereeCredit: clampCredit(Number(e.target.value) || 5),
                  }))
                }
                className="w-24 bg-slate-50 border-transparent focus:bg-white focus:ring-2 focus:ring-sage-500 rounded-xl px-3 py-2 text-sm"
              />
            </div>
            <p className="text-xs text-slate-400 mt-1">Credit given to the referred friend</p>
          </div>
        </div>

        {/* Credit expiry */}
        <div className="mt-5">
          <label className="text-sm font-medium text-slate-700 mb-1 block">
            <Clock size={13} className="inline mr-1 -mt-0.5" />
            Credit expiry
          </label>
          <select
            value={settings.creditExpiryMonths}
            onChange={(e) =>
              setSettings((s) => ({
                ...s,
                creditExpiryMonths: Number(e.target.value),
              }))
            }
            className="bg-slate-50 border-transparent focus:bg-white focus:ring-2 focus:ring-sage-500 rounded-xl px-3 py-2 text-sm w-40"
          >
            {EXPIRY_OPTIONS.map((m) => (
              <option key={m} value={m}>
                {m} {m === 1 ? 'month' : 'months'}
              </option>
            ))}
          </select>
        </div>

        {/* Max referrals */}
        <div className="mt-5">
          <label className="text-sm font-medium text-slate-700 mb-1 block">
            Max referrals per patient
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              max={999}
              value={settings.maxReferralsPerCustomer}
              onChange={(e) =>
                setSettings((s) => ({
                  ...s,
                  maxReferralsPerCustomer: Math.max(0, Number(e.target.value) || 0),
                }))
              }
              className="w-24 bg-slate-50 border-transparent focus:bg-white focus:ring-2 focus:ring-sage-500 rounded-xl px-3 py-2 text-sm"
            />
            <span className="text-xs text-slate-400">0 = unlimited</span>
          </div>
        </div>

        <div className="bg-lavender-50 border border-lavender-100 rounded-xl p-3 mt-5 flex items-start gap-2">
          <Info size={14} className="text-lavender-600 mt-0.5 shrink-0" />
          <p className="text-xs text-lavender-800">
            Credits are applied automatically when a referred friend completes their first booking.
            Both the referrer and friend receive their respective credits.
          </p>
        </div>
      </div>

      {/* ============================================================ */}
      {/* Section 3: Referral Message                                  */}
      {/* ============================================================ */}
      <div
        className={cn(
          'bg-white rounded-2xl shadow-soft p-6 mt-6',
          !settings.enabled && 'opacity-50 pointer-events-none',
        )}
      >
        <h2 className="text-sm font-semibold text-slate-800 mb-1">Referral Message</h2>
        <p className="text-xs text-slate-500 mb-4">
          Customize the message patients send when referring friends
        </p>

        {/* Merge variable chips */}
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

        {/* Template textarea */}
        <textarea
          value={settings.messageTemplate}
          onChange={(e) =>
            setSettings((s) => ({
              ...s,
              messageTemplate: e.target.value.slice(0, 2000),
            }))
          }
          rows={4}
          className="w-full bg-slate-50 border-transparent focus:bg-white focus:ring-2 focus:ring-sage-500 rounded-xl px-3 py-2 text-sm resize-none"
        />
        <div className="flex items-center justify-between mt-1">
          <span className="text-xs text-slate-400">
            {(settings.messageTemplate || '').length} / 2000
          </span>
          {(settings.messageTemplate || '').length <= 160 ? (
            <span className="text-xs text-sage-600">SMS friendly</span>
          ) : (settings.messageTemplate || '').length > 1600 ? (
            <span className="text-xs text-amber-600">Long — may span multiple SMS segments</span>
          ) : null}
        </div>

        {/* Email subject */}
        <div className="mt-4">
          <label className="text-sm font-medium text-slate-700 mb-1 block">Email Subject</label>
          <input
            type="text"
            value={settings.emailSubject}
            onChange={(e) =>
              setSettings((s) => ({
                ...s,
                emailSubject: e.target.value.slice(0, 200),
              }))
            }
            placeholder="A friend thinks you'll love {businessName}"
            className="w-full bg-slate-50 border-transparent focus:bg-white focus:ring-2 focus:ring-sage-500 rounded-xl px-3 py-2 text-sm"
          />
        </div>

        {/* Live Preview with channel tabs */}
        <div className="mt-5">
          <p className="text-xs font-medium text-slate-600 mb-2">Live Preview</p>
          <div className="flex gap-1.5 mb-3">
            {(['whatsapp', 'sms', 'email'] as const).map((ch) => {
              const Icon = ch === 'whatsapp' ? MessageSquare : ch === 'sms' ? Phone : Mail;
              return (
                <button
                  key={ch}
                  onClick={() => setPreviewChannel(ch)}
                  className={cn(
                    'inline-flex items-center gap-1 text-xs px-3 py-1 rounded-full transition-colors capitalize',
                    previewChannel === ch
                      ? 'bg-sage-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                  )}
                >
                  <Icon size={12} />
                  {ch}
                </button>
              );
            })}
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
                Subject: {resolvePreview(settings.emailSubject)}
              </p>
            )}
            <p className="whitespace-pre-wrap text-sm">
              {resolvePreview(settings.messageTemplate)}
            </p>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* Section 4: Referral Activity                                 */}
      {/* ============================================================ */}
      {stats && (
        <div
          className={cn(
            'bg-white rounded-2xl shadow-soft p-6 mt-6',
            !settings.enabled && 'opacity-50 pointer-events-none',
          )}
        >
          <h2 className="text-sm font-semibold text-slate-800 mb-4">Referral Activity</h2>

          {/* Stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-50 rounded-xl p-3 text-center">
              <div className="flex items-center justify-center gap-1 text-slate-400 mb-1">
                <Users size={13} />
                <span className="text-[11px]">Total</span>
              </div>
              <p className="text-xl font-serif font-semibold text-slate-900">
                {stats.totalReferrals}
              </p>
            </div>
            <div className="bg-slate-50 rounded-xl p-3 text-center">
              <div className="flex items-center justify-center gap-1 text-slate-400 mb-1">
                <Check size={13} />
                <span className="text-[11px]">Completed</span>
              </div>
              <p className="text-xl font-serif font-semibold text-sage-600">
                {stats.completedReferrals}
              </p>
            </div>
            <div className="bg-slate-50 rounded-xl p-3 text-center">
              <div className="flex items-center justify-center gap-1 text-slate-400 mb-1">
                <TrendingUp size={13} />
                <span className="text-[11px]">Issued</span>
              </div>
              <p className="text-xl font-serif font-semibold text-sage-600">
                ${stats.totalCreditsIssued}
              </p>
            </div>
            <div className="bg-slate-50 rounded-xl p-3 text-center">
              <div className="flex items-center justify-center gap-1 text-slate-400 mb-1">
                <CreditCard size={13} />
                <span className="text-[11px]">Redeemed</span>
              </div>
              <p className="text-xl font-serif font-semibold text-sage-600">
                ${stats.totalCreditsRedeemed}
              </p>
            </div>
          </div>

          {/* Recent referrals table */}
          {stats.recentReferrals.length > 0 && (
            <div className="mt-5">
              <h3 className="text-xs font-medium text-slate-500 mb-2 uppercase tracking-wider">
                Recent Referrals
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-slate-400 border-b border-slate-100">
                      <th className="pb-2 font-medium">Referrer</th>
                      <th className="pb-2 font-medium">Referred</th>
                      <th className="pb-2 font-medium">Status</th>
                      <th className="pb-2 font-medium text-right">Credit</th>
                      <th className="pb-2 font-medium text-right">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {stats.recentReferrals.map((r) => (
                      <tr key={r.id}>
                        <td className="py-2.5 text-slate-800 font-medium">{r.referrerName}</td>
                        <td className="py-2.5 text-slate-600">
                          {r.referredName || <span className="text-slate-400 italic">Pending</span>}
                        </td>
                        <td className="py-2.5">
                          <span
                            className={cn(
                              'text-xs px-2 py-0.5 rounded-full font-medium',
                              r.status === 'COMPLETED'
                                ? 'bg-sage-50 text-sage-900'
                                : r.status === 'PENDING'
                                  ? 'bg-lavender-50 text-lavender-900'
                                  : 'bg-red-50 text-red-700',
                            )}
                          >
                            {r.status === 'COMPLETED'
                              ? 'Completed'
                              : r.status === 'PENDING'
                                ? 'Pending'
                                : 'Expired'}
                          </span>
                        </td>
                        <td className="py-2.5 text-right text-slate-700">
                          ${r.referrerCreditAmount}
                        </td>
                        <td className="py-2.5 text-right text-slate-400 text-xs">
                          {new Date(r.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* Save Button                                                  */}
      {/* ============================================================ */}
      <div className="flex items-center gap-3 mt-6 pb-6">
        <button
          onClick={handleSave}
          disabled={saving || !isVerticalAllowed}
          className={cn(
            'bg-sage-600 text-white px-5 py-2 rounded-xl text-sm font-medium hover:bg-sage-700 transition-colors',
            (saving || !isVerticalAllowed) && 'opacity-50 cursor-not-allowed',
          )}
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}
