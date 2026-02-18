'use client';

import { useRouter } from 'next/navigation';
import { cn } from '@/lib/cn';
import { useI18n } from '@/lib/i18n';
import {
  Calendar,
  MessageSquare,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react';

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  PENDING: { bg: 'bg-lavender-50', text: 'text-lavender-900' },
  CONFIRMED: { bg: 'bg-sage-50', text: 'text-sage-900' },
  IN_PROGRESS: { bg: 'bg-amber-50', text: 'text-amber-700' },
  COMPLETED: { bg: 'bg-sage-50', text: 'text-sage-900' },
  NO_SHOW: { bg: 'bg-red-50', text: 'text-red-700' },
};

interface MyWorkProps {
  myBookingsToday: any[];
  myAssignedConversations: any[];
  completedTodayByStaff: number;
}

export function MyWork({ myBookingsToday, myAssignedConversations, completedTodayByStaff }: MyWorkProps) {
  const router = useRouter();
  const { t } = useI18n();

  const hasBookings = myBookingsToday.length > 0;
  const hasConversations = myAssignedConversations.length > 0;

  if (!hasBookings && !hasConversations && completedTodayByStaff === 0) {
    return null;
  }

  return (
    <div data-testid="my-work" className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* My Schedule */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-soft p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Calendar size={16} className="text-sage-600" />
            <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100">
              {t('dashboard.my_schedule')}
            </h3>
          </div>
          <div className="flex items-center gap-2">
            {completedTodayByStaff > 0 && (
              <span className="text-[10px] text-sage-600 bg-sage-50 px-2 py-0.5 rounded-full">
                {completedTodayByStaff} {t('dashboard.completed_label')}
              </span>
            )}
            <button
              onClick={() => router.push('/calendar')}
              className="text-xs text-sage-600 hover:text-sage-700 flex items-center gap-1 transition-colors"
            >
              {t('dashboard.view_calendar')} <ArrowRight size={12} />
            </button>
          </div>
        </div>
        {hasBookings ? (
          <div className="space-y-1.5">
            {myBookingsToday.slice(0, 5).map((b: any) => (
              <div
                key={b.id}
                className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50/60 dark:bg-slate-800/40"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <p className="text-xs font-medium text-slate-700 dark:text-slate-300 min-w-[48px]">
                    {new Date(b.startTime).toLocaleTimeString('en-US', {
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </p>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate">
                      {b.customer?.name}
                    </p>
                    <p className="text-[11px] text-slate-500 truncate">{b.service?.name}</p>
                  </div>
                </div>
                <span
                  className={cn(
                    'text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0',
                    STATUS_COLORS[b.status]?.bg,
                    STATUS_COLORS[b.status]?.text,
                  )}
                >
                  {t(`status.${b.status.toLowerCase()}`)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-4">
            <CheckCircle2 size={20} className="mx-auto text-sage-300 mb-1" />
            <p className="text-xs text-slate-400">{t('dashboard.no_bookings_scheduled')}</p>
          </div>
        )}
      </div>

      {/* My Conversations */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-soft p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <MessageSquare size={16} className="text-lavender-600" />
            <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100">
              {t('dashboard.my_conversations')}
            </h3>
          </div>
          <button
            onClick={() => router.push('/inbox')}
            className="text-xs text-sage-600 hover:text-sage-700 flex items-center gap-1 transition-colors"
          >
            {t('dashboard.view_inbox')} <ArrowRight size={12} />
          </button>
        </div>
        {hasConversations ? (
          <div className="space-y-1.5">
            {myAssignedConversations.slice(0, 5).map((c: any) => (
              <div
                key={c.id}
                className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50/60 dark:bg-slate-800/40 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800"
                onClick={() => router.push('/inbox')}
              >
                <div className="min-w-0">
                  <p className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate">
                    {c.customer?.name}
                  </p>
                  <p className="text-[11px] text-slate-500 truncate max-w-[200px]">
                    {c.messages?.[0]?.content || t('dashboard.no_messages')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-4">
            <CheckCircle2 size={20} className="mx-auto text-sage-300 mb-1" />
            <p className="text-xs text-slate-400">{t('dashboard.no_assigned_conversations')}</p>
          </div>
        )}
      </div>
    </div>
  );
}
