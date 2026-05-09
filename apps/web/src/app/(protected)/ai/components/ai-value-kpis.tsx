'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Info } from 'lucide-react';

/**
 * BCC v3 two-metric dashboard tile.
 *
 *   Card 1 (large)        : Bookings captured (count + revenue)
 *   Card 2 (sub-callout)  : Of which, would have been missed without BCC
 *
 * Powered by GET /front-desk/summary (FrontDeskAttributionService.getSummary).
 * Methodology tooltip references the 7 attribution reasons defined in
 * BCC-PIVOT-MASTER-PLAN.md (Phase 4) and the future BOOKING-ATTRIBUTION-DEFINITION
 * doc (TODO: Phase 8 will create that doc — until then, the tooltip text is
 * inlined here).
 */

interface BaselineShape {
  monthlyBookings: number | null;
  monthlyRevenue: number | null;
  source: string;
  capturedAt: string | Date | null;
}

interface FrontDeskV3Summary {
  days: number;
  captured: { count: number; revenue: number };
  wouldHaveBeenMissed: {
    count: number;
    revenue: number;
    byReason: Record<string, { count: number; revenue: number }>;
  };
  responseTimeMedianMinutes: number | null;
  baseline: BaselineShape;
}

const EMPTY_SUMMARY: FrontDeskV3Summary = {
  days: 30,
  captured: { count: 0, revenue: 0 },
  wouldHaveBeenMissed: { count: 0, revenue: 0, byReason: {} },
  responseTimeMedianMinutes: null,
  baseline: {
    monthlyBookings: null,
    monthlyRevenue: null,
    source: 'concierge_call',
    capturedAt: null,
  },
};

function formatCurrency(value: number): string {
  return `$${Math.round(value).toLocaleString()}`;
}

const METHODOLOGY_TEXT = [
  'A booking is counted as "would have been missed without BCC" when it matches one of these patterns:',
  '• Waitlist match — filled a cancelled slot from the waitlist',
  '• AI booking — booked end-to-end by the AI Front Desk',
  '• Quote follow-up — converted from a stalled quote',
  '• Consult follow-up — treatment booked within 14 days of a consult',
  '• After-hours AI — first message arrived outside open hours and AI drafted a reply',
  '• Unanswered threshold — staff took >15 min to reply and AI drafted before they did',
  "Bookings that don't match any of these are counted as ORGANIC.",
].join('\n');

export function AIValueKPIs() {
  const [summary, setSummary] = useState<FrontDeskV3Summary>(EMPTY_SUMMARY);
  const [loading, setLoading] = useState(true);
  const [showTooltip, setShowTooltip] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const data = await api.get<FrontDeskV3Summary>('/front-desk/summary?days=30');
        setSummary(data);
      } catch {
        setSummary(EMPTY_SUMMARY);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="space-y-4" data-testid="ai-value-kpis">
        <div className="animate-pulse bg-white rounded-2xl shadow-soft h-40" />
        <div className="animate-pulse bg-white rounded-2xl shadow-soft h-28" />
      </div>
    );
  }

  const { captured, wouldHaveBeenMissed, baseline } = summary;
  const hasBaseline =
    baseline.capturedAt != null &&
    (baseline.monthlyBookings != null || baseline.monthlyRevenue != null);

  return (
    <div className="space-y-4" data-testid="ai-value-kpis">
      {/* Card 1: Bookings captured (large, primary) */}
      <div className="bg-white rounded-2xl shadow-soft p-6">
        <p className="text-sm text-slate-500 mb-2">Bookings captured</p>
        <p className="font-serif text-5xl font-bold text-sage-600">{captured.count}</p>
        <p className="text-lg text-slate-700 mt-1">{formatCurrency(captured.revenue)} in revenue</p>
        {hasBaseline && (
          <p className="text-xs text-slate-500 mt-3">
            vs baseline of{' '}
            {baseline.monthlyBookings != null ? `${baseline.monthlyBookings} bookings` : '—'}
            {baseline.monthlyRevenue != null
              ? ` / ${formatCurrency(baseline.monthlyRevenue)}`
              : ''}{' '}
            per month
          </p>
        )}
        {/* TODO Phase 4 follow-up: optional 30-day sparkline (Recharts) */}
      </div>

      {/* Card 2: Sub-callout — would-have-been-missed */}
      <div className="bg-lavender-50 border border-lavender-100 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-2">
          <p className="text-sm text-lavender-900">Of which, would have been missed without BCC</p>
          <button
            type="button"
            aria-label="Methodology"
            className="text-lavender-600 hover:text-lavender-900 focus:outline-none focus:ring-2 focus:ring-lavender-500 rounded"
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
            onFocus={() => setShowTooltip(true)}
            onBlur={() => setShowTooltip(false)}
            onClick={() => setShowTooltip((v) => !v)}
          >
            <Info size={14} />
          </button>
        </div>
        <p className="font-serif text-3xl font-bold text-lavender-600">
          {wouldHaveBeenMissed.count}
        </p>
        <p className="text-sm text-slate-700 mt-1">
          {formatCurrency(wouldHaveBeenMissed.revenue)} in revenue
        </p>
        {showTooltip && (
          <div
            role="tooltip"
            data-testid="methodology-tooltip"
            className="mt-3 text-xs text-slate-700 whitespace-pre-line bg-white rounded-xl p-3 shadow-soft"
          >
            {METHODOLOGY_TEXT}
          </div>
        )}
      </div>
    </div>
  );
}
