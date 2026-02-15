'use client';

import { CalendarCheck, CalendarX, CalendarClock, X, Loader2 } from 'lucide-react';
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

interface CancelStateData {
  state: string;
  bookingId?: string;
  serviceName?: string;
  date?: string;
  time?: string;
  staffName?: string;
  suggestedResponse?: string;
}

interface RescheduleStateData {
  state: string;
  bookingId?: string;
  serviceName?: string;
  serviceId?: string;
  originalDate?: string;
  originalTime?: string;
  newDate?: string;
  newTime?: string;
  newSlotIso?: string;
  staffName?: string;
  suggestedResponse?: string;
  availableOptions?: string[];
}

type PanelMode = 'book' | 'cancel' | 'reschedule';

interface AiBookingPanelProps {
  conversationId: string;
  mode: PanelMode;
  bookingState?: BookingStateData;
  cancelState?: CancelStateData;
  rescheduleState?: RescheduleStateData;
  onConfirmed: () => void;
  onDismissed: () => void;
}

const BOOK_STEPS: Record<string, number> = {
  IDENTIFY_SERVICE: 1,
  IDENTIFY_DATE: 2,
  IDENTIFY_TIME: 3,
  CONFIRM: 4,
};

const CANCEL_STEPS: Record<string, number> = {
  IDENTIFY_BOOKING: 1,
  CONFIRM_CANCEL: 2,
};

const RESCHEDULE_STEPS: Record<string, number> = {
  IDENTIFY_BOOKING: 1,
  IDENTIFY_NEW_DATE: 2,
  IDENTIFY_NEW_TIME: 3,
  CONFIRM_RESCHEDULE: 4,
};

const MODE_CONFIG: Record<PanelMode, {
  icon: typeof CalendarCheck;
  titleKey: string;
  colorClass: string;
  stepCount: number;
  stateSteps: Record<string, number>;
  confirmState: string;
  confirmEndpoint: string;
  dismissEndpoint: string;
  confirmLabelKey: string;
  confirmSuccessKey: string;
  confirmFailKey: string;
}> = {
  book: {
    icon: CalendarCheck,
    titleKey: 'ai.booking_assistant',
    colorClass: 'text-lavender-600',
    stepCount: 4,
    stateSteps: BOOK_STEPS,
    confirmState: 'CONFIRM',
    confirmEndpoint: 'booking-confirm',
    dismissEndpoint: 'booking-cancel',
    confirmLabelKey: 'ai.confirm_booking',
    confirmSuccessKey: 'ai.booking_confirmed',
    confirmFailKey: 'ai.booking_confirm_failed',
  },
  cancel: {
    icon: CalendarX,
    titleKey: 'ai.cancel_assistant',
    colorClass: 'text-red-600',
    stepCount: 2,
    stateSteps: CANCEL_STEPS,
    confirmState: 'CONFIRM_CANCEL',
    confirmEndpoint: 'cancel-confirm',
    dismissEndpoint: 'cancel-dismiss',
    confirmLabelKey: 'ai.confirm_cancel',
    confirmSuccessKey: 'ai.cancel_confirmed',
    confirmFailKey: 'ai.cancel_confirm_failed',
  },
  reschedule: {
    icon: CalendarClock,
    titleKey: 'ai.reschedule_assistant',
    colorClass: 'text-orange-600',
    stepCount: 4,
    stateSteps: RESCHEDULE_STEPS,
    confirmState: 'CONFIRM_RESCHEDULE',
    confirmEndpoint: 'reschedule-confirm',
    dismissEndpoint: 'reschedule-dismiss',
    confirmLabelKey: 'ai.confirm_reschedule',
    confirmSuccessKey: 'ai.reschedule_confirmed',
    confirmFailKey: 'ai.reschedule_confirm_failed',
  },
};

