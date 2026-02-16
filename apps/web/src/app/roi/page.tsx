'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { useI18n } from '@/lib/i18n';
import { PageSkeleton } from '@/components/skeleton';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { TrendingUp, ChevronDown, ChevronUp, Rocket } from 'lucide-react';

const PERIOD_OPTIONS = [
  { label: '7d', value: 7, key: 'period_7d' },
  { label: '30d', value: 30, key: 'period_30d' },
  { label: '90d', value: 90, key: 'period_90d' },
];

interface DashboardData {
  hasBaseline: boolean;
  baseline?: {
    goLiveDate: string;
    baselineStart: string;
    baselineEnd: string;
    metrics: any;
  };
  current?: {
    noShowRate: number;
    noShowTotal: number;
    consultConversionRate: number;
    avgResponseMinutes: number;
    totalRevenue: number;
    completedBookings: number;
    depositCompliance: number;
    revenueOverTime: { date: string; revenue: number }[];
    statusBreakdown: { status: string; count: number }[];
  };
  deltas?: {
    noShowRate: number;
    consultConversionRate: number;
    avgResponseMinutes: number;
    totalRevenue: number;
  };
  recoveredRevenue?: {
    amount: number | null;
    sufficient: boolean;
    reason: string | null;
    formula: {
      baselineNoShowRate: number;
      currentNoShowRate: number;
      noShowImprovement: number;
      completedBookings: number;
      avgBookingValue: number;
    } | null;
  };
}

