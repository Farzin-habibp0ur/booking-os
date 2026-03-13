'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { TrendingUp, FileText, Target, FlaskConical } from 'lucide-react';
import { PageSkeleton } from '@/components/skeleton';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

interface ContentStats {
  byStatus?: Record<string, number>;
  byTier?: Record<string, number>;
  byContentType?: Record<string, number>;
  byPillar?: Record<string, number>;
}

interface RejectionStats {
  byGate?: Record<string, number>;
  byCode?: Record<string, number>;
  byAgent?: Record<string, number>;
  bySeverity?: Record<string, number>;
}

interface ABTest {
  id: string;
  name: string;
  status: string;
  metric: string;
  winnerVariantId?: string;
  confidence?: number;
  startedAt?: string;
  endedAt?: string;
}

interface AgentRunStats {
  totalRuns: number;
  byAgent?: Array<{ agentType: string; _count: number }>;
  byStatus?: Array<{ status: string; _count: number }>;
}

type DateRange = '7' | '30' | '90';

const TIER_COLORS: Record<string, string> = {
  GREEN: '#22c55e',
  YELLOW: '#f59e0b',
  RED: '#ef4444',
};

const SEVERITY_COLORS: Record<string, string> = {
  MINOR: '#94a3b8',
  MAJOR: '#f59e0b',
  CRITICAL: '#ef4444',
};

const PILLAR_COLORS = ['#71907C', '#9F8ECB', '#f59e0b', '#6366f1', '#ec4899', '#14b8a6'];

