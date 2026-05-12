'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight, Check, X } from 'lucide-react';
import { api } from '@/lib/api';
import { DetailSkeleton } from '@/components/skeleton';

interface PilotHealth {
  daysIntoPilot: number;
  messagesHandled: number;
  draftsApproved: number;
  responseTimeMedianMinutes: number | null;
  captured: { count: number; revenue: number };
  wouldHaveBeenMissed: { count: number; revenue: number };
  baseline: {
    monthlyBookings: number | null;
    monthlyRevenue: number | null;
    capturedAt: string | null;
  };
  scorecard: {
    messagesHandled: { value: number; target: number; met: boolean };
    bookings: { value: number; target: number; met: boolean };
    continuationLogged: boolean;
  };
}

const PILOT_LENGTH_DAYS = 30;

const formatRevenue = (value: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);

export default function BusinessPilotHealthPage() {
  const params = useParams();
  const businessId = (params?.id as string) || '';

  const [health, setHealth] = useState<PilotHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchHealth = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.get<PilotHealth>(`/admin/businesses/${businessId}/pilot-health`);
      setHealth(result);
    } catch (err) {
      const message =
        err instanceof Error && err.message ? err.message : 'Failed to load pilot health';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    fetchHealth();
  }, [fetchHealth]);

  if (loading) {
    return (
      <div className="p-6 md:p-8" data-testid="loading">
        <DetailSkeleton />
      </div>
    );
  }

  if (error || !health) {
    return (
      <div className="p-6 md:p-8">
        <div className="rounded-2xl bg-red-50 p-4 text-red-700">{error || 'No pilot data.'}</div>
      </div>
    );
  }

  const dayLabel = `Day ${Math.min(health.daysIntoPilot, PILOT_LENGTH_DAYS)} of ${PILOT_LENGTH_DAYS}`;

  return (
    <div className="max-w-5xl p-6 md:p-8">
      <nav className="mb-4 flex items-center gap-1 text-sm text-slate-500">
        <Link href="/businesses" className="transition-colors hover:text-sage-600">
          Businesses
        </Link>
        <ChevronRight size={14} />
        <Link href={`/businesses/${businessId}`} className="transition-colors hover:text-sage-600">
          Detail
        </Link>
        <ChevronRight size={14} />
        <span className="font-medium text-slate-900 dark:text-white">Pilot Health</span>
      </nav>

      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="font-serif text-2xl font-bold text-slate-900 dark:text-white">
            Pilot Health
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            30-day pilot snapshot since the OWNER staff was provisioned.
          </p>
        </div>
        <span
          data-testid="day-counter"
          className="rounded-full bg-lavender-50 px-3 py-1 text-sm font-medium text-lavender-900"
        >
          {dayLabel}
        </span>
      </div>

      <section className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <MetricCard label="Messages handled" value={health.messagesHandled} />
        <MetricCard label="Drafts approved" value={health.draftsApproved} />
        <MetricCard
          label="Median response time"
          value={
            health.responseTimeMedianMinutes === null
              ? '—'
              : `${health.responseTimeMedianMinutes} min`
          }
        />
        <MetricCard
          label="Captured bookings"
          value={`${health.captured.count} · ${formatRevenue(health.captured.revenue)}`}
        />
        <MetricCard
          label="Would-have-been-missed"
          value={`${health.wouldHaveBeenMissed.count} · ${formatRevenue(health.wouldHaveBeenMissed.revenue)}`}
        />
        <MetricCard
          label="Baseline (monthly)"
          value={
            health.baseline.monthlyBookings === null && health.baseline.monthlyRevenue === null
              ? 'Not captured'
              : `${health.baseline.monthlyBookings ?? '—'} bookings · ${
                  health.baseline.monthlyRevenue === null
                    ? '—'
                    : formatRevenue(health.baseline.monthlyRevenue)
                }`
          }
          accent="lavender"
        />
      </section>

      <section className="mt-8 rounded-2xl bg-white p-6 shadow-soft dark:bg-slate-900">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
          Pilot scorecard
        </h2>
        <ul className="mt-4 space-y-3">
          <ScorecardRow
            label={`At least ${health.scorecard.messagesHandled.target} messages handled`}
            value={`${health.scorecard.messagesHandled.value} / ${health.scorecard.messagesHandled.target}`}
            met={health.scorecard.messagesHandled.met}
            testId="scorecard-messages"
          />
          <ScorecardRow
            label={`At least ${health.scorecard.bookings.target} bookings (max(5, baseline ÷ 12))`}
            value={`${health.scorecard.bookings.value} / ${health.scorecard.bookings.target}`}
            met={health.scorecard.bookings.met}
            testId="scorecard-bookings"
          />
          <li
            data-testid="scorecard-continuation"
            className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 dark:bg-slate-800"
          >
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
              Continuation conversation logged
            </span>
            <span className="text-sm text-slate-500">TBD — manual</span>
          </li>
        </ul>
      </section>
    </div>
  );
}

function MetricCard({
  label,
  value,
  accent = 'sage',
}: {
  label: string;
  value: string | number;
  accent?: 'sage' | 'lavender';
}) {
  const bg = accent === 'lavender' ? 'bg-lavender-50' : 'bg-sage-50';
  const text = accent === 'lavender' ? 'text-lavender-900' : 'text-sage-900';
  return (
    <div className={`rounded-2xl ${bg} p-5`}>
      <p className={`text-xs font-medium uppercase tracking-wider ${text}`}>{label}</p>
      <p className="mt-2 font-serif text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
    </div>
  );
}

function ScorecardRow({
  label,
  value,
  met,
  testId,
}: {
  label: string;
  value: string;
  met: boolean;
  testId: string;
}) {
  return (
    <li
      data-testid={testId}
      className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 dark:bg-slate-800"
    >
      <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{label}</span>
      <span className="flex items-center gap-2 text-sm">
        <span className="text-slate-500">{value}</span>
        {met ? (
          <Check size={18} className="text-sage-600" data-testid={`${testId}-met`} />
        ) : (
          <X size={18} className="text-red-500" data-testid={`${testId}-unmet`} />
        )}
      </span>
    </li>
  );
}
