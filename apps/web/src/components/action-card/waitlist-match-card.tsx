'use client';

import { cn } from '@/lib/cn';

interface WaitlistSlot {
  time: string;
  display: string;
  staffName: string;
  staffId: string;
}

interface WaitlistMatchCardProps {
  id: string;
  customerName: string;
  serviceName: string;
  slots: WaitlistSlot[];
  preferredStaff?: string | null;
  status?: string;
  onOfferSlot?: (cardId: string, slot: WaitlistSlot) => void;
  onDismiss?: (cardId: string) => void;
}

export function WaitlistMatchCard({
  id,
  customerName,
  serviceName,
  slots,
  preferredStaff,
  status = 'PENDING',
  onOfferSlot,
  onDismiss,
}: WaitlistMatchCardProps) {
  const isPending = status === 'PENDING';

  return (
    <div
      data-testid={`waitlist-match-card-${id}`}
      className={cn(
        'rounded-xl border p-4 my-2',
        isPending
          ? 'bg-sage-50 border-sage-200'
          : 'bg-slate-50 border-slate-200 opacity-75',
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-sage-100 flex items-center justify-center">
          <span className="text-sage-700 text-sm font-bold" data-testid="waitlist-icon">
            ⚡
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-800">
            Waitlist Match: {customerName}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            {serviceName}
            {preferredStaff ? ` · Preferred: ${preferredStaff}` : ''}
          </p>

          {slots.length > 0 && (
            <div className="mt-2 space-y-1" data-testid="slot-list">
              {slots.map((slot, idx) => (
                <div
                  key={idx}
                  data-testid={`slot-${idx}`}
                  className="flex items-center justify-between bg-white rounded-lg px-3 py-1.5 text-xs border border-slate-100"
                >
                  <span className="text-slate-700">
                    {formatSlotDate(slot.time)} at {slot.display}
                  </span>
                  <span className="text-slate-500">{slot.staffName}</span>
                  {isPending && onOfferSlot && (
                    <button
                      data-testid={`offer-slot-${idx}`}
                      onClick={() => onOfferSlot(id, slot)}
                      className="ml-2 px-2 py-0.5 rounded bg-sage-600 text-white hover:bg-sage-700 transition-colors text-xs"
                    >
                      Offer
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {isPending && onDismiss && (
            <div className="mt-2 flex justify-end">
              <button
                data-testid={`dismiss-${id}`}
                onClick={() => onDismiss(id)}
                className="text-xs px-3 py-1 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                Dismiss
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function formatSlotDate(isoString: string): string {
  try {
    const date = new Date(isoString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return isoString;
  }
}
