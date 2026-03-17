'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { TrendingUp, FileText, Target } from 'lucide-react';
import { PageSkeleton } from '@/components/skeleton';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface AgentRunStats {
  totalRuns: number;
  byAgent?: Array<{ agentType: string; _count: number }>;
  byStatus?: Array<{ status: string; _count: number }>;
}

type DateRange = '7' | '30' | '90';

export default function AIPerformancePage() {
  const [dateRange, setDateRange] = useState<DateRange>('30');
  const [agentStats, setAgentStats] = useState<AgentRunStats | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const agents = await api.get<any>('/agent-runs/stats').catch(() => null);
      setAgentStats(agents as AgentRunStats);
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

  if (loading) {
    return (
      <div className="space-y-6" data-testid="performance-loading">
        <PageSkeleton />
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4" data-testid="kpi-grid">
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
