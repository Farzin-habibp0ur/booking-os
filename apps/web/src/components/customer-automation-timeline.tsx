'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Zap, Bot } from 'lucide-react';
import { cn } from '@/lib/cn';
import { getActionLabel } from '@/lib/automation-labels';

interface TimelineEvent {
  id: string;
  source: 'rule' | 'agent';
  title: string;
  action: string;
  outcome: string;
  trigger?: string;
  createdAt: string;
}

function outcomeColor(outcome: string) {
  switch (outcome) {
    case 'SENT':
      return 'bg-sage-50 text-sage-700';
    case 'SKIPPED':
      return 'bg-amber-50 text-amber-700';
    case 'FAILED':
      return 'bg-red-50 text-red-700';
    default:
      return 'bg-slate-100 text-slate-500';
  }
}

function formatTimeAgo(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

interface CustomerAutomationTimelineProps {
  customerId: string;
}

export function CustomerAutomationTimeline({ customerId }: CustomerAutomationTimelineProps) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<TimelineEvent[]>(`/automations/customer/${customerId}/timeline`)
      .then(setEvents)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [customerId]);

  if (loading) {
    return (
      <div className="space-y-3" data-testid="timeline-loading">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-start gap-3 animate-pulse">
            <div className="w-8 h-8 rounded-full bg-slate-200" />
            <div className="flex-1">
              <div className="h-3 bg-slate-200 rounded w-1/3 mb-2" />
              <div className="h-2 bg-slate-100 rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <p className="text-sm text-slate-400" data-testid="timeline-empty">
        No automation actions for this customer yet.
      </p>
    );
  }

  return (
    <div className="space-y-3" data-testid="automation-timeline">
      {events.map((event) => (
        <div key={event.id} className="flex items-start gap-3">
          <div
            className={cn(
              'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
              event.source === 'rule' ? 'bg-sage-50' : 'bg-lavender-50',
            )}
          >
            {event.source === 'rule' ? (
              <Zap size={14} className="text-sage-600" />
            ) : (
              <Bot size={14} className="text-lavender-600" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-800 truncate">{event.title}</p>
            <p className="text-xs text-slate-500">{getActionLabel(event.action)}</p>
            <p className="text-xs text-slate-400 mt-0.5">{formatTimeAgo(event.createdAt)}</p>
          </div>
          <span
            className={cn(
              'text-xs px-2 py-0.5 rounded-full flex-shrink-0',
              outcomeColor(event.outcome),
            )}
          >
            {event.outcome}
          </span>
        </div>
      ))}
    </div>
  );
}
