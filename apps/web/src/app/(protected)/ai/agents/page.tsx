'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { useToast } from '@/lib/toast';
import { Bot, ChevronDown, ChevronUp, Play, CheckCircle, XCircle, Clock } from 'lucide-react';
import { ListSkeleton } from '@/components/skeleton';

interface AgentConfig {
  id: string;
  agentType: string;
  isEnabled: boolean;
  autonomyLevel: string;
  config?: Record<string, any>;
  runIntervalMinutes?: number;
  lastRunAt?: string;
  nextRunAt?: string;
  performanceScore?: number;
}

interface AgentRun {
  id: string;
  agentType: string;
  status: 'SUCCESS' | 'FAILURE' | 'RUNNING';
  startedAt: string;
  completedAt?: string;
  cardsCreated: number;
  errors?: any;
}

const AGENT_DESCRIPTIONS: Record<string, string> = {
  WAITLIST: 'Auto-matches waitlist entries to cancelled booking slots',
  RETENTION: 'Detects at-risk customers and generates win-back action cards',
  DATA_HYGIENE: 'Identifies duplicate records and incomplete customer profiles',
  SCHEDULING_OPTIMIZER: 'Detects schedule gaps and suggests optimal booking slots',
  QUOTE_FOLLOWUP: 'Sends follow-up reminders for expired or pending quotes',
};

export default function AIAgentsPage() {
  const { toast } = useToast();
  const [agents, setAgents] = useState<AgentConfig[]>([]);
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [runningId, setRunningId] = useState<string | null>(null);

  useEffect(() => {
    loadAgents();
  }, []);

  const loadAgents = async () => {
    setLoading(true);
    try {
      const [configs, agentRuns] = await Promise.all([
        api.get<AgentConfig[]>('/agent-config').catch(() => []),
        api.get<any>('/agent-runs?take=100').catch(() => ({ data: [] })),
      ]);

      setAgents(Array.isArray(configs) ? configs : []);

      const runData = (agentRuns as any)?.data || agentRuns || [];
      setRuns(Array.isArray(runData) ? runData : []);
    } catch {
      // Graceful fallback
    } finally {
      setLoading(false);
    }
  };

  const toggleAgent = async (agentType: string, currentEnabled: boolean) => {
    setTogglingId(agentType);
    try {
      await api.patch(`/agent-config/${agentType}`, { isEnabled: !currentEnabled });
      setAgents((prev) =>
        prev.map((a) => (a.agentType === agentType ? { ...a, isEnabled: !currentEnabled } : a)),
      );
      toast(`${formatAgentName(agentType)} ${!currentEnabled ? 'enabled' : 'disabled'}`);
    } catch {
      toast('Failed to toggle agent', 'error');
    } finally {
      setTogglingId(null);
    }
  };

  const triggerAgent = async (agentType: string) => {
    setRunningId(agentType);
    try {
      await api.post(`/agent-config/${agentType}/run-now`, {});
      toast(`${formatAgentName(agentType)} triggered`);
      setTimeout(() => loadAgents(), 3000);
    } catch {
      toast('Failed to trigger agent', 'error');
    } finally {
      setRunningId(null);
    }
  };

  const getAgentRuns = (agentType: string) =>
    runs.filter((r) => r.agentType === agentType).slice(0, 10);

  if (loading) {
    return (
      <div className="space-y-6" data-testid="agents-loading">
        <ListSkeleton rows={4} />
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
          <span className="text-xs text-slate-500 ml-2">
            {agents.filter((a) => a.isEnabled).length}/{agents.length} active
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {agents.length === 0 ? (
            <div className="col-span-full rounded-2xl bg-white dark:bg-slate-900 p-12 shadow-soft text-center">
              <Bot className="mx-auto mb-4 text-slate-400" size={48} />
              <h3 className="font-serif text-lg text-slate-900 dark:text-white mb-2">
                No Core Agents
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Configure agents in Settings to start automating your operations.
              </p>
            </div>
          ) : (
            agents.map((agent) => (
              <AgentCard
                key={agent.agentType}
                agent={agent}
                runs={getAgentRuns(agent.agentType)}
                expanded={expandedAgent === agent.agentType}
                toggling={togglingId === agent.agentType}
                running={runningId === agent.agentType}
                onToggle={() => toggleAgent(agent.agentType, agent.isEnabled)}
                onTrigger={() => triggerAgent(agent.agentType)}
                onExpand={() =>
                  setExpandedAgent(expandedAgent === agent.agentType ? null : agent.agentType)
                }
              />
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function AgentCard({
  agent,
  runs,
  expanded,
  toggling,
  running,
  onToggle,
  onTrigger,
  onExpand,
}: {
  agent: AgentConfig;
  runs: AgentRun[];
  expanded: boolean;
  toggling: boolean;
  running: boolean;
  onToggle: () => void;
  onTrigger: () => void;
  onExpand: () => void;
}) {
  return (
    <div
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
              {formatAgentName(agent.agentType)}
            </h3>
          </div>
          <button
            onClick={onToggle}
            disabled={toggling}
            className={cn(
              'relative w-10 h-5 rounded-full transition-colors flex-shrink-0',
              agent.isEnabled ? 'bg-sage-500' : 'bg-slate-300',
              toggling && 'opacity-50',
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
          {AGENT_DESCRIPTIONS[agent.agentType] || 'AI-powered automation agent'}
        </p>

        {/* Performance Score */}
        {agent.performanceScore != null && (
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] text-slate-500">Performance</span>
              <span
                className={cn(
                  'text-xs font-medium',
                  agent.performanceScore >= 80
                    ? 'text-green-600'
                    : agent.performanceScore >= 50
                      ? 'text-amber-600'
                      : 'text-red-600',
                )}
              >
                {Math.round(agent.performanceScore)}%
              </span>
            </div>
            <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all',
                  agent.performanceScore >= 80
                    ? 'bg-green-500'
                    : agent.performanceScore >= 50
                      ? 'bg-amber-500'
                      : 'bg-red-500',
                )}
                style={{ width: `${agent.performanceScore}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>
            {agent.lastRunAt ? `Last run ${formatRelative(agent.lastRunAt)}` : 'Never run'}
          </span>
          {agent.runIntervalMinutes && (
            <span className="text-slate-400">Every {agent.runIntervalMinutes}min</span>
          )}
        </div>

        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <button
            onClick={onTrigger}
            disabled={!agent.isEnabled || running}
            className={cn(
              'flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg transition-colors',
              'bg-sage-50 text-sage-700 hover:bg-sage-100',
              'disabled:opacity-50',
            )}
            data-testid={`trigger-${agent.agentType}`}
          >
            <Play size={12} className={running ? 'animate-pulse' : ''} />
            {running ? 'Running...' : 'Run Now'}
          </button>
          <button
            onClick={onExpand}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg bg-slate-50 text-slate-600 hover:bg-slate-100 transition-colors ml-auto"
            data-testid={`expand-${agent.agentType}`}
          >
            History
            {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
        </div>
      </div>

      {/* Expanded: Run History */}
      {expanded && (
        <div
          className="border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 px-5 py-3"
          data-testid={`history-${agent.agentType}`}
        >
          {runs.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-2">No run history</p>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {runs.map((run) => (
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
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
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
                        )}
                        s
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
}

function formatAgentName(agentType: string): string {
  // Handle PascalCase (marketing agents)
  const spaced = agentType.replace(/([A-Z])/g, ' $1').trim();
  // Handle SCREAMING_SNAKE_CASE (core agents)
  return spaced.replace(/_/g, ' ');
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
