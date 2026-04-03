'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { MessageSquare, Zap, Bot, FileEdit } from 'lucide-react';

interface AIStats {
  processedToday: number;
  autoReplied: number;
  draftsCreated: number;
  failed: number;
  dailyLimit: number;
  history: unknown[];
}

interface AgentStats {
  totalRuns: number;
  byAgent: unknown[];
  byStatus: unknown[];
}

export function AIValueKPIs() {
  const [stats, setStats] = useState<AIStats>({
    processedToday: 0,
    autoReplied: 0,
    draftsCreated: 0,
    failed: 0,
    dailyLimit: 0,
    history: [],
  });
  const [agentStats, setAgentStats] = useState<AgentStats>({
    totalRuns: 0,
    byAgent: [],
    byStatus: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [aiStatsData, agentStatsData] = await Promise.allSettled([
          api.get<AIStats>('/ai/stats'),
          api.get<AgentStats>('/agent-runs/stats'),
        ]);

        if (aiStatsData.status === 'fulfilled' && aiStatsData.value) {
          setStats(aiStatsData.value);
        }

        if (agentStatsData.status === 'fulfilled' && agentStatsData.value) {
          setAgentStats(agentStatsData.value);
        }
      } catch {
        // defaults already set to 0
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4" data-testid="ai-value-kpis">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="animate-pulse bg-white rounded-2xl h-24" />
        ))}
      </div>
    );
  }

  const kpis = [
    {
      label: 'Conversations Handled',
      value: stats.processedToday,
      icon: <MessageSquare size={20} className="text-lavender-600" />,
      iconBg: 'bg-lavender-50',
    },
    {
      label: 'Auto-Replies Sent',
      value: stats.autoReplied,
      icon: <Zap size={20} className="text-sage-600" />,
      iconBg: 'bg-sage-50',
    },
    {
      label: 'Agent Tasks',
      value: agentStats.totalRuns,
      icon: <Bot size={20} className="text-slate-600" />,
      iconBg: 'bg-slate-100',
    },
    {
      label: 'Drafts Pending',
      value: stats.draftsCreated,
      icon: <FileEdit size={20} className="text-amber-700" />,
      iconBg: 'bg-amber-50',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4" data-testid="ai-value-kpis">
      {kpis.map((kpi) => (
        <div key={kpi.label} className="bg-white rounded-2xl shadow-soft p-5">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center ${kpi.iconBg} mb-3`}
          >
            {kpi.icon}
          </div>
          <p className="font-serif text-2xl font-bold text-slate-900">{kpi.value}</p>
          <p className="text-sm text-slate-500">{kpi.label}</p>
        </div>
      ))}
    </div>
  );
}
