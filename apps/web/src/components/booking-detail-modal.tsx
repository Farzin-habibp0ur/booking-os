'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { X, Calendar, Clock, User, MessageSquare, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/cn';

interface BookingDetailModalProps {
  booking: any;
  isOpen: boolean;
  onClose: () => void;
  onUpdated: (booking: any) => void;
  onReschedule: (booking: any) => void;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  PENDING: { label: 'Pending', color: 'text-yellow-700', bg: 'bg-yellow-100' },
  CONFIRMED: { label: 'Confirmed', color: 'text-green-700', bg: 'bg-green-100' },
  IN_PROGRESS: { label: 'In Progress', color: 'text-blue-700', bg: 'bg-blue-100' },
  COMPLETED: { label: 'Completed', color: 'text-gray-700', bg: 'bg-gray-100' },
  CANCELLED: { label: 'Cancelled', color: 'text-red-700', bg: 'bg-red-100' },
  NO_SHOW: { label: 'No Show', color: 'text-orange-700', bg: 'bg-orange-100' },
};

export default function BookingDetailModal({ booking, isOpen, onClose, onUpdated, onReschedule }: BookingDetailModalProps) {
  const [updating, setUpdating] = useState('');
  const [confirmAction, setConfirmAction] = useState<{ action: string; label: string } | null>(null);

  if (!isOpen || !booking) return null;

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
    if (['CANCELLED', 'NO_SHOW'].includes(action)) {
      setConfirmAction({ action, label });
    } else {
      updateStatus(action);
    }
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
    green: 'bg-green-600 hover:bg-green-700 text-white',
    blue: 'bg-blue-600 hover:bg-blue-700 text-white',
    orange: 'bg-orange-500 hover:bg-orange-600 text-white',
    red: 'bg-red-600 hover:bg-red-700 text-white',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-[520px] max-h-[80vh] bg-white rounded-lg shadow-xl flex flex-col">
        {/* Confirm dialog overlay */}
        {confirmAction && (
          <div className="absolute inset-0 z-10 bg-white/95 rounded-lg flex items-center justify-center">
            <div className="text-center p-6">
              <AlertTriangle size={32} className="mx-auto text-orange-500 mb-3" />
              <p className="font-semibold mb-1">
                {confirmAction.action === 'CANCELLED' ? 'Cancel this booking?' : 'Mark as no-show?'}
              </p>
              <p className="text-sm text-gray-500 mb-4">
                {confirmAction.action === 'CANCELLED'
                  ? 'This will cancel the booking and any pending reminders.'
                  : 'This will mark the customer as a no-show for this appointment.'}
              </p>
              <div className="flex gap-2 justify-center">
                <button
                  onClick={() => setConfirmAction(null)}
                  className="px-4 py-2 border rounded-md text-sm hover:bg-gray-50"
                >
                  Go back
                </button>
                <button
                  onClick={() => updateStatus(confirmAction.action)}
                  disabled={!!updating}
                  className={cn('px-4 py-2 rounded-md text-sm text-white', confirmAction.action === 'CANCELLED' ? 'bg-red-600 hover:bg-red-700' : 'bg-orange-500 hover:bg-orange-600')}
                >
                  {updating ? 'Updating...' : confirmAction.label}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold">{booking.customer?.name}</h2>
            <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', statusConfig.bg, statusConfig.color)}>
              {statusConfig.label}
            </span>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4 space-y-4">
          {/* Main info */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-start gap-2">
              <MessageSquare size={16} className="text-gray-400 mt-0.5" />
              <div>
                <p className="text-xs text-gray-500">Service</p>
                <p className="text-sm font-medium">{booking.service?.name}</p>
                <p className="text-xs text-gray-400">{booking.service?.durationMins} min{booking.service?.price > 0 ? ` · $${booking.service.price}` : ''}</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <User size={16} className="text-gray-400 mt-0.5" />
              <div>
                <p className="text-xs text-gray-500">Staff</p>
                <p className="text-sm font-medium">{booking.staff?.name || 'Any'}</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Calendar size={16} className="text-gray-400 mt-0.5" />
              <div>
                <p className="text-xs text-gray-500">Date</p>
                <p className="text-sm font-medium">
                  {new Date(booking.startTime).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Clock size={16} className="text-gray-400 mt-0.5" />
              <div>
                <p className="text-xs text-gray-500">Time</p>
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
            <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Customer</p>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-sm font-semibold">
                {(booking.customer?.name || '?')[0].toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-medium">{booking.customer?.name}</p>
                <p className="text-xs text-gray-500">{booking.customer?.phone}</p>
              </div>
            </div>
          </div>

          {/* Notes */}
          {booking.notes && (
            <div className="border-t pt-3">
              <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Notes</p>
              <p className="text-sm text-gray-700">{booking.notes}</p>
            </div>
          )}

          {/* Timeline */}
          <div className="border-t pt-3">
            <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Timeline</p>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <div className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                Created {new Date(booking.createdAt).toLocaleString()}
              </div>
              {booking.status !== 'PENDING' && booking.status !== 'CONFIRMED' && (
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <div className={cn('w-1.5 h-1.5 rounded-full',
                    booking.status === 'COMPLETED' ? 'bg-green-500' :
                    booking.status === 'CANCELLED' ? 'bg-red-500' :
                    booking.status === 'NO_SHOW' ? 'bg-orange-500' : 'bg-blue-500'
                  )} />
                  {statusConfig.label} · {new Date(booking.updatedAt).toLocaleString()}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="p-4 border-t bg-gray-50 space-y-2">
          {/* Status actions */}
          {getAvailableActions().length > 0 && (
            <div className="flex gap-2">
              {getAvailableActions().map((action) => (
                <button
                  key={action.status}
                  onClick={() => handleAction(action.status, action.label)}
                  disabled={!!updating}
                  className={cn('flex-1 py-2 rounded-md text-sm font-medium', variantClasses[action.variant])}
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
              className="w-full py-2 border rounded-md text-sm hover:bg-gray-100"
            >
              Reschedule
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