export default function AIPerformancePage() {
  const [dateRange, setDateRange] = useState<DateRange>('30');
  const [contentStats, setContentStats] = useState<ContentStats | null>(null);
  const [rejectionStats, setRejectionStats] = useState<RejectionStats | null>(null);
  const [abTests, setAbTests] = useState<ABTest[]>([]);
  const [agentStats, setAgentStats] = useState<AgentRunStats | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [content, rejections, tests, agents] = await Promise.all([
        api.get<ContentStats>('/marketing-content/stats').catch(() => null),
        api.get<RejectionStats>('/rejection-analytics/stats').catch(() => null),
        api.get<any>('/ab-testing').catch(() => []),
        api.get<any>('/agent-runs/stats').catch(() => null),
      ]);

      setContentStats(content as ContentStats);
      setRejectionStats(rejections as RejectionStats);
      setAbTests(Array.isArray(tests) ? tests : (tests as any)?.data || []);
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

  // Derived data
  const totalContent = contentStats?.byStatus
    ? Object.values(contentStats.byStatus).reduce((s, v) => s + v, 0)
    : 0;
  const publishedCount = contentStats?.byStatus?.PUBLISHED || 0;
  const totalRejections = rejectionStats?.byGate
    ? Object.values(rejectionStats.byGate).reduce((s, v) => s + v, 0)
    : 0;
  const rejectionRate = totalContent > 0 ? Math.round((totalRejections / totalContent) * 100) : 0;
  const completedTests = abTests.filter((t) => t.status === 'COMPLETED').length;
  const wonTests = abTests.filter((t) => t.winnerVariantId).length;
  const winRate = completedTests > 0 ? Math.round((wonTests / completedTests) * 100) : 0;
  const totalRuns = agentStats?.totalRuns || 0;

  // Chart data
  const tierData = contentStats?.byTier
    ? Object.entries(contentStats.byTier).map(([name, value]) => ({ name, value }))
    : [];

  const pillarData = contentStats?.byPillar
    ? Object.entries(contentStats.byPillar).map(([name, value]) => ({ name, value }))
    : [];

  const rejectionByGate = rejectionStats?.byGate
    ? Object.entries(rejectionStats.byGate).map(([gate, count]) => ({
        gate: gate.replace('GATE_', 'Gate '),
        count,
      }))
    : [];

  const rejectionByCode = rejectionStats?.byCode
    ? Object.entries(rejectionStats.byCode)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([code, count]) => ({ code, count }))
    : [];

  const rejectionBySeverity = rejectionStats?.bySeverity
    ? Object.entries(rejectionStats.bySeverity).map(([name, value]) => ({ name, value }))
    : [];

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
        <KPICard icon={<FileText size={18} />} label="Total Content" value={totalContent} />
        <KPICard
          icon={<Target size={18} />}
          label="Rejection Rate"
          value={`${rejectionRate}%`}
          color={
            rejectionRate > 20
              ? 'text-red-600'
              : rejectionRate > 10
                ? 'text-amber-600'
                : 'text-green-600'
          }
        />
        <KPICard
          icon={<FlaskConical size={18} />}
          label="A/B Test Win Rate"
          value={completedTests > 0 ? `${winRate}%` : 'N/A'}
          color="text-lavender-600"
        />
        <KPICard
          icon={<TrendingUp size={18} />}
          label="Agent Runs"
          value={totalRuns}
          color="text-sage-600"
        />
      </div>

      {/* Content Tier Distribution */}
      {tierData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div
            className="rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-soft border border-slate-100 dark:border-slate-800"
            data-testid="tier-chart"
          >
            <h3 className="font-serif text-base font-semibold text-slate-900 dark:text-white mb-4">
              Content Tier Distribution
            </h3>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={tierData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {tierData.map((entry) => (
                    <Cell key={entry.name} fill={TIER_COLORS[entry.name] || '#94a3b8'} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Pillar Balance */}
          {pillarData.length > 0 && (
            <div
              className="rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-soft border border-slate-100 dark:border-slate-800"
              data-testid="pillar-chart"
            >
              <h3 className="font-serif text-base font-semibold text-slate-900 dark:text-white mb-4">
                Content by Pillar
              </h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={pillarData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 10 }}
                    stroke="#94a3b8"
                    angle={-45}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
                  <Tooltip />
                  <Bar dataKey="value" name="Content Items">
                    {pillarData.map((_, i) => (
                      <Cell key={i} fill={PILLAR_COLORS[i % PILLAR_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* Rejection Analytics */}
      {(rejectionByGate.length > 0 || rejectionByCode.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Rejections by Gate */}
          {rejectionByGate.length > 0 && (
            <div
              className="rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-soft border border-slate-100 dark:border-slate-800"
              data-testid="rejection-gate-chart"
            >
              <h3 className="font-serif text-base font-semibold text-slate-900 dark:text-white mb-4">
                Rejections by Gate
              </h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={rejectionByGate}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="gate" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                  <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
                  <Tooltip />
                  <Bar dataKey="count" fill="#ef4444" name="Rejections" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Rejections by Code */}
          {rejectionByCode.length > 0 && (
            <div
              className="rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-soft border border-slate-100 dark:border-slate-800"
              data-testid="rejection-code-chart"
            >
              <h3 className="font-serif text-base font-semibold text-slate-900 dark:text-white mb-4">
                Top Rejection Codes
              </h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={rejectionByCode} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis type="number" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                  <YAxis
                    dataKey="code"
                    type="category"
                    tick={{ fontSize: 11 }}
                    stroke="#94a3b8"
                    width={50}
                  />
                  <Tooltip />
                  <Bar dataKey="count" fill="#f59e0b" name="Count" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* Rejection Severity */}
      {rejectionBySeverity.length > 0 && (
        <div
          className="rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-soft border border-slate-100 dark:border-slate-800"
          data-testid="severity-chart"
        >
          <h3 className="font-serif text-base font-semibold text-slate-900 dark:text-white mb-4">
            Rejection Severity
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={rejectionBySeverity}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={70}
                paddingAngle={4}
                dataKey="value"
              >
                {rejectionBySeverity.map((entry) => (
                  <Cell key={entry.name} fill={SEVERITY_COLORS[entry.name] || '#94a3b8'} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* A/B Test Summary */}
      {abTests.length > 0 && (
        <div
          className="rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-soft border border-slate-100 dark:border-slate-800"
          data-testid="ab-test-summary"
        >
          <div className="flex items-center gap-2 mb-4">
            <FlaskConical size={18} className="text-lavender-500" />
            <h3 className="font-serif text-base font-semibold text-slate-900 dark:text-white">
              A/B Tests
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800">
                  <th className="text-left py-2 font-medium text-slate-600 dark:text-slate-400">
                    Test
                  </th>
                  <th className="text-center py-2 font-medium text-slate-600 dark:text-slate-400">
                    Status
                  </th>
                  <th className="text-center py-2 font-medium text-slate-600 dark:text-slate-400">
                    Metric
                  </th>
                  <th className="text-center py-2 font-medium text-slate-600 dark:text-slate-400">
                    Winner
                  </th>
                  <th className="text-center py-2 font-medium text-slate-600 dark:text-slate-400">
                    Confidence
                  </th>
                </tr>
              </thead>
              <tbody>
                {abTests.map((test) => (
                  <tr
                    key={test.id}
                    className="border-b border-slate-50 dark:border-slate-800 last:border-0"
                  >
                    <td className="py-2.5 text-slate-900 dark:text-white font-medium">
                      {test.name}
                    </td>
                    <td className="py-2.5 text-center">
                      <span
                        className={cn(
                          'text-xs font-medium px-2 py-0.5 rounded-full',
                          test.status === 'COMPLETED'
                            ? 'bg-green-50 text-green-700'
                            : test.status === 'RUNNING'
                              ? 'bg-amber-50 text-amber-700'
                              : 'bg-slate-50 text-slate-600',
                        )}
                      >
                        {test.status}
                      </span>
                    </td>
                    <td className="py-2.5 text-center text-slate-600 dark:text-slate-400">
                      {test.metric}
                    </td>
                    <td className="py-2.5 text-center">
                      {test.winnerVariantId ? (
                        <span className="text-xs bg-sage-50 text-sage-700 px-2 py-0.5 rounded-full">
                          Winner declared
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">-</span>
                      )}
                    </td>
                    <td className="py-2.5 text-center">
                      {test.confidence != null ? (
                        <span className="text-xs font-medium">{Math.round(test.confidence)}%</span>
                      ) : (
                        <span className="text-xs text-slate-400">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