export default function RoiPage() {
  const { t } = useI18n();
  const [days, setDays] = useState(30);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [goingLive, setGoingLive] = useState(false);
  const [showFormula, setShowFormula] = useState(false);

  const loadDashboard = (period: number) => {
    setLoading(true);
    api
      .get<DashboardData>(`/roi/dashboard?days=${period}`)
      .then(setData)
      .catch(() => setData({ hasBaseline: false }))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadDashboard(days);
  }, [days]);

  const handleGoLive = async () => {
    if (!confirm(t('roi.go_live_confirm'))) return;
    setGoingLive(true);
    try {
      await api.post('/roi/go-live');
      loadDashboard(days);
    } catch {
      alert(t('roi.go_live_error'));
    } finally {
      setGoingLive(false);
    }
  };

  if (loading && !data) return <PageSkeleton />;

  // No baseline — show go-live CTA
  if (!data?.hasBaseline) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[60vh]">
        <div className="bg-white rounded-2xl shadow-soft p-8 max-w-lg text-center">
          <div className="w-16 h-16 bg-sage-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Rocket size={32} className="text-sage-600" />
          </div>
          <h2 className="text-xl font-serif font-bold text-slate-900 mb-2">
            {t('roi.go_live_title')}
          </h2>
          <p className="text-sm text-slate-500 mb-6">{t('roi.go_live_description')}</p>
          <button
            onClick={handleGoLive}
            disabled={goingLive}
            className="bg-sage-600 text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-sage-700 transition-colors disabled:opacity-50"
          >
            {goingLive ? '...' : t('roi.go_live_button')}
          </button>
        </div>
      </div>
    );
  }

  const { baseline, current, deltas, recoveredRevenue } = data;

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-serif font-semibold text-slate-900">{t('roi.title')}</h1>
        <div className="flex gap-1 bg-slate-100 rounded-xl p-0.5">
          {PERIOD_OPTIONS.map((p) => (
            <button
              key={p.value}
              onClick={() => setDays(p.value)}
              className={cn(
                'px-3 py-1.5 rounded-xl text-sm transition-colors',
                days === p.value
                  ? 'bg-white shadow-sm font-medium'
                  : 'text-slate-500 hover:text-slate-700',
              )}
            >
              {t(`roi.${p.key}`)}
            </button>
          ))}
        </div>
      </div>

      {/* Baseline Banner */}
      {baseline && (
        <div className="bg-sage-50 rounded-xl px-4 py-2.5 text-sm text-sage-700">
          {t('roi.baseline_banner', {
            date: formatDate(baseline.goLiveDate),
            start: formatDate(baseline.baselineStart),
            end: formatDate(baseline.baselineEnd),
          })}
        </div>
      )}

      {/* Metric Cards */}
      {current && deltas && (
        <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
          <MetricCard
            label={t('roi.no_show_rate')}
            value={`${current.noShowRate}%`}
            delta={deltas.noShowRate}
            invertDelta={false}
            t={t}
          />
          <MetricCard
            label={t('roi.avg_response')}
            value={`${current.avgResponseMinutes}m`}
            delta={deltas.avgResponseMinutes}
            invertDelta={false}
            t={t}
          />
          <MetricCard
            label={t('roi.consult_conversion')}
            value={`${current.consultConversionRate}%`}
            delta={deltas.consultConversionRate}
            invertDelta={false}
            t={t}
          />
          <MetricCard
            label={t('roi.deposit_compliance')}
            value={`${current.depositCompliance}%`}
            delta={null}
            invertDelta={false}
            t={t}
          />
          <MetricCard
            label={t('roi.revenue')}
            value={`$${Math.round(current.totalRevenue).toLocaleString()}`}
            delta={deltas.totalRevenue}
            invertDelta={false}
            prefix="$"
            t={t}
          />
          <MetricCard
            label={t('roi.completed_bookings')}
            value={current.completedBookings}
            delta={null}
            invertDelta={false}
            t={t}
          />
        </div>
      )}

      {/* Recovered Revenue Card */}
      {recoveredRevenue && (
        <div className="bg-white rounded-2xl shadow-soft p-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="font-semibold text-slate-900 mb-1">{t('roi.recovered_revenue_title')}</h2>
              <p className="text-xs text-slate-400">{t('roi.recovered_revenue_desc')}</p>
            </div>
            <TrendingUp size={20} className="text-sage-500 mt-1" />
          </div>
          <div className="mt-4">
            {recoveredRevenue.amount !== null ? (
              <p className="text-4xl font-serif font-bold text-sage-600">
                ${Math.round(recoveredRevenue.amount).toLocaleString()}
              </p>
            ) : recoveredRevenue.reason === 'insufficient_data' ? (
              <div>
                <p className="text-lg font-serif font-medium text-slate-400">
                  {t('roi.insufficient_data')}
                </p>
                <p className="text-xs text-slate-400 mt-1">{t('roi.insufficient_data_desc')}</p>
              </div>
            ) : (
              <p className="text-lg font-serif font-medium text-slate-400">
                {t('roi.no_improvement')}
              </p>
            )}
          </div>

          {/* How we calculate */}
          {recoveredRevenue.formula && (
            <div className="mt-4 border-t border-slate-100 pt-3">
              <button
                onClick={() => setShowFormula(!showFormula)}
                className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 transition-colors"
              >
                {showFormula ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                {t('roi.how_we_calculate')}
              </button>
              {showFormula && (
                <div className="mt-2 bg-slate-50 rounded-xl p-3 text-xs text-slate-600">
                  {t('roi.formula_explanation', {
                    baseline: String(recoveredRevenue.formula.baselineNoShowRate),
                    current: String(recoveredRevenue.formula.currentNoShowRate),
                    bookings: String(recoveredRevenue.formula.completedBookings),
                    avgValue: String(
                      Math.round(recoveredRevenue.formula.avgBookingValue).toLocaleString(),
                    ),
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Trend Charts */}
      {current && baseline && (
        <div className="grid grid-cols-2 gap-6">
          {/* No-Show Rate Trend — using revenue data dates to show baseline reference */}
          <div className="bg-white rounded-2xl shadow-soft p-4">
            <h2 className="font-semibold mb-4">{t('roi.no_show_trend')}</h2>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart
                data={current.revenueOverTime.map((d) => ({
                  date: d.date,
                  value: current.noShowRate,
                }))}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(d) => d.slice(5)} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${v}%`} />
                <Tooltip formatter={(v: number) => [`${v}%`, t('roi.no_show_rate')]} />
                <ReferenceLine
                  y={baseline.metrics.noShowRate}
                  stroke="#ef4444"
                  strokeDasharray="4 4"
                  label={{
                    value: `${t('roi.baseline_label')} ${baseline.metrics.noShowRate}%`,
                    position: 'right',
                    fontSize: 10,
                    fill: '#ef4444',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#8AA694"
                  fill="#8AA694"
                  fillOpacity={0.1}
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Revenue Trend */}
          <div className="bg-white rounded-2xl shadow-soft p-4">
            <h2 className="font-semibold mb-4">{t('roi.revenue_trend')}</h2>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={current.revenueOverTime}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(d) => d.slice(5)} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `$${v}`} />
                <Tooltip formatter={(v: number) => [`$${v}`, t('roi.revenue')]} />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#71907C"
                  fill="#71907C"
                  fillOpacity={0.1}
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({
  label,
  value,
  delta,
  invertDelta,
  prefix,
  t,
}: {
  label: string;
  value: string | number;
  delta: number | null;
  invertDelta: boolean;
  prefix?: string;
  t: (key: string) => string;
}) {
  const improved = delta !== null && delta > 0;
  const worsened = delta !== null && delta < 0;

  return (
    <div className="bg-white rounded-2xl shadow-soft p-4">
      <p className="text-xs text-slate-500 truncate">{label}</p>
      <p className="text-2xl font-serif font-bold mt-1">{value}</p>
      {delta !== null && (
        <div className="mt-1">
          <span
            className={cn(
              'inline-flex items-center text-[11px] px-1.5 py-0.5 rounded-full',
              improved ? 'bg-sage-50 text-sage-700' : worsened ? 'bg-red-50 text-red-600' : 'bg-slate-50 text-slate-500',
            )}
          >
            {improved ? '+' : ''}
            {prefix && delta > 0 ? prefix : ''}
            {typeof delta === 'number' ? (prefix ? Math.abs(Math.round(delta)).toLocaleString() : Math.round(delta)) : delta}
            {!prefix ? (label.includes('%') || label.includes('Rate') || label.includes('→') ? 'pp' : '') : ''}
          </span>
        </div>
      )}
    </div>
  );
}
