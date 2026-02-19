'use client';

import {
  DollarSign,
  MessageSquare,
  Calendar,
  Clock,
  AlertTriangle,
  Users,
  Zap,
  Sparkles,
  Check,
  X,
  Eye,
} from 'lucide-react';
import { cn } from '@/lib/cn';

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

export interface BriefingCardData {
  id: string;
  type: string;
  category: string;
  priority: number;
  title: string;
  description: string;
  suggestedAction?: string | null;
  ctaConfig?: any[];
  status: string;
  autonomyLevel?: string;
  customer?: { id: string; name: string } | null;
  booking?: { id: string; startTime: string; service?: { name: string } | null } | null;
  staff?: { id: string; name: string } | null;
  conversationId?: string | null;
  createdAt: string;
  expiresAt?: string | null;
  preview?: any;
}

interface BriefingCardProps {
  card: BriefingCardData;
  onApprove?: (id: string) => void;
  onDismiss?: (id: string) => void;
  onView?: (card: BriefingCardData) => void;
}

export function BriefingCard({ card, onApprove, onDismiss, onView }: BriefingCardProps) {
  const Icon = TYPE_ICONS[card.type] || Sparkles;
  const isPending = card.status === 'PENDING';
  const timeAgo = getTimeAgo(card.createdAt);

  return (
    <div
      data-testid={`briefing-card-${card.id}`}
      className={cn(
        'group rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800',
        'p-4 transition-all hover:shadow-soft cursor-pointer',
      )}
      onClick={() => onView?.(card)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onView?.(card)}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'p-2 rounded-xl shrink-0',
            card.category === 'URGENT_TODAY'
              ? 'bg-red-100 text-red-700'
              : card.category === 'OPPORTUNITY'
                ? 'bg-sage-100 text-sage-700'
                : 'bg-lavender-100 text-lavender-700',
          )}
        >
          <Icon size={16} />
        </div>

        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
            {card.title}
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">
            {card.description}
          </p>
          {card.suggestedAction && (
            <p className="text-xs text-lavender-600 dark:text-lavender-400 mt-1 flex items-center gap-1">
              <Sparkles size={10} />
              {card.suggestedAction}
            </p>
          )}
          <div className="flex items-center gap-2 mt-2">
            {card.customer && (
              <span className="text-[10px] text-slate-400">{card.customer.name}</span>
            )}
            <span className="text-[10px] text-slate-300">{timeAgo}</span>
          </div>
        </div>
      </div>

      {isPending && (onApprove || onDismiss) && (
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-50 dark:border-slate-800">
          <div className="flex-1" />
          {onDismiss && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDismiss(card.id);
              }}
              className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
              data-testid={`briefing-dismiss-${card.id}`}
              title="Dismiss"
            >
              <X size={14} />
            </button>
          )}
          {card.preview && onView && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onView(card);
              }}
              className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 transition-colors"
              data-testid={`briefing-preview-${card.id}`}
            >
              <Eye size={12} /> Preview
            </button>
          )}
          {onApprove && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onApprove(card.id);
              }}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-xl bg-sage-600 text-white hover:bg-sage-700 transition-colors"
              data-testid={`briefing-approve-${card.id}`}
            >
              <Check size={12} /> Approve
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function getTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
