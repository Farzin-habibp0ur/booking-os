'use client';

import { CalendarCheck, X, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { api } from '@/lib/api';
import { useToast } from '@/lib/toast';
import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/cn';

interface BookingStateData {
  state: string;
  serviceId?: string;
  serviceName?: string;
  date?: string;
  time?: string;
  staffId?: string;
  staffName?: string;
  slotIso?: string;
  suggestedResponse?: string;
  availableOptions?: string[];
}

interface AiBookingPanelProps {
  conversationId: string;
  bookingState: BookingStateData;
  onBookingConfirmed: () => void;
  onCancelled: () => void;
}

const STATE_STEPS: Record<string, number> = {
  IDENTIFY_SERVICE: 1,
  IDENTIFY_DATE: 2,
  IDENTIFY_TIME: 3,
  CONFIRM: 4,
};

export default function AiBookingPanel({ conversationId, bookingState, onBookingConfirmed, onCancelled }: AiBookingPanelProps) {
  const { t } = useI18n();
  const { toast } = useToast();
  const [confirming, setConfirming] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const currentStep = STATE_STEPS[bookingState.state] || 1;

  const confirmBooking = async () => {
    setConfirming(true);
    try {
      await api.post(`/ai/conversations/${conversationId}/booking-confirm`);
      toast(t('ai.booking_confirmed'));
      onBookingConfirmed();
    } catch (e: any) {
      toast(t('ai.booking_confirm_failed'), 'error');
    }
    setConfirming(false);
  };

  const cancelBooking = async () => {
    setCancelling(true);
    try {
      await api.post(`/ai/conversations/${conversationId}/booking-cancel`);
      onCancelled();
    } catch (e: any) {
      console.error(e);
    }
    setCancelling(false);
  };

  return (
    <div className="p-4 border-b">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <CalendarCheck size={14} className="text-purple-600" />
          <span className="text-xs font-semibold text-purple-700 uppercase">{t('ai.booking_assistant')}</span>
        </div>
        <button onClick={cancelBooking} disabled={cancelling} className="text-gray-400 hover:text-red-500">
          {cancelling ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />}
        </button>
      </div>

      {/* Progress steps */}
      <div className="flex gap-1 mb-3">
        {[1, 2, 3, 4].map((step) => (
          <div
            key={step}
            className={cn(
              'h-1 flex-1 rounded-full',
              step <= currentStep ? 'bg-purple-500' : 'bg-gray-200',
            )}
          />
        ))}
      </div>

      {/* Extracted info */}
      <div className="space-y-1.5 text-xs">
        {bookingState.serviceName && (
          <div className="flex justify-between">
            <span className="text-gray-500">{t('ai.booking_service')}</span>
            <span className="font-medium">{bookingState.serviceName}</span>
          </div>
        )}
        {bookingState.date && (
          <div className="flex justify-between">
            <span className="text-gray-500">{t('ai.booking_date')}</span>
            <span className="font-medium">{bookingState.date}</span>
          </div>
        )}
        {bookingState.time && (
          <div className="flex justify-between">
            <span className="text-gray-500">{t('ai.booking_time')}</span>
            <span className="font-medium">{bookingState.time}</span>
          </div>
        )}
        {bookingState.staffName && (
          <div className="flex justify-between">
            <span className="text-gray-500">{t('ai.booking_staff')}</span>
            <span className="font-medium">{bookingState.staffName}</span>
          </div>
        )}
      </div>

      {/* Current step label */}
      <p className="text-[10px] text-purple-500 mt-2">
        {t(`ai.booking_step_${bookingState.state.toLowerCase()}`)}
      </p>

      {/* Confirm button (only in CONFIRM state) */}
      {bookingState.state === 'CONFIRM' && (
        <button
          onClick={confirmBooking}
          disabled={confirming}
          className="mt-3 w-full bg-purple-600 text-white py-2 rounded-md text-sm hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-1.5"
        >
          {confirming ? <Loader2 size={14} className="animate-spin" /> : <CalendarCheck size={14} />}
          {t('ai.confirm_booking')}
        </button>
      )}
    </div>
  );
}
