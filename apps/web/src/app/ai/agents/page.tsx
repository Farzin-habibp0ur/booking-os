'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { useToast } from '@/lib/toast';
import {
  Bot,
  Megaphone,
  ChevronDown,
  ChevronUp,
  Play,
  Pause,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
} from 'lucide-react';

interface AgentConfig {
  id: string;
  agentType: string;
  isEnabled: boolean;
  autonomyLevel: string;
  config: Record<string, any>;
  lastRunAt?: string;
  runCount?: number;
}

interface AgentRun {
  id: string;
  agentType: string;
  status: 'SUCCESS' | 'FAILURE' | 'RUNNING';
  startedAt: string;
  completedAt?: string;
  cardsCreated: number;
  error?: string;
}

interface MarketingAgent {
  id: string;
  type: string;
  name: string;
  enabled: boolean;
  lastRunAt: string | null;
  runCount: number;
  runIntervalMinutes: number;
}

const CORE_AGENT_DESCRIPTIONS: Record<string, string> = {
  WAITLIST: 'Auto-matches waitlist entries to cancelled booking slots',
  RETENTION: 'Detects at-risk customers and generates win-back action cards',
  DATA_HYGIENE: 'Identifies duplicate records and incomplete customer profiles',
  SCHEDULING_OPTIMIZER: 'Detects schedule gaps and suggests optimal booking slots',
  QUOTE_FOLLOWUP: 'Sends follow-up reminders for expired or pending quotes',
};

const MARKETING_AGENT_DESCRIPTIONS: Record<string, string> = {
  BLOG_WRITER: 'Generates SEO-optimized blog posts from business context',
  SOCIAL_CREATOR: 'Creates social media posts and engagement content',
  EMAIL_COMPOSER: 'Drafts marketing emails and newsletters',
  CASE_STUDY: 'Writes customer success stories and case studies',
  VIDEO_SCRIPT: 'Creates video scripts for social and marketing content',
  NEWSLETTER: 'Compiles and formats regular business newsletters',
  CONTENT_SCHEDULER: 'Schedules content publication across channels',
  CONTENT_PUBLISHER: 'Publishes approved content to connected platforms',
  PERFORMANCE_TRACKER: 'Tracks content performance metrics and KPIs',
  TREND_ANALYZER: 'Analyzes market trends and content opportunities',
  CONTENT_CALENDAR: 'Maintains and optimizes the content calendar',
  CONTENT_ROI: 'Calculates return on investment for content efforts',
};

