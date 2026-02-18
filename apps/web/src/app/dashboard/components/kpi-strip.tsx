'use client';

import {
  Calendar,
  MessageSquare,
  DollarSign,
  Users,
  Clock,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { useI18n } from '@/lib/i18n';

interface KpiStripProps {
  mode: string;
  metrics: {
    totalBookingsThisWeek: number;
    totalBookingsLastWeek: number;
    revenueThisMonth: number;
    avgResponseTimeMins: number;
    openConversationCount: number;
    totalCustomers: number;
    noShowRate: number;
  };
  myBookingsToday?: any[];
  completedTodayByStaff?: number;
  myAssignedConversations?: any[];
}

interface KpiItem {
  label: string;
  value: string | number;
  icon: any;
  color: string;
  trend?: 'up' | 'down' | 'flat';
  subtitle?: string;
}

export function KpiStrip({
  mode,
  metrics,
  myBookingsToday = [],
  completedTodayByStaff = 0,
  myAssignedConversations = [],
}: KpiStripProps) {
  const { t } = useI18n();

  const weekChange =
    metrics.totalBookingsLastWeek > 0
      ? Math.round(
          ((metrics.totalBookingsThisWeek - metrics.totalBookingsLastWeek) /
            metrics.totalBookingsLastWeek) *
            100,
        )
      : metrics.totalBookingsThisWeek > 0
        ? 100
        : 0;

  const kpis: KpiItem[] = (() => {
    if (mode === 'agent') {
      return [
        {
          label: t('dashboard.kpi_response_time'),
          value: `${metrics.avgResponseTimeMins}m`,
          icon: Clock,
          color: 'text-amber-600 bg-amber-50',
          trend: metrics.avgResponseTimeMins <= 5 ? ('up' as const) : ('down' as const),
        },
        {
          label: t('dashboard.kpi_unassigned'),
          value: metrics.openConversationCount,
          icon: MessageSquare,
          color: 'text-lavender-600 bg-lavender-50',
        },
        {
          label: t('dashboard.kpi_today_bookings'),
          value: myBookingsToday.length,
          icon: Calendar,
          color: 'text-sage-600 bg-sage-50',
        },
      ];
    }

    if (mode === 'provider') {
      return [
        {
          label: t('dashboard.kpi_my_schedule'),
          value: myBookingsToday.length,
          icon: Calendar,
          color: 'text-sage-600 bg-sage-50',
        },
        {
          label: t('dashboard.kpi_completed_today'),
          value: completedTodayByStaff,
          icon: CheckCircle2,
          color: 'text-sage-700 bg-sage-50',
        },
        {
          label: t('dashboard.kpi_no_show_rate'),
          value: `${metrics.noShowRate}%`,
          icon: Users,
          color: metrics.noShowRate > 15
            ? 'text-red-600 bg-red-50'
            : 'text-amber-600 bg-amber-50',
        },
      ];
    }

    // Admin mode (default)
    return [
      {
        label: t('dashboard.kpi_revenue'),
        value: `$${metrics.revenueThisMonth.toLocaleString()}`,
        icon: DollarSign,
        color: 'text-sage-700 bg-sage-50',
      },
      {
        label: t('dashboard.kpi_bookings_week'),
        value: metrics.totalBookingsThisWeek,
        icon: Calendar,
        color: 'text-sage-600 bg-sage-50',
        trend: weekChange > 0 ? ('up' as const) : weekChange < 0 ? ('down' as const) : ('flat' as const),
        subtitle: weekChange !== 0 ? `${weekChange > 0 ? '+' : ''}${weekChange}%` : undefined,
      },
      {
        label: t('dashboard.kpi_customers'),
        value: metrics.totalCustomers,
        icon: Users,
        color: 'text-lavender-600 bg-lavender-50',
      },
    ];
  })();

  return (
    <div data-testid="kpi-strip" className="grid grid-cols-3 gap-3">
      {kpis.map((kpi) => {
        const Icon = kpi.icon;
        return (
          <div
            key={kpi.label}
            className="bg-white dark:bg-slate-900 rounded-2xl shadow-soft p-4 flex items-center gap-3"
          >
            <div className={cn('p-2 rounded-xl', kpi.color)}>
              <Icon size={16} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-lg font-serif font-bold text-slate-900 dark:text-slate-100 leading-tight">
                {kpi.value}
                {kpi.trend === 'up' && (
                  <TrendingUp size={12} className="inline ml-1 text-sage-500" />
                )}
                {kpi.trend === 'down' && (
                  <TrendingDown size={12} className="inline ml-1 text-red-400" />
                )}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{kpi.label}</p>
              {kpi.subtitle && (
                <p className="text-[10px] text-sage-600">{kpi.subtitle}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
