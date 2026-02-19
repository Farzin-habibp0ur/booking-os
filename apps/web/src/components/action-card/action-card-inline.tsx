'use client';

import { cn } from '@/lib/cn';

export interface InlineActionCardData {
  id: string;
  type: string;
  title: string;
  description: string;
  suggestedAction?: string | null;
  status: string;
}

interface ActionCardInlineProps {
  card: InlineActionCardData;
  onApprove?: (id: string) => void;
  onDismiss?: (id: string) => void;
}

const typeLabels: Record<string, string> = {
  BOOKING_CONFIRM: 'Booking',
  BOOKING_CANCEL: 'Cancellation',
  BOOKING_RESCHEDULE: 'Reschedule',
  LOW_CONFIDENCE: 'Review',
  HUMAN_TAKEOVER: 'Takeover',
};

export function ActionCardInline({ card, onApprove, onDismiss }: ActionCardInlineProps) {
  const isPending = card.status === 'PENDING';
  const label = typeLabels[card.type] || card.type;

  return (
    <div
      data-testid={`inline-card-${card.id}`}
      className={cn(
        'rounded-xl border p-3 my-2',
        isPending
          ? 'border-lavender-200 bg-lavender-50'
          : 'border-slate-200 bg-slate-50 opacity-75',
      )}
    >
      <div className="flex items-center gap-2 mb-1">
        <span
          data-testid={`inline-card-badge-${card.id}`}
          className="text-xs font-medium px-2 py-0.5 rounded-full bg-lavender-100 text-lavender-800"
        >
          {label}
        </span>
        {!isPending && <span className="text-xs text-slate-500">{card.status.toLowerCase()}</span>}
      </div>

      <p className="text-sm font-medium text-slate-800">{card.title}</p>
      <p className="text-xs text-slate-600 mt-0.5">{card.description}</p>

      {card.suggestedAction && isPending && (
        <p className="text-xs text-lavender-700 mt-1 italic">{card.suggestedAction}</p>
      )}

      {isPending && (onApprove || onDismiss) && (
        <div className="flex gap-2 mt-2" data-testid={`inline-card-actions-${card.id}`}>
          {onApprove && (
            <button
              data-testid={`inline-approve-${card.id}`}
              onClick={() => onApprove(card.id)}
              className="text-xs px-3 py-1 rounded-lg bg-sage-600 text-white hover:bg-sage-700 transition-colors"
            >
              Approve
            </button>
          )}
          {onDismiss && (
            <button
              data-testid={`inline-dismiss-${card.id}`}
              onClick={() => onDismiss(card.id)}
              className="text-xs px-3 py-1 rounded-lg bg-slate-200 text-slate-700 hover:bg-slate-300 transition-colors"
            >
              Dismiss
            </button>
          )}
        </div>
      )}
    </div>
  );
}