export default function AIAgentsPage() {
  const toast = useToast();
  const [coreAgents, setCoreAgents] = useState<AgentConfig[]>([]);
  const [marketingAgents, setMarketingAgents] = useState<MarketingAgent[]>([]);
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  useEffect(() => {
    loadAgents();
  }, []);

  const loadAgents = async () => {
    setLoading(true);
    try {
      const [configs, mAgents, agentRuns] = await Promise.all([
        api.get<AgentConfig[]>('/agents/config').catch(() => []),
        api.get<MarketingAgent[]>('/marketing-agents').catch(() => []),
        api.get<{ data: AgentRun[] }>('/agents/runs?pageSize=50').catch(() => ({ data: [] })),
      ]);
      setCoreAgents((configs as AgentConfig[]) || []);
      setMarketingAgents((mAgents as MarketingAgent[]) || []);
      setRuns(((agentRuns as any)?.data || agentRuns || []) as AgentRun[]);
    } catch {
      // Graceful fallback
    } finally {
      setLoading(false);
    }
  };

  const toggleAgent = async (agentType: string, currentEnabled: boolean) => {
    setTogglingId(agentType);
    try {
      await api.patch(`/agents/config/${agentType}`, { isEnabled: !currentEnabled });
      setCoreAgents((prev) =>
        prev.map((a) => (a.agentType === agentType ? { ...a, isEnabled: !currentEnabled } : a)),
      );
      toast(`${agentType} agent ${!currentEnabled ? 'enabled' : 'disabled'}`);
    } catch {
      toast('Failed to toggle agent', 'error');
    } finally {
      setTogglingId(null);
    }
  };

  const triggerAgent = async (agentType: string) => {
    try {
      await api.post(`/agents/${agentType}/trigger`, {});
      toast(`${agentType} agent triggered`);
      // Reload runs after a brief delay
      setTimeout(() => loadAgents(), 2000);
    } catch {
      toast('Failed to trigger agent', 'error');
    }
  };

  const getAgentRuns = (agentType: string) =>
    runs.filter((r) => r.agentType === agentType).slice(0, 10);

  if (loading) {
    return (
      <div className="space-y-6" data-testid="agents-loading">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-soft animate-pulse">
            <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-1/4 mb-3" />
            <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-8" data-testid="agents-page">
      {/* Core Agents */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Bot size={20} className="text-sage-600" />
          <h2 className="font-serif text-lg font-semibold text-slate-900 dark:text-white">
            Core Agents
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {coreAgents.length === 0 ? (
            <div className="col-span-full rounded-2xl bg-white dark:bg-slate-900 p-12 shadow-soft text-center">
              <Bot className="mx-auto mb-4 text-slate-400" size={48} />
              <h3 className="font-serif text-lg text-slate-900 dark:text-white mb-2">
                No Agents Configured
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Configure agents in Settings to start automating your operations.
              </p>
            </div>
          ) : (
            coreAgents.map((agent) => {
              const isExpanded = expandedAgent === agent.agentType;
              const agentRuns = getAgentRuns(agent.agentType);
              return (
                <div
                  key={agent.agentType}
                  className="rounded-2xl bg-white dark:bg-slate-900 shadow-soft border border-slate-100 dark:border-slate-800 overflow-hidden"
                  data-testid={`agent-card-${agent.agentType}`}
                >
                  <div className="p-5">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            'w-2 h-2 rounded-full flex-shrink-0',
                            agent.isEnabled ? 'bg-green-500' : 'bg-slate-300',
                          )}
                        />
                        <h3 className="font-serif font-semibold text-slate-900 dark:text-white text-sm">
                          {agent.agentType.replace(/_/g, ' ')}
                        </h3>
                      </div>
                      <button
                        onClick={() => toggleAgent(agent.agentType, agent.isEnabled)}
                        disabled={togglingId === agent.agentType}
                        className={cn(
                          'relative w-10 h-5 rounded-full transition-colors flex-shrink-0',
                          agent.isEnabled ? 'bg-sage-500' : 'bg-slate-300',
                          togglingId === agent.agentType && 'opacity-50',
                        )}
                        data-testid={`toggle-${agent.agentType}`}
                        aria-label={`Toggle ${agent.agentType}`}
                      >
                        <span
                          className={cn(
                            'absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform',
                            agent.isEnabled ? 'translate-x-5' : 'translate-x-0.5',
                          )}
                        />
                      </button>
                    </div>

                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 line-clamp-2">
                      {CORE_AGENT_DESCRIPTIONS[agent.agentType] || 'AI-powered automation agent'}
                    </p>

                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>
                        {agent.lastRunAt
                          ? `Last run ${formatRelative(agent.lastRunAt)}`
                          : 'Never run'}
                      </span>
                      <span className="text-slate-400">{agent.autonomyLevel}</span>
                    </div>

                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                      <button
                        onClick={() => triggerAgent(agent.agentType)}
                        disabled={!agent.isEnabled}
                        className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg bg-sage-50 text-sage-700 hover:bg-sage-100 disabled:opacity-50 transition-colors"
                        data-testid={`trigger-${agent.agentType}`}
                      >
                        <Play size={12} />
                        Run Now
                      </button>
                      <button
                        onClick={() => setExpandedAgent(isExpanded ? null : agent.agentType)}
                        className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg bg-slate-50 text-slate-600 hover:bg-slate-100 transition-colors ml-auto"
                        data-testid={`expand-${agent.agentType}`}
                      >
                        History
                        {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      </button>
                    </div>
                  </div>

                  {/* Expanded: Run History */}
                  {isExpanded && (
                    <div className="border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 px-5 py-3" data-testid={`history-${agent.agentType}`}>
                      {agentRuns.length === 0 ? (
                        <p className="text-xs text-slate-500 text-center py-2">No run history</p>
                      ) : (
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {agentRuns.map((run) => (
                            <div key={run.id} className="flex items-center justify-between text-xs">
                              <div className="flex items-center gap-1.5">
                                {run.status === 'SUCCESS' ? (
                                  <CheckCircle size={12} className="text-green-500" />
                                ) : run.status === 'FAILURE' ? (
                                  <XCircle size={12} className="text-red-500" />
                                ) : (
                                  <Clock size={12} className="text-amber-500" />
                                )}
                                <span className="text-slate-600 dark:text-slate-300">
                                  {new Date(run.startedAt).toLocaleString('en-US', {
                                    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                                  })}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                {run.cardsCreated > 0 && (
                                  <span className="text-slate-400">{run.cardsCreated} cards</span>
                                )}
                                {run.completedAt && run.startedAt && (
                                  <span className="text-slate-400">
                                    {Math.round(
                                      (new Date(run.completedAt).getTime() -
                                        new Date(run.startedAt).getTime()) /
                                        1000,
                                    )}s
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* Marketing Agents */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Megaphone size={20} className="text-lavender-500" />
          <h2 className="font-serif text-lg font-semibold text-slate-900 dark:text-white">
            Marketing Agents
          </h2>
          <span className="text-xs text-slate-500 ml-auto">
            {marketingAgents.filter((a) => a.enabled).length} of {marketingAgents.length} active
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {marketingAgents.length === 0 ? (
            <div className="col-span-full rounded-2xl bg-white dark:bg-slate-900 p-12 shadow-soft text-center">
              <Megaphone className="mx-auto mb-4 text-slate-400" size={48} />
              <h3 className="font-serif text-lg text-slate-900 dark:text-white mb-2">
                No Marketing Agents
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Marketing agents will appear here once configured.
              </p>
            </div>
          ) : (
            marketingAgents.map((agent) => (
              <div
                key={agent.id}
                className="rounded-2xl bg-white dark:bg-slate-900 p-5 shadow-soft border border-slate-100 dark:border-slate-800"
                data-testid={`marketing-agent-${agent.type}`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        'w-2 h-2 rounded-full flex-shrink-0',
                        agent.enabled ? 'bg-green-500' : 'bg-slate-300',
                      )}
                    />
                    <h3 className="font-medium text-sm text-slate-900 dark:text-white">
                      {agent.name}
                    </h3>
                  </div>
                  <span
                    className={cn(
                      'text-[10px] px-2 py-0.5 rounded-full font-medium',
                      agent.enabled
                        ? 'bg-sage-50 text-sage-700'
                        : 'bg-slate-100 text-slate-500',
                    )}
                  >
                    {agent.enabled ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 line-clamp-2">
                  {MARKETING_AGENT_DESCRIPTIONS[agent.type] || 'Marketing automation agent'}
                </p>
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span>
                    {agent.lastRunAt
                      ? `Last: ${formatRelative(agent.lastRunAt)}`
                      : 'Never run'}
                  </span>
                  <span>Every {agent.runIntervalMinutes || 60}min</span>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function formatRelative(isoString: string): string {
  const diffMs = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}
