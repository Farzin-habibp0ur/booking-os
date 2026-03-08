'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import {
  CreditCard,
  Loader2,
  Check,
  ExternalLink,
  ArrowLeft,
  Sparkles,
  Clock,
} from 'lucide-react';

type PlanTier = 'starter' | 'professional' | 'enterprise';
type BillingInterval = 'monthly' | 'annual';

interface BillingStatus {
  plan: PlanTier;
  status: string;
  isTrial: boolean;
  trialDaysRemaining: number;
  trialEndsAt: string | null;
  isGracePeriod: boolean;
  graceEndsAt: string | null;
  subscription: {
    id: string;
    plan: PlanTier;
    status: string;
    currentPeriodEnd: string;
    canceledAt: string | null;
  } | null;
}

const PLANS: {
  id: PlanTier;
  label: string;
  monthlyPrice: number;
  annualPrice: number;
  features: string[];
  highlighted?: boolean;
}[] = [
  {
    id: 'starter',
    label: 'Starter',
    monthlyPrice: 49,
    annualPrice: 39,
    features: [
      '1 staff member',
      'Up to 50 clients',
      'Online booking page',
      'Email notifications',
      'Basic reports',
      'Calendar sync',
    ],
  },
  {
    id: 'professional',
    label: 'Professional',
    monthlyPrice: 99,
    annualPrice: 79,
    highlighted: true,
    features: [
      'Up to 5 staff members',
      'Unlimited clients',
      'WhatsApp inbox',
      'AI auto-replies & assistant',
      'Campaigns & templates',
      'Advanced reports',
      '3 background AI agents',
    ],
  },
  {
    id: 'enterprise',
    label: 'Enterprise',
    monthlyPrice: 199,
    annualPrice: 159,
    features: [
      'Unlimited staff',
      'Unlimited clients',
      'Multi-location support',
      'API access & integrations',
      'White-label booking',
      'Unlimited AI agents',
      'Dedicated account manager',
    ],
  },
];

// M11 fix: Validate redirect URL to prevent open redirect via compromised API response
function isValidStripeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && parsed.hostname.endsWith('.stripe.com');
  } catch {
    return false;
  }
}

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-sage-50 text-sage-900',
  trialing: 'bg-lavender-50 text-lavender-900',
  past_due: 'bg-amber-50 text-amber-700',
  canceled: 'bg-red-50 text-red-700',
};

const STATUS_LABELS: Record<string, string> = {
  active: 'Active',
  trialing: 'Trialing',
  past_due: 'Past Due',
  canceled: 'Canceled',
};

