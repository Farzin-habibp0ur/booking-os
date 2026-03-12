'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import {
  Activity,
  Car,
  ChevronRight,
  DollarSign,
  Eye,
  MapPin,
  TrendingUp,
  User,
  Zap,
} from 'lucide-react';
import { DEAL_STAGE_STYLES, dealStageBadgeClasses } from '@/lib/design-tokens';
import { cn } from '@/lib/cn';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CustomerJourneyBoardProps {
  journey: {
    customerId: string;
    firstContact: { date: string; channel: string };
    deals: Array<{
      id: string;
      stage: string;
      dealValue: number | null;
      probability: number;
      vehicle: {
        id: string;
        year: number;
        make: string;
        model: string;
        trim: string | null;
        stockNumber: string;
      } | null;
      assignedTo: { id: string; name: string } | null;
      stageHistory: Array<{
        fromStage: string | null;
        toStage: string;
        createdAt: string;
        changedBy: { name: string } | null;
      }>;
      activities: Array<{
        type: string;
        description: string;
        createdAt: string;
      }>;
      createdAt: string;
    }>;
    testDrives: Array<{
      id: string;
      vehicle: { year: number; make: string; model: string } | null;
      feedback: string | null;
      outcome: string | null;
      createdAt: string;
      booking: { startTime: string; status: string } | null;
    }>;
    vehiclesOfInterest: Array<{
      id: string;
      year: number;
      make: string;
      model: string;
      trim: string | null;
      stockNumber: string;
      askingPrice: number | null;
      imageUrls: string[];
    }>;
    stats: {
      totalWonValue: number;
      totalVisits: number;
      testDriveCount: number;
      activeDeals: number;
      wonDeals: number;
      lostDeals: number;
      engagementScore: number;
    };
  } | null;
}

// ---------------------------------------------------------------------------
// Ordered pipeline stages
// ---------------------------------------------------------------------------

const STAGE_ORDER = [
  'INQUIRY',
  'QUALIFIED',
  'TEST_DRIVE',
  'NEGOTIATION',
  'FINANCE',
  'CLOSED_WON',
  'CLOSED_LOST',
] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function daysBetween(a: string, b: string): number {
  const ms = new Date(b).getTime() - new Date(a).getTime();
  return Math.max(0, Math.round(ms / (1000 * 60 * 60 * 24)));
}

function durationLabel(days: number): string {
  if (days === 0) return '<1d';
  if (days === 1) return '1 day';
  if (days < 30) return `${days} days`;
  const months = Math.floor(days / 30);
  return months === 1 ? '1 month' : `${months} months`;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function EngagementRing({ score }: { score: number }) {
  const clamped = Math.min(100, Math.max(0, score));
  const circumference = 2 * Math.PI * 18;
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <div className="relative flex h-12 w-12 items-center justify-center">
      <svg className="h-12 w-12 -rotate-90" viewBox="0 0 40 40">
        <circle
          cx="20"
          cy="20"
          r="18"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          className="text-slate-100"
        />
        <circle
          cx="20"
          cy="20"
          r="18"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="text-sage-500 transition-all duration-700"
        />
      </svg>
      <span className="absolute font-serif text-sm font-semibold text-slate-800">{clamped}</span>
    </div>
  );
}

interface StageNodeProps {
  stage: string;
  dateEntered: string | null;
  timeSpent: string | null;
  isActive: boolean;
  isReached: boolean;
  isLast: boolean;
}

