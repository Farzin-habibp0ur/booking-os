'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { useI18n } from '@/lib/i18n';
import { ELEVATION, BOOKING_STATUS_STYLES } from '@/lib/design-tokens';
import {
  CalendarCheck,
  DollarSign,
  Clock,
  UserX,
  ClipboardList,
  Sparkles,
  ChevronRight,
  X,
} from 'lucide-react';

interface CalendarSidebarProps {
  currentDate: Date;
  onClose: () => void;
}

interface TodaySummary {
  bookingCount: number;
  confirmedCount: number;
  revenue: number;
  gaps: number;
  noShows: number;
  avgDuration: number;
}

interface WaitlistEntry {
  id: string;
  customerName: string;
  serviceName: string;
  preferredDate: string;
  status: string;
}

interface AIAction {
  id: string;
  title: string;
  description: string;
  type: string;
}

export function CalendarSidebar({ currentDate, onClose }: CalendarSidebarProps) {
  const { t } = useI18n();
  const [summary, setSummary] = useState<TodaySummary | null>(null);
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([]);
  const [aiActions, setAiActions] = useState<AIAction[]>([]);

  useEffect(() => {
    const dateStr = currentDate.toISOString().split('T')[0];

    // Load today's summary
    api
      .get<any>(`/analytics/daily-summary?date=${dateStr}`)
      .then((data) => {
        setSummary({
          bookingCount: data?.totalBookings ?? 0,
          confirmedCount: data?.confirmedBookings ?? 0,
          revenue: data?.revenue ?? 0,
          gaps: data?.gaps ?? 0,
          noShows: data?.noShows ?? 0,
          avgDuration: data?.avgDuration ?? 0,
        });
      })
      .catch(() => setSummary(null));

    // Load waitlist (top 5)
    api
      .get<any>('/waitlist?limit=5&status=pending')
      .then((data) => setWaitlist(data?.data?.slice(0, 5) || []))
      .catch(() => setWaitlist([]));

    // Load AI suggested actions
    api
      .get<any>('/briefing/actions?limit=3')
      .then((data) => setAiActions(data?.slice?.(0, 3) || []))
      .catch(() => setAiActions([]));
  }, [currentDate]);

  const dateLabel = currentDate.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });

  return (
    <div className="w-72 lg:w-80 border-l border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col h-full overflow-y-auto animate-slide-in-right">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{dateLabel}</h3>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
          aria-label="Close sidebar"
        >
          <X size={16} />
        </button>
      </div>

      {/* Today's Summary Strip */}
      {summary && (
        <div className="p-4 space-y-3">
          <p className="nav-section-label">Summary</p>
          <div className="grid grid-cols-2 gap-2">
            <SummaryItem
              icon={CalendarCheck}
              label="Bookings"
              value={`${summary.confirmedCount}/${summary.bookingCount}`}
              accent="sage"
            />
            <SummaryItem
              icon={DollarSign}
              label="Revenue"
              value={`$${summary.revenue.toLocaleString()}`}
              accent="sage"
            />
            <SummaryItem
              icon={Clock}
              label="Gaps"
              value={`${summary.gaps}`}
              accent={summary.gaps > 2 ? 'amber' : 'sage'}
            />
            <SummaryItem
              icon={UserX}
              label="No-shows"
              value={`${summary.noShows}`}
              accent={summary.noShows > 0 ? 'red' : 'sage'}
            />
          </div>
        </div>
      )}

      {/* Waitlist */}
      {waitlist.length > 0 && (
        <div className="p-4 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2 mb-2">
            <ClipboardList size={14} className="text-slate-400" />
            <p className="nav-section-label !p-0">Waitlist</p>
          </div>
          <div className="space-y-1.5">
            {waitlist.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 text-xs"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-700 dark:text-slate-300 truncate">
                    {entry.customerName}
                  </p>
                  <p className="text-slate-500 truncate">{entry.serviceName}</p>
                </div>
                <ChevronRight size={12} className="text-slate-300 shrink-0" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI Actions */}
      {aiActions.length > 0 && (
        <div className="p-4 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles size={14} className="text-lavender-500" />
            <p className="nav-section-label !p-0">AI Suggestions</p>
          </div>
          <div className="space-y-2">
            {aiActions.map((action) => (
              <div
                key={action.id}
                className="p-2.5 rounded-xl bg-lavender-50 dark:bg-lavender-900/20 border border-lavender-100 dark:border-lavender-800/30"
              >
                <p className="text-xs font-medium text-lavender-900 dark:text-lavender-300">
                  {action.title}
                </p>
                <p className="text-[10px] text-lavender-600 dark:text-lavender-400 mt-0.5">
                  {action.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Stats */}
      {summary && summary.avgDuration > 0 && (
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 mt-auto">
          <p className="text-[10px] text-slate-400">
            Avg service time: {Math.round(summary.avgDuration)} min
          </p>
        </div>
      )}
    </div>
  );
}

function SummaryItem({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: any;
  label: string;
  value: string;
  accent: 'sage' | 'amber' | 'red';
}) {
  const accentClasses = {
    sage: 'text-sage-600 dark:text-sage-400',
    amber: 'text-amber-600 dark:text-amber-400',
    red: 'text-red-600 dark:text-red-400',
  };

  return (
    <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50">
      <Icon size={14} className={accentClasses[accent]} />
      <div>
        <p className={cn('text-sm font-semibold', accentClasses[accent])}>{value}</p>
        <p className="text-[10px] text-slate-400">{label}</p>
      </div>
    </div>
  );
}
