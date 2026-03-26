'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Megaphone, Zap, Gift, Users, ArrowRight } from 'lucide-react';
import { api } from '@/lib/api';
import { ListSkeleton } from '@/components/skeleton';

interface ReferralSummary {
  supported: boolean;
  enabled?: boolean;
  totalReferrals?: number;
  completedReferrals?: number;
  pendingReferrals?: number;
  conversionRate?: number;
  totalCreditsIssued?: number;
}

const BASE_CARDS = [
  {
    icon: Megaphone,
    title: 'Campaigns',
    description: 'Create and manage outreach campaigns',
    href: '/campaigns',
  },
  {
    icon: Zap,
    title: 'Automations',
    description: 'Set up automated workflows and triggers',
    href: '/automations',
  },
  {
    icon: Gift,
    title: 'Offers',
    description: 'Configure special offers and promotions',
    href: '/settings/offers',
  },
] as const;

export default function MarketingHubPage() {
  const [summary, setSummary] = useState<ReferralSummary | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState(false);

  useEffect(() => {
    api
      .get<ReferralSummary>('/referral/stats/summary')
      .then((data) => setSummary(data))
      .catch(() => setStatsError(true))
      .finally(() => setStatsLoading(false));
  }, []);

  // Build cards: include Referrals card only when supported
  const showReferrals = summary?.supported !== false;
  const CARDS = showReferrals
    ? [
        ...BASE_CARDS,
        {
          icon: Users,
          title: 'Referrals',
          description:
            summary?.enabled === false
              ? 'Set up your referral program'
              : 'Patient referral program',
          href: '/marketing/referrals',
        },
      ]
    : [...BASE_CARDS];

  return (
    <div className="space-y-8" data-testid="marketing-hub-page">
      <div>
        <h1 className="font-serif text-2xl font-bold text-slate-800">Marketing</h1>
        <p className="mt-1 text-sm text-slate-500">
          Manage campaigns, automations, offers, and referrals
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {CARDS.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="group flex items-start gap-4 rounded-2xl bg-white p-6 shadow-soft transition-shadow hover:shadow-md"
            data-testid={`hub-card-${card.title.toLowerCase()}`}
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sage-50">
              <card.icon className="h-5 w-5 text-sage-600" />
            </div>
            <div className="flex-1">
              <p className="text-base font-semibold text-slate-800">{card.title}</p>
              <p className="mt-1 text-sm text-slate-500">{card.description}</p>
            </div>
            <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5" />
          </Link>
        ))}
      </div>

      {statsLoading && !statsError && <ListSkeleton rows={1} />}

      {summary?.supported && summary.enabled && !statsError && (
        <div className="space-y-4" data-testid="referral-stats-section">
          <h2 className="text-lg font-semibold text-slate-800">Referral Program</h2>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
            {[
              { label: 'Total Referrals', value: summary.totalReferrals ?? 0 },
              { label: 'Completed', value: summary.completedReferrals ?? 0 },
              { label: 'Pending', value: summary.pendingReferrals ?? 0 },
              { label: 'Conversion', value: `${summary.conversionRate ?? 0}%` },
              { label: 'Credits Issued', value: `$${summary.totalCreditsIssued ?? 0}` },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl bg-white p-4 text-center shadow-soft">
                <p className="font-serif text-2xl font-bold text-slate-800">{item.value}</p>
                <p className="mt-1 text-xs text-slate-500">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
