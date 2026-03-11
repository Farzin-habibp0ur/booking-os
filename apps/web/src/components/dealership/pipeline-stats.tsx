'use client';

import { DollarSign, TrendingUp, Clock, Trophy } from 'lucide-react';

interface PipelineStatsProps {
  stats: {
    totalDeals: number;
    totalPipelineValue: number;
    weightedPipelineValue: number;
    winRate: number;
    avgCycleTime: number;
    won: number;
    lost: number;
  } | null;
}

export function PipelineStats({ stats }: PipelineStatsProps) {
  if (!stats) return null;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-soft p-4">
        <div className="flex items-center gap-2 text-slate-500 text-xs mb-1">
          <DollarSign size={14} />
          Pipeline Value
        </div>
        <p className="text-2xl font-serif font-bold text-slate-900 dark:text-slate-100">
          ${stats.totalPipelineValue.toLocaleString()}
        </p>
        <p className="text-xs text-slate-400 mt-0.5">
          Weighted: ${stats.weightedPipelineValue.toLocaleString()}
        </p>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-soft p-4">
        <div className="flex items-center gap-2 text-slate-500 text-xs mb-1">
          <Trophy size={14} />
          Win Rate
        </div>
        <p className="text-2xl font-serif font-bold text-slate-900 dark:text-slate-100">
          {stats.winRate}%
        </p>
        <p className="text-xs text-slate-400 mt-0.5">
          {stats.won}W / {stats.lost}L
        </p>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-soft p-4">
        <div className="flex items-center gap-2 text-slate-500 text-xs mb-1">
          <Clock size={14} />
          Avg Cycle Time
        </div>
        <p className="text-2xl font-serif font-bold text-slate-900 dark:text-slate-100">
          {stats.avgCycleTime} days
        </p>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-soft p-4">
        <div className="flex items-center gap-2 text-slate-500 text-xs mb-1">
          <TrendingUp size={14} />
          Active Deals
        </div>
        <p className="text-2xl font-serif font-bold text-slate-900 dark:text-slate-100">
          {stats.totalDeals}
        </p>
      </div>
    </div>
  );
}
