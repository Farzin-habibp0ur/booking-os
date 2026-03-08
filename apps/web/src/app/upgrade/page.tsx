'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Check, Sparkles, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';

type PlanTier = 'starter' | 'professional' | 'enterprise';
type BillingInterval = 'monthly' | 'annual';

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

function isValidStripeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && parsed.hostname.endsWith('.stripe.com');
  } catch {
    return false;
  }
}

export default function UpgradePage() {
  const router = useRouter();
  const { user } = useAuth();
  const [billingInterval, setBillingInterval] = useState<BillingInterval>('monthly');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handlePlanSelect = async (plan: PlanTier) => {
    if (!user) {
      router.push(`/signup?plan=${plan}`);
      return;
    }

    setActionLoading(`checkout-${plan}`);
    setError(null);
    try {
      const { url } = await api.post<{ url: string }>('/billing/checkout', {
        plan,
        billing: billingInterval,
      });
      if (!isValidStripeUrl(url)) {
        setError('Could not start checkout. Please try again.');
        setActionLoading(null);
        return;
      }
      window.location.href = url;
    } catch {
      setError('Could not start checkout. Please try again.');
      setActionLoading(null);
    }
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#FCFCFD' }}>
      <div className="max-w-5xl mx-auto px-4 py-12">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm text-sage-600 hover:text-sage-700 mb-6 transition-colors"
        >
          <ArrowLeft size={14} />
          Back
        </Link>

        <div className="text-center mb-10">
          <h1 className="text-3xl font-serif font-semibold text-slate-900">
            Choose the right plan for your business
          </h1>
          <p className="text-slate-500 mt-2">
            Start with a 14-day free trial. No credit card required.
          </p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm mb-6 text-center">
            {error}
          </div>
        )}

        {/* Billing interval toggle */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <button
            onClick={() => setBillingInterval('monthly')}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              billingInterval === 'monthly'
                ? 'bg-slate-900 text-white'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setBillingInterval('annual')}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors flex items-center gap-1.5 ${
              billingInterval === 'annual'
                ? 'bg-slate-900 text-white'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Annual
            <span className="text-xs bg-sage-100 text-sage-700 px-1.5 py-0.5 rounded-full">
              Save 20%
            </span>
          </button>
        </div>

        {/* Plan cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PLANS.map((plan) => {
            const price = billingInterval === 'annual' ? plan.annualPrice : plan.monthlyPrice;

            return (
              <div
                key={plan.id}
                data-testid={`plan-card-${plan.id}`}
                className={`bg-white rounded-2xl shadow-soft p-6 flex flex-col ${
                  plan.highlighted ? 'ring-2 ring-sage-500' : ''
                }`}
              >
                {plan.highlighted && (
                  <div className="flex items-center gap-1.5 mb-3">
                    <Sparkles size={14} className="text-sage-600" />
                    <span className="text-xs font-medium text-sage-700">Most Popular</span>
                  </div>
                )}

                <h3 className="text-lg font-semibold text-slate-900">{plan.label}</h3>
                <div className="mt-2">
                  <span className="text-3xl font-serif font-semibold text-slate-900">${price}</span>
                  <span className="text-sm text-slate-500">/mo</span>
                  {billingInterval === 'annual' && (
                    <span className="text-xs text-slate-400 ml-1">billed annually</span>
                  )}
                </div>

                <ul className="mt-5 space-y-2.5 flex-1">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm text-slate-600">
                      <Check size={16} className="text-sage-600 mt-0.5 shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handlePlanSelect(plan.id)}
                  disabled={actionLoading !== null}
                  className={`w-full mt-6 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2 ${
                    plan.highlighted
                      ? 'bg-sage-600 text-white hover:bg-sage-700'
                      : 'bg-slate-900 text-white hover:bg-slate-800'
                  }`}
                >
                  Get Started
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
