'use client';

import { Clock } from 'lucide-react';
import { ActivityFeed, ActivityEntry } from './activity-feed';

interface RecentChangesPanelProps {
  entries: ActivityEntry[];
  loading?: boolean;
  title?: string;
}

export function RecentChangesPanel({
  entries,
  loading,
  title = 'Recent Changes',
}: RecentChangesPanelProps) {
  return (
    <div
      data-testid="recent-changes-panel"
      className="bg-white dark:bg-slate-900 rounded-2xl shadow-soft p-4"
    >
      <div className="flex items-center gap-2 mb-3">
        <Clock size={14} className="text-slate-400" />
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{title}</h3>
      </div>
      <ActivityFeed entries={entries.slice(0, 10)} loading={loading} />
    </div>
  );
}
