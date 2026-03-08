'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { useI18n } from '@/lib/i18n';
import { Activity } from 'lucide-react';

interface ActivityEntry {
  id: string;
  timestamp: string;
  agentName: string;
  description: string;
  outcome: 'success' | 'failed' | 'pending';
}

export function AIActivityFeed() {
  const { t } = useI18n();
  const [activities, setActivities] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchActivities = async () => {
      try {
        setLoading(true);
        const data = await api.get<ActivityEntry[]>('/ai/activity?limit=50');
        setActivities(data || []);
      } catch (err) {
        console.error('Failed to fetch activities:', err);
        // Mock data on failure
        const now = new Date();
        const mockActivities: ActivityEntry[] = [
          {
            id: '1',
            timestamp: new Date(now.getTime() - 5 * 60000).toISOString(),
            agentName: 'Booking Agent',
            description: 'Created booking for John Doe',
            outcome: 'success',
          },
          {
            id: '2',
            timestamp: new Date(now.getTime() - 15 * 60000).toISOString(),
            agentName: 'Follow-up Agent',
            description: 'Sent reminder to customer',
            outcome: 'success',
          },
          {
            id: '3',
            timestamp: new Date(now.getTime() - 25 * 60000).toISOString(),
            agentName: 'Review Agent',
            description: 'Processing review submission',
            outcome: 'pending',
          },
          {
            id: '4',
            timestamp: new Date(now.getTime() - 35 * 60000).toISOString(),
            agentName: 'Waitlist Agent',
            description: 'Failed to process waitlist entry',
            outcome: 'failed',
          },
        ];
        setActivities(mockActivities);
      } finally {
        setLoading(false);
      }
    };

    fetchActivities();
  }, []);

  const getOutcomeColor = (outcome: string) => {
    switch (outcome) {
      case 'success':
        return 'bg-green-500';
      case 'failed':
        return 'bg-red-500';
      case 'pending':
        return 'bg-amber-500';
      default:
        return 'bg-slate-400';
    }
  };

  const getOutcomeLabel = (outcome: string) => {
    switch (outcome) {
      case 'success':
        return 'Success';
      case 'failed':
        return 'Failed';
      case 'pending':
        return 'Pending';
      default:
        return 'Unknown';
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
      if (diffMinutes < 10080) return `${Math.floor(diffMinutes / 1440)}d ago`;

      // Format as date
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {
      return 'Unknown';
    }
  };

  if (loading) {
    return (
      <div className="rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-soft">
        <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-1/4 mb-6"></div>
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex gap-4 animate-pulse">
              <div className="h-3 w-3 bg-slate-200 dark:bg-slate-700 rounded-full flex-shrink-0 mt-2"></div>
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

  if (activities.length === 0) {
    return (
      <div className="rounded-2xl bg-white dark:bg-slate-900 p-12 shadow-soft text-center">
        <div className="flex justify-center mb-4">
          <Activity className="text-slate-400" size={48} />
        </div>
        <h3 className="font-serif text-lg text-slate-900 dark:text-white mb-2">No Activity Yet</h3>
        <p className="text-slate-600 dark:text-slate-400">
          AI agents will show their activity here once they start running.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-soft">
      <h2 className="font-serif text-lg font-semibold text-slate-900 dark:text-white mb-6">
        Recent Activity
      </h2>

      <div className="max-h-96 overflow-y-auto space-y-4">
        {activities.map((activity) => (
          <div
            key={activity.id}
            className="flex gap-4 pb-4 border-b border-slate-100 dark:border-slate-800 last:border-0 last:pb-0"
          >
            {/* Status dot */}
            <div className="flex-shrink-0 mt-1">
              <span className={cn('status-dot', getOutcomeColor(activity.outcome))}></span>
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2 mb-1">
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  {activity.agentName}
                </p>
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400 flex-shrink-0">
                  {formatTimestamp(activity.timestamp)}
                </span>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-300 mb-1">
                {activity.description}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {getOutcomeLabel(activity.outcome)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