export default function BillingPage() {
  const { t } = useI18n();
  const router = useRouter();
  const { user } = useAuth();
  const [billing, setBilling] = useState<BillingStatus | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [billingInterval, setBillingInterval] = useState<BillingInterval>('monthly');

  useEffect(() => {
    if (user && user.role !== 'ADMIN') {
      router.replace('/settings');
      return;
    }
    api
      .get<BillingStatus>('/billing/status')
      .then((status) => {
        setBilling(status);
        setLoaded(true);
      })
      .catch(() => {
        setLoaded(true);
      });
  }, []);

  const handleCheckout = async (plan: PlanTier) => {
    setActionLoading(`checkout-${plan}`);
    setError(null);
    try {
      const { url } = await api.post<{ url: string }>('/billing/checkout', {
        plan,
        billing: billingInterval,
      });
      if (!isValidStripeUrl(url)) {
        setError(t('billing.checkout_error'));
        setActionLoading(null);
        return;
      }
      window.location.href = url;
    } catch {
      setError(t('billing.checkout_error'));
      setActionLoading(null);
    }
  };

  const handlePortal = async () => {
    setActionLoading('portal');
    setError(null);
    try {
      const { url } = await api.post<{ url: string }>('/billing/portal');
      if (!isValidStripeUrl(url)) {
        setError(t('billing.portal_error'));
        setActionLoading(null);
        return;
      }
      window.location.href = url;
    } catch {
      setError(t('billing.portal_error'));
      setActionLoading(null);
    }
  };

  if (!loaded) {
    return (
      <div className="p-6 max-w-5xl">
        <div className="flex items-center gap-2 mb-6">
          <CreditCard size={24} className="text-amber-600" />
          <h1 className="text-2xl font-serif font-semibold text-slate-900 dark:text-slate-100">
            {t('billing.title')}
          </h1>
        </div>
        <div className="flex items-center justify-center py-12">
          <Loader2 size={24} className="animate-spin text-slate-400" />
        </div>
      </div>
    );
  }

  const subscription = billing?.subscription;
  const hasWarning = subscription && (subscription.status === 'past_due' || subscription.status === 'canceled');

  return (
    <div className="p-6 max-w-5xl">
      <Link
        href="/settings"
        className="inline-flex items-center gap-1 text-sm text-sage-600 hover:text-sage-700 dark:text-sage-400 dark:hover:text-sage-300 mb-3 transition-colors"
      >
        <ArrowLeft size={14} />
        Back to Settings
      </Link>
      <div className="flex items-center gap-2 mb-6">
        <CreditCard size={24} className="text-amber-600" />
        <h1 className="text-2xl font-serif font-semibold text-slate-900 dark:text-slate-100">
          {t('billing.title')}
        </h1>
      </div>

      {error && <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm mb-4">{error}</div>}

      {/* Trial info banner */}
      {billing?.isTrial && (
        <div className="bg-lavender-50 border border-lavender-200 rounded-xl p-4 mb-6 flex items-center gap-3">
          <Clock size={20} className="text-lavender-600 shrink-0" />
          <div>
            <p className="text-sm font-medium text-lavender-800">
              {billing.trialDaysRemaining} day{billing.trialDaysRemaining !== 1 ? 's' : ''} left in
              your free trial
            </p>
            <p className="text-xs text-lavender-600 mt-0.5">
              All features are unlocked during your trial. Choose a plan below to continue after it
              ends.
            </p>
          </div>
        </div>
      )}

      {/* Grace period warning */}
      {billing?.isGracePeriod && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
          <p className="text-sm font-medium text-red-700">
            Your trial has ended. You have read-only access during the grace period. Subscribe now to
            keep all your data and features.
          </p>
        </div>
      )}

      {/* Warning banner for past_due / canceled */}
      {hasWarning && (
        <div
          className={`rounded-xl p-4 mb-6 ${
            subscription.status === 'past_due'
              ? 'bg-amber-50 border border-amber-200'
              : 'bg-red-50 border border-red-200'
          }`}
          data-testid="warning-banner"
        >
          <p
            className={`text-sm font-medium ${
              subscription.status === 'past_due' ? 'text-amber-700' : 'text-red-700'
            }`}
          >
            {subscription.status === 'past_due'
              ? t('billing.past_due_warning')
              : t('billing.canceled_warning')}
          </p>
          <button
            onClick={handlePortal}
            disabled={actionLoading !== null}
            className={`mt-2 text-sm underline ${
              subscription.status === 'past_due' ? 'text-amber-700' : 'text-red-700'
            }`}
          >
            {t('billing.manage_billing')}
          </button>
        </div>
      )}

      {/* Current subscription card */}
      {subscription && subscription.status !== 'canceled' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-soft p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {PLANS.find((p) => p.id === billing?.plan)?.label || billing?.plan} Plan
              </h3>
              <p className="text-sm text-slate-500 mt-1">
                Renews on {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
              </p>
            </div>
            <span
              className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_COLORS[subscription.status] || ''}`}
            >
              {STATUS_LABELS[subscription.status] || subscription.status}
            </span>
          </div>
          <div className="flex gap-3 mt-4">
            <button
              onClick={handlePortal}
              disabled={actionLoading !== null}
              className="border border-slate-200 dark:border-slate-700 px-4 py-2 rounded-xl text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {actionLoading === 'portal' && <Loader2 size={14} className="animate-spin" />}
              <ExternalLink size={14} />
              {t('billing.manage_billing')}
            </button>
          </div>
        </div>
      )}

      {/* Billing interval toggle */}
      <div className="flex items-center justify-center gap-3 mb-6">
        <button
          onClick={() => setBillingInterval('monthly')}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
            billingInterval === 'monthly'
              ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
              : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          Monthly
        </button>
        <button
          onClick={() => setBillingInterval('annual')}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors flex items-center gap-1.5 ${
            billingInterval === 'annual'
              ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
              : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          Annual
          <span className="text-xs bg-sage-100 text-sage-700 px-1.5 py-0.5 rounded-full">
            Save 20%
          </span>
        </button>
      </div>

      {/* Plan cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {PLANS.map((plan) => {
          const price = billingInterval === 'annual' ? plan.annualPrice : plan.monthlyPrice;
          const isCurrentPlan = billing?.plan === plan.id && subscription?.status === 'active';

          return (
            <div
              key={plan.id}
              className={`bg-white dark:bg-slate-900 rounded-2xl shadow-soft p-6 flex flex-col ${
                plan.highlighted ? 'ring-2 ring-sage-500' : ''
              }`}
            >
              {plan.highlighted && (
                <div className="flex items-center gap-1.5 mb-3">
                  <Sparkles size={14} className="text-sage-600" />
                  <span className="text-xs font-medium text-sage-700">Most Popular</span>
                </div>
              )}

              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {plan.label}
              </h3>
              <div className="mt-2">
                <span className="text-3xl font-serif font-semibold text-slate-900 dark:text-slate-100">
                  ${price}
                </span>
                <span className="text-sm text-slate-500">/mo</span>
                {billingInterval === 'annual' && (
                  <span className="text-xs text-slate-400 ml-1">billed annually</span>
                )}
              </div>

              <ul className="mt-5 space-y-2.5 flex-1">
                {plan.features.map((feature) => (
                  <li
                    key={feature}
                    className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400"
                  >
                    <Check size={16} className="text-sage-600 mt-0.5 shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              {isCurrentPlan ? (
                <div className="mt-6 text-center py-2.5 rounded-xl text-sm font-medium bg-sage-50 text-sage-700 border border-sage-200">
                  Current Plan
                </div>
              ) : (
                <button
                  onClick={() => handleCheckout(plan.id)}
                  disabled={actionLoading !== null}
                  className={`w-full mt-6 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2 ${
                    plan.highlighted
                      ? 'bg-sage-600 text-white hover:bg-sage-700'
                      : 'bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100'
                  }`}
                >
                  {actionLoading === `checkout-${plan.id}` && (
                    <Loader2 size={14} className="animate-spin" />
                  )}
                  {subscription ? 'Switch Plan' : 'Subscribe'}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
