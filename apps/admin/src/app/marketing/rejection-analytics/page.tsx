'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  BarChart3,
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  ShieldAlert,
  Info,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { cn } from '@/lib/cn';
import { api } from '@/lib/api';
import { useToast } from '@/lib/toast';
import { PageSkeleton } from '@/components/skeleton';

// --- Constants ---

const AGENTS = [
  'MKT_BLOG_WRITER',
  'MKT_SOCIAL_CREATOR',
  'MKT_EMAIL_COMPOSER',
  'MKT_CASE_STUDY',
  'MKT_VIDEO_SCRIPT',
  'MKT_NEWSLETTER',
  'MKT_SCHEDULER',
  'MKT_PUBLISHER',
  'MKT_PERF_TRACKER',
  'MKT_TREND_ANALYZER',
  'MKT_CALENDAR_PLANNER',
  'MKT_ROI_REPORTER',
] as const;

const AGENT_LABELS: Record<string, string> = {
  MKT_BLOG_WRITER: 'Blog Writer',
  MKT_SOCIAL_CREATOR: 'Social Creator',
  MKT_EMAIL_COMPOSER: 'Email Composer',
  MKT_CASE_STUDY: 'Case Study',
  MKT_VIDEO_SCRIPT: 'Video Script',
  MKT_NEWSLETTER: 'Newsletter',
  MKT_SCHEDULER: 'Scheduler',
  MKT_PUBLISHER: 'Publisher',
  MKT_PERF_TRACKER: 'Perf Tracker',
  MKT_TREND_ANALYZER: 'Trend Analyzer',
  MKT_CALENDAR_PLANNER: 'Calendar Planner',
  MKT_ROI_REPORTER: 'ROI Reporter',
};

const REJECTION_CODE_LABELS: Record<string, string> = {
  R01: 'Factual Error',
  R02: 'Off-Brand',
  R03: 'Low Quality',
  R04: 'Duplicate',
  R05: 'Missing CTA',
  R06: 'Wrong Platform',
  R07: 'Sensitive Topic',
  R08: 'Outdated Info',
  R09: 'Poor SEO',
  R10: 'Compliance Issue',
};

const REJECTION_CODES = Object.keys(REJECTION_CODE_LABELS);

const GATES = ['GATE_1', 'GATE_2', 'GATE_3', 'GATE_4'] as const;

const SEVERITIES = ['MINOR', 'MAJOR', 'CRITICAL'] as const;

const SEVERITY_BADGE_STYLES: Record<string, string> = {
  MINOR: 'bg-slate-100 text-slate-600',
  MAJOR: 'bg-amber-100 text-amber-700',
  CRITICAL: 'bg-red-100 text-red-700',
};

// --- Types ---

interface RejectionLog {
  id: string;
  date: string;
  draftTitle: string;
  agentId: string;
  gate: string;
  rejectionCode: string;
  severity: string;
  reason: string;
}

interface WeeklySummary {
  totalThisWeek: number;
  totalLastWeek: number;
  changePercent: number;
  mostCommonCode: string;
  mostRejectedAgent: string;
  rejectionRate: number;
  byCode: { code: string; count: number }[];
  byAgent: { agent: string; count: number }[];
}

interface Stats {
  byGate: { gate: string; count: number }[];
  byCode: { code: string; count: number }[];
  byAgent: { agent: string; count: number }[];
  bySeverity: { severity: string; count: number }[];
}

interface AgentDetail {
  agentType: string;
  recentTrend: 'up' | 'down' | 'stable';
  changePercent: number;
  breakdown: { code: string; count: number }[];
  last30Days: number;
  last60Days: number;
}

interface Filters {
  startDate: string;
  endDate: string;
  gate: string;
  agentId: string;
  rejectionCode: string;
  severity: string;
}

// --- Component ---

