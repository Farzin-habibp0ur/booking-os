'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { X, Calendar, Clock, User, MessageSquare, AlertTriangle, Repeat } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useI18n } from '@/lib/i18n';

interface BookingDetailModalProps {
  booking: any;
  isOpen: boolean;
  onClose: () => void;
  onUpdated: (booking: any) => void;
  onReschedule: (booking: any) => void;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  PENDING: { label: 'Pending', color: 'text-lavender-900', bg: 'bg-lavender-50' },
  CONFIRMED: { label: 'Confirmed', color: 'text-sage-900', bg: 'bg-sage-50' },
  IN_PROGRESS: { label: 'In Progress', color: 'text-amber-700', bg: 'bg-amber-50' },
  COMPLETED: { label: 'Completed', color: 'text-sage-900', bg: 'bg-sage-50' },
  CANCELLED: { label: 'Cancelled', color: 'text-red-700', bg: 'bg-red-50' },
  NO_SHOW: { label: 'No Show', color: 'text-red-700', bg: 'bg-red-50' },
};

export default function BookingDetailModal({ booking, isOpen, onClose, onUpdated, onReschedule }: BookingDetailModalProps) {
  const [updating, setUpdating] = useState('');
  const [confirmAction, setConfirmAction] = useState<{ action: string; label: string } | null>(null);
  const [cancelScope, setCancelScope] = useState<'single' | 'future' | 'all' | null>(null);
  const { t } = useI18n();

  if (!isOpen || !booking) return null;

  const isRecurring = !!(booking.recurringSeriesId || booking.recurringSeries?.id);

  const statusConfig = STATUS_CONFIG[booking.status] || STATUS_CONFIG.PENDING;

  const updateStatus = async (status: string) => {
    setUpdating(status);
    try {
      const updated = await api.patch<any>(`/bookings/${booking.id}/status`, { status });
      onUpdated(updated);
      setConfirmAction(null);
    } catch (e) {
      console.error(e);
    }
    setUpdating('');
  };

  const handleAction = (action: string, label: string) => {
    if (action === 'CANCELLED' && isRecurring) {
      setCancelScope('single');
      return;
    }
    if (['CANCELLED', 'NO_SHOW'].includes(action)) {
      setConfirmAction({ action, label });
    } else {
      updateStatus(action);
    }
  };

  const handleRecurringCancel = async () => {
    if (!cancelScope) return;
    setUpdating('CANCELLED');
    try {
      const seriesId = booking.recurringSeriesId || booking.recurringSeries?.id;
      await api.post(`/bookings/recurring/${seriesId}/cancel`, {
        scope: cancelScope,
        bookingId: booking.id,
      });
      onUpdated(booking);
      setCancelScope(null);
    } catch (e) {
      console.error(e);
    }
    setUpdating('');
  };

  const getAvailableActions = () => {
    const actions: { status: string; label: string; variant: string }[] = [];
    switch (booking.status) {
      case 'PENDING':
        actions.push({ status: 'CONFIRMED', label: 'Confirm', variant: 'green' });
        actions.push({ status: 'CANCELLED', label: 'Cancel', variant: 'red' });
        break;
      case 'CONFIRMED':
        actions.push({ status: 'IN_PROGRESS', label: 'Start Visit', variant: 'blue' });
        actions.push({ status: 'NO_SHOW', label: 'No Show', variant: 'orange' });
        actions.push({ status: 'CANCELLED', label: 'Cancel', variant: 'red' });
        break;
      case 'IN_PROGRESS':
        actions.push({ status: 'COMPLETED', label: 'Complete', variant: 'green' });
        break;
    }
    return actions;
  };

  const variantClasses: Record<string, string> = {
    green: 'bg-sage-600 hover:bg-sage-700 text-white',
    blue: 'bg-sage-600 hover:bg-sage-700 text-white',
    orange: 'bg-orange-500 hover:bg-orange-600 text-white',
    red: 'bg-red-600 hover:bg-red-700 text-white',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-[520px] max-h-[80vh] bg-white rounded-2xl shadow-soft-lg flex flex-col">
        {/* Confirm dialog overlay */}
        {confirmAction && (
          <div className="absolute inset-0 z-10 bg-white/95 rounded-2xl flex items-center justify-center">
            <div className="text-center p-6">
              <AlertTriangle size={32} className="mx-auto text-orange-500 mb-3" />
              <p className="font-semibold mb-1">
                {confirmAction.action === 'CANCELLED' ? 'Cancel this booking?' : 'Mark as no-show?'}
              </p>
              <p className="text-sm text-slate-500 mb-4">
                {confirmAction.action === 'CANCELLED'
                  ? 'This will cancel the booking and any pending reminders.'
                  : 'This will mark the customer as a no-show for this appointment.'}
              </p>
              <div className="flex gap-2 justify-center">
                <button
                  onClick={() => setConfirmAction(null)}
                  className="px-4 py-2 border rounded-xl text-sm hover:bg-slate-50"
                >
                  Go back
                </button>
                <button
                  onClick={() => updateStatus(confirmAction.action)}
                  disabled={!!updating}
                  className={cn('px-4 py-2 rounded-xl text-sm text-white', confirmAction.action === 'CANCELLED' ? 'bg-red-600 hover:bg-red-700' : 'bg-orange-500 hover:bg-orange-600')}
                >
                  {updating ? 'Updating...' : confirmAction.label}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Recurring cancel scope picker */}
        {cancelScope !== null && (
          <div className="absolute inset-0 z-10 bg-white/95 rounded-2xl flex items-center justify-center">
            <div className="text-center p-6 w-full max-w-xs">
              <Repeat size={28} className="mx-auto text-lavender-600 mb-3" />
              <p className="font-semibold mb-3">{t('recurring.cancel_scope_title')}</p>
              <div className="space-y-2 mb-4">
                {(['single', 'future', 'all'] as const).map((scope) => (
                  <button
                    key={scope}
                    onClick={() => setCancelScope(scope)}
                    className={cn(
                      'w-full px-3 py-2 rounded-xl text-sm text-left transition-colors',
                      cancelScope === scope
                        ? 'bg-lavender-50 border-2 border-lavender-300 text-lavender-900'
                        : 'border border-slate-200 hover:bg-slate-50',
                    )}
                  >
                    {scope === 'single' && t('recurring.cancel_this_only')}
                    {scope === 'future' && t('recurring.cancel_this_and_future')}
                    {scope === 'all' && t('recurring.cancel_all')}
                  </button>
                ))}
              </div>
              <div className="flex gap-2 justify-center">
                <button
                  onClick={() => setCancelScope(null)}
                  className="px-4 py-2 border rounded-xl text-sm hover:bg-slate-50"
                >
                  Go back
                </button>
                <button
                  onClick={handleRecurringCancel}
                  disabled={!!updating}
                  className="px-4 py-2 rounded-xl text-sm text-white bg-red-600 hover:bg-red-700"
                >
                  {updating ? 'Cancelling...' : 'Cancel'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-serif font-semibold text-slate-900">{booking.customer?.name}</h2>
            <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', statusConfig.bg, statusConfig.color)}>
              {statusConfig.label}
            </span>
            {isRecurring && (
              <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium bg-lavender-50 text-lavender-900">
                <Repeat size={10} />
                {t('recurring.recurring_badge')}
              </span>
            )}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4 space-y-4">
          {/* Main info */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-start gap-2">
              <MessageSquare size={16} className="text-slate-400 mt-0.5" />
              <div>
                <p className="text-xs text-slate-500">Service</p>
                <p className="text-sm font-medium">{booking.service?.name}</p>
                <p className="text-xs text-slate-400">{booking.service?.durationMins} min{booking.service?.price > 0 ? ` · $${booking.service.price}` : ''}</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <User size={16} className="text-slate-400 mt-0.5" />
              <div>
                <p className="text-xs text-slate-500">Staff</p>
                <p className="text-sm font-medium">{booking.staff?.name || 'Any'}</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Calendar size={16} className="text-slate-400 mt-0.5" />
              <div>
                <p className="text-xs text-slate-500">Date</p>
                <p className="text-sm font-medium">
                  {new Date(booking.startTime).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Clock size={16} className="text-slate-400 mt-0.5" />
              <div>
                <p className="text-xs text-slate-500">Time</p>
                <p className="text-sm font-medium">
                  {new Date(booking.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  {' – '}
                  {new Date(booking.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          </div>

          {/* Customer info */}
          <div className="border-t pt-3">
            <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Customer</p>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-sage-100 flex items-center justify-center text-sage-600 text-sm font-semibold">
                {(booking.customer?.name || '?')[0].toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-medium">{booking.customer?.name}</p>
                <p className="text-xs text-slate-500">{booking.customer?.phone}</p>
              </div>
            </div>
          </div>

          {/* Notes */}
          {booking.notes && (
            <div className="border-t pt-3">
              <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Notes</p>
              <p className="text-sm text-slate-700">{booking.notes}</p>
            </div>
          )}

          {/* Timeline */}
          <div className="border-t pt-3">
            <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Timeline</p>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <div className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                Created {new Date(booking.createdAt).toLocaleString()}
              </div>
              {booking.status !== 'PENDING' && booking.status !== 'CONFIRMED' && (
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <div className={cn('w-1.5 h-1.5 rounded-full',
                    booking.status === 'COMPLETED' ? 'bg-sage-500' :
                    booking.status === 'CANCELLED' ? 'bg-red-500' :
                    booking.status === 'NO_SHOW' ? 'bg-red-400' : 'bg-amber-500'
                  )} />
                  {statusConfig.label} · {new Date(booking.updatedAt).toLocaleString()}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 space-y-2">
          {/* Status actions */}
          {getAvailableActions().length > 0 && (
            <div className="flex gap-2">
              {getAvailableActions().map((action) => (
                <button
                  key={action.status}
                  onClick={() => handleAction(action.status, action.label)}
                  disabled={!!updating}
                  className={cn('flex-1 py-2 rounded-xl text-sm font-medium', variantClasses[action.variant])}
                >
                  {updating === action.status ? 'Updating...' : action.label}
                </button>
              ))}
            </div>
          )}

          {/* Reschedule button (available for PENDING, CONFIRMED) */}
          {['PENDING', 'CONFIRMED'].includes(booking.status) && (
            <button
              onClick={() => onReschedule(booking)}
              className="w-full py-2 border border-slate-200 rounded-xl text-sm hover:bg-slate-100 transition-colors"
            >
              Reschedule
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
