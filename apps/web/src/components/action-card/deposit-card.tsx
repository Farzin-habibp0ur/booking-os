'use client';

import { cn } from '@/lib/cn';

interface DepositCardProps {
  id: string;
  customerName: string;
  serviceName: string;
  depositAmount: number;
  bookingDate?: string;
  status: string;
  onSendReminder?: (id: string) => void;
  onDismiss?: (id: string) => void;
}

export function DepositCard({
  id,
  customerName,
  serviceName,
  depositAmount,
  bookingDate,
  status,
  onSendReminder,
  onDismiss,
}: DepositCardProps) {
  const isPending = status === 'PENDING';

  return (
    <div
      data-testid={`deposit-card-${id}`}
      className={cn(
        'rounded-xl border p-4',
        isPending ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-slate-50 opacity-75',
      )}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="text-amber-600 text-lg">$</span>
        <span className="text-sm font-semibold text-slate-800">Deposit Required</span>
        {!isPending && (
          <span className="text-xs text-slate-500 ml-auto">{status.toLowerCase()}</span>
        )}
      </div>

      <p className="text-sm text-slate-700">
        <span className="font-medium">{customerName}</span> owes{' '}
        <span data-testid={`deposit-amount-${id}`} className="font-semibold text-amber-700">
          ${depositAmount.toFixed(2)}
        </span>{' '}
        for {serviceName}
      </p>

      {bookingDate && <p className="text-xs text-slate-500 mt-1">Appointment: {bookingDate}</p>}

      {isPending && (onSendReminder || onDismiss) && (
        <div className="flex gap-2 mt-3" data-testid={`deposit-actions-${id}`}>
          {onSendReminder && (
            <button
              data-testid={`deposit-send-${id}`}
              onClick={() => onSendReminder(id)}
              className="text-xs px-3 py-1.5 rounded-lg bg-amber-600 text-white hover:bg-amber-700 transition-colors"
            >
              Send Reminder
            </button>
          )}
          {onDismiss && (
            <button
              data-testid={`deposit-dismiss-${id}`}
              onClick={() => onDismiss(id)}
              className="text-xs px-3 py-1.5 rounded-lg bg-slate-200 text-slate-700 hover:bg-slate-300 transition-colors"
            >
              Dismiss
            </button>
          )}
        </div>
      )}
    </div>
  );
}
