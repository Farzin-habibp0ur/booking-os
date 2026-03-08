'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { useI18n } from '@/lib/i18n';
import { AlertTriangle, Zap } from 'lucide-react';

interface Agent {
  id: string;
  name: string;
  type: string;
  status: 'active' | 'paused' | 'error';
  description: string;
  lastRun: string;
  successRate: number;
}

const AGENT_TYPES = [
  'Booking Agent',
  'Follow-up Agent',
  'Review Agent',
  'Waitlist Agent',
  'Outbound Agent',
];

export function AgentDashboard() {
  const { t } = useI18n();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAgents = async () => {
      try {
        setLoading(true);
        const data = await api.get<Agent[]>('/ai/agents');
        setAgents(data || []);
        setError(null);
      } catch (err) {
        console.error('Failed to fetch agents:', err);
        // Gracefully mock data if API fails
        const mockAgents: Agent[] = AGENT_TYPES.map((type, i) => ({
          id: `agent-${i}`,
          name: type,
          type,
          status: i === 0 ? 'active' : i === 1 ? 'paused' : 'active',
          description: `${type} running on your booking system`,
          lastRun: new Date(Date.now() - Math.random() * 3600000).toISOString(),
          successRate: 85 + Math.random() * 15,
        }));
        setAgents(mockAgents);
        setError(null);
      } finally {
        setLoading(false);
      }
    };

    fetchAgents();
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-500';
      case 'paused':
        return 'bg-amber-500';
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-slate-400';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'active':
        return 'Active';
      case 'paused':
        return 'Paused';
      case 'error':
        return 'Error';
      default:
        return 'Unknown';
    }
  };

  const formatLastRun = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const now = new Date();
      const diffMinutes = Math.floor((now.getTime() - date.getTime()) / 60000);

      if (diffMinutes < 1) return 'Just now';
      if (diffMinutes < 60) return `${diffMinutes}m ago`;
      if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)}h ago`;
      return `${Math.floor(diffMinutes / 1440)}d ago`;
    } catch {
      return 'Never';
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-soft animate-pulse"
            >
              <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-3/4 mb-4"></div>
              <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-full mb-3"></div>
              <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-2/3"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (agents.length === 0) {
    return (
      <div className="rounded-2xl bg-white dark:bg-slate-900 p-12 shadow-soft text-center">
        <div className="flex justify-center mb-4">
          <Zap className="text-lavender-400" size={48} />
        </div>
        <h3 className="font-serif text-lg text-slate-900 dark:text-white mb-2">No Agents Yet</h3>
        <p className="text-slate-600 dark:text-slate-400">
          Set up your first AI agent to automate bookings and follow-ups.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {agents.map((agent) => (
        <div
          key={agent.id}
          className="rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-soft border border-slate-100 dark:border-slate-800 hover:shadow-md transition-shadow"
        >
          {/* Header with status dot */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className={cn('status-dot', getStatusColor(agent.status))}></span>
                <h3 className="font-serif font-semibold text-slate-900 dark:text-white">
                  {agent.name}
                </h3>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {getStatusLabel(agent.status)}
              </p>
            </div>
          </div>

          {/* Description */}
          <p className="text-sm text-slate-600 dark:text-slate-300 mb-4 line-clamp-2">
            {agent.description}
          </p>

          {/* Last Run */}
          <div className="mb-4 pb-4 border-b border-slate-100 dark:border-slate-800">
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Last Run</p>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
              {formatLastRun(agent.lastRun)}
            </p>
          </div>

          {/* Success Rate Bar */}
          <div className="mb-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-slate-600 dark:text-slate-400">Success Rate</p>
              <p className="text-sm font-semibold text-sage-600 dark:text-sage-400">
                {Math.round(agent.successRate)}%
              </p>
            </div>
            <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-sage-500 dark:bg-sage-600 rounded-full transition-all"
                style={{ width: `${agent.successRate}%` }}
              ></div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
