'use client';

import { cn } from '@/lib/cn';

interface QuoteFollowupCardProps {
  id: string;
  customerName: string;
  serviceName: string;
  totalAmount: number;
  daysSinceCreated: number;
  status?: string;
  onFollowUp?: (cardId: string) => void;
  onDismiss?: (cardId: string) => void;
}

export function QuoteFollowupCard({
  id,
  customerName,
  serviceName,
  totalAmount,
  daysSinceCreated,
  status = 'PENDING',
  onFollowUp,
  onDismiss,
}: QuoteFollowupCardProps) {
  const isPending = status === 'PENDING';

  return (
    <div
      data-testid={`quote-followup-card-${id}`}
      className={cn(
        'rounded-xl border p-4 my-2',
        isPending
          ? 'bg-lavender-50 border-lavender-200'
          : 'bg-slate-50 border-slate-200 opacity-75',
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-lavender-100 flex items-center justify-center">
          <span className="text-lavender-700 text-sm font-bold" data-testid="quote-icon">
            $
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-800">
            Quote pending: {customerName}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            {serviceName} · ${totalAmount.toFixed(2)}
          </p>

          <div className="mt-2 bg-white rounded-lg px-3 py-1.5 text-xs border border-slate-100 inline-block">
            <span className="text-lavender-600">Waiting:</span>{' '}
            <span className="font-medium text-slate-700">{daysSinceCreated} days</span>
          </div>

          {isPending && (onFollowUp || onDismiss) && (
            <div className="mt-2 flex justify-end gap-2">
              {onDismiss && (
                <button
                  data-testid={`dismiss-${id}`}
                  onClick={() => onDismiss(id)}
                  className="text-xs px-3 py-1 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  Dismiss
                </button>
              )}
              {onFollowUp && (
                <button
                  data-testid={`followup-${id}`}
                  onClick={() => onFollowUp(id)}
                  className="text-xs px-3 py-1.5 rounded-lg bg-lavender-600 text-white hover:bg-lavender-700 transition-colors"
                >
                  Send Follow-up
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
