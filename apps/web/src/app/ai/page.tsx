'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { useI18n } from '@/lib/i18n';
import {
  Sparkles,
  Bot,
  Activity,
  Zap,
  CheckCircle,
  Clock,
  AlertTriangle,
  TrendingUp,
} from 'lucide-react';
import { AgentDashboard } from './components/agent-dashboard';
import { AutonomyOverview } from './components/autonomy-overview';
import { AIActivityFeed } from './components/ai-activity-feed';

interface Agent {
  id: string;
  name: string;
  status: 'active' | 'paused' | 'error';
}

interface Action {
  id: string;
  action: string;
  status: 'pending' | 'approved' | 'rejected';
  timestamp: string;
}

interface RunMetrics {
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
  successRate: number;
  avgRunTime: number;
}

type TabType = 'overview' | 'agents' | 'actions' | 'performance';

export default function AICommandCenterPage() {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [agents, setAgents] = useState<Agent[]>([]);
  const [actions, setActions] = useState<Action[]>([]);
  const [metrics, setMetrics] = useState<RunMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [agentsLoading, setAgentsLoading] = useState(false);
  const [actionsLoading, setActionsLoading] = useState(false);
  const [metricsLoading, setMetricsLoading] = useState(false);

  // Fetch agents for Agents tab
  const fetchAgents = async () => {
    try {
      setAgentsLoading(true);
      const data = await api.get<Agent[]>('/ai/agents');
      setAgents(data || []);
    } catch (err) {
      console.error('Failed to fetch agents:', err);
      setAgents([]);
    } finally {
      setAgentsLoading(false);
    }
  };

  // Fetch actions for Actions tab
  const fetchActions = async () => {
    try {
      setActionsLoading(true);
      const data = await api.get<Action[]>('/ai/briefing');
      setActions(data || []);
    } catch (err) {
      console.error('Failed to fetch actions:', err);
      setActions([]);
    } finally {
      setActionsLoading(false);
    }
  };

  // Fetch metrics for Performance tab
  const fetchMetrics = async () => {
    try {
      setMetricsLoading(true);
      const data = await api.get<RunMetrics>('/ai/performance');
      setMetrics(data || null);
    } catch (err) {
      console.error('Failed to fetch metrics:', err);
      setMetrics(null);
    } finally {
      setMetricsLoading(false);
    }
  };

  // Load initial data
  useEffect(() => {
    setLoading(false);
  }, []);

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    // Fetch data for specific tabs on demand
    if (tab === 'agents' && agents.length === 0) {
      fetchAgents();
    } else if (tab === 'actions' && actions.length === 0) {
      fetchActions();
    } else if (tab === 'performance' && !metrics) {
      fetchMetrics();
    }
  };

  const tabs: Array<{ id: TabType; label: string; icon: any }> = [
    { id: 'overview', label: 'Overview', icon: Sparkles },
    { id: 'agents', label: 'Agents', icon: Bot },
    { id: 'actions', label: 'Actions', icon: Zap },
    { id: 'performance', label: 'Performance', icon: TrendingUp },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Sparkles size={32} className="text-lavender-500" />
            <h1 className="font-serif text-3xl font-bold text-slate-900 dark:text-white">
              AI Command Center
            </h1>
          </div>
          <p className="text-slate-600 dark:text-slate-400">
            Monitor and manage your AI agents and automations
          </p>
        </div>

        {/* Tab Bar */}
        <div className="mb-8 flex gap-1 border-b border-slate-200 dark:border-slate-800 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={cn(
                  'relative flex items-center gap-2 px-4 py-3 text-sm font-medium transition-all whitespace-nowrap',
                  isActive
                    ? 'text-sage-600 dark:text-sage-400 border-b-2 border-sage-600 dark:border-sage-400'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200',
                )}
              >
                <Icon size={18} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div>
          {loading ? (
            <div className="grid grid-cols-1 gap-6">
              {[...Array(2)].map((_, i) => (
                <div
                  key={i}
                  className="rounded-2xl bg-white dark:bg-slate-900 p-8 shadow-soft animate-pulse"
                >
                  <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-1/3 mb-4"></div>
                  <div className="space-y-3">
                    {[...Array(3)].map((_, j) => (
                      <div
                        key={j}
                        className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-full"
                      ></div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : activeTab === 'overview' ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-3">
                  <AgentDashboard />
                </div>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                  <AIActivityFeed />
                </div>
                <div>
                  <AutonomyOverview />
                </div>
              </div>
            </div>
          ) : activeTab === 'agents' ? (
            <div>
              {agentsLoading ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <div
                      key={i}
                      className="rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-soft animate-pulse"
                    >
                      <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-1/4 mb-3"></div>
                      <div className="space-y-2">
                        {[...Array(2)].map((_, j) => (
                          <div
                            key={j}
                            className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-full"
                          ></div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : agents.length === 0 ? (
                <div className="rounded-2xl bg-white dark:bg-slate-900 p-12 shadow-soft text-center">
                  <Bot className="mx-auto mb-4 text-slate-400" size={48} />
                  <h3 className="font-serif text-lg text-slate-900 dark:text-white mb-2">
                    No Agents Configured
                  </h3>
                  <p className="text-slate-600 dark:text-slate-400">
                    Set up AI agents to start automating your booking operations.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {agents.map((agent) => (
                    <div
                      key={agent.id}
                      className="rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-soft border border-slate-100 dark:border-slate-800"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={cn(
                            'status-dot',
                            agent.status === 'active'
                              ? 'bg-green-500'
                              : agent.status === 'paused'
                                ? 'bg-amber-500'
                                : 'bg-red-500',
                          )}
                        ></span>
                        <h3 className="font-serif font-semibold text-slate-900 dark:text-white">
                          {agent.name}
                        </h3>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : activeTab === 'actions' ? (
            <div>
              {actionsLoading ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <div
                      key={i}
                      className="rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-soft animate-pulse"
                    >
                      <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-1/3 mb-3"></div>
                      <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-full"></div>
                    </div>
                  ))}
                </div>
              ) : actions.length === 0 ? (
                <div className="rounded-2xl bg-white dark:bg-slate-900 p-12 shadow-soft text-center">
                  <CheckCircle className="mx-auto mb-4 text-green-500" size={48} />
                  <h3 className="font-serif text-lg text-slate-900 dark:text-white mb-2">
                    All Clear
                  </h3>
                  <p className="text-slate-600 dark:text-slate-400">
                    No pending actions. Your AI agents are running smoothly.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {actions.map((action) => (
                    <div
                      key={action.id}
                      className="rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-soft border-l-4 border-lavender-400"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="font-serif font-semibold text-slate-900 dark:text-white mb-1">
                            {action.action}
                          </p>
                          <p className="text-sm text-slate-600 dark:text-slate-400">
                            {new Date(action.timestamp).toLocaleString()}
                          </p>
                        </div>
                        <span
                          className={cn(
                            'px-3 py-1 rounded-lg text-xs font-medium',
                            action.status === 'pending'
                              ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                              : action.status === 'approved'
                                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                                : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
                          )}
                        >
                          {action.status.charAt(0).toUpperCase() + action.status.slice(1)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : activeTab === 'performance' ? (
            <div>
              {metricsLoading ? (
                <div className="rounded-2xl bg-white dark:bg-slate-900 p-8 shadow-soft animate-pulse">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[...Array(4)].map((_, i) => (
                      <div key={i}>
                        <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4 mb-2"></div>
                        <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-1/2"></div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : !metrics ? (
                <div className="rounded-2xl bg-white dark:bg-slate-900 p-12 shadow-soft text-center">
                  <TrendingUp className="mx-auto mb-4 text-slate-400" size={48} />
                  <h3 className="font-serif text-lg text-slate-900 dark:text-white mb-2">
                    No Performance Data
                  </h3>
                  <p className="text-slate-600 dark:text-slate-400">
                    Run your AI agents to see performance metrics.
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Metrics Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-soft border border-slate-100 dark:border-slate-800">
                      <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">Total Runs</p>
                      <p className="font-serif text-3xl font-bold text-slate-900 dark:text-white">
                        {metrics.totalRuns}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-soft border border-slate-100 dark:border-slate-800">
                      <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">Successful</p>
                      <p className="font-serif text-3xl font-bold text-green-600 dark:text-green-400">
                        {metrics.successfulRuns}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-soft border border-slate-100 dark:border-slate-800">
                      <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">Failed</p>
                      <p className="font-serif text-3xl font-bold text-red-600 dark:text-red-400">
                        {metrics.failedRuns}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-soft border border-slate-100 dark:border-slate-800">
                      <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                        Success Rate
                      </p>
                      <p className="font-serif text-3xl font-bold text-sage-600 dark:text-sage-400">
                        {Math.round(metrics.successRate)}%
                      </p>
                    </div>
                  </div>

                  {/* Avg Run Time */}
                  <div className="rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-soft border border-slate-100 dark:border-slate-800">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                          Average Run Time
                        </p>
                        <p className="font-serif text-2xl font-bold text-slate-900 dark:text-white">
                          {metrics.avgRunTime}ms
                        </p>
                      </div>
                      <Clock className="text-lavender-400" size={40} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
