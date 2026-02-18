'use client';

import {
  Calendar,
  MessageSquare,
  Check,
  X,
  Play,
  Settings,
  User,
  Sparkles,
  Bot,
} from 'lucide-react';
import { cn } from '@/lib/cn';

const ACTION_ICONS: Record<string, { icon: typeof Calendar; color: string }> = {
  BOOKING_CREATED: { icon: Calendar, color: 'text-sage-600 bg-sage-50' },
  BOOKING_UPDATED: { icon: Calendar, color: 'text-blue-600 bg-blue-50' },
  BOOKING_CANCELLED: { icon: X, color: 'text-red-600 bg-red-50' },
  BOOKING_STATUS_CHANGED: { icon: Calendar, color: 'text-amber-600 bg-amber-50' },
  CONVERSATION_ASSIGNED: { icon: MessageSquare, color: 'text-sage-600 bg-sage-50' },
  CONVERSATION_STATUS_CHANGED: { icon: MessageSquare, color: 'text-blue-600 bg-blue-50' },
  CARD_APPROVED: { icon: Check, color: 'text-sage-600 bg-sage-50' },
  CARD_DISMISSED: { icon: X, color: 'text-slate-500 bg-slate-50' },
  CARD_EXECUTED: { icon: Play, color: 'text-lavender-600 bg-lavender-50' },
  SETTING_CHANGED: { icon: Settings, color: 'text-slate-600 bg-slate-50' },
};

const ACTOR_ICONS: Record<string, typeof User> = {
  STAFF: User,
  AI: Sparkles,
  SYSTEM: Bot,
  CUSTOMER: User,
};

export interface ActivityEntry {
  id: string;
  actorType: string;
  actorName?: string;
  action: string;
  entityType: string;
  entityId: string;
  description?: string;
  diff?: { before?: any; after?: any };
  createdAt: string;
}

interface ActivityFeedProps {
  entries: ActivityEntry[];
  loading?: boolean;
}

function timeAgo(date: string): string {
  const mins = Math.floor((Date.now() - new Date(date).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function ActivityFeed({ entries, loading }: ActivityFeedProps) {
  if (loading) {
    return (
      <div data-testid="activity-feed-loading" className="space-y-3 animate-pulse">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-12 bg-slate-100 dark:bg-slate-800 rounded-xl" />
        ))}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <p data-testid="activity-feed-empty" className="text-sm text-slate-400 text-center py-6">
        No activity yet
      </p>
    );
  }

  return (
    <div data-testid="activity-feed" className="space-y-1">
      {entries.map((entry) => {
        const actionConfig = ACTION_ICONS[entry.action] || {
          icon: Settings,
          color: 'text-slate-500 bg-slate-50',
        };
        const ActionIcon = actionConfig.icon;
        const ActorIcon = ACTOR_ICONS[entry.actorType] || User;

        return (
          <div
            key={entry.id}
            data-testid={`activity-${entry.id}`}
            className="flex items-start gap-3 py-2 px-1"
          >
            <div className={cn('p-1.5 rounded-lg mt-0.5', actionConfig.color)}>
              <ActionIcon size={12} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-slate-700 dark:text-slate-300">
                {entry.description || entry.action}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="flex items-center gap-1 text-[10px] text-slate-400">
                  <ActorIcon size={10} />
                  {entry.actorName || entry.actorType}
                </span>
                <span className="text-[10px] text-slate-300">·</span>
                <span className="text-[10px] text-slate-400">{timeAgo(entry.createdAt)}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
