'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { Clock, AlertTriangle, XCircle } from 'lucide-react';

export function TrialBanner() {
  const { user } = useAuth();
  const trial = user?.trial;

  if (!trial) return null;

  // Active trial
  if (trial.isTrial && trial.trialDaysRemaining > 0) {
    const urgent = trial.trialDaysRemaining <= 3;
    return (
      <div
        className={`flex items-center justify-between px-4 py-2 text-sm ${
          urgent
            ? 'bg-amber-50 text-amber-800 border-b border-amber-200'
            : 'bg-lavender-50 text-lavender-800 border-b border-lavender-200'
        }`}
        data-testid="trial-banner"
      >
        <div className="flex items-center gap-2">
          {urgent ? <AlertTriangle size={16} /> : <Clock size={16} />}
          <span>
            <strong>{trial.trialDaysRemaining} day{trial.trialDaysRemaining !== 1 ? 's' : ''}</strong>{' '}
            left in your free trial
            {urgent ? ' — choose a plan to keep your data' : ''}
          </span>
        </div>
        <Link
          href="/settings/billing"
          className={`shrink-0 px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
            urgent
              ? 'bg-amber-600 text-white hover:bg-amber-700'
              : 'bg-lavender-600 text-white hover:bg-lavender-700'
          }`}
        >
          Choose Plan
        </Link>
      </div>
    );
  }

  // Grace period
  if (trial.isGracePeriod) {
    return (
      <div
        className="flex items-center justify-between px-4 py-2 text-sm bg-red-50 text-red-800 border-b border-red-200"
        data-testid="trial-banner"
      >
        <div className="flex items-center gap-2">
          <XCircle size={16} />
          <span>
            Your trial has ended. You have <strong>read-only access</strong> during the grace period.
            Subscribe to unlock all features.
          </span>
        </div>
        <Link
          href="/settings/billing"
          className="shrink-0 px-3 py-1 rounded-lg text-xs font-medium bg-red-600 text-white hover:bg-red-700 transition-colors"
        >
          Subscribe Now
        </Link>
      </div>
    );
  }

  // Trial expired, no grace period, no subscription — handled by billing page redirect
  return null;
}
