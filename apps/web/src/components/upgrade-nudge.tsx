'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { TrendingUp, X, AlertTriangle } from 'lucide-react';
import { isNearLimit, isAtLimit, getUpgradePlan, getUsagePercent, getLimitValue } from '@/lib/plan-limits';
import type { PlanLimits } from '@/lib/plan-limits';

interface UpgradeNudgeProps {
  current: number;
  plan: string;
  resource: keyof PlanLimits;
  resourceLabel: string;
}

export function UpgradeNudge({ current, plan, resource, resourceLabel }: UpgradeNudgeProps) {
  const router = useRouter();
  const [dismissed, setDismissed] = useState(false);

  const storageKey = `upgrade-nudge-dismissed-${resource}`;

  useEffect(() => {
    if (typeof window !== 'undefined' && sessionStorage.getItem(storageKey)) {
      setDismissed(true);
    }
  }, [storageKey]);

  const handleDismiss = () => {
    setDismissed(true);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(storageKey, '1');
    }
  };

  const atLimit = isAtLimit(current, plan, resource);
  const nearLimit = isNearLimit(current, plan, resource);
  const upgrade = getUpgradePlan(plan);

  if (dismissed || (!nearLimit && !atLimit) || !upgrade) return null;

  const percent = getUsagePercent(current, plan, resource);
  const limit = getLimitValue(plan, resource);

  return (
    <div
      className={`mb-4 rounded-xl p-4 flex items-center justify-between gap-4 ${
        atLimit
          ? 'bg-amber-50 border border-amber-200'
          : 'bg-lavender-50 border border-lavender-200'
      }`}
      data-testid="upgrade-nudge"
    >
      <div className="flex items-center gap-3 min-w-0">
        {atLimit ? (
          <AlertTriangle size={20} className="text-amber-600 shrink-0" />
        ) : (
          <TrendingUp size={20} className="text-lavender-600 shrink-0" />
        )}
        <div className="min-w-0">
          <p
            className={`text-sm font-medium ${
              atLimit ? 'text-amber-900' : 'text-lavender-900'
            }`}
          >
            {atLimit
              ? `You've reached your ${resourceLabel} limit (${current}/${limit})`
              : `You're using ${percent}% of your ${resourceLabel} limit (${current}/${limit})`}
          </p>
          <p
            className={`text-xs mt-0.5 ${
              atLimit ? 'text-amber-700' : 'text-lavender-700'
            }`}
          >
            Upgrade to {upgrade.label} for higher limits.
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={() => router.push('/settings/billing')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            atLimit
              ? 'bg-amber-600 text-white hover:bg-amber-700'
              : 'bg-lavender-600 text-white hover:bg-lavender-700'
          }`}
          data-testid="upgrade-nudge-cta"
        >
          Upgrade Now
        </button>
        <button
          onClick={handleDismiss}
          className="p-1 text-slate-400 hover:text-slate-600 transition-colors"
          data-testid="upgrade-nudge-dismiss"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
