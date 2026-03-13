'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { Bot, Zap, Megaphone, TrendingUp, AlertTriangle } from 'lucide-react';

interface AgentConfigItem {
  agentType: string;
  isEnabled: boolean;
  autonomyLevel: string;
  runIntervalMinutes?: number;
  lastRunAt?: string;
  nextRunAt?: string;
  performanceScore?: number;
  config?: Record<string, any>;
}

interface BriefingCount {
  URGENT_TODAY: number;
  NEEDS_APPROVAL: number;
  OPPORTUNITY: number;
  HYGIENE: number;
  total: number;
}

const MARKETING_AGENT_LABELS: Record<string, string> = {
  BlogWriter: 'Blog Writer',
  SocialCreator: 'Social Creator',
  EmailComposer: 'Email Composer',
  CaseStudyWriter: 'Case Study',
  VideoScriptWriter: 'Video Script',
  NewsletterComposer: 'Newsletter',
  ContentScheduler: 'Content Scheduler',
  ContentPublisher: 'Content Publisher',
  PerformanceTracker: 'Performance Tracker',
  TrendAnalyzer: 'Trend Analyzer',
  ContentCalendar: 'Content Calendar',
  ContentROI: 'Content ROI',
};

export function AgentDashboard() {
  const [agents, setAgents] = useState<AgentConfigItem[]>([]);
  const [briefingCount, setBriefingCount] = useState<BriefingCount | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [configData, countData] = await Promise.all([
          api.get<AgentConfigItem[]>('/agent-config').catch(() => []),
          api.get<BriefingCount>('/dashboard-briefing/briefing/count').catch(() => null),
        ]);
        setAgents(Array.isArray(configData) ? configData : []);
        setBriefingCount(countData as BriefingCount);
      } catch {
        setAgents([]);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const activeCount = agents.filter((a) => a.isEnabled).length;
  const avgScore = agents.length > 0
    ? Math.round(agents.reduce((sum, a) => sum + (a.performanceScore || 0), 0) / agents.length)
    : 0;

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-soft animate-pulse"
          >
            <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/2 mb-3"></div>
            <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-1/3 mb-2"></div>
            <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-2/3"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="agent-dashboard">
      {/* System Health KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <HealthCard
          icon={<Bot size={20} className="text-sage-600" />}
          label="Active Agents"
          value={`${activeCount}/${agents.length}`}
          sublabel={activeCount === agents.length ? 'All running' : `${agents.length - activeCount} paused`}
        />
        <HealthCard
          icon={<TrendingUp size={20} className="text-lavender-500" />}
          label="Avg Performance"
          value={`${avgScore}%`}
          sublabel={avgScore >= 80 ? 'Healthy' : avgScore >= 50 ? 'Moderate' : 'Needs attention'}
          valueColor={avgScore >= 80 ? 'text-green-600' : avgScore >= 50 ? 'text-amber-600' : 'text-red-600'}
        />
        <HealthCard
          icon={<AlertTriangle size={20} className="text-red-500" />}
          label="Urgent Actions"
          value={briefingCount?.URGENT_TODAY?.toString() || '0'}
          sublabel={`${briefingCount?.total || 0} total pending`}
          valueColor={(briefingCount?.URGENT_TODAY || 0) > 0 ? 'text-red-600' : 'text-slate-900'}
        />
        <HealthCard
          icon={<Megaphone size={20} className="text-lavender-500" />}
          label="Pending Approvals"
          value={briefingCount?.NEEDS_APPROVAL?.toString() || '0'}
          sublabel="Content reviews"
        />
      </div>

      {/* Agent Status Grid */}
      {agents.length > 0 && (
        <div className="rounded-2xl bg-white dark:bg-slate-900 p-5 shadow-soft border border-slate-100 dark:border-slate-800">
          <h3 className="font-serif text-sm font-semibold text-slate-900 dark:text-white mb-3">
            Agent Status
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2">
            {agents.map((agent) => (
              <div
                key={agent.agentType}
                className={cn(
                  'rounded-xl p-2.5 border transition-colors',
                  agent.isEnabled
                    ? 'border-sage-100 bg-sage-50/50 dark:bg-sage-900/10 dark:border-sage-800'
                    : 'border-slate-100 bg-slate-50 dark:bg-slate-800/50 dark:border-slate-700',
                )}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <span
                    className={cn(
                      'w-1.5 h-1.5 rounded-full flex-shrink-0',
                      agent.isEnabled ? 'bg-green-500' : 'bg-slate-300',
                    )}
                  />
                  <p className="text-[11px] font-medium text-slate-900 dark:text-white truncate">
                    {MARKETING_AGENT_LABELS[agent.agentType] || agent.agentType.replace(/_/g, ' ')}
                  </p>
                </div>
                {agent.performanceScore != null && (
                  <div className="flex items-center gap-1">
                    <div className="flex-1 h-1 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded-full',
                          agent.performanceScore >= 80 ? 'bg-green-500' : agent.performanceScore >= 50 ? 'bg-amber-500' : 'bg-red-500',
                        )}
                        style={{ width: `${agent.performanceScore}%` }}
                      />
                    </div>
                    <span className="text-[9px] text-slate-400">{Math.round(agent.performanceScore)}%</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {agents.length === 0 && (
        <div className="rounded-2xl bg-white dark:bg-slate-900 p-12 shadow-soft text-center">
          <Zap className="mx-auto mb-4 text-lavender-400" size={48} />
          <h3 className="font-serif text-lg text-slate-900 dark:text-white mb-2">No Agents Configured</h3>
          <p className="text-slate-600 dark:text-slate-400">
            Configure marketing agents to start automating your content pipeline.
          </p>
        </div>
      )}
    </div>
  );
}

function HealthCard({
  icon,
  label,
  value,
  sublabel,
  valueColor,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sublabel: string;
  valueColor?: string;
}) {
  return (
    <div className="rounded-2xl bg-white dark:bg-slate-900 p-5 shadow-soft border border-slate-100 dark:border-slate-800">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <p className="text-xs text-slate-600 dark:text-slate-400">{label}</p>
      </div>
      <p className={cn('font-serif text-2xl font-bold', valueColor || 'text-slate-900 dark:text-white')}>
        {value}
      </p>
      <p className="text-[11px] text-slate-500 mt-0.5">{sublabel}</p>
    </div>
  );
}
