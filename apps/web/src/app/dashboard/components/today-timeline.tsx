'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { useToast } from '@/lib/toast';
import { cn } from '@/lib/cn';
import { Calendar, Play, CheckCircle2, UserX, MessageSquare, ArrowRight } from 'lucide-react';

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  PENDING: { bg: 'bg-lavender-50', text: 'text-lavender-900' },
  PENDING_DEPOSIT: { bg: 'bg-amber-50', text: 'text-amber-700' },
  CONFIRMED: { bg: 'bg-sage-50', text: 'text-sage-900' },
  IN_PROGRESS: { bg: 'bg-amber-50', text: 'text-amber-700' },
  COMPLETED: { bg: 'bg-sage-50', text: 'text-sage-900' },
  NO_SHOW: { bg: 'bg-red-50', text: 'text-red-700' },
  CANCELLED: { bg: 'bg-slate-100', text: 'text-slate-600' },
};

const HOUR_START = 8;
const HOUR_END = 19;
const HOURS = Array.from({ length: HOUR_END - HOUR_START + 1 }, (_, i) => HOUR_START + i);

interface TodayTimelineProps {
  todayBookings: any[];
  onBookingUpdate?: () => void;
}

export function TodayTimeline({ todayBookings, onBookingUpdate }: TodayTimelineProps) {
  const router = useRouter();
  const { t } = useI18n();
  const { toast } = useToast();
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const handleStatusUpdate = async (bookingId: string, newStatus: string) => {
    setActionLoading(bookingId);
    try {
      await api.patch(`/bookings/${bookingId}/status`, { status: newStatus });
      toast({
        title: t('common.success'),
        description: `Booking ${newStatus.toLowerCase().replace('_', ' ')}`,
      });
      onBookingUpdate?.();
    } catch (err: any) {
      toast({
        title: t('common.error'),
        description: err.message || 'Failed to update status',
        variant: 'destructive',
      });
    } finally {
      setActionLoading(null);
    }
  };

  const formatHour = (hour: number) => {
    if (hour === 0) return '12 AM';
    if (hour < 12) return `${hour} AM`;
    if (hour === 12) return '12 PM';
    return `${hour - 12} PM`;
  };

  const getBookingPosition = (startTime: string) => {
    const d = new Date(startTime);
    const mins = d.getHours() * 60 + d.getMinutes();
    return mins;
  };

  const getBookingDuration = (startTime: string, endTime: string) => {
    const start = new Date(startTime);
    const end = new Date(endTime);
    return (end.getTime() - start.getTime()) / 60000;
  };

  // Find gaps between bookings (free time slots)
  const sortedBookings = [...todayBookings].sort(
    (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
  );

  const gaps: { startMinutes: number; durationMinutes: number }[] = [];
  for (let i = 0; i < sortedBookings.length - 1; i++) {
    const currentEnd = new Date(sortedBookings[i].endTime).getTime();
    const nextStart = new Date(sortedBookings[i + 1].startTime).getTime();
    const gapMinutes = (nextStart - currentEnd) / 60000;
    if (gapMinutes >= 30) {
      gaps.push({
        startMinutes:
          new Date(sortedBookings[i].endTime).getHours() * 60 +
          new Date(sortedBookings[i].endTime).getMinutes(),
        durationMinutes: gapMinutes,
      });
    }
  }

  // Current time position as percentage
  const timelineStartMinutes = HOUR_START * 60;
  const timelineEndMinutes = HOUR_END * 60;
  const timelineRange = timelineEndMinutes - timelineStartMinutes;
  const currentTimePercent = Math.max(
    0,
    Math.min(100, ((currentMinutes - timelineStartMinutes) / timelineRange) * 100),
  );

  const isWithinTimeline =
    currentMinutes >= timelineStartMinutes && currentMinutes <= timelineEndMinutes;

  if (todayBookings.length === 0) {
    return (
      <div
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-soft"
        data-testid="today-timeline"
      >
        <div className="flex items-center justify-between p-6 pb-4">
          <h2 className="font-semibold text-slate-900 dark:text-slate-100">
            {t('dashboard.todays_appointments')}
          </h2>
          <button
            onClick={() => router.push('/calendar')}
            className="text-xs text-sage-600 hover:text-sage-700 flex items-center gap-1 transition-colors"
          >
            {t('dashboard.view_calendar')} <ArrowRight size={12} />
          </button>
        </div>
        <div className="px-6 pb-6">
          <div className="text-center py-6" data-testid="timeline-empty">
            <Calendar size={24} className="mx-auto text-slate-300 mb-2" />
            <p className="text-slate-400 text-sm">{t('dashboard.no_appointments_today')}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="bg-white dark:bg-slate-900 rounded-2xl shadow-soft"
      data-testid="today-timeline"
    >
      <div className="flex items-center justify-between p-6 pb-4">
        <h2 className="font-semibold text-slate-900 dark:text-slate-100">
          {t('dashboard.todays_appointments')}
        </h2>
        <button
          onClick={() => router.push('/calendar')}
          className="text-xs text-sage-600 hover:text-sage-700 flex items-center gap-1 transition-colors"
        >
          {t('dashboard.view_calendar')} <ArrowRight size={12} />
        </button>
      </div>

      <div className="px-6 pb-6">
        <div className="relative" data-testid="timeline-grid">
          {/* Hour markers */}
          {HOURS.map((hour) => {
            const percent = ((hour * 60 - timelineStartMinutes) / timelineRange) * 100;
            return (
              <div
                key={hour}
                className="flex items-start"
                style={{
                  position: 'relative',
                  height: `${100 / HOURS.length}%`,
                  minHeight: '48px',
                }}
              >
                <span className="text-[10px] text-slate-400 w-12 shrink-0 pt-0.5 text-right pr-3">
                  {formatHour(hour)}
                </span>
                <div className="flex-1 border-t border-slate-100 relative" />
              </div>
            );
          })}

          {/* Current time indicator */}
          {isWithinTimeline && (
            <div
              className="absolute left-12 right-0 flex items-center z-20 pointer-events-none"
              style={{ top: `${currentTimePercent}%` }}
              data-testid="current-time-indicator"
            >
              <div className="w-2 h-2 rounded-full bg-red-500 -ml-1" />
              <div className="flex-1 h-[2px] bg-red-500" />
            </div>
          )}

          {/* Gap indicators */}
          {gaps.map((gap, i) => {
            const gapPercent = ((gap.startMinutes - timelineStartMinutes) / timelineRange) * 100;
            const gapHeight = (gap.durationMinutes / timelineRange) * 100;
            return (
              <div
                key={`gap-${i}`}
                className="absolute left-12 right-0 flex items-center justify-center"
                style={{
                  top: `${gapPercent}%`,
                  height: `${gapHeight}%`,
                  minHeight: '20px',
                }}
                data-testid="gap-indicator"
              >
                <span className="text-[9px] text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full">
                  {gap.durationMinutes >= 60
                    ? `${Math.floor(gap.durationMinutes / 60)}h ${gap.durationMinutes % 60 > 0 ? `${gap.durationMinutes % 60}m` : ''} free`
                    : `${gap.durationMinutes}m free`}
                </span>
              </div>
            );
          })}

          {/* Booking cards overlaid on timeline */}
          {sortedBookings.map((booking) => {
            const startMins = getBookingPosition(booking.startTime);
            const duration = getBookingDuration(booking.startTime, booking.endTime);
            const topPercent = ((startMins - timelineStartMinutes) / timelineRange) * 100;
            const heightPercent = (duration / timelineRange) * 100;

            const isPast = startMins + duration < currentMinutes;
            const isNow = startMins <= currentMinutes && startMins + duration > currentMinutes;

            const canStart = booking.status === 'CONFIRMED' || booking.status === 'PENDING';
            const canComplete = booking.status === 'IN_PROGRESS';
            const canNoShow =
              isPast && (booking.status === 'CONFIRMED' || booking.status === 'PENDING');
            const isFinished =
              booking.status === 'COMPLETED' ||
              booking.status === 'NO_SHOW' ||
              booking.status === 'CANCELLED';

            return (
              <div
                key={booking.id}
                className="absolute left-12 right-0 px-1"
                style={{
                  top: `${topPercent}%`,
                  height: `${Math.max(heightPercent, 4)}%`,
                  minHeight: '52px',
                }}
              >
                <div
                  className={cn(
                    'h-full rounded-xl p-3 flex items-start justify-between gap-2 transition-colors',
                    isFinished
                      ? 'bg-slate-50/80 opacity-60'
                      : isNow
                        ? 'bg-sage-50 border border-sage-200 shadow-sm'
                        : 'bg-slate-50/80 hover:bg-slate-100/80',
                  )}
                  data-testid="timeline-booking"
                >
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className="text-center min-w-[48px] shrink-0">
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {new Date(booking.startTime).toLocaleTimeString('en-US', {
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </p>
                      <p className="text-[9px] text-slate-400">{duration}min</p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
                        {booking.customer?.name}
                      </p>
                      <p className="text-xs text-slate-500 truncate">
                        {booking.service?.name}
                        {booking.staff ? ` · ${booking.staff.name}` : ''}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* Status badge */}
                    <span
                      className={cn(
                        'text-[10px] px-2 py-0.5 rounded-full font-medium',
                        STATUS_COLORS[booking.status]?.bg,
                        STATUS_COLORS[booking.status]?.text,
                      )}
                    >
                      {t(`status.${booking.status.toLowerCase()}`)}
                    </span>

                    {/* Quick actions */}
                    {!isFinished && (
                      <div className="flex items-center gap-1">
                        {canStart && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStatusUpdate(booking.id, 'IN_PROGRESS');
                            }}
                            disabled={actionLoading === booking.id}
                            className="p-1 rounded-lg hover:bg-sage-100 text-sage-600 transition-colors disabled:opacity-50"
                            title="Start"
                            data-testid="action-start"
                          >
                            <Play size={14} />
                          </button>
                        )}
                        {canComplete && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStatusUpdate(booking.id, 'COMPLETED');
                            }}
                            disabled={actionLoading === booking.id}
                            className="p-1 rounded-lg hover:bg-sage-100 text-sage-600 transition-colors disabled:opacity-50"
                            title="Complete"
                            data-testid="action-complete"
                          >
                            <CheckCircle2 size={14} />
                          </button>
                        )}
                        {canNoShow && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStatusUpdate(booking.id, 'NO_SHOW');
                            }}
                            disabled={actionLoading === booking.id}
                            className="p-1 rounded-lg hover:bg-red-100 text-red-600 transition-colors disabled:opacity-50"
                            title="No-Show"
                            data-testid="action-no-show"
                          >
                            <UserX size={14} />
                          </button>
                        )}
                        {booking.conversationId && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/inbox?conversationId=${booking.conversationId}`);
                            }}
                            className="p-1 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
                            title="Open Chat"
                            data-testid="action-chat"
                          >
                            <MessageSquare size={14} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
