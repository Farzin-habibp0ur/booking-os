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
} from 'lucide-react';

interface AgentConfig {
  id: string;
  agentType: string;
  isEnabled: boolean;
  config: any;
}

interface AgentRun {
  id: string;
  agentType: string;
  status: string;
  cardsCreated: number;
  startedAt: string;
  completedAt?: string;
  error?: string;
}

const AGENT_META: Record<
  string,
  { name: string; category: 'content' | 'distribution' | 'analytics'; interval: string }
> = {
  MKT_BLOG_WRITER: { name: 'Blog Writer', category: 'content', interval: '6h' },
  MKT_SOCIAL_CREATOR: { name: 'Social Creator', category: 'content', interval: '4h' },
  MKT_EMAIL_COMPOSER: { name: 'Email Composer', category: 'content', interval: '8h' },
  MKT_CASE_STUDY: { name: 'Case Study', category: 'content', interval: '24h' },
  MKT_VIDEO_SCRIPT: { name: 'Video Script', category: 'content', interval: '24h' },
  MKT_NEWSLETTER: { name: 'Newsletter', category: 'content', interval: '168h' },
  MKT_SCHEDULER: { name: 'Content Scheduler', category: 'distribution', interval: '2h' },
  MKT_PUBLISHER: { name: 'Content Publisher', category: 'distribution', interval: '30min' },
  MKT_PERF_TRACKER: { name: 'Performance Tracker', category: 'analytics', interval: '4h' },
  MKT_TREND_ANALYZER: { name: 'Trend Analyzer', category: 'analytics', interval: '24h' },
  MKT_CALENDAR_PLANNER: { name: 'Calendar Planner', category: 'analytics', interval: '24h' },
  MKT_ROI_REPORTER: { name: 'ROI Reporter', category: 'analytics', interval: '168h' },
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
  const { addToast } = useToast();
  const [configs, setConfigs] = useState<AgentConfig[]>([]);
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabFilter>('all');
  const [triggeringAgent, setTriggeringAgent] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [configsRes, runsRes] = await Promise.all([
        api.get('/agents/config'),
        api.get('/agents/runs?pageSize=100'),
      ]);
      setConfigs(Array.isArray(configsRes) ? configsRes : configsRes.items || []);
      setRuns(Array.isArray(runsRes) ? runsRes : runsRes.items || []);
    } catch {
      // handled by api client
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleToggle = async (agentType: string, isEnabled: boolean) => {
    try {
      await api.patch(`/agents/config/${agentType}`, { isEnabled: !isEnabled });
      addToast(`Agent ${!isEnabled ? 'enabled' : 'disabled'}`, 'success');
      fetchData();
    } catch {
      addToast('Failed to update agent', 'error');
    }
  };

  const handleTrigger = async (agentType: string) => {
    try {
      setTriggeringAgent(agentType);
      await api.post(`/agents/${agentType}/trigger`, {});
      addToast('Agent triggered successfully', 'success');
      fetchData();
    } catch {
      addToast('Failed to trigger agent', 'error');
    } finally {
      setTriggeringAgent(null);
    }
  };

  const marketingTypes = Object.keys(AGENT_META);
  const marketingConfigs = configs.filter((c) => marketingTypes.includes(c.agentType));
  const marketingRuns = runs.filter((r) => marketingTypes.includes(r.agentType));

  const enabledCount = marketingConfigs.filter((c) => c.isEnabled).length;
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

  const filteredTypes =
    tab === 'all' ? marketingTypes : marketingTypes.filter((t) => AGENT_META[t].category === tab);

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
          <div className="text-sm text-emerald-600">Total Runs</div>
          <div className="text-2xl font-bold text-emerald-700" data-testid="total-runs">
            {totalRuns}
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
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-2xl bg-slate-100 animate-pulse" />
          ))}
        </div>
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
            const isEnabled = config?.isEnabled || false;

            return (
              <div
                key={agentType}
                className="rounded-2xl border bg-white shadow-sm p-4"
                data-testid="agent-card"
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
                          Every {meta.interval}
                        </span>
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
                            {' \u00b7 '}
                            {new Date(latestRun.startedAt).toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleTrigger(agentType)}
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
                      onClick={() => handleToggle(agentType, isEnabled)}
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
    </div>
  );
}
