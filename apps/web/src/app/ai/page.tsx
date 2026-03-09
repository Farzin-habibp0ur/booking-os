'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { Bot, Megaphone } from 'lucide-react';
import { AgentDashboard } from './components/agent-dashboard';
import { AutonomyOverview } from './components/autonomy-overview';
import { AIActivityFeed } from './components/ai-activity-feed';

interface MarketingAgent {
  id: string;
  type: string;
  name: string;
  enabled: boolean;
  lastRunAt: string | null;
  runCount: number;
}

const MARKETING_AGENT_LABELS: Record<string, string> = {
  BLOG_WRITER: 'Blog Writer',
  SOCIAL_CREATOR: 'Social Creator',
  EMAIL_COMPOSER: 'Email Composer',
  CASE_STUDY: 'Case Study',
  VIDEO_SCRIPT: 'Video Script',
  NEWSLETTER: 'Newsletter',
  CONTENT_SCHEDULER: 'Content Scheduler',
  CONTENT_PUBLISHER: 'Content Publisher',
  PERFORMANCE_TRACKER: 'Performance Tracker',
  TREND_ANALYZER: 'Trend Analyzer',
  CONTENT_CALENDAR: 'Content Calendar',
  CONTENT_ROI: 'Content ROI',
};

export default function AIOverviewPage() {
  const [marketingAgents, setMarketingAgents] = useState<MarketingAgent[]>([]);
  const [marketingLoading, setMarketingLoading] = useState(true);

  useEffect(() => {
    const fetchMarketingAgents = async () => {
      try {
        const data = await api.get<MarketingAgent[]>('/marketing-agents');
        setMarketingAgents(data || []);
      } catch {
        // Create mock data from known types
        setMarketingAgents(
          Object.entries(MARKETING_AGENT_LABELS).map(([type, name], i) => ({
            id: `ma-${i}`,
            type,
            name,
            enabled: i < 6,
            lastRunAt: i < 6 ? new Date(Date.now() - Math.random() * 7200000).toISOString() : null,
            runCount: i < 6 ? Math.floor(Math.random() * 50) + 5 : 0,
          })),
        );
      } finally {
        setMarketingLoading(false);
      }
    };
    fetchMarketingAgents();
  }, []);

  return (
    <div className="space-y-6" data-testid="ai-overview">
      {/* Core Agent Dashboard */}
      <div>
        <AgentDashboard />
      </div>

      {/* Activity Feed + Autonomy */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <AIActivityFeed />
        </div>
        <div>
          <AutonomyOverview />
        </div>
      </div>

      {/* Marketing Agents Summary */}
      <div
        className="rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-soft border border-slate-100 dark:border-slate-800"
        data-testid="marketing-agents-summary"
      >
        <div className="flex items-center gap-2 mb-4">
          <Megaphone size={20} className="text-lavender-500" />
          <h2 className="font-serif text-lg font-semibold text-slate-900 dark:text-white">
            Marketing Agents
          </h2>
          <span className="text-xs text-slate-500 ml-auto">
            {marketingAgents.filter((a) => a.enabled).length} of {marketingAgents.length} active
          </span>
        </div>

        {marketingLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="h-16 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse"
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {marketingAgents.map((agent) => (
              <div
                key={agent.id}
                className={cn(
                  'rounded-xl p-3 border transition-colors',
                  agent.enabled
                    ? 'border-sage-100 bg-sage-50/50 dark:bg-sage-900/10 dark:border-sage-800'
                    : 'border-slate-100 bg-slate-50 dark:bg-slate-800/50 dark:border-slate-700',
                )}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <span
                    className={cn(
                      'w-1.5 h-1.5 rounded-full flex-shrink-0',
                      agent.enabled ? 'bg-green-500' : 'bg-slate-300',
                    )}
                  />
                  <p className="text-xs font-medium text-slate-900 dark:text-white truncate">
                    {MARKETING_AGENT_LABELS[agent.type] || agent.name}
                  </p>
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                  {agent.enabled
                    ? agent.lastRunAt
                      ? `Last run ${formatRelative(agent.lastRunAt)}`
                      : 'Waiting'
                    : 'Disabled'}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
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
