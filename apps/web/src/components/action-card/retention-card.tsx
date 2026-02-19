'use client';

import { cn } from '@/lib/cn';

interface RetentionCardProps {
  id: string;
  customerName: string;
  avgDaysBetween: number;
  daysSinceLastBooking: number;
  lastServiceName: string;
  totalBookings: number;
  status?: string;
  onFollowUp?: (cardId: string) => void;
  onDismiss?: (cardId: string) => void;
}

export function RetentionCard({
  id,
  customerName,
  avgDaysBetween,
  daysSinceLastBooking,
  lastServiceName,
  totalBookings,
  status = 'PENDING',
  onFollowUp,
  onDismiss,
}: RetentionCardProps) {
  const isPending = status === 'PENDING';
  const overdueDays = daysSinceLastBooking - avgDaysBetween;

  return (
    <div
      data-testid={`retention-card-${id}`}
      className={cn(
        'rounded-xl border p-4 my-2',
        isPending
          ? 'bg-amber-50 border-amber-200'
          : 'bg-slate-50 border-slate-200 opacity-75',
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
          <span className="text-amber-700 text-sm font-bold" data-testid="retention-icon">
            ↩
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-800">
            {customerName} may be overdue
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            Last visit: {lastServiceName} · {totalBookings} total bookings
          </p>

          <div className="mt-2 flex gap-3" data-testid="cadence-info">
            <div className="bg-white rounded-lg px-3 py-1.5 text-xs border border-slate-100">
              <span className="text-slate-500">Usual cadence:</span>{' '}
              <span className="font-medium text-slate-700">{avgDaysBetween} days</span>
            </div>
            <div className="bg-white rounded-lg px-3 py-1.5 text-xs border border-amber-200">
              <span className="text-amber-600">Overdue by:</span>{' '}
              <span className="font-medium text-amber-700">{overdueDays > 0 ? overdueDays : 0} days</span>
            </div>
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
                  className="text-xs px-3 py-1.5 rounded-lg bg-amber-600 text-white hover:bg-amber-700 transition-colors"
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
