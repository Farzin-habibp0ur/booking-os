'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { Megaphone, FileText, BarChart3, Target } from 'lucide-react';
import { PageSkeleton } from '@/components/skeleton';
import { AgentDashboard } from './components/agent-dashboard';
import { AutonomyOverview } from './components/autonomy-overview';
import { AIActivityFeed } from './components/ai-activity-feed';

interface ContentStats {
  byStatus?: Record<string, number>;
  byTier?: Record<string, number>;
  byContentType?: Record<string, number>;
  byPillar?: Record<string, number>;
}

interface PillarBalance {
  pillar: string;
  count: number;
  percentage: number;
}

export default function AIOverviewPage() {
  const [contentStats, setContentStats] = useState<ContentStats | null>(null);
  const [pillarBalance, setPillarBalance] = useState<PillarBalance[]>([]);
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    const fetchContentData = async () => {
      try {
        const [stats, balance] = await Promise.all([
          api.get<ContentStats>('/marketing-content/stats').catch(() => null),
          api.get<PillarBalance[]>('/marketing-content/pillar-balance').catch(() => []),
        ]);
        setContentStats(stats as ContentStats);
        setPillarBalance(Array.isArray(balance) ? balance : []);
      } catch {
        // Graceful fallback
      } finally {
        setStatsLoading(false);
      }
    };
    fetchContentData();
  }, []);

  const totalContent = contentStats?.byStatus
    ? Object.values(contentStats.byStatus).reduce((s, v) => s + v, 0)
    : 0;
  const publishedCount = contentStats?.byStatus?.PUBLISHED || 0;
  const draftCount = contentStats?.byStatus?.DRAFT || 0;
  const reviewCount = contentStats?.byStatus?.IN_REVIEW || 0;

  return (
    <div className="space-y-6" data-testid="ai-overview">
      {/* System Health + Agent Dashboard */}
      <AgentDashboard />

      {/* Activity Feed + Autonomy */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <AIActivityFeed />
        </div>
        <div>
          <AutonomyOverview />
        </div>
      </div>

      {/* Content Pipeline Summary */}
      <div
        className="rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-soft border border-slate-100 dark:border-slate-800"
        data-testid="content-pipeline-summary"
      >
        <div className="flex items-center gap-2 mb-4">
          <Megaphone size={20} className="text-lavender-500" />
          <h2 className="font-serif text-lg font-semibold text-slate-900 dark:text-white">
            Content Pipeline
          </h2>
        </div>

        {statsLoading ? (
          <PageSkeleton />
        ) : (
          <div className="space-y-4">
            {/* Content Status Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <MiniStat icon={<FileText size={16} />} label="Total Content" value={totalContent} />
              <MiniStat
                icon={<Target size={16} />}
                label="Published"
                value={publishedCount}
                color="text-green-600"
              />
              <MiniStat
                icon={<FileText size={16} />}
                label="Drafts"
                value={draftCount}
                color="text-amber-600"
              />
              <MiniStat
                icon={<BarChart3 size={16} />}
                label="In Review"
                value={reviewCount}
                color="text-lavender-600"
              />
            </div>

            {/* Tier Distribution */}
            {contentStats?.byTier && Object.keys(contentStats.byTier).length > 0 && (
              <div>
                <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">
                  Content Tier Distribution
                </p>
                <div className="flex gap-1 h-3 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800">
                  {Object.entries(contentStats.byTier).map(([tier, count]) => {
                    const total = Object.values(contentStats.byTier!).reduce((s, v) => s + v, 0);
                    const pct = total > 0 ? (count / total) * 100 : 0;
                    return (
                      <div
                        key={tier}
                        className={cn(
                          'h-full',
                          tier === 'GREEN'
                            ? 'bg-green-500'
                            : tier === 'YELLOW'
                              ? 'bg-amber-500'
                              : 'bg-red-500',
                        )}
                        style={{ width: `${pct}%` }}
                        title={`${tier}: ${count} (${Math.round(pct)}%)`}
                      />
                    );
                  })}
                </div>
                <div className="flex justify-between mt-1">
                  {Object.entries(contentStats.byTier).map(([tier, count]) => (
                    <span key={tier} className="text-[10px] text-slate-500">
                      {tier}: {count}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Pillar Balance */}
            {pillarBalance.length > 0 && (
              <div>
                <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">
                  Pillar Balance
                </p>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                  {pillarBalance.map((p) => (
                    <div
                      key={p.pillar}
                      className="flex items-center justify-between bg-slate-50 dark:bg-slate-800 rounded-lg px-3 py-2"
                    >
                      <span className="text-xs text-slate-700 dark:text-slate-300 truncate">
                        {p.pillar}
                      </span>
                      <span className="text-xs font-medium text-lavender-600 ml-2">
                        {Math.round(p.percentage)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function MiniStat({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color?: string;
}) {
  return (
    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3">
      <div className="flex items-center gap-1.5 mb-1 text-slate-500">
        {icon}
        <span className="text-[11px]">{label}</span>
      </div>
      <p className={cn('font-serif text-xl font-bold', color || 'text-slate-900 dark:text-white')}>
        {value}
      </p>
    </div>
  );
}
