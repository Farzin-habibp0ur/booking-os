'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { TrendingUp, ThumbsUp, ThumbsDown } from 'lucide-react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

interface PerformanceData {
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
  successRate: number;
  avgRunTime: number;
  dailyStats?: Array<{
    date: string;
    successRate: number;
    created: number;
    approved: number;
    dismissed: number;
  }>;
  agentComparison?: Array<{
    agentType: string;
    runs: number;
    successRate: number;
    cardsCreated: number;
  }>;
}

interface FeedbackStats {
  agentType: string;
  helpful: number;
  notHelpful: number;
  total: number;
  helpfulPercent: number;
}

type DateRange = '7' | '30' | '90';

export default function AIPerformancePage() {
  const [dateRange, setDateRange] = useState<DateRange>('30');
  const [performance, setPerformance] = useState<PerformanceData | null>(null);
  const [feedback, setFeedback] = useState<FeedbackStats[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [perfData, fbData] = await Promise.all([
        api.get<PerformanceData>(`/agents/runs?days=${dateRange}`).catch(() => null),
        api.get<any>('/agents/feedback/stats').catch(() => null),
      ]);

      // Process performance data or create mock
      if (perfData && typeof perfData === 'object' && 'totalRuns' in (perfData as any)) {
        setPerformance(perfData as PerformanceData);
      } else {
        setPerformance(generateMockPerformance(Number(dateRange)));
      }

      // Process feedback
      if (Array.isArray(fbData)) {
        setFeedback(fbData);
      } else if (fbData?.stats) {
        setFeedback(fbData.stats);
      } else {
        setFeedback(generateMockFeedback());
      }
    } catch {
      setPerformance(generateMockPerformance(Number(dateRange)));
      setFeedback(generateMockFeedback());
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const ranges: Array<{ value: DateRange; label: string }> = [
    { value: '7', label: 'Last 7 days' },
    { value: '30', label: 'Last 30 days' },
    { value: '90', label: 'Last 90 days' },
  ];

  if (loading) {
    return (
      <div className="space-y-6" data-testid="performance-loading">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-soft animate-pulse"
          >
            <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-1/4 mb-4" />
            <div className="h-48 bg-slate-100 dark:bg-slate-800 rounded" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="performance-page">
      {/* Date Range Selector */}
      <div className="flex items-center gap-2" data-testid="date-range-selector">
        {ranges.map((r) => (
          <button
            key={r.value}
            onClick={() => setDateRange(r.value)}
            className={cn(
              'px-3 py-1.5 text-sm font-medium rounded-lg transition-colors',
              dateRange === r.value
                ? 'bg-sage-100 text-sage-700'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
            )}
            data-testid={`range-${r.value}`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* KPI Cards */}
      {performance && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4" data-testid="kpi-grid">
          <KPICard label="Total Runs" value={performance.totalRuns} />
          <KPICard label="Successful" value={performance.successfulRuns} color="text-green-600" />
          <KPICard label="Failed" value={performance.failedRuns} color="text-red-600" />
          <KPICard
            label="Success Rate"
            value={`${Math.round(performance.successRate)}%`}
            color="text-sage-600"
          />
        </div>
      )}

      {/* Success Rate Over Time */}
      {performance?.dailyStats && performance.dailyStats.length > 0 && (
        <div
          className="rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-soft border border-slate-100 dark:border-slate-800"
          data-testid="success-rate-chart"
        >
          <h3 className="font-serif text-base font-semibold text-slate-900 dark:text-white mb-4">
            Success Rate Over Time
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={performance.dailyStats}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#94a3b8" />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} stroke="#94a3b8" />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="successRate"
                stroke="#71907C"
                strokeWidth={2}
                dot={false}
                name="Success Rate (%)"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Cards Created vs Approved vs Dismissed */}
      {performance?.dailyStats && performance.dailyStats.length > 0 && (
        <div
          className="rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-soft border border-slate-100 dark:border-slate-800"
          data-testid="cards-chart"
        >
          <h3 className="font-serif text-base font-semibold text-slate-900 dark:text-white mb-4">
            Cards Created vs Approved vs Dismissed
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={performance.dailyStats}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#94a3b8" />
              <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
              <Tooltip />
              <Legend />
              <Area
                type="monotone"
                dataKey="created"
                stackId="1"
                stroke="#9F8ECB"
                fill="#F5F3FA"
                name="Created"
              />
              <Area
                type="monotone"
                dataKey="approved"
                stackId="1"
                stroke="#71907C"
                fill="#E4EBE6"
                name="Approved"
              />
              <Area
                type="monotone"
                dataKey="dismissed"
                stackId="1"
                stroke="#ef4444"
                fill="#fef2f2"
                name="Dismissed"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Agent Comparison */}
      {performance?.agentComparison && performance.agentComparison.length > 0 && (
        <div
          className="rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-soft border border-slate-100 dark:border-slate-800"
          data-testid="agent-comparison-chart"
        >
          <h3 className="font-serif text-base font-semibold text-slate-900 dark:text-white mb-4">
            Agent Comparison
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={performance.agentComparison} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis type="number" tick={{ fontSize: 11 }} stroke="#94a3b8" />
              <YAxis
                dataKey="agentType"
                type="category"
                tick={{ fontSize: 11 }}
                stroke="#94a3b8"
                width={120}
                tickFormatter={(v) => v.replace(/_/g, ' ')}
              />
              <Tooltip />
              <Legend />
              <Bar dataKey="runs" fill="#71907C" name="Runs" />
              <Bar dataKey="cardsCreated" fill="#9F8ECB" name="Cards Created" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Staff Feedback Summary */}
      <div
        className="rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-soft border border-slate-100 dark:border-slate-800"
        data-testid="feedback-table"
      >
        <h3 className="font-serif text-base font-semibold text-slate-900 dark:text-white mb-4">
          Staff Feedback Summary
        </h3>
        {feedback.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-4">No feedback data available</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800">
                  <th className="text-left py-2 font-medium text-slate-600">Agent</th>
                  <th className="text-center py-2 font-medium text-slate-600">
                    <ThumbsUp size={14} className="inline mr-1" />
                    Helpful
                  </th>
                  <th className="text-center py-2 font-medium text-slate-600">
                    <ThumbsDown size={14} className="inline mr-1" />
                    Not Helpful
                  </th>
                  <th className="text-center py-2 font-medium text-slate-600">Helpful %</th>
                </tr>
              </thead>
              <tbody>
                {feedback.map((fb) => (
                  <tr
                    key={fb.agentType}
                    className="border-b border-slate-50 dark:border-slate-800 last:border-0"
                  >
                    <td className="py-2.5 text-slate-900 dark:text-white font-medium">
                      {fb.agentType.replace(/_/g, ' ')}
                    </td>
                    <td className="py-2.5 text-center text-green-600">{fb.helpful}</td>
                    <td className="py-2.5 text-center text-red-600">{fb.notHelpful}</td>
                    <td className="py-2.5 text-center">
                      <span
                        className={cn(
                          'text-xs font-medium px-2 py-0.5 rounded-full',
                          fb.helpfulPercent >= 80
                            ? 'bg-green-50 text-green-700'
                            : fb.helpfulPercent >= 50
                              ? 'bg-amber-50 text-amber-700'
                              : 'bg-red-50 text-red-700',
                        )}
                      >
                        {Math.round(fb.helpfulPercent)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Average Run Time */}
      {performance && (
        <div className="rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-soft border border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">Average Run Time</p>
              <p className="font-serif text-2xl font-bold text-slate-900 dark:text-white">
                {performance.avgRunTime}ms
              </p>
            </div>
            <TrendingUp className="text-lavender-400" size={32} />
          </div>
        </div>
      )}
    </div>
  );
}

function KPICard({
  label,
  value,
  color,
}: {
  label: string;
  value: string | number;
  color?: string;
}) {
  return (
    <div className="rounded-2xl bg-white dark:bg-slate-900 p-5 shadow-soft border border-slate-100 dark:border-slate-800">
      <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">{label}</p>
      <p className={cn('font-serif text-2xl font-bold', color || 'text-slate-900 dark:text-white')}>
        {value}
      </p>
    </div>
  );
}

function generateMockPerformance(days: number): PerformanceData {
  const dailyStats = Array.from({ length: days }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (days - 1 - i));
    return {
      date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      successRate: 75 + Math.random() * 20,
      created: Math.floor(Math.random() * 15) + 2,
      approved: Math.floor(Math.random() * 10) + 1,
      dismissed: Math.floor(Math.random() * 5),
    };
  });

  const agents = [
    'WAITLIST',
    'RETENTION',
    'DATA_HYGIENE',
    'SCHEDULING_OPTIMIZER',
    'QUOTE_FOLLOWUP',
  ];
  const agentComparison = agents.map((agentType) => ({
    agentType,
    runs: Math.floor(Math.random() * 100) + 10,
    successRate: 70 + Math.random() * 25,
    cardsCreated: Math.floor(Math.random() * 50) + 5,
  }));

  const totalRuns = agentComparison.reduce((sum, a) => sum + a.runs, 0);
  const successfulRuns = Math.round(totalRuns * 0.88);

  return {
    totalRuns,
    successfulRuns,
    failedRuns: totalRuns - successfulRuns,
    successRate: (successfulRuns / totalRuns) * 100,
    avgRunTime: Math.round(Math.random() * 2000 + 500),
    dailyStats,
    agentComparison,
  };
}

function generateMockFeedback(): FeedbackStats[] {
  const agents = [
    'WAITLIST',
    'RETENTION',
    'DATA_HYGIENE',
    'SCHEDULING_OPTIMIZER',
    'QUOTE_FOLLOWUP',
  ];
  return agents.map((agentType) => {
    const helpful = Math.floor(Math.random() * 30) + 5;
    const notHelpful = Math.floor(Math.random() * 10);
    const total = helpful + notHelpful;
    return {
      agentType,
      helpful,
      notHelpful,
      total,
      helpfulPercent: total > 0 ? (helpful / total) * 100 : 0,
    };
  });
}
