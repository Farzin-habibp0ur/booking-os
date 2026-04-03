'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { TrendingUp, FileText, Target, Bot, Zap, Send, Ban } from 'lucide-react';
import { PageSkeleton } from '@/components/skeleton';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

interface AgentRunStats {
  totalRuns: number;
  byAgent?: Array<{ agentType: string; _count: number }>;
  byStatus?: Array<{ status: string; _count: number }>;
}

type DateRange = '7' | '30' | '90';
type PerfTab = 'agents' | 'automations' | 'combined';

export default function AIPerformancePage() {
  const [dateRange, setDateRange] = useState<DateRange>('30');
  const [activeTab, setActiveTab] = useState<PerfTab>('agents');
  const [agentStats, setAgentStats] = useState<AgentRunStats | null>(null);
  const [autoOverview, setAutoOverview] = useState<any>(null);
  const [autoTimeline, setAutoTimeline] = useState<any[]>([]);
  const [autoByRule, setAutoByRule] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [agents, autoOv, autoTl, autoRl] = await Promise.allSettled([
        api.get<any>('/agent-runs/stats'),
        api.get<any>('/automations/analytics/overview'),
        api.get<any>('/automations/analytics/timeline?days=30'),
        api.get<any>('/automations/analytics/by-rule'),
      ]);
      if (agents.status === 'fulfilled') setAgentStats(agents.value as AgentRunStats);
      if (autoOv.status === 'fulfilled') setAutoOverview(autoOv.value);
      if (autoTl.status === 'fulfilled')
        setAutoTimeline(Array.isArray(autoTl.value) ? autoTl.value : []);
      if (autoRl.status === 'fulfilled')
        setAutoByRule(Array.isArray(autoRl.value) ? autoRl.value : []);
    } catch {
      // Graceful fallback
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

  const tabs: Array<{ value: PerfTab; label: string; icon: React.ReactNode }> = [
    { value: 'agents', label: 'Agent Performance', icon: <Bot size={14} /> },
    { value: 'automations', label: 'Automation Analytics', icon: <Zap size={14} /> },
    { value: 'combined', label: 'Combined', icon: <TrendingUp size={14} /> },
  ];

  const totalRuns = agentStats?.totalRuns || 0;
  const completedRuns = agentStats?.byStatus?.find((s) => s.status === 'COMPLETED')?._count || 0;
  const failedRuns = agentStats?.byStatus?.find((s) => s.status === 'FAILED')?._count || 0;
  const successRate = totalRuns > 0 ? Math.round((completedRuns / totalRuns) * 100) : 0;

  const agentByType = agentStats?.byAgent
    ? agentStats.byAgent.map((a) => ({
        agent: formatAgentName(a.agentType),
        runs: a._count,
      }))
    : [];

  const pieData = [
    { name: 'Sent', value: autoOverview?.totalMessagesSent7d || 0, color: '#71907C' },
    { name: 'Skipped', value: autoOverview?.totalMessagesSkipped7d || 0, color: '#d97706' },
    { name: 'Failed', value: autoOverview?.totalMessagesFailed7d || 0, color: '#dc2626' },
  ].filter((d) => d.value > 0);

  if (loading) {
    return (
      <div className="space-y-6" data-testid="performance-loading">
        <PageSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="performance-page">
      {/* Top controls: date range + inner tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        {/* Inner tab bar */}
        <div
          className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-1"
          data-testid="perf-tab-bar"
        >
          {tabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors',
                activeTab === tab.value
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300',
              )}
              data-testid={`tab-${tab.value}`}
            >
              {tab.icon}
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Date range selector */}
        <div className="flex items-center gap-2 sm:ml-auto" data-testid="date-range-selector">
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
      </div>

      {/* Agent Performance Tab */}
      {(activeTab === 'agents' || activeTab === 'combined') && (
        <div data-testid="agent-performance-section">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6" data-testid="kpi-grid">
            <KPICard
              icon={<TrendingUp size={18} />}
              label="Total Runs"
              value={totalRuns}
              color="text-sage-600"
            />
            <KPICard
              icon={<FileText size={18} />}
              label="Completed"
              value={completedRuns}
              color="text-green-600"
            />
            <KPICard
              icon={<Target size={18} />}
              label="Failed"
              value={failedRuns}
              color={failedRuns > 0 ? 'text-red-600' : 'text-slate-600'}
            />
            <KPICard
              icon={<TrendingUp size={18} />}
              label="Success Rate"
              value={totalRuns > 0 ? `${successRate}%` : 'N/A'}
              color={
                successRate >= 90
                  ? 'text-green-600'
                  : successRate >= 70
                    ? 'text-amber-600'
                    : 'text-red-600'
              }
            />
          </div>

          {/* Agent Run Comparison */}
          {agentByType.length > 0 && (
            <div
              className="rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-soft border border-slate-100 dark:border-slate-800"
              data-testid="agent-comparison-chart"
            >
              <h3 className="font-serif text-base font-semibold text-slate-900 dark:text-white mb-4">
                Agent Run Comparison
              </h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={agentByType} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis type="number" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                  <YAxis
                    dataKey="agent"
                    type="category"
                    tick={{ fontSize: 10 }}
                    stroke="#94a3b8"
                    width={120}
                  />
                  <Tooltip />
                  <Bar dataKey="runs" fill="#71907C" name="Runs" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* Automation Analytics Tab */}
      {(activeTab === 'automations' || activeTab === 'combined') && (
        <div data-testid="automation-analytics-section">
          {/* Automation KPIs */}
          <div
            className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6"
            data-testid="automation-kpi-grid"
          >
            {[
              {
                label: 'Active Rules',
                value: autoOverview?.totalRulesActive || 0,
                icon: <Zap size={18} />,
                color: 'text-sage-600',
              },
              {
                label: 'Messages Sent (7d)',
                value: autoOverview?.totalMessagesSent7d || 0,
                icon: <Send size={18} />,
                color: 'text-sage-600',
              },
              {
                label: 'Delivery Rate',
                value: `${autoOverview?.deliveryRate || 0}%`,
                icon: <TrendingUp size={18} />,
                color: 'text-sage-600',
              },
              {
                label: 'Skipped (7d)',
                value: autoOverview?.totalMessagesSkipped7d || 0,
                icon: <Ban size={18} />,
                color: 'text-amber-600',
              },
            ].map((stat) => (
              <KPICard
                key={stat.label}
                icon={stat.icon}
                label={stat.label}
                value={stat.value}
                color={stat.color}
              />
            ))}
          </div>

          {/* Timeline */}
          {autoTimeline.length > 0 && (
            <div
              className="rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-soft border border-slate-100 dark:border-slate-800 mb-6"
              data-testid="automation-timeline-chart"
            >
              <h3 className="font-serif text-base font-semibold text-slate-900 dark:text-white mb-4">
                Daily Volume (30 days)
              </h3>
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={autoTimeline}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(d) => d.slice(5)} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Area
                    type="monotone"
                    dataKey="sent"
                    stackId="1"
                    stroke="#71907C"
                    fill="#71907C"
                    fillOpacity={0.6}
                    name="Sent"
                  />
                  <Area
                    type="monotone"
                    dataKey="skipped"
                    stackId="1"
                    stroke="#d97706"
                    fill="#d97706"
                    fillOpacity={0.4}
                    name="Skipped"
                  />
                  <Area
                    type="monotone"
                    dataKey="failed"
                    stackId="1"
                    stroke="#dc2626"
                    fill="#dc2626"
                    fillOpacity={0.4}
                    name="Failed"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-6 mb-6">
            {/* Pie */}
            {pieData.length > 0 && (
              <div
                className="rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-soft border border-slate-100 dark:border-slate-800"
                data-testid="automation-pie-chart"
              >
                <h3 className="font-serif text-base font-semibold text-slate-900 dark:text-white mb-4">
                  Outcome Breakdown (7d)
                </h3>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {pieData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Top rule */}
            {autoOverview?.topPerformingRule && (
              <div
                className="rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-soft border border-slate-100 dark:border-slate-800"
                data-testid="top-performing-rule"
              >
                <h3 className="font-serif text-base font-semibold text-slate-900 dark:text-white mb-4">
                  Top Performing Rule
                </h3>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-sage-50 rounded-xl flex items-center justify-center">
                    <Zap size={18} className="text-sage-600" />
                  </div>
                  <div>
                    <p className="font-medium text-slate-900 dark:text-white">
                      {autoOverview.topPerformingRule.name}
                    </p>
                    <p className="text-xs text-slate-500">
                      {autoOverview.topPerformingRule.sentCount} messages sent this week
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Per-rule table */}
          {autoByRule.length > 0 && (
            <div
              className="rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-soft border border-slate-100 dark:border-slate-800"
              data-testid="automation-rule-table"
            >
              <h3 className="font-serif text-base font-semibold text-slate-900 dark:text-white mb-4">
                Per-Rule Breakdown (7d)
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-slate-500 border-b border-slate-100 dark:border-slate-800">
                      <th className="text-left py-2 font-medium">Rule</th>
                      <th className="text-left py-2 font-medium">Trigger</th>
                      <th className="text-right py-2 font-medium">Sent</th>
                      <th className="text-right py-2 font-medium">Skipped</th>
                      <th className="text-right py-2 font-medium">Failed</th>
                      <th className="text-right py-2 font-medium">Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {autoByRule
                      .sort((a, b) => b.sent - a.sent)
                      .map((r: any) => {
                        const total = r.sent + r.failed;
                        const rate = total > 0 ? Math.round((r.sent / total) * 100) : 0;
                        return (
                          <tr
                            key={r.ruleId}
                            className="border-b border-slate-50 dark:border-slate-800"
                          >
                            <td className="py-2 font-medium text-slate-900 dark:text-white">
                              {r.ruleName}
                            </td>
                            <td className="py-2 text-slate-500">
                              <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-xs">
                                {r.trigger}
                              </span>
                            </td>
                            <td className="py-2 text-right text-sage-700">{r.sent}</td>
                            <td className="py-2 text-right text-amber-600">{r.skipped}</td>
                            <td className="py-2 text-right text-red-600">{r.failed}</td>
                            <td className="py-2 text-right">
                              <span
                                className={cn(
                                  'text-xs font-medium',
                                  rate >= 90
                                    ? 'text-sage-700'
                                    : rate >= 70
                                      ? 'text-amber-600'
                                      : 'text-red-600',
                                )}
                              >
                                {rate}%
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function KPICard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color?: string;
}) {
  return (
    <div className="rounded-2xl bg-white dark:bg-slate-900 p-5 shadow-soft border border-slate-100 dark:border-slate-800">
      <div className="flex items-center gap-2 mb-2 text-slate-500">
        {icon}
        <p className="text-xs">{label}</p>
      </div>
      <p className={cn('font-serif text-2xl font-bold', color || 'text-slate-900 dark:text-white')}>
        {value}
      </p>
    </div>
  );
}

function formatAgentName(agentType: string): string {
  return agentType
    .replace(/([A-Z])/g, ' $1')
    .trim()
    .replace(/_/g, ' ');
}
