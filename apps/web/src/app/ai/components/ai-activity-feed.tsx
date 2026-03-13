'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { Activity, CheckCircle, XCircle, Clock } from 'lucide-react';

interface AgentRun {
  id: string;
  agentType: string;
  status: 'SUCCESS' | 'FAILURE' | 'RUNNING';
  startedAt: string;
  completedAt?: string;
  cardsCreated: number;
  errors?: any;
}

export function AIActivityFeed() {
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRuns = async () => {
      try {
        setLoading(true);
        const data = await api.get<any>('/agent-runs?take=15');
        const items = data?.data || data || [];
        setRuns(Array.isArray(items) ? items : []);
      } catch {
        setRuns([]);
      } finally {
        setLoading(false);
      }
    };
    fetchRuns();
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'SUCCESS':
        return <CheckCircle size={14} className="text-green-500" />;
      case 'FAILURE':
        return <XCircle size={14} className="text-red-500" />;
      case 'RUNNING':
        return <Clock size={14} className="text-amber-500 animate-pulse" />;
      default:
        return <Clock size={14} className="text-slate-400" />;
    }
  };

  const formatTimestamp = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const now = new Date();
      const diffMinutes = Math.floor((now.getTime() - date.getTime()) / 60000);
      if (diffMinutes < 1) return 'Just now';
      if (diffMinutes < 60) return `${diffMinutes}m ago`;
      if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)}h ago`;
      return `${Math.floor(diffMinutes / 1440)}d ago`;
    } catch {
      return 'Unknown';
    }
  };

  const formatAgentName = (agentType: string) =>
    agentType
      .replace(/([A-Z])/g, ' $1')
      .trim()
      .replace(/_/g, ' ');

  if (loading) {
    return (
      <div className="rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-soft border border-slate-100 dark:border-slate-800">
        <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-1/4 mb-6"></div>
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex gap-3 animate-pulse">
              <div className="h-3.5 w-3.5 bg-slate-200 dark:bg-slate-700 rounded-full flex-shrink-0 mt-1"></div>
              <div className="flex-1">
                <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/2 mb-2"></div>
                <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-3/4"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (runs.length === 0) {
    return (
      <div className="rounded-2xl bg-white dark:bg-slate-900 p-12 shadow-soft border border-slate-100 dark:border-slate-800 text-center">
        <Activity className="mx-auto mb-4 text-slate-400" size={48} />
        <h3 className="font-serif text-lg text-slate-900 dark:text-white mb-2">
          No Recent Activity
        </h3>
        <p className="text-slate-600 dark:text-slate-400">
          Agent runs will appear here once agents start processing.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-soft border border-slate-100 dark:border-slate-800">
      <h2 className="font-serif text-lg font-semibold text-slate-900 dark:text-white mb-4">
        Recent Agent Runs
      </h2>

      <div className="max-h-96 overflow-y-auto space-y-3">
        {runs.map((run) => (
          <div
            key={run.id}
            className="flex gap-3 pb-3 border-b border-slate-100 dark:border-slate-800 last:border-0 last:pb-0"
          >
            <div className="flex-shrink-0 mt-0.5">{getStatusIcon(run.status)}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium text-slate-900 dark:text-white">
                  {formatAgentName(run.agentType)}
                </p>
                <span className="text-[11px] text-slate-500 flex-shrink-0">
                  {formatTimestamp(run.startedAt)}
                </span>
              </div>
              <div className="flex items-center gap-3 mt-0.5">
                <span
                  className={cn(
                    'text-xs',
                    run.status === 'SUCCESS'
                      ? 'text-green-600'
                      : run.status === 'FAILURE'
                        ? 'text-red-600'
                        : 'text-amber-600',
                  )}
                >
                  {run.status.toLowerCase()}
                </span>
                {run.cardsCreated > 0 && (
                  <span className="text-xs text-slate-500">{run.cardsCreated} cards created</span>
                )}
                {run.completedAt && run.startedAt && (
                  <span className="text-xs text-slate-400">
                    {Math.round(
                      (new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime()) /
                        1000,
                    )}
                    s
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
