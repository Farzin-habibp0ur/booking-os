import { cn } from '@/lib/cn';
import { CheckCircle, X, Clock } from 'lucide-react';

export const PRIORITY_CONFIG: Record<
  string,
  { label: string; borderColor: string; bgColor: string; textColor: string }
> = {
  URGENT_TODAY: {
    label: 'Urgent',
    borderColor: 'border-red-400',
    bgColor: 'bg-red-50',
    textColor: 'text-red-700',
  },
  NEEDS_APPROVAL: {
    label: 'Needs Approval',
    borderColor: 'border-amber-400',
    bgColor: 'bg-amber-50',
    textColor: 'text-amber-700',
  },
  OPPORTUNITY: {
    label: 'Opportunity',
    borderColor: 'border-sage-400',
    bgColor: 'bg-sage-50',
    textColor: 'text-sage-700',
  },
  HYGIENE: {
    label: 'Hygiene',
    borderColor: 'border-slate-400',
    bgColor: 'bg-slate-50',
    textColor: 'text-slate-700',
  },
};

export interface ActionCard {
  id: string;
  title: string;
  description: string;
  priority: 'URGENT_TODAY' | 'NEEDS_APPROVAL' | 'OPPORTUNITY' | 'HYGIENE';
  sourceAgent: string;
  confidence?: number;
  createdAt: string;
}

interface ActionCardComponentProps {
  card: ActionCard;
  isSelected?: boolean;
  isNew?: boolean;
  onApprove: () => void;
  onDismiss: () => void;
  onSnooze: () => void;
  onSelect?: () => void;
  onExpand?: () => void;
}

export function ActionCardComponent({
  card,
  isSelected = false,
  isNew = false,
  onApprove,
  onDismiss,
  onSnooze,
  onSelect,
}: ActionCardComponentProps) {
  const config = PRIORITY_CONFIG[card.priority] || PRIORITY_CONFIG.HYGIENE;

  return (
    <div
      data-testid={`action-card-${card.id}`}
      className={cn(
        'rounded-xl bg-white p-4 shadow-soft border-l-4 transition-all',
        config.borderColor,
        isSelected && 'ring-2 ring-sage-300',
        isNew && 'animate-badge-flash',
      )}
    >
      <div className="flex items-start gap-3">
        {onSelect && (
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onSelect}
            className="rounded text-sage-600 mt-1 flex-shrink-0"
            aria-label={`Select ${card.title}`}
            data-testid="action-checkbox"
          />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <p className="text-sm font-semibold text-slate-900">{card.title}</p>
            {card.confidence != null && (
              <span
                className="text-[10px] bg-lavender-50 text-lavender-700 px-2 py-0.5 rounded-full font-medium flex-shrink-0"
                data-testid="confidence-badge"
              >
                {Math.round(card.confidence * 100)}% confidence
              </span>
            )}
          </div>
          <p className="text-xs text-slate-600 mb-3">{card.description}</p>
          <div className="flex items-center gap-2">
            <button
              onClick={onApprove}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg bg-sage-50 text-sage-700 hover:bg-sage-100 transition-colors"
              data-testid="action-approve"
            >
              <CheckCircle size={12} />
              Approve
            </button>
            <button
              onClick={onDismiss}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg bg-slate-50 text-slate-600 hover:bg-slate-100 transition-colors"
              data-testid="action-dismiss"
            >
              <X size={12} />
              Dismiss
            </button>
            <button
              onClick={onSnooze}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg bg-slate-50 text-slate-500 hover:bg-slate-100 transition-colors"
              data-testid="action-snooze"
            >
              <Clock size={12} />
              Snooze
            </button>
            <span className="text-[10px] text-slate-400 ml-auto">{card.sourceAgent}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