export default function RejectionAnalyticsPage() {
  const { toast } = useToast();

  const [filters, setFilters] = useState<Filters>({
    startDate: '',
    endDate: '',
    gate: '',
    agentId: '',
    rejectionCode: '',
    severity: '',
  });

  const [logs, setLogs] = useState<RejectionLog[]>([]);
  const [logsTotal, setLogsTotal] = useState(0);
  const [logsPage, setLogsPage] = useState(0);
  const [stats, setStats] = useState<Stats | null>(null);
  const [weeklySummary, setWeeklySummary] = useState<WeeklySummary | null>(null);
  const [agentDetail, setAgentDetail] = useState<AgentDetail | null>(null);
  const [selectedDetailAgent, setSelectedDetailAgent] = useState('');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const PAGE_SIZE = 20;

  const buildQueryParams = useCallback(() => {
    const params = new URLSearchParams();
    if (filters.startDate) params.set('startDate', filters.startDate);
    if (filters.endDate) params.set('endDate', filters.endDate);
    if (filters.gate) params.set('gate', filters.gate);
    if (filters.agentId) params.set('agentId', filters.agentId);
    if (filters.rejectionCode) params.set('rejectionCode', filters.rejectionCode);
    if (filters.severity) params.set('severity', filters.severity);
    return params.toString();
  }, [filters]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const query = buildQueryParams();
      const logParams = new URLSearchParams(query);
      logParams.set('skip', String(logsPage * PAGE_SIZE));
      logParams.set('take', String(PAGE_SIZE));

      const [statsRes, summaryRes, logsRes] = await Promise.all([
        api.get<Stats>(`/rejection-analytics/stats?${query}`),
        api.get<WeeklySummary>(`/rejection-analytics/weekly-summary?${query}`),
        api.get<{ items: RejectionLog[]; total: number }>(
          `/rejection-analytics/logs?${logParams.toString()}`,
        ),
      ]);

      setStats(statsRes);
      setWeeklySummary(summaryRes);
      setLogs(logsRes.items);
      setLogsTotal(logsRes.total);
    } catch (err) {
      toast('Failed to load rejection data', 'error');
    } finally {
      setLoading(false);
    }
  }, [buildQueryParams, logsPage, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!selectedDetailAgent) {
      setAgentDetail(null);
      return;
    }
    api
      .get<AgentDetail>(`/rejection-analytics/agent/${selectedDetailAgent}`)
      .then(setAgentDetail)
      .catch((err) => {
        toast(err instanceof Error ? err.message : 'Failed to load agent detail', 'error');
      });
  }, [selectedDetailAgent, toast]);

  const updateFilter = (key: keyof Filters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setLogsPage(0);
  };

  const totalPages = Math.ceil(logsTotal / PAGE_SIZE);

  // Weekly trend data for line chart (from weeklySummary or generate placeholder)
  const trendData = weeklySummary?.byCode
    ? Array.from({ length: 12 }, (_, i) => ({
        week: `W${i + 1}`,
        rate: 0,
      }))
    : [];

  if (loading) {
    return <PageSkeleton />;
  }

  const hasData = stats && (stats.byCode.length > 0 || stats.byAgent.length > 0);

  return (
    <div className="p-6 space-y-6 animate-page-fade">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/marketing" className="text-slate-400 hover:text-slate-600 transition-colors">
            <ArrowLeft size={20} />
            <span className="ml-1 text-sm">Back to Marketing</span>
          </Link>
          <div className="flex items-center gap-2">
            <BarChart3 size={24} className="text-[#71907C]" />
            <h1 className="text-2xl font-serif font-bold text-slate-800">Rejection Analytics</h1>
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div
        data-testid="rejection-filters"
        className="bg-white rounded-2xl shadow-soft p-4 flex flex-wrap items-end gap-4"
      >
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-500">Start Date</label>
          <input
            type="date"
            value={filters.startDate}
            onChange={(e) => updateFilter('startDate', e.target.value)}
            className="bg-slate-50 border-transparent focus:bg-white focus:ring-2 focus:ring-sage-500 rounded-xl px-3 py-2 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-500">End Date</label>
          <input
            type="date"
            value={filters.endDate}
            onChange={(e) => updateFilter('endDate', e.target.value)}
            className="bg-slate-50 border-transparent focus:bg-white focus:ring-2 focus:ring-sage-500 rounded-xl px-3 py-2 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-500">Gate</label>
          <select
            data-testid="filter-gate"
            value={filters.gate}
            onChange={(e) => updateFilter('gate', e.target.value)}
            className="bg-slate-50 border-transparent focus:bg-white focus:ring-2 focus:ring-sage-500 rounded-xl px-3 py-2 text-sm"
          >
            <option value="">All</option>
            {GATES.map((g) => (
              <option key={g} value={g}>
                {g.replace('_', ' ')}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-500">Agent</label>
          <select
            data-testid="filter-agent"
            value={filters.agentId}
            onChange={(e) => updateFilter('agentId', e.target.value)}
            className="bg-slate-50 border-transparent focus:bg-white focus:ring-2 focus:ring-sage-500 rounded-xl px-3 py-2 text-sm"
          >
            <option value="">All</option>
            {AGENTS.map((a) => (
              <option key={a} value={a}>
                {AGENT_LABELS[a]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-500">Code</label>
          <select
            value={filters.rejectionCode}
            onChange={(e) => updateFilter('rejectionCode', e.target.value)}
            className="bg-slate-50 border-transparent focus:bg-white focus:ring-2 focus:ring-sage-500 rounded-xl px-3 py-2 text-sm"
          >
            <option value="">All</option>
            {REJECTION_CODES.map((c) => (
              <option key={c} value={c}>
                {c}: {REJECTION_CODE_LABELS[c]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-500">Severity</label>
          <select
            value={filters.severity}
            onChange={(e) => updateFilter('severity', e.target.value)}
            className="bg-slate-50 border-transparent focus:bg-white focus:ring-2 focus:ring-sage-500 rounded-xl px-3 py-2 text-sm"
          >
            <option value="">All</option>
            {SEVERITIES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>

      {!hasData ? (
        <div className="bg-white rounded-2xl shadow-soft p-16 flex flex-col items-center justify-center text-center">
          <AlertTriangle size={48} className="text-slate-300 mb-3" />
          <h3 className="text-lg font-medium text-slate-600 mb-1">No rejection data</h3>
          <p className="text-sm text-slate-400 max-w-sm">
            No rejections found for the selected filters. Adjust your date range or filters to see
            data.
          </p>
        </div>
      ) : (
        <>
          {/* Charts Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Rejection by Code */}
            <div data-testid="chart-by-code" className="bg-white rounded-2xl shadow-soft p-6">
              <h2 className="text-sm font-semibold text-slate-700 mb-4">Rejections by Code</h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={stats.byCode.map((item) => ({
                    ...item,
                    label: `${item.code}: ${REJECTION_CODE_LABELS[item.code] || item.code}`,
                  }))}
                  layout="vertical"
                  margin={{ left: 100, right: 20, top: 5, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis type="number" tick={{ fontSize: 12 }} />
                  <YAxis type="category" dataKey="label" tick={{ fontSize: 11 }} width={95} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: '12px',
                      border: 'none',
                      boxShadow: '0 12px 40px -12px rgba(0,0,0,0.1)',
                    }}
                  />
                  <Bar dataKey="count" fill="#9F8ECB" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Rejection by Agent */}
            <div data-testid="chart-by-agent" className="bg-white rounded-2xl shadow-soft p-6">
              <h2 className="text-sm font-semibold text-slate-700 mb-4">Rejections by Agent</h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={stats.byAgent.map((item) => ({
                    ...item,
                    label: AGENT_LABELS[item.agent] || item.agent,
                  }))}
                  margin={{ left: 10, right: 20, top: 5, bottom: 40 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={0} height={50} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: '12px',
                      border: 'none',
                      boxShadow: '0 12px 40px -12px rgba(0,0,0,0.1)',
                    }}
                  />
                  <Bar dataKey="count" fill="#71907C" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Rejection Rate Trend */}
            <div data-testid="chart-trend" className="bg-white rounded-2xl shadow-soft p-6">
              <h2 className="text-sm font-semibold text-slate-700 mb-4">
                Rejection Rate Trend (12 weeks)
              </h2>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={trendData} margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="week" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} unit="%" />
                  <Tooltip
                    contentStyle={{
                      borderRadius: '12px',
                      border: 'none',
                      boxShadow: '0 12px 40px -12px rgba(0,0,0,0.1)',
                    }}
                    formatter={(value: number) => [`${value}%`, 'Rejection Rate']}
                  />
                  <Line
                    type="monotone"
                    dataKey="rate"
                    stroke="#9F8ECB"
                    strokeWidth={2}
                    dot={{ fill: '#9F8ECB', r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Agent-Specific Detail */}
            <div data-testid="agent-detail-panel" className="bg-white rounded-2xl shadow-soft p-6">
              <h2 className="text-sm font-semibold text-slate-700 mb-4">Agent-Specific Detail</h2>
              <select
                value={selectedDetailAgent}
                onChange={(e) => setSelectedDetailAgent(e.target.value)}
                className="bg-slate-50 border-transparent focus:bg-white focus:ring-2 focus:ring-sage-500 rounded-xl px-3 py-2 text-sm w-full mb-4"
              >
                <option value="">Select an agent...</option>
                {AGENTS.map((a) => (
                  <option key={a} value={a}>
                    {AGENT_LABELS[a]}
                  </option>
                ))}
              </select>

              {!selectedDetailAgent && (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Info size={32} className="text-slate-300 mb-2" />
                  <p className="text-sm text-slate-400">
                    Select an agent to view rejection breakdown
                  </p>
                </div>
              )}

              {selectedDetailAgent && agentDetail && (
                <div className="space-y-4">
                  {/* Trend indicator */}
                  <div className="flex items-center gap-2">
                    {agentDetail.recentTrend === 'up' && (
                      <>
                        <TrendingUp size={18} className="text-red-500" />
                        <span className="text-sm font-medium text-red-600">
                          +{agentDetail.changePercent}% vs last period
                        </span>
                      </>
                    )}
                    {agentDetail.recentTrend === 'down' && (
                      <>
                        <TrendingDown size={18} className="text-[#71907C]" />
                        <span className="text-sm font-medium text-[#71907C]">
                          -{agentDetail.changePercent}% vs last period
                        </span>
                      </>
                    )}
                    {agentDetail.recentTrend === 'stable' && (
                      <>
                        <Minus size={18} className="text-slate-500" />
                        <span className="text-sm font-medium text-slate-500">
                          Stable ({agentDetail.changePercent}% change)
                        </span>
                      </>
                    )}
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-50 rounded-xl p-3">
                      <p className="text-xs text-slate-500">Last 30 days</p>
                      <p className="text-xl font-serif font-bold text-slate-800">
                        {agentDetail.last30Days}
                      </p>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-3">
                      <p className="text-xs text-slate-500">Last 60 days</p>
                      <p className="text-xl font-serif font-bold text-slate-800">
                        {agentDetail.last60Days}
                      </p>
                    </div>
                  </div>

                  {/* Breakdown */}
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Breakdown by Code
                    </p>
                    {agentDetail.breakdown.length === 0 ? (
                      <p className="text-sm text-slate-400">No rejections</p>
                    ) : (
                      agentDetail.breakdown.map((item) => (
                        <div key={item.code} className="flex items-center justify-between text-sm">
                          <span className="text-slate-600">
                            {item.code}: {REJECTION_CODE_LABELS[item.code] || item.code}
                          </span>
                          <span className="font-medium text-slate-800">{item.count}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {selectedDetailAgent && !agentDetail && (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-pulse text-sm text-slate-400">Loading...</div>
                </div>
              )}
            </div>
          </div>

          {/* Weekly Summary */}
          {weeklySummary && (
            <div data-testid="weekly-summary" className="bg-white rounded-2xl shadow-soft p-6">
              <h2 className="text-sm font-semibold text-slate-700 mb-4">Weekly Summary</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-slate-50 rounded-xl p-4">
                  <p className="text-xs text-slate-500 mb-1">Total This Week</p>
                  <p className="text-3xl font-serif font-bold text-slate-800">
                    {weeklySummary.totalThisWeek}
                  </p>
                </div>
                <div className="bg-slate-50 rounded-xl p-4">
                  <p className="text-xs text-slate-500 mb-1">vs Last Week</p>
                  <div className="flex items-center gap-2">
                    <p className="text-3xl font-serif font-bold text-slate-800">
                      {weeklySummary.totalLastWeek}
                    </p>
                    <span
                      className={cn(
                        'flex items-center gap-0.5 text-sm font-medium',
                        weeklySummary.changePercent > 0 && 'text-red-600',
                        weeklySummary.changePercent < 0 && 'text-[#71907C]',
                        weeklySummary.changePercent === 0 && 'text-slate-500',
                      )}
                    >
                      {weeklySummary.changePercent > 0 ? (
                        <TrendingUp size={14} />
                      ) : weeklySummary.changePercent < 0 ? (
                        <TrendingDown size={14} />
                      ) : (
                        <Minus size={14} />
                      )}
                      {weeklySummary.changePercent > 0 ? '+' : ''}
                      {weeklySummary.changePercent}%
                    </span>
                  </div>
                </div>
                <div className="bg-slate-50 rounded-xl p-4">
                  <p className="text-xs text-slate-500 mb-1">Most Common Code</p>
                  <p className="text-lg font-semibold text-slate-800">
                    {weeklySummary.mostCommonCode}
                  </p>
                  <p className="text-xs text-slate-400">
                    {REJECTION_CODE_LABELS[weeklySummary.mostCommonCode] || ''}
                  </p>
                </div>
                <div className="bg-slate-50 rounded-xl p-4">
                  <p className="text-xs text-slate-500 mb-1">Most Rejected Agent</p>
                  <p className="text-lg font-semibold text-slate-800">
                    {AGENT_LABELS[weeklySummary.mostRejectedAgent] ||
                      weeklySummary.mostRejectedAgent}
                  </p>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Rejection Log Table */}
      <div
        data-testid="rejection-log-table"
        className="bg-white rounded-2xl shadow-soft overflow-hidden"
      >
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-700">
            Rejection Log <span className="text-slate-400 font-normal">({logsTotal} total)</span>
          </h2>
        </div>

        {logs.length === 0 ? (
          <div className="p-12 text-center">
            <ShieldAlert size={36} className="text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-400">No rejection logs match the current filters</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Draft Title
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Agent
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Gate
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Code
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Severity
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Reason
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {logs.map((log) => (
                    <tr
                      key={log.id}
                      data-testid="rejection-log-row"
                      className="hover:bg-slate-50/50 cursor-pointer transition-colors"
                      onClick={() => setExpandedRow(expandedRow === log.id ? null : log.id)}
                    >
                      <td className="px-6 py-3 text-slate-600 whitespace-nowrap">
                        {new Date(log.date).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-3 text-slate-800 font-medium max-w-[200px] truncate">
                        {log.draftTitle}
                      </td>
                      <td className="px-6 py-3 text-slate-600 whitespace-nowrap">
                        {AGENT_LABELS[log.agentId] || log.agentId}
                      </td>
                      <td className="px-6 py-3 text-slate-600 whitespace-nowrap">
                        {log.gate.replace('_', ' ')}
                      </td>
                      <td className="px-6 py-3 whitespace-nowrap">
                        <span className="text-slate-800 font-medium">{log.rejectionCode}</span>
                        <span className="text-slate-400 ml-1 text-xs">
                          {REJECTION_CODE_LABELS[log.rejectionCode] || ''}
                        </span>
                      </td>
                      <td className="px-6 py-3 whitespace-nowrap">
                        <span
                          className={cn(
                            'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                            SEVERITY_BADGE_STYLES[log.severity] || 'bg-slate-100 text-slate-600',
                          )}
                        >
                          {log.severity}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-slate-500">
                        <div className="flex items-center gap-1">
                          {expandedRow === log.id ? (
                            <ChevronUp size={14} />
                          ) : (
                            <ChevronDown size={14} />
                          )}
                          <span className="text-xs">
                            {expandedRow === log.id ? 'Hide' : 'Show'}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Expanded reason rows */}
              {logs.map(
                (log) =>
                  expandedRow === log.id && (
                    <div
                      key={`reason-${log.id}`}
                      className="px-6 py-4 bg-slate-50 border-b border-slate-100"
                    >
                      <p className="text-xs font-medium text-slate-500 mb-1">Rejection Reason</p>
                      <p className="text-sm text-slate-700">{log.reason}</p>
                    </div>
                  ),
              )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between">
                <p className="text-xs text-slate-500">
                  Showing {logsPage * PAGE_SIZE + 1}–
                  {Math.min((logsPage + 1) * PAGE_SIZE, logsTotal)} of {logsTotal}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setLogsPage((p) => Math.max(0, p - 1))}
                    disabled={logsPage === 0}
                    className={cn(
                      'p-2 rounded-xl transition-colors',
                      logsPage === 0
                        ? 'text-slate-300 cursor-not-allowed'
                        : 'text-slate-600 hover:bg-slate-100',
                    )}
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span className="text-sm text-slate-600">
                    {logsPage + 1} / {totalPages}
                  </span>
                  <button
                    onClick={() => setLogsPage((p) => Math.min(totalPages - 1, p + 1))}
                    disabled={logsPage >= totalPages - 1}
                    className={cn(
                      'p-2 rounded-xl transition-colors',
                      logsPage >= totalPages - 1
                        ? 'text-slate-300 cursor-not-allowed'
                        : 'text-slate-600 hover:bg-slate-100',
                    )}
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
