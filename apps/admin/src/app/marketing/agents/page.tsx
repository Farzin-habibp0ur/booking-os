'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { useToast } from '@/lib/toast';
import {
  Bot,
  Play,
  Clock,
  CheckCircle2,
  XCircle,
  Zap,
  BarChart3,
  Send,
  FileText,
  X,
  TrendingUp,
  Activity,
  ArrowRight,
} from 'lucide-react';
import { ListSkeleton } from '@/components/skeleton';

interface AgentConfig {
  id: string;
  agentType: string;
  isEnabled: boolean;
  config: any;
  runIntervalMinutes?: number;
  lastRunAt?: string;
  nextRunAt?: string;
  performanceScore?: number;
}

interface AgentRun {
  id: string;
  agentType: string;
  status: string;
  cardsCreated: number;
  startedAt: string;
  completedAt?: string;
  error?: string;
  errors?: any;
}

interface AgentPerformance {
  agentType: string;
  performanceScore: number;
  totalRuns: number;
  successRate: number;
  avgItemsPerRun: number;
}

const AGENT_META: Record<
  string,
  { name: string; description: string; category: 'content' | 'distribution' | 'analytics' }
> = {
  MKT_BLOG_WRITER: {
    name: 'Blog Writer',
    description: 'SEO blog posts with 4 value layers',
    category: 'content',
  },
  MKT_SOCIAL_CREATOR: {
    name: 'Social Creator',
    description: 'Platform-native social content',
    category: 'content',
  },
  MKT_EMAIL_COMPOSER: {
    name: 'Email Composer',
    description: 'Email campaigns and sequences',
    category: 'content',
  },
  MKT_CASE_STUDY: {
    name: 'Case Study',
    description: 'Customer success case studies',
    category: 'content',
  },
  MKT_VIDEO_SCRIPT: {
    name: 'Video Script',
    description: 'Timestamped video scripts',
    category: 'content',
  },
  MKT_NEWSLETTER: {
    name: 'Newsletter',
    description: 'Weekly newsletter composition',
    category: 'content',
  },
  MKT_SCHEDULER: {
    name: 'Content Scheduler',
    description: 'Optimal posting time scheduling',
    category: 'distribution',
  },
  MKT_PUBLISHER: {
    name: 'Content Publisher',
    description: 'Cross-platform content publishing',
    category: 'distribution',
  },
  MKT_PERF_TRACKER: {
    name: 'Performance Tracker',
    description: 'Content performance metrics',
    category: 'analytics',
  },
  MKT_TREND_ANALYZER: {
    name: 'Trend Analyzer',
    description: 'Industry trend detection',
    category: 'analytics',
  },
  MKT_CALENDAR_PLANNER: {
    name: 'Calendar Planner',
    description: 'Content calendar management',
    category: 'analytics',
  },
  MKT_ROI_REPORTER: {
    name: 'ROI Reporter',
    description: 'Marketing ROI analysis',
    category: 'analytics',
  },
};

const CATEGORY_LABELS: Record<string, string> = {
  content: 'Content',
  distribution: 'Distribution',
  analytics: 'Analytics',
};

const CATEGORY_STYLES: Record<string, string> = {
  content: 'bg-lavender-50 text-lavender-700',
  distribution: 'bg-blue-50 text-blue-700',
  analytics: 'bg-amber-50 text-amber-700',
};

type TabFilter = 'all' | 'content' | 'distribution' | 'analytics';