function StageNode({ stage, dateEntered, timeSpent, isActive, isReached, isLast }: StageNodeProps) {
  const style = DEAL_STAGE_STYLES[stage];
  const label = style?.label ?? stage;

  return (
    <div className="flex items-center">
      <div className="flex flex-col items-center gap-1.5">
        {/* Stage dot */}
        <div
          className={cn(
            'relative flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all',
            isReached
              ? `${style?.bg ?? 'bg-slate-100'} border-current ${style?.text ?? 'text-slate-600'}`
              : 'border-slate-200 bg-white text-slate-300',
          )}
        >
          {isActive && (
            <span
              className={cn(
                'absolute inset-0 animate-ping rounded-full opacity-30',
                style?.bg ?? 'bg-sage-200',
              )}
            />
          )}
          <span
            className={cn(
              'h-2.5 w-2.5 rounded-full',
              isReached
                ? (style?.text ?? 'text-slate-600').replace('text-', 'bg-')
                : 'bg-slate-200',
            )}
          />
        </div>

        {/* Label */}
        <span
          className={cn(
            'text-xs font-medium whitespace-nowrap',
            isReached ? 'text-slate-800' : 'text-slate-400',
          )}
        >
          {label}
        </span>

        {/* Date & time spent */}
        {isReached && dateEntered ? (
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-[10px] text-slate-500">{formatDate(dateEntered)}</span>
            {timeSpent && (
              <span className="text-[10px] font-medium text-slate-400">{timeSpent}</span>
            )}
          </div>
        ) : (
          <div className="h-7" />
        )}
      </div>

      {/* Connector line */}
      {!isLast && (
        <div className="mx-1 flex items-start pt-1">
          <div className={cn('h-0.5 w-8 sm:w-12', isReached ? 'bg-sage-300' : 'bg-slate-200')} />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function CustomerJourneyBoard({ journey }: CustomerJourneyBoardProps) {
  if (!journey) return null;

  const { stats, deals, vehiclesOfInterest } = journey;

  // Determine the most recent/active deal for timeline
  const primaryDeal = useMemo(() => {
    const active = deals.filter((d) => d.stage !== 'CLOSED_WON' && d.stage !== 'CLOSED_LOST');
    if (active.length > 0) {
      return active.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )[0];
    }
    // Fall back to most recent deal of any kind
    return (
      deals.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] ??
      null
    );
  }, [deals]);

  // Build per-stage info from primary deal history
  const stageInfo = useMemo(() => {
    if (!primaryDeal) return {};

    const info: Record<string, { dateEntered: string; timeSpent: string | null }> = {};
    const sorted = [...primaryDeal.stageHistory].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );

    for (let i = 0; i < sorted.length; i++) {
      const entry = sorted[i];
      const nextEntry = sorted[i + 1];
      const days = nextEntry
        ? daysBetween(entry.createdAt, nextEntry.createdAt)
        : daysBetween(entry.createdAt, new Date().toISOString());

      info[entry.toStage] = {
        dateEntered: entry.createdAt,
        timeSpent: durationLabel(days),
      };
    }

    return info;
  }, [primaryDeal]);

  const currentStageIndex = primaryDeal
    ? STAGE_ORDER.indexOf(primaryDeal.stage as (typeof STAGE_ORDER)[number])
    : -1;

  const activeDeals = deals.filter((d) => d.stage !== 'CLOSED_WON' && d.stage !== 'CLOSED_LOST');

  return (
    <div className="space-y-5">
      {/* ----------------------------------------------------------------- */}
      {/* Journey Timeline                                                   */}
      {/* ----------------------------------------------------------------- */}
      <div className="rounded-2xl bg-white p-5 shadow-soft">
        <h3 className="mb-4 text-sm font-semibold text-slate-800">Sales Journey</h3>

        {primaryDeal ? (
          <div className="overflow-x-auto pb-2">
            <div className="flex items-start gap-0 min-w-max px-2">
              {STAGE_ORDER.filter((s) => s !== 'CLOSED_LOST').map((stage, idx, arr) => {
                const stageIdx = STAGE_ORDER.indexOf(stage);
                const isReached = stageIdx <= currentStageIndex;
                const isActive = stage === primaryDeal.stage;
                const info = stageInfo[stage];

                return (
                  <StageNode
                    key={stage}
                    stage={stage}
                    dateEntered={info?.dateEntered ?? null}
                    timeSpent={info?.timeSpent ?? null}
                    isActive={isActive}
                    isReached={isReached}
                    isLast={idx === arr.length - 1}
                  />
                );
              })}
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-400">No deals in pipeline yet.</p>
        )}
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Stats Row                                                          */}
      {/* ----------------------------------------------------------------- */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-soft">
          <EngagementRing score={stats.engagementScore} />
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
              Engagement
            </p>
            <p className="font-sans text-sm text-slate-700">Score</p>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-4 shadow-soft">
          <div className="mb-1 flex items-center gap-2 text-slate-400">
            <Eye className="h-4 w-4" />
            <span className="text-[11px] font-medium uppercase tracking-wider">Visits</span>
          </div>
          <p className="font-serif text-2xl font-semibold text-slate-800">{stats.totalVisits}</p>
        </div>

        <div className="rounded-2xl bg-white p-4 shadow-soft">
          <div className="mb-1 flex items-center gap-2 text-slate-400">
            <Car className="h-4 w-4" />
            <span className="text-[11px] font-medium uppercase tracking-wider">Test Drives</span>
          </div>
          <p className="font-serif text-2xl font-semibold text-slate-800">{stats.testDriveCount}</p>
        </div>

        <div className="rounded-2xl bg-white p-4 shadow-soft">
          <div className="mb-1 flex items-center gap-2 text-slate-400">
            <TrendingUp className="h-4 w-4" />
            <span className="text-[11px] font-medium uppercase tracking-wider">Active Deals</span>
          </div>
          <p className="font-serif text-2xl font-semibold text-slate-800">{stats.activeDeals}</p>
        </div>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Vehicles of Interest                                               */}
      {/* ----------------------------------------------------------------- */}
      {vehiclesOfInterest.length > 0 && (
        <div className="rounded-2xl bg-white p-5 shadow-soft">
          <h3 className="mb-3 text-sm font-semibold text-slate-800">Vehicles of Interest</h3>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {vehiclesOfInterest.map((v) => (
              <Link
                key={v.id}
                href={`/inventory/${v.id}`}
                className="flex shrink-0 items-center gap-2 rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2 transition hover:border-sage-200 hover:bg-sage-50/40"
              >
                <Car className="h-4 w-4 text-slate-400" />
                <span className="whitespace-nowrap text-sm font-medium text-slate-700">
                  {v.year} {v.make} {v.model}
                  {v.trim ? ` ${v.trim}` : ''}
                </span>
                <span className="text-xs text-slate-400">#{v.stockNumber}</span>
                {v.askingPrice != null && (
                  <span className="ml-1 whitespace-nowrap text-xs font-semibold text-sage-600">
                    {formatCurrency(v.askingPrice)}
                  </span>
                )}
                <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* Active Deals                                                       */}
      {/* ----------------------------------------------------------------- */}
      {activeDeals.length > 0 && (
        <div className="rounded-2xl bg-white p-5 shadow-soft">
          <h3 className="mb-3 text-sm font-semibold text-slate-800">Active Deals</h3>
          <div className="divide-y divide-slate-100">
            {activeDeals.map((deal) => (
              <Link
                key={deal.id}
                href={`/pipeline/${deal.id}`}
                className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0 transition hover:opacity-80"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {/* Vehicle */}
                  <div className="min-w-0">
                    {deal.vehicle ? (
                      <p className="truncate text-sm font-medium text-slate-800">
                        {deal.vehicle.year} {deal.vehicle.make} {deal.vehicle.model}
                        {deal.vehicle.trim ? ` ${deal.vehicle.trim}` : ''}
                      </p>
                    ) : (
                      <p className="text-sm text-slate-400">No vehicle linked</p>
                    )}

                    {/* Assigned salesperson */}
                    {deal.assignedTo && (
                      <div className="mt-0.5 flex items-center gap-1 text-xs text-slate-400">
                        <User className="h-3 w-3" />
                        <span>{deal.assignedTo.name}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-3">
                  {/* Deal value */}
                  {deal.dealValue != null && (
                    <span className="flex items-center gap-1 text-sm font-semibold text-slate-700">
                      <DollarSign className="h-3.5 w-3.5 text-slate-400" />
                      {formatCurrency(deal.dealValue)}
                    </span>
                  )}

                  {/* Stage badge */}
                  <span
                    className={cn(
                      'inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-medium',
                      dealStageBadgeClasses(deal.stage),
                    )}
                  >
                    {DEAL_STAGE_STYLES[deal.stage]?.label ?? deal.stage}
                  </span>

                  <ChevronRight className="h-4 w-4 text-slate-300" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
