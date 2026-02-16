'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { CreditCard, Loader2, Check, ExternalLink } from 'lucide-react';

interface Subscription {
  plan: 'basic' | 'pro';
  status: 'active' | 'trialing' | 'past_due' | 'canceled';
  currentPeriodEnd: string;
}

const PLANS = [
  {
    id: 'basic' as const,
    priceKey: 'billing.basic_price',
    features: [
      'billing.feature_bookings',
      'billing.feature_customers',
      'billing.feature_inbox',
      'billing.feature_reports',
    ],
  },
  {
    id: 'pro' as const,
    priceKey: 'billing.pro_price',
    features: [
      'billing.feature_everything_basic',
      'billing.feature_ai',
      'billing.feature_api',
      'billing.feature_priority_support',
    ],
    recommended: true,
  },
];

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-sage-50 text-sage-900',
  trialing: 'bg-lavender-50 text-lavender-900',
  past_due: 'bg-amber-50 text-amber-700',
  canceled: 'bg-red-50 text-red-700',
};

export default function BillingPage() {
  const { t } = useI18n();
  const router = useRouter();
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user && user.role !== 'ADMIN') {
      router.replace('/settings');
      return;
    }
    api
      .get<Subscription | null>('/billing/subscription')
      .then((sub) => {
        setSubscription(sub);
        setLoaded(true);
      })
      .catch(() => {
        setLoaded(true);
      });
  }, []);

  const handleCheckout = async (plan: 'basic' | 'pro') => {
    setActionLoading(`checkout-${plan}`);
    setError(null);
    try {
      const { url } = await api.post<{ url: string }>('/billing/checkout', { plan });
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
      window.location.href = url;
    } catch {
      setError(t('billing.portal_error'));
      setActionLoading(null);
    }
  };

  if (!loaded) {
    return (
      <div className="p-6 max-w-3xl">
        <div className="flex items-center gap-2 mb-6">
          <CreditCard size={24} className="text-amber-600" />
          <h1 className="text-2xl font-serif font-semibold text-slate-900">{t('billing.title')}</h1>
        </div>
        <div className="flex items-center justify-center py-12">
          <Loader2 size={24} className="animate-spin text-slate-400" />
        </div>
      </div>
    );
  }

  const hasWarning =
    subscription && (subscription.status === 'past_due' || subscription.status === 'canceled');

  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center gap-2 mb-6">
        <CreditCard size={24} className="text-amber-600" />
        <h1 className="text-2xl font-serif font-semibold text-slate-900">{t('billing.title')}</h1>
      </div>

      {error && <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm mb-4">{error}</div>}

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

      {/* State A — No subscription: plan cards */}
      {!subscription && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className={`bg-white rounded-2xl shadow-soft p-6 ${
                plan.recommended ? 'ring-2 ring-sage-500' : ''
              }`}
            >
              {plan.recommended && (
                <span className="inline-block bg-sage-50 text-sage-700 text-xs font-medium px-2 py-1 rounded-full mb-3">
                  {t('billing.recommended')}
                </span>
              )}
              <h3 className="text-lg font-semibold text-slate-900">
                {t(`billing.${plan.id}_plan`)}
              </h3>
              <p className="text-2xl font-serif font-semibold text-slate-900 mt-1">
                {t(plan.priceKey)}
              </p>

              <ul className="mt-4 space-y-2">
                {plan.features.map((featureKey) => (
                  <li key={featureKey} className="flex items-start gap-2 text-sm text-slate-600">
                    <Check size={16} className="text-sage-600 mt-0.5 shrink-0" />
                    <span>{t(featureKey)}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleCheckout(plan.id)}
                disabled={actionLoading !== null}
                className="w-full mt-6 bg-sage-600 text-white px-4 py-2 rounded-xl text-sm hover:bg-sage-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {actionLoading === `checkout-${plan.id}` && (
                  <Loader2 size={14} className="animate-spin" />
                )}
                {t('billing.subscribe')}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* State B — Active/trialing subscription */}
      {subscription && (
        <div className="bg-white rounded-2xl shadow-soft p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-900">
              {t(`billing.${subscription.plan}_plan`)}
            </h3>
            <span
              className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_COLORS[subscription.status] || ''}`}
            >
              {t(`billing.status_${subscription.status}`)}
            </span>
          </div>

          <p className="text-sm text-slate-500">
            {t('billing.renews_on', {
              date: new Date(subscription.currentPeriodEnd).toLocaleDateString(),
            })}
          </p>

          <div className="flex gap-3 pt-2">
            <button
              onClick={() => handleCheckout(subscription.plan === 'basic' ? 'pro' : 'basic')}
              disabled={actionLoading !== null}
              className="bg-sage-600 text-white px-4 py-2 rounded-xl text-sm hover:bg-sage-700 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {(actionLoading === 'checkout-basic' || actionLoading === 'checkout-pro') && (
                <Loader2 size={14} className="animate-spin" />
              )}
              {t('billing.change_plan')}
            </button>
            <button
              onClick={handlePortal}
              disabled={actionLoading !== null}
              className="border border-slate-200 px-4 py-2 rounded-xl text-sm hover:bg-slate-50 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {actionLoading === 'portal' && <Loader2 size={14} className="animate-spin" />}
              <ExternalLink size={14} />
              {t('billing.manage_billing')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
