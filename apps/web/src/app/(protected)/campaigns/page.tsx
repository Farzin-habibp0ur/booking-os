'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { useI18n } from '@/lib/i18n';
import { Megaphone, Plus, Repeat, Copy, ChevronLeft, ChevronRight } from 'lucide-react';
import { useToast } from '@/lib/toast';
import { TableRowSkeleton, EmptyState } from '@/components/skeleton';
import TooltipNudge from '@/components/tooltip-nudge';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

const statusColors: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-600',
  SCHEDULED: 'bg-lavender-100 text-lavender-700',
  SENDING: 'bg-amber-100 text-amber-700',
  SENT: 'bg-sage-100 text-sage-700',
  CANCELLED: 'bg-red-100 text-red-700',
};

const RECURRENCE_KEYS: Record<string, string> = {
  DAILY: 'campaigns.recurrence.daily',
  WEEKLY: 'campaigns.recurrence.weekly',
  BIWEEKLY: 'campaigns.recurrence.biweekly',
  MONTHLY: 'campaigns.recurrence.monthly',
};

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<any>({ data: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'table' | 'performance' | 'calendar'>('table');
  const [performanceData, setPerformanceData] = useState<any[]>([]);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const router = useRouter();
  const { toast } = useToast();
  const { t } = useI18n();

  const handleClone = async (e: React.MouseEvent, campaignId: string) => {
    e.stopPropagation();
    try {
      const cloned = await api.post<any>(`/campaigns/${campaignId}/clone`);
      toast(t('campaigns.clone_success'));
      router.push(`/campaigns/${cloned.id}`);
    } catch {
      toast(t('campaigns.clone_error'), 'error');
    }
  };

  useEffect(() => {
    api
      .get<any>('/campaigns?pageSize=50')
      .then(setCampaigns)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (view === 'performance' && performanceData.length === 0) {
      api
        .get<any[]>('/campaigns/performance')
        .then((data) => setPerformanceData(Array.isArray(data) ? data : []))
        .catch(() => {});
    }
  }, [view]);

  return (
    <div className="p-6" data-tour-target="campaigns-list">
      <TooltipNudge
        id="campaigns-intro"
        title="Reach customers at scale"
        description="Create targeted campaigns to re-engage inactive customers, promote offers, or send seasonal messages. Filter by tags, booking history, and more."
      />
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
        <h1 className="text-2xl font-serif font-semibold text-slate-900">{t('campaigns.title')}</h1>
        <button
          onClick={() => router.push('/campaigns/new')}
          className="flex items-center gap-2 px-4 py-2 bg-sage-600 text-white rounded-xl text-sm hover:bg-sage-700 transition-colors"
        >
          <Plus size={16} />
          {t('campaigns.new_campaign')}
        </button>
      </div>

      <div className="flex items-center gap-1 mb-4">
        <button
          onClick={() => setView('table')}
          className={cn(
            'px-3 py-1.5 text-sm rounded-lg transition-colors',
            view === 'table' ? 'bg-sage-600 text-white' : 'text-slate-500 hover:bg-slate-100',
          )}
        >
          {t('campaigns.view_table')}
        </button>
        <button
          onClick={() => setView('performance')}
          className={cn(
            'px-3 py-1.5 text-sm rounded-lg transition-colors',
            view === 'performance' ? 'bg-sage-600 text-white' : 'text-slate-500 hover:bg-slate-100',
          )}
        >
          {t('campaigns.view_performance')}
        </button>
        <button
          onClick={() => setView('calendar')}
          className={cn(
            'px-3 py-1.5 text-sm rounded-lg transition-colors',
            view === 'calendar' ? 'bg-sage-600 text-white' : 'text-slate-500 hover:bg-slate-100',
          )}
        >
          {t('campaigns.view_calendar')}
        </button>
      </div>

      {view === 'performance' ? (
        <div className="bg-white rounded-2xl shadow-soft p-5">
          <h2 className="text-sm font-semibold text-slate-900 mb-4">
            {t('campaigns.view_performance')}
          </h2>
          {performanceData.length > 0 ? (
            <ResponsiveContainer width="100%" height={Math.max(200, performanceData.length * 40)}>
              <BarChart data={performanceData} layout="vertical" margin={{ left: 120 }}>
                <XAxis type="number" tickFormatter={(v) => `$${v}`} />
                <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value: number) => [`$${value.toLocaleString()}`, 'Revenue']} />
                <Bar dataKey="revenue" fill="#8AA694" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-slate-400 text-center py-8">No performance data yet</p>
          )}
        </div>
      ) : view === 'calendar' ? (
        <CampaignCalendar
          campaigns={campaigns.data}
          month={calendarMonth}
          onMonthChange={setCalendarMonth}
          onSelect={(id: string) => router.push(`/campaigns/${id}`)}
          t={t}
        />
      ) : (
        <div className="bg-white rounded-2xl shadow-soft overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="text-left p-3 text-xs font-medium text-slate-500 uppercase">
                    {t('campaigns.table.name')}
                  </th>
                  <th className="text-left p-3 text-xs font-medium text-slate-500 uppercase">
                    {t('campaigns.table.status')}
                  </th>
                  <th className="text-left p-3 text-xs font-medium text-slate-500 uppercase">
                    {t('campaigns.table.scheduled')}
                  </th>
                  <th className="text-left p-3 text-xs font-medium text-slate-500 uppercase">
                    {t('campaigns.table.sent')}
                  </th>
                  <th className="text-left p-3 text-xs font-medium text-slate-500 uppercase">
                    {t('campaigns.table.created')}
                  </th>
                  <th className="p-3 text-xs font-medium text-slate-500 uppercase w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {loading
                  ? Array.from({ length: 3 }).map((_, i) => <TableRowSkeleton key={i} cols={5} />)
                  : campaigns.data.map((c: any) => (
                      <tr
                        key={c.id}
                        className="hover:bg-slate-50 cursor-pointer"
                        onClick={() => router.push(`/campaigns/${c.id}`)}
                      >
                        <td className="p-3 text-sm font-medium">
                          <span className="flex items-center gap-1.5">
                            {c.name}
                            {c.recurrenceRule && c.recurrenceRule !== 'NONE' && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-lavender-50 text-lavender-700 text-[10px] rounded-full font-medium">
                                <Repeat size={10} />
                                {t(RECURRENCE_KEYS[c.recurrenceRule]) || c.recurrenceRule}
                              </span>
                            )}
                          </span>
                        </td>
                        <td className="p-3">
                          <span
                            className={cn(
                              'text-xs px-2 py-0.5 rounded-full',
                              statusColors[c.status] || 'bg-slate-100',
                            )}
                          >
                            {c.status}
                          </span>
                          {c.status === 'SCHEDULED' && c.scheduledAt && (
                            <span className="text-xs text-slate-400 block mt-0.5">
                              {new Date(c.scheduledAt).toLocaleDateString('en-US', {
                                weekday: 'short',
                                month: 'short',
                                day: 'numeric',
                                hour: 'numeric',
                                minute: '2-digit',
                              })}
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-sm text-slate-600">
                          {c.scheduledAt
                            ? new Date(c.scheduledAt).toLocaleString('en-US', {
                                dateStyle: 'medium',
                                timeStyle: 'short',
                              })
                            : '—'}
                        </td>
                        <td className="p-3 text-sm text-slate-600">
                          {c.sentAt
                            ? new Date(c.sentAt).toLocaleString('en-US', {
                                dateStyle: 'medium',
                                timeStyle: 'short',
                              })
                            : '—'}
                        </td>
                        <td className="p-3 text-sm text-slate-600">
                          {new Date(c.createdAt).toLocaleDateString('en-US', {
                            dateStyle: 'medium',
                          })}
                        </td>
                        <td className="p-3">
                          <button
                            onClick={(e) => handleClone(e, c.id)}
                            title={t('campaigns.clone')}
                            className="p-1.5 text-slate-400 hover:text-sage-600 transition-colors rounded-lg hover:bg-sage-50"
                          >
                            <Copy size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
          {!loading && campaigns.data.length === 0 && (
            <EmptyState
              icon={Megaphone}
              title={t('campaigns.no_campaigns')}
              description={t('campaigns.no_campaigns_desc')}
              action={{
                label: t('campaigns.create'),
                onClick: () => router.push('/campaigns/new'),
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}

const STATUS_DOT_COLORS: Record<string, string> = {
  DRAFT: 'bg-slate-400',
  SCHEDULED: 'bg-lavender-500',
  SENDING: 'bg-amber-500',
  SENT: 'bg-sage-500',
  CANCELLED: 'bg-red-500',
};

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function CampaignCalendar({
  campaigns,
  month,
  onMonthChange,
  onSelect,
  t,
}: {
  campaigns: any[];
  month: Date;
  onMonthChange: (d: Date) => void;
  onSelect: (id: string) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  const year = month.getFullYear();
  const mo = month.getMonth();
  const firstDay = new Date(year, mo, 1).getDay();
  const daysInMonth = new Date(year, mo + 1, 0).getDate();
  const today = new Date();
  const isToday = (day: number) =>
    today.getFullYear() === year && today.getMonth() === mo && today.getDate() === day;

  // Map campaigns to dates
  const campaignsByDay = new Map<number, any[]>();
  for (const c of campaigns) {
    const dateStr = c.scheduledAt || c.sentAt || c.createdAt;
    if (!dateStr) continue;
    const d = new Date(dateStr);
    if (d.getFullYear() === year && d.getMonth() === mo) {
      const day = d.getDate();
      const list = campaignsByDay.get(day) || [];
      list.push(c);
      campaignsByDay.set(day, list);
    }
  }

  const prevMonth = () => onMonthChange(new Date(year, mo - 1, 1));
  const nextMonth = () => onMonthChange(new Date(year, mo + 1, 1));

  // Build grid cells
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div
      className="bg-white rounded-2xl shadow-soft overflow-hidden"
      data-testid="campaign-calendar"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
        <button
          onClick={prevMonth}
          className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
        >
          <ChevronLeft size={16} />
        </button>
        <h2 className="text-sm font-semibold text-slate-900">
          {month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </h2>
        <button
          onClick={nextMonth}
          className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Day names */}
      <div className="grid grid-cols-7 border-b border-slate-100">
        {DAY_NAMES.map((d) => (
          <div
            key={d}
            className="text-center text-[10px] font-medium text-slate-400 uppercase py-2"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7">
        {cells.map((day, i) => {
          const isWeekend = i % 7 === 0 || i % 7 === 6;
          const dayCampaigns = day ? campaignsByDay.get(day) || [] : [];
          const visible = dayCampaigns.slice(0, 2);
          const overflow = dayCampaigns.length - 2;

          return (
            <div
              key={i}
              className={cn(
                'min-h-24 border-r border-b border-slate-100 p-1.5',
                isWeekend && 'bg-slate-50/50',
                day && isToday(day) && 'ring-2 ring-inset ring-sage-500 rounded',
              )}
            >
              {day && (
                <>
                  <p
                    className={cn(
                      'text-xs mb-1',
                      isToday(day) ? 'font-bold text-sage-700' : 'text-slate-500',
                    )}
                  >
                    {day}
                  </p>
                  <div className="space-y-0.5">
                    {visible.map((c: any) => (
                      <button
                        key={c.id}
                        onClick={() => onSelect(c.id)}
                        className="flex items-center gap-1 w-full text-left text-[10px] px-1.5 py-0.5 rounded-md truncate hover:shadow-sm transition cursor-pointer bg-slate-50 hover:bg-slate-100"
                      >
                        <span
                          className={cn(
                            'w-1.5 h-1.5 rounded-full shrink-0',
                            STATUS_DOT_COLORS[c.status] || 'bg-slate-400',
                          )}
                        />
                        <span className="truncate">{c.name}</span>
                      </button>
                    ))}
                    {overflow > 0 && (
                      <p className="text-[9px] text-slate-400 px-1.5">
                        {t('campaigns.calendar_more', { count: overflow })}
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
