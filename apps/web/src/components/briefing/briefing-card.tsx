'use client';

import { useState } from 'react';
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
  ChevronDown,
  ChevronUp,
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

const CATEGORY_BORDER: Record<string, string> = {
  URGENT_TODAY: 'border-l-red-400',
  NEEDS_APPROVAL: 'border-l-lavender-400',
  OPPORTUNITY: 'border-l-sage-400',
  HYGIENE: 'border-l-slate-300',
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
  onSnooze?: (id: string, until: string) => void;
  onView?: (card: BriefingCardData) => void;
}

const ACTION_LABELS: Record<string, string> = {
  DEPOSIT_PENDING: 'Send Reminder',
  OVERDUE_REPLY: 'Nudge Staff',
  OPEN_SLOT: 'Notify Waitlist',
  STALLED_QUOTE: 'Follow Up',
  NO_SHOW_RISK: 'Send Reminder',
  RETENTION_DUE: 'Send Outreach',
  WAITLIST_MATCH: 'Offer Slot',
  SCHEDULE_GAP: 'Optimize',
};

const SNOOZE_OPTIONS = [
  { label: '1 hour', hours: 1 },
  { label: '4 hours', hours: 4 },
  { label: 'Tomorrow', hours: 24 },
  { label: 'Next week', hours: 168 },
];

export function BriefingCard({ card, onApprove, onDismiss, onSnooze, onView }: BriefingCardProps) {
  const Icon = TYPE_ICONS[card.type] || Sparkles;
  const isPending = card.status === 'PENDING';
  const timeAgo = getTimeAgo(card.createdAt);
  const actionLabel = ACTION_LABELS[card.type] || 'Approve';
  const [expanded, setExpanded] = useState(false);
  const [showSnooze, setShowSnooze] = useState(false);

  const handleSnooze = (hours: number) => {
    const until = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
    onSnooze?.(card.id, until);
    setShowSnooze(false);
  };

  return (
    <div
      data-testid={`briefing-card-${card.id}`}
      className={cn(
        'group rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800',
        'border-l-4 p-4 transition-all hover:shadow-soft cursor-pointer',
        CATEGORY_BORDER[card.category] || 'border-l-slate-200',
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

        {/* Expand/collapse toggle */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setExpanded(!expanded);
          }}
          className="p-1 rounded-lg text-slate-300 hover:text-slate-500 transition-colors shrink-0"
          data-testid={`briefing-expand-${card.id}`}
        >
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      {/* Expandable detail section */}
      {expanded && (
        <div
          className="mt-3 pt-3 border-t border-slate-50 dark:border-slate-800 space-y-2"
          data-testid={`briefing-details-${card.id}`}
        >
          {card.description && (
            <p className="text-xs text-slate-600 dark:text-slate-300">{card.description}</p>
          )}
          {card.booking && (
            <div className="text-xs text-slate-500">
              <span className="font-medium">Booking:</span>{' '}
              {card.booking.service?.name || 'Service'} at{' '}
              {new Date(card.booking.startTime).toLocaleString([], {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </div>
          )}
          {card.staff && (
            <div className="text-xs text-slate-500">
              <span className="font-medium">Staff:</span> {card.staff.name}
            </div>
          )}
          {card.suggestedAction && (
            <div className="bg-lavender-50 dark:bg-lavender-950/30 rounded-xl p-2.5">
              <p className="text-xs text-lavender-700 dark:text-lavender-300 flex items-center gap-1">
                <Sparkles size={10} />
                <span className="font-medium">Suggested:</span> {card.suggestedAction}
              </p>
            </div>
          )}
        </div>
      )}

      {isPending && (onApprove || onDismiss || onSnooze) && (
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
          {onSnooze && (
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowSnooze(!showSnooze);
                }}
                className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 px-2 py-1 rounded-lg hover:bg-slate-50 transition-colors"
                data-testid={`briefing-snooze-${card.id}`}
              >
                <Clock size={12} /> Snooze
              </button>
              {showSnooze && (
                <div
                  className="absolute bottom-full right-0 mb-1 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-100 dark:border-slate-700 py-1 z-30 min-w-[120px]"
                  data-testid={`snooze-menu-${card.id}`}
                >
                  {SNOOZE_OPTIONS.map((opt) => (
                    <button
                      key={opt.label}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSnooze(opt.hours);
                      }}
                      className="w-full text-left px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700 transition-colors"
                      data-testid={`snooze-option-${opt.hours}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
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
              <Check size={12} /> {actionLabel}
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