export default function MarketingAgentsPage() {
  const { toast } = useToast();
  const [configs, setConfigs] = useState<AgentConfig[]>([]);
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [performance, setPerformance] = useState<AgentPerformance[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabFilter>('all');
  const [triggeringAgent, setTriggeringAgent] = useState<string | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [agentRuns, setAgentRuns] = useState<AgentRun[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [configsRes, runsRes, perfRes] = await Promise.all([
        api.get<AgentConfig[] | { items: AgentConfig[] }>('/agent-config/admin/all'),
        api.get<AgentRun[] | { items: AgentRun[] }>('/agent-runs?take=100'),
        api.get<AgentPerformance[]>('/agent-config/admin/performance').catch(() => []),
      ]);
      setConfigs(
        Array.isArray(configsRes)
          ? configsRes
          : (configsRes as { items: AgentConfig[] }).items || [],
      );
      setRuns(Array.isArray(runsRes) ? runsRes : (runsRes as { items: AgentRun[] }).items || []);
      setPerformance(Array.isArray(perfRes) ? perfRes : []);
    } catch {
      // handled by api client
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openAgentDetail = async (agentType: string) => {
    setSelectedAgent(agentType);
    setLoadingDetail(true);
    try {
      const runsRes = await api.get<AgentRun[] | { items: AgentRun[] }>(
        `/agent-runs?agentType=${agentType}&take=10`,
      );
      setAgentRuns(
        Array.isArray(runsRes) ? runsRes : (runsRes as { items: AgentRun[] }).items || [],
      );
    } catch {
      setAgentRuns([]);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleToggle = async (agentType: string, isEnabled: boolean) => {
    try {
      await api.patch(`/agent-config/admin/${agentType}`, { isEnabled: !isEnabled });
      toast(`Agent ${!isEnabled ? 'enabled' : 'disabled'}`, 'success');
      fetchData();
    } catch {
      toast('Failed to update agent', 'error');
    }
  };

  const handleTrigger = async (agentType: string) => {
    try {
      setTriggeringAgent(agentType);
      await api.post(`/agent-config/admin/${agentType}/run-now`, {});
      toast('Agent triggered successfully', 'success');
      fetchData();
    } catch {
      toast('Failed to trigger agent', 'error');
    } finally {
      setTriggeringAgent(null);
    }
  };

  const marketingTypes = Object.keys(AGENT_META);
  const marketingConfigs = configs.filter((c) => marketingTypes.includes(c.agentType));
  const marketingRuns = runs.filter((r) => marketingTypes.includes(r.agentType));

  const enabledCount = marketingConfigs.filter((c) => c.isEnabled).length;
  const avgPerformance =
    marketingConfigs.length > 0
      ? Math.round(
          marketingConfigs.reduce((sum, c) => sum + (c.performanceScore || 0), 0) /
            marketingConfigs.filter((c) => c.performanceScore != null).length || 0,
        )
      : 0;
  const draftsLast24h = marketingRuns
    .filter(
      (r) =>
        r.status === 'COMPLETED' &&
        new Date(r.startedAt) > new Date(Date.now() - 24 * 60 * 60 * 1000),
    )
    .reduce((sum, r) => sum + (r.cardsCreated || 0), 0);
  const completedRuns = marketingRuns.filter((r) => r.status === 'COMPLETED').length;
  const totalRuns = marketingRuns.length;
  const successRate = totalRuns > 0 ? Math.round((completedRuns / totalRuns) * 100) : 0;

  const getLatestRun = (agentType: string) => marketingRuns.find((r) => r.agentType === agentType);

  const getConfigForType = (agentType: string) =>
    marketingConfigs.find((c) => c.agentType === agentType);

  const getPerfForType = (agentType: string) => performance.find((p) => p.agentType === agentType);

  const filteredTypes =
    tab === 'all' ? marketingTypes : marketingTypes.filter((t) => AGENT_META[t].category === tab);

  const formatInterval = (minutes?: number) => {
    if (!minutes) return 'Manual';
    if (minutes < 60) return `${minutes}min`;
    if (minutes < 1440) return `${Math.floor(minutes / 60)}h`;
    return `${Math.floor(minutes / 1440)}d`;
  };

  return (
    <div className="space-y-6" data-testid="marketing-agents-page">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Marketing Agents</h1>
        <p className="text-sm text-slate-500 mt-1">
          12 autonomous agents that generate, schedule, and analyze marketing content
        </p>
      </div>

      {/* Stats Strip */}
      <div className="grid grid-cols-4 gap-4" data-testid="stats-strip">
        <div className="rounded-2xl bg-lavender-50 p-4">
          <div className="text-sm text-lavender-600">Agents Enabled</div>
          <div className="text-2xl font-bold text-lavender-700" data-testid="enabled-count">
            {enabledCount}
          </div>
        </div>
        <div className="rounded-2xl bg-sage-50 p-4">
          <div className="text-sm text-sage-600">Drafts (24h)</div>
          <div className="text-2xl font-bold text-sage-700" data-testid="drafts-24h">
            {draftsLast24h}
          </div>
        </div>
        <div className="rounded-2xl bg-blue-50 p-4">
          <div className="text-sm text-blue-600">Success Rate</div>
          <div className="text-2xl font-bold text-blue-700" data-testid="success-rate">
            {successRate}%
          </div>
        </div>
        <div className="rounded-2xl bg-emerald-50 p-4">
          <div className="text-sm text-emerald-600">Avg Performance</div>
          <div className="text-2xl font-bold text-emerald-700" data-testid="avg-performance">
            {avgPerformance}
          </div>
        </div>
      </div>

      {/* Tab Filters */}
      <div className="flex gap-2" data-testid="tab-filters">
        {(['all', 'content', 'distribution', 'analytics'] as TabFilter[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'px-4 py-2 rounded-xl text-sm font-medium transition-colors',
              tab === t
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
            )}
            data-testid={`tab-${t}`}
          >
            {t === 'all' ? 'All Agents' : CATEGORY_LABELS[t]}
          </button>
        ))}
      </div>

      {/* Agent Cards */}
      {loading ? (
        <ListSkeleton rows={4} />
      ) : filteredTypes.length === 0 ? (
        <div className="text-center py-16 text-slate-400" data-testid="empty-state">
          <Bot size={48} className="mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium">No agents in this category</p>
        </div>
      ) : (
        <div className="space-y-3" data-testid="agent-list">
          {filteredTypes.map((agentType) => {
            const meta = AGENT_META[agentType];
            const config = getConfigForType(agentType);
            const latestRun = getLatestRun(agentType);
            const perf = getPerfForType(agentType);
            const isEnabled = config?.isEnabled || false;
            const score = config?.performanceScore ?? perf?.performanceScore;

            return (
              <div
                key={agentType}
                className="rounded-2xl border bg-white shadow-sm p-4 cursor-pointer hover:shadow-md transition-shadow"
                data-testid="agent-card"
                onClick={() => openAgentDetail(agentType)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={cn(
                        'w-10 h-10 rounded-xl flex items-center justify-center',
                        meta.category === 'content'
                          ? 'bg-lavender-50'
                          : meta.category === 'distribution'
                            ? 'bg-blue-50'
                            : 'bg-amber-50',
                      )}
                    >
                      {meta.category === 'content' ? (
                        <FileText size={18} className="text-lavender-600" />
                      ) : meta.category === 'distribution' ? (
                        <Send size={18} className="text-blue-600" />
                      ) : (
                        <BarChart3 size={18} className="text-amber-600" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-slate-900">{meta.name}</h3>
                        <span
                          className={cn(
                            'px-2 py-0.5 rounded-full text-xs font-medium',
                            CATEGORY_STYLES[meta.category],
                          )}
                          data-testid="category-badge"
                        >
                          {CATEGORY_LABELS[meta.category]}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                        <span className="inline-flex items-center gap-1">
                          <Clock size={12} />
                          Every {formatInterval(config?.runIntervalMinutes)}
                        </span>
                        {score != null && (
                          <span
                            className={cn(
                              'inline-flex items-center gap-1 font-medium',
                              score >= 80
                                ? 'text-sage-600'
                                : score >= 50
                                  ? 'text-amber-600'
                                  : 'text-red-500',
                            )}
                            data-testid="performance-score"
                          >
                            <TrendingUp size={12} />
                            {Math.round(score)}%
                          </span>
                        )}
                        {latestRun && (
                          <span
                            className={cn(
                              'inline-flex items-center gap-1',
                              latestRun.status === 'COMPLETED'
                                ? 'text-sage-600'
                                : latestRun.status === 'FAILED'
                                  ? 'text-red-500'
                                  : 'text-slate-400',
                            )}
                            data-testid="last-run-status"
                          >
                            {latestRun.status === 'COMPLETED' ? (
                              <CheckCircle2 size={12} />
                            ) : latestRun.status === 'FAILED' ? (
                              <XCircle size={12} />
                            ) : (
                              <Zap size={12} />
                            )}
                            {latestRun.status === 'COMPLETED'
                              ? `${latestRun.cardsCreated} created`
                              : latestRun.status}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleTrigger(agentType);
                      }}
                      disabled={!isEnabled || triggeringAgent === agentType}
                      className={cn(
                        'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors inline-flex items-center gap-1.5',
                        isEnabled
                          ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          : 'bg-slate-50 text-slate-300 cursor-not-allowed',
                      )}
                      data-testid="run-now-btn"
                    >
                      <Play size={14} />
                      {triggeringAgent === agentType ? 'Running...' : 'Run Now'}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggle(agentType, isEnabled);
                      }}
                      className={cn(
                        'relative w-11 h-6 rounded-full transition-colors',
                        isEnabled ? 'bg-sage-500' : 'bg-slate-200',
                      )}
                      data-testid="toggle-btn"
                      role="switch"
                      aria-checked={isEnabled}
                    >
                      <span
                        className={cn(
                          'absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform',
                          isEnabled ? 'translate-x-5' : 'translate-x-0',
                        )}
                      />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Agent Detail Modal */}
      {selectedAgent && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 animate-backdrop"
          data-testid="agent-detail-modal"
          onClick={() => setSelectedAgent(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto animate-modal-enter"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  {AGENT_META[selectedAgent]?.name || selectedAgent}
                </h2>
                <p className="text-sm text-slate-500 mt-0.5">
                  {AGENT_META[selectedAgent]?.description}
                </p>
              </div>
              <button
                onClick={() => setSelectedAgent(null)}
                className="p-2 rounded-lg hover:bg-slate-100 text-slate-400"
                data-testid="close-modal-btn"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Performance Metrics */}
              <div>
                <h3 className="text-sm font-medium text-slate-700 mb-3">Performance Metrics</h3>
                <div className="grid grid-cols-3 gap-3" data-testid="agent-metrics">
                  {(() => {
                    const config = getConfigForType(selectedAgent);
                    const perf = getPerfForType(selectedAgent);
                    const agentTypeRuns = marketingRuns.filter(
                      (r) => r.agentType === selectedAgent,
                    );
                    const completed = agentTypeRuns.filter((r) => r.status === 'COMPLETED');
                    const itemsProduced = completed.reduce(
                      (sum, r) => sum + (r.cardsCreated || 0),
                      0,
                    );
                    const approvalRate =
                      perf?.successRate ??
                      (agentTypeRuns.length > 0
                        ? Math.round((completed.length / agentTypeRuns.length) * 100)
                        : 0);
                    const avgQuality = config?.performanceScore ?? perf?.performanceScore ?? 0;

                    return (
                      <>
                        <div className="rounded-xl bg-slate-50 p-3 text-center">
                          <div className="text-xs text-slate-500">Items Produced</div>
                          <div
                            className="text-xl font-bold text-slate-900 mt-1"
                            data-testid="items-produced"
                          >
                            {itemsProduced}
                          </div>
                        </div>
                        <div className="rounded-xl bg-slate-50 p-3 text-center">
                          <div className="text-xs text-slate-500">Approval Rate</div>
                          <div
                            className="text-xl font-bold text-slate-900 mt-1"
                            data-testid="approval-rate"
                          >
                            {approvalRate}%
                          </div>
                        </div>
                        <div className="rounded-xl bg-slate-50 p-3 text-center">
                          <div className="text-xs text-slate-500">Avg Quality Score</div>
                          <div
                            className="text-xl font-bold text-slate-900 mt-1"
                            data-testid="avg-quality"
                          >
                            {Math.round(avgQuality)}
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* Configuration */}
              <div>
                <h3 className="text-sm font-medium text-slate-700 mb-3">Configuration</h3>
                <div
                  className="rounded-xl bg-slate-50 p-4 space-y-2 text-sm"
                  data-testid="agent-config-detail"
                >
                  {(() => {
                    const config = getConfigForType(selectedAgent);
                    return (
                      <>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Status</span>
                          <span
                            className={cn(
                              'font-medium',
                              config?.isEnabled ? 'text-sage-600' : 'text-slate-400',
                            )}
                          >
                            {config?.isEnabled ? 'Enabled' : 'Disabled'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Run Interval</span>
                          <span className="font-medium text-slate-900">
                            {formatInterval(config?.runIntervalMinutes)}
                          </span>
                        </div>
                        {config?.lastRunAt && (
                          <div className="flex justify-between">
                            <span className="text-slate-500">Last Run</span>
                            <span className="font-medium text-slate-900">
                              {new Date(config.lastRunAt).toLocaleString()}
                            </span>
                          </div>
                        )}
                        {config?.nextRunAt && (
                          <div className="flex justify-between">
                            <span className="text-slate-500">Next Run</span>
                            <span className="font-medium text-slate-900">
                              {new Date(config.nextRunAt).toLocaleString()}
                            </span>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* Run History */}
              <div>
                <h3 className="text-sm font-medium text-slate-700 mb-3">Recent Runs</h3>
                {loadingDetail ? (
                  <div className="text-center py-6 text-slate-400 text-sm">Loading runs...</div>
                ) : agentRuns.length === 0 ? (
                  <div
                    className="text-center py-6 text-slate-400 text-sm"
                    data-testid="no-runs-message"
                  >
                    No recent runs
                  </div>
                ) : (
                  <div className="space-y-2" data-testid="run-history">
                    {agentRuns.map((run) => (
                      <div
                        key={run.id}
                        className="flex items-center justify-between rounded-xl bg-slate-50 p-3 text-sm"
                        data-testid="run-entry"
                      >
                        <div className="flex items-center gap-2">
                          {run.status === 'COMPLETED' ? (
                            <CheckCircle2 size={14} className="text-sage-600" />
                          ) : run.status === 'FAILED' ? (
                            <XCircle size={14} className="text-red-500" />
                          ) : (
                            <Activity size={14} className="text-amber-500" />
                          )}
                          <span className="text-slate-700">
                            {new Date(run.startedAt).toLocaleString()}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs">
                          <span className="text-slate-500">{run.cardsCreated} items</span>
                          <span
                            className={cn(
                              'px-2 py-0.5 rounded-full font-medium',
                              run.status === 'COMPLETED'
                                ? 'bg-sage-50 text-sage-700'
                                : run.status === 'FAILED'
                                  ? 'bg-red-50 text-red-700'
                                  : 'bg-amber-50 text-amber-700',
                            )}
                          >
                            {run.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