export default function AiBookingPanel({
  conversationId, mode, bookingState, cancelState, rescheduleState, onConfirmed, onDismissed,
}: AiBookingPanelProps) {
  const { t } = useI18n();
  const { toast } = useToast();
  const [confirming, setConfirming] = useState(false);
  const [dismissing, setDismissing] = useState(false);

  const config = MODE_CONFIG[mode];
  const Icon = config.icon;

  // Get current state string based on mode
  const currentStateStr = mode === 'book'
    ? (bookingState?.state || 'IDENTIFY_SERVICE')
    : mode === 'cancel'
      ? (cancelState?.state || 'IDENTIFY_BOOKING')
      : (rescheduleState?.state || 'IDENTIFY_BOOKING');

  const currentStep = config.stateSteps[currentStateStr] || 1;

  const handleConfirm = async () => {
    setConfirming(true);
    try {
      await api.post(`/ai/conversations/${conversationId}/${config.confirmEndpoint}`);
      toast(t(config.confirmSuccessKey));
      onConfirmed();
    } catch (e: any) {
      toast(t(config.confirmFailKey), 'error');
    }
    setConfirming(false);
  };

  const handleDismiss = async () => {
    setDismissing(true);
    try {
      await api.post(`/ai/conversations/${conversationId}/${config.dismissEndpoint}`);
      onDismissed();
    } catch (e: any) {
      console.error(e);
    }
    setDismissing(false);
  };

  // Build info rows based on mode
  const infoRows: Array<{ label: string; value: string }> = [];
  if (mode === 'book' && bookingState) {
    if (bookingState.serviceName) infoRows.push({ label: t('ai.booking_service'), value: bookingState.serviceName });
    if (bookingState.date) infoRows.push({ label: t('ai.booking_date'), value: bookingState.date });
    if (bookingState.time) infoRows.push({ label: t('ai.booking_time'), value: bookingState.time });
    if (bookingState.staffName) infoRows.push({ label: t('ai.booking_staff'), value: bookingState.staffName });
  } else if (mode === 'cancel' && cancelState) {
    if (cancelState.serviceName) infoRows.push({ label: t('ai.booking_service'), value: cancelState.serviceName });
    if (cancelState.date) infoRows.push({ label: t('ai.booking_date'), value: cancelState.date });
    if (cancelState.time) infoRows.push({ label: t('ai.booking_time'), value: cancelState.time });
    if (cancelState.staffName) infoRows.push({ label: t('ai.booking_staff'), value: cancelState.staffName });
  } else if (mode === 'reschedule' && rescheduleState) {
    if (rescheduleState.serviceName) infoRows.push({ label: t('ai.booking_service'), value: rescheduleState.serviceName });
    if (rescheduleState.originalDate) infoRows.push({ label: t('ai.original_date'), value: rescheduleState.originalDate });
    if (rescheduleState.originalTime) infoRows.push({ label: t('ai.original_time'), value: rescheduleState.originalTime });
    if (rescheduleState.newDate) infoRows.push({ label: t('ai.new_date'), value: rescheduleState.newDate });
    if (rescheduleState.newTime) infoRows.push({ label: t('ai.new_time'), value: rescheduleState.newTime });
    if (rescheduleState.staffName) infoRows.push({ label: t('ai.booking_staff'), value: rescheduleState.staffName });
  }

  const isConfirmReady = currentStateStr === config.confirmState;

  // Color scheme per mode
  const progressColor = mode === 'cancel' ? 'bg-red-500' : mode === 'reschedule' ? 'bg-orange-500' : 'bg-lavender-500';
  const btnColor = mode === 'cancel'
    ? 'bg-red-600 hover:bg-red-700'
    : mode === 'reschedule'
      ? 'bg-orange-600 hover:bg-orange-700'
      : 'bg-lavender-600 hover:bg-lavender-700';
  const stepTextColor = mode === 'cancel' ? 'text-red-500' : mode === 'reschedule' ? 'text-orange-500' : 'text-lavender-600';
  const titleColor = mode === 'cancel' ? 'text-red-700' : mode === 'reschedule' ? 'text-orange-700' : 'text-lavender-900';

  return (
    <div className="p-4 border-b">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <Icon size={14} className={config.colorClass} />
          <span className={cn('text-xs font-semibold uppercase', titleColor)}>{t(config.titleKey)}</span>
        </div>
        <button onClick={handleDismiss} disabled={dismissing} className="text-slate-400 hover:text-red-500">
          {dismissing ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />}
        </button>
      </div>

      {/* Progress steps */}
      <div className="flex gap-1 mb-3">
        {Array.from({ length: config.stepCount }, (_, i) => i + 1).map((step) => (
          <div
            key={step}
            className={cn(
              'h-1 flex-1 rounded-full',
              step <= currentStep ? progressColor : 'bg-slate-200',
            )}
          />
        ))}
      </div>

      {/* Extracted info */}
      <div className="space-y-1.5 text-xs">
        {infoRows.map((row) => (
          <div key={row.label} className="flex justify-between">
            <span className="text-slate-500">{row.label}</span>
            <span className="font-medium">{row.value}</span>
          </div>
        ))}
      </div>

      {/* Current step label */}
      <p className={cn('text-[10px] mt-2', stepTextColor)}>
        {t(`ai.step_${currentStateStr.toLowerCase()}`)}
      </p>

      {/* Confirm button */}
      {isConfirmReady && (
        <button
          onClick={handleConfirm}
          disabled={confirming}
          className={cn('mt-3 w-full text-white py-2 rounded-xl text-sm disabled:opacity-50 flex items-center justify-center gap-1.5 transition-colors', btnColor)}
        >
          {confirming ? <Loader2 size={14} className="animate-spin" /> : <Icon size={14} />}
          {t(config.confirmLabelKey)}
        </button>
      )}
    </div>
  );
}
