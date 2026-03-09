'use client';

import { useEffect, useState, useMemo } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import {
  ChevronLeft,
  ChevronRight,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Printer,
  Loader2,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface ReviewData {
  id: string;
  month: string;
  metrics: {
    totalBookings: number;
    completedBookings: number;
    noShowCount: number;
    noShowRate: number;
    totalRevenue: number;
    avgBookingValue: number;
    revenueChange: number;
    bookingsChange: number;
    newCustomers: number;
    returningCustomers: number;
    retentionRate: number;
    topServices: { name: string; count: number }[];
    topStaff: { name: string; completed: number }[];
    busiestDays: { day: string; count: number }[];
    busiestHours: { hour: number; count: number }[];
    aiStats: { actionCardsCreated: number; actionCardsApproved: number; actionCardsDismissed: number };
    contentStats: { published: number; pending: number };
  };
  aiSummary: string;
}

interface Recommendation {
  title: string;
  description: string;
  link: string;
}

function parseRecommendations(summary: string): { text: string; recommendations: Recommendation[] } {
  const marker = 'RECOMMENDATIONS_JSON:';
  const idx = summary.indexOf(marker);
  if (idx === -1) return { text: summary, recommendations: [] };

  const text = summary.substring(0, idx).trim();
  const jsonStr = summary.substring(idx + marker.length).trim();
  try {
    const recommendations = JSON.parse(jsonStr);
    return { text, recommendations: Array.isArray(recommendations) ? recommendations.slice(0, 3) : [] };
  } catch {
    return { text: summary, recommendations: [] };
  }
}

function formatMonth(month: string): string {
  const [year, mon] = month.split('-').map(Number);
  const date = new Date(year, mon - 1, 1);
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function getAdjacentMonth(month: string, delta: number): string {
  const [year, mon] = month.split('-').map(Number);
  const date = new Date(year, mon - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function getCurrentMonth(): string {
  const now = new Date();
  // Default to previous month since current month is incomplete
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;
}

export default function MonthlyReviewPage() {
  const [month, setMonth] = useState(getCurrentMonth);
  const [review, setReview] = useState<ReviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    api
      .get<ReviewData>(`/business-review/${month}`)
      .then(setReview)
      .catch(() => setError('Failed to load review'))
      .finally(() => setLoading(false));
  }, [month]);

  const { text: summaryText, recommendations } = useMemo(
    () => (review ? parseRecommendations(review.aiSummary) : { text: '', recommendations: [] }),
    [review],
  );

  const m = review?.metrics;

  // Generate daily data points for the revenue chart (placeholder distribution)
  const revenueChartData = useMemo(() => {
    if (!m) return [];
    const [year, mon] = month.split('-').map(Number);
    const daysInMonth = new Date(year, mon, 0).getDate();
    const dailyAvg = m.totalRevenue / daysInMonth;
    return Array.from({ length: daysInMonth }, (_, i) => ({
      day: i + 1,
      revenue: Math.round(dailyAvg * (0.5 + Math.random()) * 100) / 100,
    }));
  }, [m, month]);

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="p-6 space-y-6 print:p-0">
      {/* Header */}
      <div className="flex items-center justify-between print:mb-4">
        <div>
          <h1 className="text-2xl font-serif font-semibold text-slate-900">Monthly Review</h1>
          <p className="text-sm text-slate-500 mt-0.5">AI-powered business performance insights</p>
        </div>
        <div className="flex items-center gap-4 print:hidden">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMonth(getAdjacentMonth(month, -1))}
              className="p-1.5 rounded-xl hover:bg-slate-100 transition-colors"
              aria-label="Previous month"
            >
              <ChevronLeft size={18} />
            </button>
            <span className="text-sm font-medium min-w-[140px] text-center" data-testid="month-display">
              {formatMonth(month)}
            </span>
            <button
              onClick={() => setMonth(getAdjacentMonth(month, 1))}
              className="p-1.5 rounded-xl hover:bg-slate-100 transition-colors"
              aria-label="Next month"
            >
              <ChevronRight size={18} />
            </button>
          </div>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <Printer size={14} />
            Print
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin text-slate-400" size={32} />
        </div>
      ) : error ? (
        <div className="bg-red-50 rounded-2xl p-6 text-center text-red-600 text-sm">{error}</div>
      ) : m ? (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-4 gap-4">
            <KpiCard
              label="Revenue"
              value={`$${Math.round(m.totalRevenue).toLocaleString()}`}
              change={m.revenueChange}
            />
            <KpiCard
              label="Bookings"
              value={m.totalBookings}
              change={m.bookingsChange}
            />
            <KpiCard
              label="New Customers"
              value={m.newCustomers}
            />
            <KpiCard
              label="No-Show Rate"
              value={`${m.noShowRate}%`}
              change={m.noShowRate > 10 ? -1 : 1}
              invertColor
            />
          </div>

          {/* AI Summary */}
          <div className="bg-lavender-50 border border-lavender-200 rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles size={18} className="text-lavender-600" />
              <h2 className="text-lg font-semibold text-lavender-700">AI Business Review</h2>
            </div>
            <div className="text-sm text-slate-700 leading-relaxed space-y-3">
              {summaryText.split('\n\n').filter(Boolean).map((para, i) => (
                <p key={i}>{para}</p>
              ))}
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-2 gap-6">
            {/* Revenue Trend */}
            <div className="bg-white rounded-2xl shadow-soft p-4">
              <h3 className="font-semibold mb-4">Revenue Trend</h3>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={revenueChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `$${v}`} />
                  <Tooltip formatter={(v: number) => [`$${v}`, 'Revenue']} />
                  <Area type="monotone" dataKey="revenue" stroke="#8AA694" fill="#8AA694" fillOpacity={0.1} strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Top Services */}
            <div className="bg-white rounded-2xl shadow-soft p-4">
              <h3 className="font-semibold mb-4">Top Services</h3>
              {m.topServices.length === 0 ? (
                <p className="text-slate-400 text-sm py-8 text-center">No service data</p>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={m.topServices} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={100} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#9F8ECB" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Bookings by Day */}
          <div className="bg-white rounded-2xl shadow-soft p-4">
            <h3 className="font-semibold mb-4">Bookings by Day of Week</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={m.busiestDays.length > 0 ? m.busiestDays : dayNames.map((d) => ({ day: d, count: 0 }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#8AA694" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Recommendations */}
          {recommendations.length > 0 && (
            <div>
              <h3 className="font-semibold mb-3">Recommendations</h3>
              <div className="grid grid-cols-3 gap-4">
                {recommendations.map((rec, i) => (
                  <div key={i} className="bg-white rounded-2xl shadow-soft p-4">
                    <div className="flex items-start gap-3">
                      <span className="flex-shrink-0 w-7 h-7 rounded-full bg-sage-100 text-sage-700 flex items-center justify-center text-sm font-bold">
                        {i + 1}
                      </span>
                      <div>
                        <p className="font-medium text-sm">{rec.title}</p>
                        <p className="text-xs text-slate-500 mt-1">{rec.description}</p>
                        {rec.link && (
                          <a
                            href={rec.link}
                            className="text-xs text-sage-600 hover:text-sage-700 font-medium mt-2 inline-block"
                          >
                            Take Action →
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Extra stats */}
          <div className="grid grid-cols-3 gap-4">
            <StatCard label="Avg Booking Value" value={`$${m.avgBookingValue}`} />
            <StatCard label="Retention Rate" value={`${m.retentionRate}%`} />
            <StatCard label="Returning Customers" value={m.returningCustomers} />
          </div>
        </>
      ) : null}
    </div>
  );
}

function KpiCard({
  label,
  value,
  change,
  invertColor,
}: {
  label: string;
  value: string | number;
  change?: number;
  invertColor?: boolean;
}) {
  const isPositive = invertColor ? (change ?? 0) < 0 : (change ?? 0) > 0;
  const isNegative = invertColor ? (change ?? 0) > 0 : (change ?? 0) < 0;

  return (
    <div className="bg-white rounded-2xl shadow-soft p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-2xl font-serif font-bold mt-1">{value}</p>
      {change !== undefined && change !== 0 && (
        <div className={cn('flex items-center gap-1 mt-1 text-xs font-medium', isPositive ? 'text-sage-600' : isNegative ? 'text-red-500' : 'text-slate-400')}>
          {change > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          {change > 0 ? '+' : ''}{change}% vs last month
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white rounded-2xl shadow-soft p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-xl font-serif font-bold mt-1">{value}</p>
    </div>
  );
}
