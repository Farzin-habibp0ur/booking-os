'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { PageSkeleton } from '@/components/skeleton';
import { useI18n } from '@/lib/i18n';
import {
  Calendar, MessageSquare, TrendingUp, TrendingDown, Clock, Users,
  DollarSign, ArrowRight, AlertCircle, CheckCircle2, XCircle, CircleDot,
} from 'lucide-react';

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  PENDING: { bg: 'bg-yellow-100', text: 'text-yellow-700' },
  CONFIRMED: { bg: 'bg-blue-100', text: 'text-blue-700' },
  IN_PROGRESS: { bg: 'bg-purple-100', text: 'text-purple-700' },
  COMPLETED: { bg: 'bg-green-100', text: 'text-green-700' },
  NO_SHOW: { bg: 'bg-red-100', text: 'text-red-700' },
  CANCELLED: { bg: 'bg-gray-100', text: 'text-gray-700' },
};

export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { t } = useI18n();

  useEffect(() => {
    api.get('/dashboard').then(setData).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <PageSkeleton />;
  if (!data) return <div className="p-6"><p className="text-red-500">{t('dashboard.failed_to_load')}</p></div>;

  const m = data.metrics;
  const weekChange = m.totalBookingsLastWeek > 0
    ? Math.round(((m.totalBookingsThisWeek - m.totalBookingsLastWeek) / m.totalBookingsLastWeek) * 100)
    : m.totalBookingsThisWeek > 0 ? 100 : 0;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('dashboard.title')}</h1>
          <p className="text-sm text-gray-500">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          icon={Calendar} color="blue"
          label={t('dashboard.bookings_this_week')}
          value={m.totalBookingsThisWeek}
          subtitle={weekChange !== 0 ? t('dashboard.vs_last_week', { change: weekChange > 0 ? '+' + weekChange : weekChange }) : t('dashboard.same_as_last_week')}
          trend={weekChange > 0 ? 'up' : weekChange < 0 ? 'down' : 'flat'}
        />
        <MetricCard
          icon={DollarSign} color="green"
          label={t('dashboard.revenue_30d')}
          value={`$${m.revenueThisMonth.toLocaleString()}`}
        />
        <MetricCard
          icon={Users} color="purple"
          label={t('dashboard.total_customers', { entity: 'Customer' })}
          value={m.totalCustomers}
          subtitle={m.newCustomersThisWeek > 0 ? t('dashboard.this_week_count', { count: m.newCustomersThisWeek }) : undefined}
          trend={m.newCustomersThisWeek > 0 ? 'up' : 'flat'}
        />
        <MetricCard
          icon={MessageSquare} color="orange"
          label={t('dashboard.open_conversations')}
          value={m.openConversationCount}
          subtitle={t('dashboard.avg_response_detail', { minutes: m.avgResponseTimeMins })}
        />
      </div>

      {/* Secondary metrics row */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white border rounded-lg p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">{t('dashboard.no_show_rate')}</p>
            <AlertCircle size={16} className={m.noShowRate > 15 ? 'text-red-500' : 'text-green-500'} />
          </div>
          <p className="text-2xl font-bold mt-1">{m.noShowRate}%</p>
          <div className="w-full bg-gray-100 rounded-full h-1.5 mt-2">
            <div className={cn('h-1.5 rounded-full', m.noShowRate > 15 ? 'bg-red-500' : m.noShowRate > 5 ? 'bg-amber-500' : 'bg-green-500')} style={{ width: `${Math.min(m.noShowRate, 100)}%` }} />
          </div>
        </div>

        <div className="bg-white border rounded-lg p-4">
          <p className="text-sm text-gray-500">{t('dashboard.avg_response_time')}</p>
          <p className="text-2xl font-bold mt-1">{m.avgResponseTimeMins}<span className="text-sm font-normal text-gray-400"> {t('dashboard.min_short')}</span></p>
          <p className={cn('text-xs mt-1', m.avgResponseTimeMins <= 5 ? 'text-green-600' : m.avgResponseTimeMins <= 15 ? 'text-amber-600' : 'text-red-600')}>
            {m.avgResponseTimeMins <= 5 ? t('dashboard.excellent') : m.avgResponseTimeMins <= 15 ? t('dashboard.good') : t('dashboard.needs_improvement')}
          </p>
        </div>

        {/* Status Breakdown */}
        <div className="bg-white border rounded-lg p-4">
          <p className="text-sm text-gray-500 mb-2">{t('dashboard.this_week_by_status')}</p>
          <div className="space-y-1.5">
            {(data.statusBreakdown || []).map((s: any) => (
              <div key={s.status} className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <div className={cn('w-2 h-2 rounded-full', STATUS_COLORS[s.status]?.bg || 'bg-gray-300')} />
                  <span className="text-xs text-gray-600">{t(`status.${s.status.toLowerCase()}`)}</span>
                </div>
                <span className="text-xs font-medium">{s.count}</span>
              </div>
            ))}
            {(!data.statusBreakdown || data.statusBreakdown.length === 0) && (
              <p className="text-xs text-gray-400">{t('dashboard.no_bookings_this_week')}</p>
            )}
          </div>
        </div>
      </div>

      {/* Today's Appointments + Unassigned */}
      <div className="grid grid-cols-2 gap-6">
        {/* Today's Appointments */}
        <div className="bg-white rounded-lg border">
          <div className="flex items-center justify-between p-4 border-b">
            <h2 className="font-semibold">{t('dashboard.todays_appointments')}</h2>
            <button onClick={() => router.push('/calendar')} className="text-xs text-blue-600 hover:underline flex items-center gap-1">
              {t('dashboard.view_calendar')} <ArrowRight size={12} />
            </button>
          </div>
          <div className="p-4">
            {data.todayBookings.length === 0 ? (
              <div className="text-center py-6">
                <Calendar size={24} className="mx-auto text-gray-300 mb-2" />
                <p className="text-gray-400 text-sm">{t('dashboard.no_appointments_today')}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {data.todayBookings.map((b: any) => (
                  <div key={b.id} className="flex items-center justify-between p-2.5 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="text-center min-w-[48px]">
                        <p className="text-sm font-bold">{new Date(b.startTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium">{b.customer?.name}</p>
                        <p className="text-xs text-gray-500">{b.service?.name}{b.staff ? ` · ${b.staff.name}` : ''}</p>
                      </div>
                    </div>
                    <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-medium', STATUS_COLORS[b.status]?.bg, STATUS_COLORS[b.status]?.text)}>
                      {t(`status.${b.status.toLowerCase()}`)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Unassigned Conversations */}
        <div className="bg-white rounded-lg border">
          <div className="flex items-center justify-between p-4 border-b">
            <h2 className="font-semibold">{t('dashboard.unassigned_conversations')}</h2>
            <button onClick={() => router.push('/inbox?filter=unassigned')} className="text-xs text-blue-600 hover:underline flex items-center gap-1">
              {t('dashboard.view_inbox')} <ArrowRight size={12} />
            </button>
          </div>
          <div className="p-4">
            {data.unassignedConversations.length === 0 ? (
              <div className="text-center py-6">
                <CheckCircle2 size={24} className="mx-auto text-green-300 mb-2" />
                <p className="text-gray-400 text-sm">{t('dashboard.all_caught_up')}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {data.unassignedConversations.map((c: any) => (
                  <div key={c.id} className="flex items-center justify-between p-2.5 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer" onClick={() => router.push('/inbox')}>
                    <div>
                      <p className="text-sm font-medium">{c.customer?.name}</p>
                      <p className="text-xs text-gray-500 truncate max-w-[220px]">
                        {c.messages?.[0]?.content || t('dashboard.no_messages')}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">{t('dashboard.unassigned_badge')}</span>
                      {c.lastMessageAt && (
                        <p className="text-[10px] text-gray-400 mt-1">{timeAgo(new Date(c.lastMessageAt), t)}</p>
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

function MetricCard({ icon: Icon, color, label, value, subtitle, trend }: {
  icon: any; color: string; label: string; value: string | number; subtitle?: string; trend?: 'up' | 'down' | 'flat';
}) {
  const colorMap: Record<string, string> = {
    blue: 'text-blue-600 bg-blue-50',
    green: 'text-green-600 bg-green-50',
    purple: 'text-purple-600 bg-purple-50',
    orange: 'text-orange-600 bg-orange-50',
  };

  return (
    <div className="bg-white rounded-lg border p-4">
      <div className="flex items-start justify-between">
        <div className={cn('p-2 rounded-lg', colorMap[color])}><Icon size={18} /></div>
        {trend === 'up' && <TrendingUp size={14} className="text-green-500" />}
        {trend === 'down' && <TrendingDown size={14} className="text-red-500" />}
      </div>
      <p className="text-2xl font-bold mt-3">{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
      {subtitle && (
        <p className={cn('text-[11px] mt-0.5', trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-600' : 'text-gray-400')}>
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
