'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { PageSkeleton } from '@/components/skeleton';
import { useI18n } from '@/lib/i18n';
import {
  Calendar,
  MessageSquare,
  TrendingUp,
  TrendingDown,
  Clock,
  Users,
  DollarSign,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  XCircle,
  CircleDot,
} from 'lucide-react';

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  PENDING: { bg: 'bg-lavender-50', text: 'text-lavender-900' },
  CONFIRMED: { bg: 'bg-sage-50', text: 'text-sage-900' },
  IN_PROGRESS: { bg: 'bg-amber-50', text: 'text-amber-700' },
  COMPLETED: { bg: 'bg-sage-50', text: 'text-sage-900' },
  NO_SHOW: { bg: 'bg-red-50', text: 'text-red-700' },
  CANCELLED: { bg: 'bg-slate-100', text: 'text-slate-600' },
};

export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { t } = useI18n();

  useEffect(() => {
    // Check if onboarding is complete; redirect to setup if not
    api
      .get<any>('/business')
      .then((biz) => {
        const config = biz.packConfig || {};
        if (!config.setupComplete) {
          router.push('/setup');
          return;
        }
        return api.get('/dashboard').then(setData);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <PageSkeleton />;
  if (!data)
    return (
      <div className="p-6">
        <p className="text-red-500">{t('dashboard.failed_to_load')}</p>
      </div>
    );

  const m = data.metrics;
  const weekChange =
    m.totalBookingsLastWeek > 0
      ? Math.round(
          ((m.totalBookingsThisWeek - m.totalBookingsLastWeek) / m.totalBookingsLastWeek) * 100,
        )
      : m.totalBookingsThisWeek > 0
        ? 100
        : 0;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-serif font-semibold text-slate-900">
            {t('dashboard.title')}
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            {new Date().toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
          </p>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          icon={Calendar}
          color="blue"
          label={t('dashboard.bookings_this_week')}
          value={m.totalBookingsThisWeek}
          subtitle={
            weekChange !== 0
              ? t('dashboard.vs_last_week', {
                  change: weekChange > 0 ? '+' + weekChange : weekChange,
                })
              : t('dashboard.same_as_last_week')
          }
          trend={weekChange > 0 ? 'up' : weekChange < 0 ? 'down' : 'flat'}
        />
        <MetricCard
          icon={DollarSign}
          color="green"
          label={t('dashboard.revenue_30d')}
          value={`$${m.revenueThisMonth.toLocaleString()}`}
        />
        <MetricCard
          icon={Users}
          color="purple"
          label={t('dashboard.total_customers', { entity: 'Customer' })}
          value={m.totalCustomers}
          subtitle={
            m.newCustomersThisWeek > 0
              ? t('dashboard.this_week_count', { count: m.newCustomersThisWeek })
              : undefined
          }
          trend={m.newCustomersThisWeek > 0 ? 'up' : 'flat'}
        />
        <MetricCard
          icon={MessageSquare}
          color="orange"
          label={t('dashboard.open_conversations')}
          value={m.openConversationCount}
          subtitle={t('dashboard.avg_response_detail', { minutes: m.avgResponseTimeMins })}
        />
      </div>

      {/* Secondary metrics row */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl shadow-soft p-6">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">{t('dashboard.no_show_rate')}</p>
            <AlertCircle
              size={16}
              className={m.noShowRate > 15 ? 'text-red-500' : 'text-sage-600'}
            />
          </div>
          <p className="text-2xl font-serif font-bold mt-1">{m.noShowRate}%</p>
          <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2">
            <div
              className={cn(
                'h-1.5 rounded-full',
                m.noShowRate > 15
                  ? 'bg-red-400'
                  : m.noShowRate > 5
                    ? 'bg-amber-400'
                    : 'bg-sage-500',
              )}
              style={{ width: `${Math.min(m.noShowRate, 100)}%` }}
            />
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-soft p-6">
          <p className="text-sm text-slate-500">{t('dashboard.avg_response_time')}</p>
          <p className="text-2xl font-serif font-bold mt-1">
            {m.avgResponseTimeMins}
            <span className="text-sm font-sans font-normal text-slate-400">
              {' '}
              {t('dashboard.min_short')}
            </span>
          </p>
          <p
            className={cn(
              'text-xs mt-1',
              m.avgResponseTimeMins <= 5
                ? 'text-sage-600'
                : m.avgResponseTimeMins <= 15
                  ? 'text-amber-600'
                  : 'text-red-600',
            )}
          >
            {m.avgResponseTimeMins <= 5
              ? t('dashboard.excellent')
              : m.avgResponseTimeMins <= 15
                ? t('dashboard.good')
                : t('dashboard.needs_improvement')}
          </p>
        </div>

        {/* Consult → Treatment Conversion */}
        <div className="bg-white rounded-2xl shadow-soft p-6">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">Consult → Treatment</p>
          </div>
          <p className="text-2xl font-serif font-bold mt-1">
            {data.consultConversion?.rate ?? 0}%
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {data.consultConversion?.converted ?? 0} of {data.consultConversion?.consultCustomers ?? 0} consults converted
          </p>
        </div>

        {/* Status Breakdown */}
        <div className="bg-white rounded-2xl shadow-soft p-6">
          <p className="text-sm text-slate-500 mb-2">{t('dashboard.this_week_by_status')}</p>
          <div className="space-y-1.5">
            {(data.statusBreakdown || []).map((s: any) => (
              <div key={s.status} className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <div
                    className={cn(
                      'w-2 h-2 rounded-full',
                      STATUS_COLORS[s.status]?.bg || 'bg-gray-300',
                    )}
                  />
                  <span className="text-xs text-slate-600">
                    {t(`status.${s.status.toLowerCase()}`)}
                  </span>
                </div>
                <span className="text-xs font-medium">{s.count}</span>
              </div>
            ))}
            {(!data.statusBreakdown || data.statusBreakdown.length === 0) && (
              <p className="text-xs text-slate-400">{t('dashboard.no_bookings_this_week')}</p>
            )}
          </div>
        </div>
      </div>

      {/* Today's Appointments + Unassigned */}
      <div className="grid grid-cols-2 gap-6">
        {/* Today's Appointments */}
        <div className="bg-white rounded-2xl shadow-soft">
          <div className="flex items-center justify-between p-6 pb-4">
            <h2 className="font-semibold text-slate-900">{t('dashboard.todays_appointments')}</h2>
            <button
              onClick={() => router.push('/calendar')}
              className="text-xs text-sage-600 hover:text-sage-700 flex items-center gap-1 transition-colors"
            >
              {t('dashboard.view_calendar')} <ArrowRight size={12} />
            </button>
          </div>
          <div className="px-6 pb-6">
            {data.todayBookings.length === 0 ? (
              <div className="text-center py-6">
                <Calendar size={24} className="mx-auto text-slate-300 mb-2" />
                <p className="text-slate-400 text-sm">{t('dashboard.no_appointments_today')}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {data.todayBookings.map((b: any) => (
                  <div
                    key={b.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-slate-50/60 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="text-center min-w-[48px]">
                        <p className="text-sm font-semibold text-slate-900">
                          {new Date(b.startTime).toLocaleTimeString('en-US', {
                            hour: 'numeric',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-800">{b.customer?.name}</p>
                        <p className="text-xs text-slate-500">
                          {b.service?.name}
                          {b.service?.kind === 'CONSULT' && (
                            <span className="ml-1 text-[9px] bg-lavender-50 text-lavender-900 px-1 py-0 rounded-full">C</span>
                          )}
                          {b.service?.kind === 'TREATMENT' && (
                            <span className="ml-1 text-[9px] bg-sage-50 text-sage-900 px-1 py-0 rounded-full">T</span>
                          )}
                          {b.staff ? ` · ${b.staff.name}` : ''}
                        </p>
                      </div>
                    </div>
                    <span
                      className={cn(
                        'text-[10px] px-2 py-0.5 rounded-full font-medium',
                        STATUS_COLORS[b.status]?.bg,
                        STATUS_COLORS[b.status]?.text,
                      )}
                    >
                      {t(`status.${b.status.toLowerCase()}`)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Unassigned Conversations */}
        <div className="bg-white rounded-2xl shadow-soft">
          <div className="flex items-center justify-between p-6 pb-4">
            <h2 className="font-semibold text-slate-900">
              {t('dashboard.unassigned_conversations')}
            </h2>
            <button
              onClick={() => router.push('/inbox?filter=unassigned')}
              className="text-xs text-sage-600 hover:text-sage-700 flex items-center gap-1 transition-colors"
            >
              {t('dashboard.view_inbox')} <ArrowRight size={12} />
            </button>
          </div>
          <div className="px-6 pb-6">
            {data.unassignedConversations.length === 0 ? (
              <div className="text-center py-6">
                <CheckCircle2 size={24} className="mx-auto text-sage-300 mb-2" />
                <p className="text-slate-400 text-sm">{t('dashboard.all_caught_up')}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {data.unassignedConversations.map((c: any) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-slate-50/60 hover:bg-slate-50 transition-colors cursor-pointer"
                    onClick={() => router.push('/inbox')}
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-800">{c.customer?.name}</p>
                      <p className="text-xs text-slate-500 truncate max-w-[220px]">
                        {c.messages?.[0]?.content || t('dashboard.no_messages')}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] bg-lavender-50 text-lavender-900 px-2.5 py-0.5 rounded-full font-medium">
                        {t('dashboard.unassigned_badge')}
                      </span>
                      {c.lastMessageAt && (
                        <p className="text-[10px] text-slate-400 mt-1">
                          {timeAgo(new Date(c.lastMessageAt), t)}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  color,
  label,
  value,
  subtitle,
  trend,
}: {
  icon: any;
  color: string;
  label: string;
  value: string | number;
  subtitle?: string;
  trend?: 'up' | 'down' | 'flat';
}) {
  const colorMap: Record<string, string> = {
    blue: 'text-sage-600 bg-sage-50',
    green: 'text-sage-700 bg-sage-50',
    purple: 'text-lavender-600 bg-lavender-50',
    orange: 'text-amber-600 bg-amber-50',
  };

  return (
    <div className="bg-white rounded-2xl shadow-soft p-6">
      <div className="flex items-start justify-between">
        <div className={cn('p-2.5 rounded-xl', colorMap[color])}>
          <Icon size={18} />
        </div>
        {trend === 'up' && <TrendingUp size={14} className="text-sage-500" />}
        {trend === 'down' && <TrendingDown size={14} className="text-red-400" />}
      </div>
      <p className="text-2xl font-serif font-bold mt-3 text-slate-900">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
      {subtitle && (
        <p
          className={cn(
            'text-[11px] mt-0.5',
            trend === 'up' ? 'text-sage-600' : trend === 'down' ? 'text-red-500' : 'text-slate-400',
          )}
        >
          {subtitle}
        </p>
      )}
    </div>
  );
}

function timeAgo(date: Date, t: (key: string, params?: any) => string): string {
  const mins = Math.floor((Date.now() - date.getTime()) / 60000);
  if (mins < 1) return t('dashboard.just_now');
  if (mins < 60) return t('dashboard.minutes_ago', { count: mins });
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return t('dashboard.hours_ago', { count: hrs });
  return t('dashboard.days_ago', { count: Math.floor(hrs / 24) });
}
