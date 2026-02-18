'use client';

import { useState } from 'react';
import {
  Sparkles,
  Check,
  X,
  Clock,
  Play,
  Eye,
  AlertTriangle,
  DollarSign,
  MessageSquare,
  Calendar,
  Users,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/cn';

const CATEGORY_STYLES: Record<
  string,
  { bg: string; border: string; badge: string; label: string }
> = {
  URGENT_TODAY: {
    bg: 'bg-red-50 dark:bg-red-950/30',
    border: 'border-red-100 dark:border-red-900/30',
    badge: 'bg-red-100 text-red-700',
    label: 'Urgent',
  },
  NEEDS_APPROVAL: {
    bg: 'bg-lavender-50 dark:bg-lavender-950/30',
    border: 'border-lavender-100 dark:border-lavender-900/30',
    badge: 'bg-lavender-100 text-lavender-700',
    label: 'Needs Approval',
  },
  OPPORTUNITY: {
    bg: 'bg-sage-50 dark:bg-sage-950/30',
    border: 'border-sage-100 dark:border-sage-900/30',
    badge: 'bg-sage-100 text-sage-700',
    label: 'Opportunity',
  },
  HYGIENE: {
    bg: 'bg-slate-50 dark:bg-slate-900/50',
    border: 'border-slate-100 dark:border-slate-800',
    badge: 'bg-slate-100 text-slate-600',
    label: 'Hygiene',
  },
};

const TYPE_ICONS: Record<string, typeof DollarSign> = {
  DEPOSIT_PENDING: DollarSign,
  OVERDUE_REPLY: MessageSquare,
  OPEN_SLOT: Calendar,
  STALLED_QUOTE: Clock,
  NO_SHOW_RISK: AlertTriangle,
  RETENTION_DUE: Users,
  WAITLIST_MATCH: Zap,
  SCHEDULE_GAP: Calendar,
};

export interface ActionCardData {
  id: string;
  type: string;
  category: string;
  priority: number;
  title: string;
  description: string;
  suggestedAction?: string;
  preview?: any;
  ctaConfig?: any[];
  status: string;
  autonomyLevel: string;
  customer?: { id: string; name: string } | null;
  booking?: { id: string; startTime: string } | null;
  staff?: { id: string; name: string } | null;
  createdAt: string;
}

interface ActionCardProps {
  card: ActionCardData;
  onApprove?: (id: string) => void;
  onDismiss?: (id: string) => void;
  onSnooze?: (id: string) => void;
  onExecute?: (id: string) => void;
  onPreview?: (card: ActionCardData) => void;
  compact?: boolean;
}

export function ActionCard({
  card,
  onApprove,
  onDismiss,
  onSnooze,
  onExecute,
  onPreview,
  compact = false,
}: ActionCardProps) {
  const style = CATEGORY_STYLES[card.category] || CATEGORY_STYLES.HYGIENE;
  const Icon = TYPE_ICONS[card.type] || Sparkles;
  const isPending = card.status === 'PENDING';

  return (
    <div
      data-testid={`action-card-${card.id}`}
      className={cn(
        'rounded-2xl border p-4 transition-all',
        style.bg,
        style.border,
        isPending && 'hover:shadow-soft',
      )}
    >
      <div className="flex items-start gap-3">
        <div className={cn('p-2 rounded-xl', style.badge)}>
          <Icon size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-medium', style.badge)}>
              {style.label}
            </span>
            {card.autonomyLevel === 'AUTO' && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-lavender-100 text-lavender-700 font-medium">
                Auto
              </span>
            )}
          </div>
          <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
            {card.title}
          </h3>
          {!compact && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
              {card.description}
            </p>
          )}
          {card.customer && <p className="text-xs text-slate-400 mt-1">{card.customer.name}</p>}
        </div>
      </div>

      {isPending && (
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          {card.preview && onPreview && (
            <button
              onClick={() => onPreview(card)}
              className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 transition-colors"
              data-testid={`preview-${card.id}`}
            >
              <Eye size={12} /> Preview
            </button>
          )}
          <div className="flex-1" />
          {onSnooze && (
            <button
              onClick={() => onSnooze(card.id)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              title="Snooze"
              data-testid={`snooze-${card.id}`}
            >
              <Clock size={14} />
            </button>
          )}
          {onDismiss && (
            <button
              onClick={() => onDismiss(card.id)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
              title="Dismiss"
              data-testid={`dismiss-${card.id}`}
            >
              <X size={14} />
            </button>
          )}
          {onApprove && (
            <button
              onClick={() => onApprove(card.id)}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-xl bg-sage-600 text-white hover:bg-sage-700 transition-colors"
              data-testid={`approve-${card.id}`}
            >
              <Check size={12} /> Approve
            </button>
          )}
          {onExecute && (
            <button
              onClick={() => onExecute(card.id)}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-xl bg-lavender-600 text-white hover:bg-lavender-700 transition-colors"
              data-testid={`execute-${card.id}`}
            >
              <Play size={12} /> Execute
            </button>
          )}
        </div>
      )}
    </div>
  );
}
