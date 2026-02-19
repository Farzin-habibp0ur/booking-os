'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/lib/i18n';
import {
  DollarSign,
  MessageSquare,
  Calendar,
  ArrowRight,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

function timeAgo(date: Date, t: (key: string, params?: any) => string): string {
  const mins = Math.floor((Date.now() - date.getTime()) / 60000);
  if (mins < 1) return t('dashboard.just_now');
  if (mins < 60) return t('dashboard.minutes_ago', { count: mins });
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return t('dashboard.hours_ago', { count: hrs });
  return t('dashboard.days_ago', { count: Math.floor(hrs / 24) });
}

interface AttentionCardsProps {
  attentionNeeded?: {
    depositPendingBookings: any[];
    overdueConversations: any[];
    tomorrowBookings: any[];
  };
}

export function AttentionCards({ attentionNeeded }: AttentionCardsProps) {
  const router = useRouter();
  const { t } = useI18n();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  if (!attentionNeeded) return null;

  const hasItems =
    (attentionNeeded.depositPendingBookings?.length || 0) > 0 ||
    (attentionNeeded.overdueConversations?.length || 0) > 0 ||
    (attentionNeeded.tomorrowBookings?.length || 0) > 0;

  if (!hasItems) return null;

  const toggleExpand = (key: string) => {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div data-testid="attention-cards">
      <div className="flex items-center gap-2 mb-4">
        <AlertTriangle size={18} className="text-amber-500" />
        <h2 className="font-semibold text-slate-900 dark:text-slate-100">
          {t('dashboard.attention_needed')}
        </h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Deposit Pending */}
        {attentionNeeded.depositPendingBookings.length > 0 && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-soft p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <DollarSign size={16} className="text-amber-500" />
                <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                  {t('dashboard.deposit_pending')}
                </p>
              </div>
              <span className="text-[10px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                {attentionNeeded.depositPendingBookings.length}
              </span>
            </div>
            <div className="space-y-2 mb-3">
              {attentionNeeded.depositPendingBookings
                .slice(0, expanded['deposits'] ? undefined : 3)
                .map((b: any) => (
                  <div key={b.id} className="flex items-center justify-between text-xs">
                    <span className="text-slate-700 dark:text-slate-300 truncate">
                      {b.customer?.name}
                    </span>
                    <span className="text-slate-400">{b.service?.name}</span>
                  </div>
                ))}
            </div>
            {attentionNeeded.depositPendingBookings.length > 3 && (
              <button
                onClick={() => toggleExpand('deposits')}
                className="text-[10px] text-slate-400 hover:text-slate-600 flex items-center gap-0.5 mb-2 transition-colors"
                data-testid="toggle-deposits"
              >
                {expanded['deposits'] ? (
                  <>
                    <ChevronUp size={10} /> Show less
                  </>
                ) : (
                  <>
                    <ChevronDown size={10} /> Show all{' '}
                    {attentionNeeded.depositPendingBookings.length}
                  </>
                )}
              </button>
            )}
            <div className="flex items-center gap-2">
              <button
                onClick={() =>
                  router.push(
                    `/bookings?bookingId=${attentionNeeded.depositPendingBookings[0]?.id}`,
                  )
                }
                className="text-xs bg-amber-50 hover:bg-amber-100 text-amber-700 px-3 py-1.5 rounded-xl font-medium transition-colors"
                data-testid="resolve-deposit"
              >
                {t('dashboard.send_reminders')}
              </button>
              <button
                onClick={() => router.push('/bookings?status=PENDING_DEPOSIT')}
                className="text-xs text-sage-600 hover:text-sage-700 flex items-center gap-1 transition-colors"
              >
                {t('dashboard.view_deposit_pending')} <ArrowRight size={12} />
              </button>
            </div>
          </div>
        )}

        {/* Overdue Replies */}
        {attentionNeeded.overdueConversations.length > 0 && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-soft p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <MessageSquare size={16} className="text-amber-500" />
                <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                  {t('dashboard.overdue_replies')}
                </p>
              </div>
              <span className="text-[10px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                {attentionNeeded.overdueConversations.length}
              </span>
            </div>
            <div className="space-y-2 mb-3">
              {attentionNeeded.overdueConversations
                .slice(0, expanded['overdue'] ? undefined : 3)
                .map((c: any) => (
                  <div key={c.id} className="flex items-center justify-between text-xs">
                    <span className="text-slate-700 dark:text-slate-300 truncate">
                      {c.customer?.name}
                    </span>
                    <span className="text-slate-400">
                      {c.lastMessageAt &&
                        t('dashboard.waiting_since', {
                          time: timeAgo(new Date(c.lastMessageAt), t),
                        })}
                    </span>
                  </div>
                ))}
            </div>
            {attentionNeeded.overdueConversations.length > 3 && (
              <button
                onClick={() => toggleExpand('overdue')}
                className="text-[10px] text-slate-400 hover:text-slate-600 flex items-center gap-0.5 mb-2 transition-colors"
                data-testid="toggle-overdue"
              >
                {expanded['overdue'] ? (
                  <>
                    <ChevronUp size={10} /> Show less
                  </>
                ) : (
                  <>
                    <ChevronDown size={10} /> Show all {attentionNeeded.overdueConversations.length}
                  </>
                )}
              </button>
            )}
            <div className="flex items-center gap-2">
              <button
                onClick={() =>
                  router.push(
                    `/inbox?conversationId=${attentionNeeded.overdueConversations[0]?.id}`,
                  )
                }
                className="text-xs bg-amber-50 hover:bg-amber-100 text-amber-700 px-3 py-1.5 rounded-xl font-medium transition-colors"
                data-testid="resolve-overdue"
              >
                {t('dashboard.open_queue')}
              </button>
              <button
                onClick={() => router.push('/inbox?filter=overdue')}
                className="text-xs text-sage-600 hover:text-sage-700 flex items-center gap-1 transition-colors"
              >
                {t('dashboard.view_overdue')} <ArrowRight size={12} />
              </button>
            </div>
          </div>
        )}

        {/* Tomorrow's Schedule */}
        {attentionNeeded.tomorrowBookings.length > 0 && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-soft p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Calendar size={16} className="text-amber-500" />
                <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                  {t('dashboard.tomorrow_schedule')}
                </p>
              </div>
              <span className="text-[10px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                {attentionNeeded.tomorrowBookings.length}
              </span>
            </div>
            <div className="space-y-2 mb-3">
              {attentionNeeded.tomorrowBookings
                .slice(0, expanded['tomorrow'] ? undefined : 3)
                .map((b: any) => (
                  <div key={b.id} className="flex items-center justify-between text-xs">
                    <span className="text-slate-700 dark:text-slate-300 truncate">
                      {b.customer?.name}
                    </span>
                    <span className="text-slate-400">
                      {new Date(b.startTime).toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                ))}
            </div>
            {attentionNeeded.tomorrowBookings.length > 3 && (
              <button
                onClick={() => toggleExpand('tomorrow')}
                className="text-[10px] text-slate-400 hover:text-slate-600 flex items-center gap-0.5 mb-2 transition-colors"
                data-testid="toggle-tomorrow"
              >
                {expanded['tomorrow'] ? (
                  <>
                    <ChevronUp size={10} /> Show less
                  </>
                ) : (
                  <>
                    <ChevronDown size={10} /> Show all {attentionNeeded.tomorrowBookings.length}
                  </>
                )}
              </button>
            )}
            <div className="flex items-center gap-2">
              <button
                onClick={() => router.push('/calendar')}
                className="text-xs bg-amber-50 hover:bg-amber-100 text-amber-700 px-3 py-1.5 rounded-xl font-medium transition-colors"
                data-testid="resolve-tomorrow"
              >
                {t('dashboard.confirm_schedule')}
              </button>
              <button
                onClick={() => router.push('/calendar')}
                className="text-xs text-sage-600 hover:text-sage-700 flex items-center gap-1 transition-colors"
              >
                {t('dashboard.view_tomorrow')} <ArrowRight size={12} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
