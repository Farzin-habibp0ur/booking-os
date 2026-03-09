'use client';

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/cn';
import { BOOKING_STATUS_STYLES, ELEVATION } from '@/lib/design-tokens';
import {
  Calendar,
  Clock,
  DollarSign,
  Play,
  Check,
  RefreshCw,
  ExternalLink,
  X,
  Phone,
} from 'lucide-react';

interface BookingPopoverProps {
  booking: any;
  anchorRect: DOMRect | null;
  onClose: () => void;
  onStart?: (booking: any) => void;
  onComplete?: (booking: any) => void;
  onReschedule?: (booking: any) => void;
  onViewDetails?: (booking: any) => void;
}

export function BookingPopover({
  booking,
  anchorRect,
  onClose,
  onStart,
  onComplete,
  onReschedule,
  onViewDetails,
}: BookingPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);

  // Click outside to close
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  // Escape to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  if (!booking || !anchorRect) return null;

  const status = BOOKING_STATUS_STYLES[booking.status] || BOOKING_STATUS_STYLES.PENDING;
  const startTime = booking.startTime
    ? new Date(booking.startTime).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
      })
    : '';
  const endTime = booking.endTime
    ? new Date(booking.endTime).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
      })
    : '';

  // Position: below the anchor, constrained to viewport
  const top = Math.min(anchorRect.bottom + 8, window.innerHeight - 280);
  const left = Math.min(anchorRect.left, window.innerWidth - 320);

  return (
    <div
      ref={popoverRef}
      className={cn(
        'fixed z-50 w-72 bg-white dark:bg-slate-900 p-4 animate-scale-in',
        ELEVATION.dropdown,
      )}
      style={{ top, left }}
      role="dialog"
      aria-label="Booking details"
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-2 right-2 text-slate-400 hover:text-slate-600 transition-colors"
        aria-label="Close"
      >
        <X size={14} />
      </button>

      {/* Client name + phone + status */}
      <div className="mb-3">
        <h4 className="text-sm font-semibold text-slate-900 dark:text-white pr-6">
          {booking.customer?.name || 'Walk-in'}
        </h4>
        {booking.customer?.phone && (
          <div className="flex items-center gap-1 text-[11px] text-slate-400 mt-0.5">
            <Phone size={10} />
            {booking.customer.phone}
          </div>
        )}
        <span
          className={cn(
            'inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full mt-1',
            status.bg,
            status.text,
          )}
        >
          <span className={cn('status-dot', status.dot)} />
          {status.label}
        </span>
      </div>

      {/* Details */}
      <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
        <div className="flex items-center gap-2">
          <Calendar size={12} className="text-slate-400" />
          <span>{booking.service?.name || 'Service'}</span>
        </div>
        <div className="flex items-center gap-2">
          <Clock size={12} className="text-slate-400" />
          <span>
            {startTime} – {endTime}
          </span>
        </div>
        {booking.deposit > 0 && (
          <div className="flex items-center gap-2">
            <DollarSign size={12} className="text-slate-400" />
            <span>${booking.deposit} deposit</span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
        {booking.status === 'CONFIRMED' && onStart && (
          <button
            onClick={() => onStart(booking)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-sage-600 text-white hover:bg-sage-700 transition-colors btn-press"
          >
            <Play size={12} />
            Start
          </button>
        )}
        {booking.status === 'IN_PROGRESS' && onComplete && (
          <button
            onClick={() => onComplete(booking)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-sage-600 text-white hover:bg-sage-700 transition-colors btn-press"
          >
            <Check size={12} />
            Complete
          </button>
        )}
        {onReschedule && (
          <button
            onClick={() => onReschedule(booking)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors btn-press"
          >
            <RefreshCw size={12} />
            Reschedule
          </button>
        )}
        {onViewDetails && (
          <button
            onClick={() => onViewDetails(booking)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-sage-600 dark:text-sage-400 hover:bg-sage-50 dark:hover:bg-sage-900/20 transition-colors btn-press ml-auto"
          >
            <ExternalLink size={12} />
            Details
          </button>
        )}
      </div>
    </div>
  );
}
