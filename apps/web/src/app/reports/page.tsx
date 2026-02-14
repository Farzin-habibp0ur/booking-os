'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { useI18n } from '@/lib/i18n';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, PieChart, Pie, Cell,
} from 'recharts';

const PERIOD_OPTIONS = [
  { label: '7 days', value: 7, key: 'period_7d' },
  { label: '30 days', value: 30, key: 'period_30d' },
  { label: '90 days', value: 90, key: 'period_90d' },
];

const PIE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#6b7280'];

const STATUS_COLORS: Record<string, string> = {
  PENDING: '#f59e0b',
  CONFIRMED: '#3b82f6',
  IN_PROGRESS: '#8b5cf6',
  COMPLETED: '#10b981',
  NO_SHOW: '#ef4444',
  CANCELLED: '#6b7280',
};

const DAYS_SHORT = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

export default function ReportsPage() {
  const { t } = useI18n();
  const [days, setDays] = useState(30);
  const [bookingsData, setBookingsData] = useState<any[]>([]);
  const [revenueData, setRevenueData] = useState<any[]>([]);
  const [noShowData, setNoShowData] = useState<any>(null);
  const [responseData, setResponseData] = useState<any>(null);
  const [serviceData, setServiceData] = useState<any[]>([]);
  const [staffData, setStaffData] = useState<any[]>([]);
  const [statusData, setStatusData] = useState<any[]>([]);
  const [peakData, setPeakData] = useState<any>(null);

  const loadAll = (period: number) => {
    api.get<any[]>(`/reports/bookings-over-time?days=${period}`).then(setBookingsData);
    api.get<any[]>(`/reports/revenue-over-time?days=${period}`).then(setRevenueData);
    api.get<any>(`/reports/no-show-rate?days=${period}`).then(setNoShowData);
    api.get<any>('/reports/response-times').then(setResponseData);
    api.get<any[]>(`/reports/service-breakdown?days=${period}`).then(setServiceData);
    api.get<any[]>(`/reports/staff-performance?days=${period}`).then(setStaffData);
    api.get<any[]>(`/reports/status-breakdown?days=${period}`).then(setStatusData);
    api.get<any>(`/reports/peak-hours?days=${period}`).then(setPeakData);
  };

  useEffect(() => { loadAll(days); }, [days]);

  const totalBookings = statusData.reduce((sum, s) => sum + s.count, 0);
  const totalRevenue = revenueData.reduce((sum, d) => sum + d.revenue, 0);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('reports.title')}</h1>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
          {PERIOD_OPTIONS.map((p) => (
            <button
              key={p.value}
              onClick={() => setDays(p.value)}
              className={cn('px-3 py-1.5 rounded-md text-sm transition-colors',
                days === p.value ? 'bg-white shadow-sm font-medium' : 'text-gray-500 hover:text-gray-700')}
            >
              {t(`reports.${p.key}`)}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <SummaryCard label={t('reports.total_bookings')} value={totalBookings} />
        <SummaryCard label={t('reports.revenue')} value={`$${Math.round(totalRevenue).toLocaleString()}`} />
        <SummaryCard label={t('reports.no_show_rate')} value={noShowData ? `${noShowData.rate}%` : '—'} accent={noShowData?.rate > 15 ? 'red' : 'green'} />
        <SummaryCard label={t('reports.avg_response')} value={responseData ? `${responseData.avgMinutes}m` : '—'} accent={responseData?.avgMinutes > 15 ? 'red' : 'green'} />
      </div>

      {/* Row 1: Bookings Over Time + Revenue */}
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white border rounded-lg p-4">
          <h2 className="font-semibold mb-4">{t('reports.bookings_over_time')}</h2>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={bookingsData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(d) => d.slice(5)} />
              <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
              <Tooltip />
              <Area type="monotone" dataKey="count" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.1} strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white border rounded-lg p-4">
          <h2 className="font-semibold mb-4">{t('reports.revenue_over_time')}</h2>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={revenueData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(d) => d.slice(5)} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `$${v}`} />
              <Tooltip formatter={(v: number) => [`$${v}`, t('reports.revenue')]} />
              <Area type="monotone" dataKey="revenue" stroke="#10b981" fill="#10b981" fillOpacity={0.1} strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Row 2: Service Breakdown + Status Breakdown */}
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white border rounded-lg p-4">
          <h2 className="font-semibold mb-4">{t('reports.service_popularity')}</h2>
          {serviceData.length === 0 ? (
            <p className="text-gray-400 text-sm py-8 text-center">{t('reports.no_data')}</p>
          ) : (
            <div className="space-y-3">
              {serviceData.map((s, i) => {
                const maxCount = serviceData[0]?.count || 1;
                return (
                  <div key={i}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="font-medium">{s.name}</span>
                      <span className="text-gray-500">{s.count} bookings · ${Math.round(s.revenue)}</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div className="h-2 rounded-full" style={{ width: `${(s.count / maxCount) * 100}%`, backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-white border rounded-lg p-4">
          <h2 className="font-semibold mb-4">{t('reports.status_breakdown')}</h2>
          {statusData.length === 0 ? (
            <p className="text-gray-400 text-sm py-8 text-center">{t('reports.no_data')}</p>
          ) : (
            <div className="flex items-center gap-6">
              <ResponsiveContainer width={160} height={160}>
                <PieChart>
                  <Pie data={statusData} dataKey="count" nameKey="status" cx="50%" cy="50%" innerRadius={40} outerRadius={70}>
                    {statusData.map((s, i) => (
                      <Cell key={s.status} fill={STATUS_COLORS[s.status] || PIE_COLORS[i]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 flex-1">
                {statusData.map((s) => (
                  <div key={s.status} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: STATUS_COLORS[s.status] || '#6b7280' }} />
                      <span className="text-sm">{t(`status.${s.status.toLowerCase()}`)}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-medium">{s.count}</span>
                      <span className="text-xs text-gray-400 ml-1">({totalBookings > 0 ? Math.round((s.count / totalBookings) * 100) : 0}%)</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Row 3: Staff Performance */}
      <div className="bg-white border rounded-lg p-4">
        <h2 className="font-semibold mb-4">{t('reports.staff_performance')}</h2>
        {staffData.length === 0 ? (
          <p className="text-gray-400 text-sm py-4 text-center">{t('reports.no_staff_data')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2 text-xs font-medium text-gray-500 uppercase">{t('nav.staff')}</th>
                  <th className="text-right p-2 text-xs font-medium text-gray-500 uppercase">{t('reports.total_bookings_col')}</th>
                  <th className="text-right p-2 text-xs font-medium text-gray-500 uppercase">{t('reports.completed_col')}</th>
                  <th className="text-right p-2 text-xs font-medium text-gray-500 uppercase">{t('reports.no_shows_col')}</th>
                  <th className="text-right p-2 text-xs font-medium text-gray-500 uppercase">{t('reports.no_show_rate_col')}</th>
                  <th className="text-right p-2 text-xs font-medium text-gray-500 uppercase">{t('reports.revenue_col')}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {staffData.map((s) => (
                  <tr key={s.staffId} className="hover:bg-gray-50">
                    <td className="p-2 text-sm font-medium">{s.name}</td>
                    <td className="p-2 text-sm text-right">{s.total}</td>
                    <td className="p-2 text-sm text-right text-green-600">{s.completed}</td>
                    <td className="p-2 text-sm text-right text-red-600">{s.noShows}</td>
                    <td className="p-2 text-sm text-right">
                      <span className={cn('px-2 py-0.5 rounded-full text-xs', s.noShowRate > 15 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700')}>
                        {s.noShowRate}%
                      </span>
                    </td>
                    <td className="p-2 text-sm text-right font-medium">${Math.round(s.revenue).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Row 4: Peak Hours */}
      {peakData && (
        <div className="grid grid-cols-2 gap-6">
          <div className="bg-white border rounded-lg p-4">
            <h2 className="font-semibold mb-4">{t('reports.bookings_by_hour')}</h2>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={(peakData.byHour || []).filter((h: any) => h.hour >= 7 && h.hour <= 20)}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="hour" tick={{ fontSize: 10 }} tickFormatter={(h) => `${h}:00`} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip labelFormatter={(h) => `${h}:00`} />
                <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white border rounded-lg p-4">
            <h2 className="font-semibold mb-4">{t('reports.bookings_by_day')}</h2>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={(peakData.byDay || []).map((d: any) => ({ ...d, name: t(`days_short.${DAYS_SHORT[d.day]}`) }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value, accent }: { label: string; value: string | number; accent?: 'red' | 'green' }) {
  return (
    <div className="bg-white border rounded-lg p-4">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={cn('text-2xl font-bold mt-1', accent === 'red' ? 'text-red-600' : accent === 'green' ? 'text-green-600' : '')}>
        {value}
      </p>
    </div>
  );
}
