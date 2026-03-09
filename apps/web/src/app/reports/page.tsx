'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { useI18n } from '@/lib/i18n';
import { Download, FileText, Loader2, Mail, Clock, X, Trash2, Sparkles } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

const PERIOD_OPTIONS = [
  { label: '7 days', value: 7, key: 'period_7d' },
  { label: '30 days', value: 30, key: 'period_30d' },
  { label: '90 days', value: 90, key: 'period_90d' },
];

import { statusHex } from '@/lib/design-tokens';

const PIE_COLORS = ['#8AA694', '#71907C', '#f59e0b', '#ef4444', '#9F8ECB', '#64748b'];

// Use centralized hex values from design tokens
const STATUS_COLORS: Record<string, string> = new Proxy({} as Record<string, string>, {
  get(_, status: string) {
    return statusHex(status);
  },
});

const DAYS_SHORT = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

type ExportFormat = 'csv' | 'pdf';

function triggerDownload(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function ExportButtons({ reportType, days }: { reportType: string; days: number }) {
  const [exporting, setExporting] = useState<ExportFormat | null>(null);

  const handleExport = async (format: ExportFormat) => {
    setExporting(format);
    try {
      const content = await api.getText(
        `/reports/${reportType}/export?days=${days}&format=${format}`,
      );
      const ext = format === 'pdf' ? 'html' : 'csv';
      const mime = format === 'pdf' ? 'text/html;charset=utf-8;' : 'text/csv;charset=utf-8;';
      triggerDownload(
        content,
        `${reportType}-${new Date().toISOString().split('T')[0]}.${ext}`,
        mime,
      );
    } catch {
      // silently fail — the api client handles auth errors
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="flex gap-1">
      <button
        onClick={() => handleExport('csv')}
        disabled={exporting !== null}
        className="p-1.5 rounded-lg text-slate-400 hover:text-sage-600 hover:bg-sage-50 transition-colors disabled:opacity-50"
        title="Export CSV"
      >
        {exporting === 'csv' ? (
          <Loader2 size={14} className="animate-spin" />
        ) : (
          <Download size={14} />
        )}
      </button>
      <button
        onClick={() => handleExport('pdf')}
        disabled={exporting !== null}
        className="p-1.5 rounded-lg text-slate-400 hover:text-lavender-600 hover:bg-lavender-50 transition-colors disabled:opacity-50"
        title="Export PDF"
      >
        {exporting === 'pdf' ? (
          <Loader2 size={14} className="animate-spin" />
        ) : (
          <FileText size={14} />
        )}
      </button>
    </div>
  );
}

interface ReportSchedule {
  id: string;
  reportType: string;
  frequency: string;
  recipients: string[];
  dayOfWeek?: number;
  dayOfMonth?: number;
  hour: number;
  timezone: string;
  isActive: boolean;
  lastSentAt?: string;
}

const REPORT_TYPES = [
  { value: 'bookings-over-time', label: 'Bookings Over Time' },
  { value: 'revenue-over-time', label: 'Revenue Over Time' },
  { value: 'no-show-rate', label: 'No-Show Rate' },
  { value: 'service-breakdown', label: 'Service Breakdown' },
  { value: 'staff-performance', label: 'Staff Performance' },
  { value: 'status-breakdown', label: 'Status Breakdown' },
  { value: 'peak-hours', label: 'Peak Hours' },
  { value: 'consult-conversion', label: 'Consult Conversion' },
];

const FREQUENCIES = [
  { value: 'DAILY', label: 'Daily' },
  { value: 'WEEKLY', label: 'Weekly' },
  { value: 'MONTHLY', label: 'Monthly' },
];

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function ScheduleModal({
  isOpen,
  onClose,
  onSaved,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [reportType, setReportType] = useState('bookings-over-time');
  const [frequency, setFrequency] = useState('WEEKLY');
  const [recipients, setRecipients] = useState('');
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [dayOfMonth, setDayOfMonth] = useState(1);
  const [hour, setHour] = useState(9);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const emails = recipients
        .split(',')
        .map((e) => e.trim())
        .filter(Boolean);
      await api.post('/reports/schedules', {
        reportType,
        frequency,
        recipients: emails,
        ...(frequency === 'WEEKLY' ? { dayOfWeek } : {}),
        ...(frequency === 'MONTHLY' ? { dayOfMonth } : {}),
        hour,
      });
      onSaved();
      onClose();
    } catch {
      // handled by api client
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold">Schedule Report Email</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Report</label>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
              className="w-full bg-slate-50 border-transparent rounded-xl px-3 py-2 text-sm focus:bg-white focus:ring-2 focus:ring-sage-500"
            >
              {REPORT_TYPES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Frequency</label>
            <select
              value={frequency}
              onChange={(e) => setFrequency(e.target.value)}
              className="w-full bg-slate-50 border-transparent rounded-xl px-3 py-2 text-sm focus:bg-white focus:ring-2 focus:ring-sage-500"
            >
              {FREQUENCIES.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>
          {frequency === 'WEEKLY' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Day of Week</label>
              <select
                value={dayOfWeek}
                onChange={(e) => setDayOfWeek(Number(e.target.value))}
                className="w-full bg-slate-50 border-transparent rounded-xl px-3 py-2 text-sm focus:bg-white focus:ring-2 focus:ring-sage-500"
              >
                {DAYS_OF_WEEK.map((d, i) => (
                  <option key={i} value={i}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
          )}
          {frequency === 'MONTHLY' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Day of Month</label>
              <select
                value={dayOfMonth}
                onChange={(e) => setDayOfMonth(Number(e.target.value))}
                className="w-full bg-slate-50 border-transparent rounded-xl px-3 py-2 text-sm focus:bg-white focus:ring-2 focus:ring-sage-500"
              >
                {Array.from({ length: 28 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {i + 1}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Send at (UTC hour)
            </label>
            <select
              value={hour}
              onChange={(e) => setHour(Number(e.target.value))}
              className="w-full bg-slate-50 border-transparent rounded-xl px-3 py-2 text-sm focus:bg-white focus:ring-2 focus:ring-sage-500"
            >
              {Array.from({ length: 24 }, (_, i) => (
                <option key={i} value={i}>
                  {String(i).padStart(2, '0')}:00 UTC
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Recipients (comma-separated emails)
            </label>
            <input
              type="text"
              value={recipients}
              onChange={(e) => setRecipients(e.target.value)}
              placeholder="admin@clinic.com, manager@clinic.com"
              className="w-full bg-slate-50 border-transparent rounded-xl px-3 py-2 text-sm focus:bg-white focus:ring-2 focus:ring-sage-500"
              required
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm rounded-xl text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !recipients.trim()}
              className="px-4 py-2 text-sm rounded-xl bg-sage-600 hover:bg-sage-700 text-white font-medium transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Create Schedule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ScheduleManager({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [schedules, setSchedules] = useState<ReportSchedule[]>([]);
  const [loading, setLoading] = useState(true);

  const loadSchedules = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<ReportSchedule[]>('/reports/schedules');
      setSchedules(data);
    } catch {
      // handled
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) loadSchedules();
  }, [isOpen, loadSchedules]);

  const toggleActive = async (id: string, isActive: boolean) => {
    await api.patch(`/reports/schedules/${id}`, { isActive: !isActive });
    loadSchedules();
  };

  const deleteSchedule = async (id: string) => {
    await api.del(`/reports/schedules/${id}`);
    loadSchedules();
  };

  if (!isOpen) return null;

  const reportLabel = (type: string) => REPORT_TYPES.find((r) => r.value === type)?.label ?? type;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold">Manage Scheduled Reports</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="animate-spin text-slate-400" size={24} />
          </div>
        ) : schedules.length === 0 ? (
          <p className="text-slate-400 text-sm py-8 text-center">
            No scheduled reports yet. Create one using the Schedule Email button.
          </p>
        ) : (
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {schedules.map((s) => (
              <div
                key={s.id}
                className={cn(
                  'p-3 rounded-xl border flex items-center justify-between',
                  s.isActive
                    ? 'bg-sage-50/50 border-sage-100'
                    : 'bg-slate-50 border-slate-100 opacity-60',
                )}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{reportLabel(s.reportType)}</p>
                  <p className="text-xs text-slate-500">
                    {s.frequency} · {String(s.hour).padStart(2, '0')}:00 UTC · {s.recipients.length}{' '}
                    recipient{s.recipients.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2 ml-3">
                  <button
                    onClick={() => toggleActive(s.id, s.isActive)}
                    className={cn(
                      'text-xs px-2 py-1 rounded-lg font-medium transition-colors',
                      s.isActive
                        ? 'bg-sage-100 text-sage-700 hover:bg-sage-200'
                        : 'bg-slate-200 text-slate-600 hover:bg-slate-300',
                    )}
                  >
                    {s.isActive ? 'Active' : 'Paused'}
                  </button>
                  <button
                    onClick={() => deleteSchedule(s.id)}
                    className="p-1 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="flex justify-end mt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-xl text-slate-600 hover:bg-slate-100 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ReportsPage() {
  const { t } = useI18n();
  const [days, setDays] = useState(30);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showManageModal, setShowManageModal] = useState(false);
  const [scheduleCount, setScheduleCount] = useState(0);
  const [bookingsData, setBookingsData] = useState<any[]>([]);
  const [revenueData, setRevenueData] = useState<any[]>([]);
  const [noShowData, setNoShowData] = useState<any>(null);
  const [responseData, setResponseData] = useState<any>(null);
  const [serviceData, setServiceData] = useState<any[]>([]);
  const [staffData, setStaffData] = useState<any[]>([]);
  const [statusData, setStatusData] = useState<any[]>([]);
  const [peakData, setPeakData] = useState<any>(null);
  const [conversionData, setConversionData] = useState<any>(null);

  const loadScheduleCount = () => {
    api
      .get<any[]>('/reports/schedules')
      .then((s) => setScheduleCount(s.length))
      .catch(() => {});
  };

  const loadAll = (period: number) => {
    api.get<any[]>(`/reports/bookings-over-time?days=${period}`).then(setBookingsData);
    api.get<any[]>(`/reports/revenue-over-time?days=${period}`).then(setRevenueData);
    api.get<any>(`/reports/no-show-rate?days=${period}`).then(setNoShowData);
    api.get<any>('/reports/response-times').then(setResponseData);
    api.get<any[]>(`/reports/service-breakdown?days=${period}`).then(setServiceData);
    api.get<any[]>(`/reports/staff-performance?days=${period}`).then(setStaffData);
    api.get<any[]>(`/reports/status-breakdown?days=${period}`).then(setStatusData);
    api.get<any>(`/reports/peak-hours?days=${period}`).then(setPeakData);
    api.get<any>(`/reports/consult-conversion?days=${period}`).then(setConversionData);
  };

  useEffect(() => {
    loadAll(days);
    loadScheduleCount();
  }, [days]);

  const totalBookings = statusData.reduce((sum, s) => sum + s.count, 0);
  const totalRevenue = revenueData.reduce((sum, d) => sum + d.revenue, 0);

  return (
    <div className="p-6 space-y-6">
      <ScheduleModal
        isOpen={showScheduleModal}
        onClose={() => setShowScheduleModal(false)}
        onSaved={loadScheduleCount}
      />
      <ScheduleManager isOpen={showManageModal} onClose={() => setShowManageModal(false)} />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-serif font-semibold text-slate-900">{t('reports.title')}</h1>
          {scheduleCount > 0 && (
            <button
              onClick={() => setShowManageModal(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-sage-50 text-sage-700 text-xs font-medium hover:bg-sage-100 transition-colors"
            >
              <Clock size={12} />
              {scheduleCount} Scheduled
            </button>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowScheduleModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium transition-colors"
          >
            <Mail size={14} />
            Schedule Email
          </button>
          <div className="flex gap-1 bg-slate-100 rounded-xl p-0.5">
            {PERIOD_OPTIONS.map((p) => (
              <button
                key={p.value}
                onClick={() => setDays(p.value)}
                className={cn(
                  'px-3 py-1.5 rounded-xl text-sm transition-colors',
                  days === p.value
                    ? 'bg-white shadow-sm font-medium'
                    : 'text-slate-500 hover:text-slate-700',
                )}
              >
                {t(`reports.${p.key}`)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-5 gap-4">
        <SummaryCard label={t('reports.total_bookings')} value={totalBookings} />
        <SummaryCard
          label={t('reports.revenue')}
          value={`$${Math.round(totalRevenue).toLocaleString()}`}
        />
        <SummaryCard
          label={t('reports.no_show_rate')}
          value={noShowData ? `${noShowData.rate}%` : '—'}
          accent={noShowData?.rate > 15 ? 'red' : 'green'}
        />
        <SummaryCard
          label={t('reports.avg_response')}
          value={responseData ? `${responseData.avgMinutes}m` : '—'}
          accent={responseData?.avgMinutes > 15 ? 'red' : 'green'}
        />
        <SummaryCard
          label="Consult → Treatment"
          value={conversionData ? `${conversionData.rate}%` : '—'}
          accent={
            conversionData?.rate >= 50 ? 'green' : conversionData?.rate > 0 ? 'red' : undefined
          }
          subtitle={
            conversionData
              ? `${conversionData.converted}/${conversionData.consultCustomers}`
              : undefined
          }
        />
      </div>

      {/* Monthly Review Link */}
      <Link
        href="/reports/monthly-review"
        className="block bg-lavender-50 border border-lavender-100 rounded-2xl p-4 hover:border-lavender-200 transition-colors group"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Sparkles size={18} className="text-lavender-600" />
            <div>
              <p className="font-medium text-lavender-700">Monthly Business Review</p>
              <p className="text-xs text-lavender-500">
                AI-powered performance summary and recommendations
              </p>
            </div>
          </div>
          <span className="text-sm text-lavender-500 group-hover:text-lavender-700 transition-colors">
            View →
          </span>
        </div>
      </Link>

      {/* Row 1: Bookings Over Time + Revenue */}
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl shadow-soft p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">{t('reports.bookings_over_time')}</h2>
            <ExportButtons reportType="bookings-over-time" days={days} />
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={bookingsData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(d) => d.slice(5)} />
              <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
              <Tooltip />
              <Area
                type="monotone"
                dataKey="count"
                stroke="#8AA694"
                fill="#8AA694"
                fillOpacity={0.1}
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-2xl shadow-soft p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">{t('reports.revenue_over_time')}</h2>
            <ExportButtons reportType="revenue-over-time" days={days} />
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={revenueData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(d) => d.slice(5)} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `$${v}`} />
              <Tooltip formatter={(v: number) => [`$${v}`, t('reports.revenue')]} />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#71907C"
                fill="#71907C"
                fillOpacity={0.1}
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Row 2: Service Breakdown + Status Breakdown */}
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl shadow-soft p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">{t('reports.service_popularity')}</h2>
            <ExportButtons reportType="service-breakdown" days={days} />
          </div>
          {serviceData.length === 0 ? (
            <p className="text-slate-400 text-sm py-8 text-center">
              Not enough data yet. Reports will populate after your first week of bookings.
            </p>
          ) : (
            <div className="space-y-3">
              {serviceData.map((s, i) => {
                const maxCount = serviceData[0]?.count || 1;
                return (
                  <div key={i}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="font-medium">{s.name}</span>
                      <span className="text-slate-500">
                        {s.count} bookings · ${Math.round(s.revenue)}
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2">
                      <div
                        className="h-2 rounded-full"
                        style={{
                          width: `${(s.count / maxCount) * 100}%`,
                          backgroundColor: PIE_COLORS[i % PIE_COLORS.length],
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-soft p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">{t('reports.status_breakdown')}</h2>
            <ExportButtons reportType="status-breakdown" days={days} />
          </div>
          {statusData.length === 0 ? (
            <p className="text-slate-400 text-sm py-8 text-center">
              Not enough data yet. Reports will populate after your first week of bookings.
            </p>
          ) : (
            <div className="flex items-center gap-6">
              <ResponsiveContainer width={160} height={160}>
                <PieChart>
                  <Pie
                    data={statusData}
                    dataKey="count"
                    nameKey="status"
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={70}
                  >
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
                      <div
                        className="w-3 h-3 rounded-sm"
                        style={{ backgroundColor: STATUS_COLORS[s.status] || '#6b7280' }}
                      />
                      <span className="text-sm">{t(`status.${s.status.toLowerCase()}`)}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-medium">{s.count}</span>
                      <span className="text-xs text-slate-400 ml-1">
                        ({totalBookings > 0 ? Math.round((s.count / totalBookings) * 100) : 0}%)
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Row 3: Staff Performance */}
      <div className="bg-white rounded-2xl shadow-soft p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">{t('reports.staff_performance')}</h2>
          <ExportButtons reportType="staff-performance" days={days} />
        </div>
        {staffData.length === 0 ? (
          <p className="text-slate-400 text-sm py-4 text-center">{t('reports.no_staff_data')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2 text-xs font-medium text-slate-500 uppercase">
                    {t('nav.staff')}
                  </th>
                  <th className="text-right p-2 text-xs font-medium text-slate-500 uppercase">
                    {t('reports.total_bookings_col')}
                  </th>
                  <th className="text-right p-2 text-xs font-medium text-slate-500 uppercase">
                    {t('reports.completed_col')}
                  </th>
                  <th className="text-right p-2 text-xs font-medium text-slate-500 uppercase">
                    {t('reports.no_shows_col')}
                  </th>
                  <th className="text-right p-2 text-xs font-medium text-slate-500 uppercase">
                    {t('reports.no_show_rate_col')}
                  </th>
                  <th className="text-right p-2 text-xs font-medium text-slate-500 uppercase">
                    {t('reports.revenue_col')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {staffData.map((s) => (
                  <tr key={s.staffId} className="hover:bg-slate-50">
                    <td className="p-2 text-sm font-medium">{s.name}</td>
                    <td className="p-2 text-sm text-right">{s.total}</td>
                    <td className="p-2 text-sm text-right text-sage-600">{s.completed}</td>
                    <td className="p-2 text-sm text-right text-red-600">{s.noShows}</td>
                    <td className="p-2 text-sm text-right">
                      <span
                        className={cn(
                          'px-2 py-0.5 rounded-full text-xs',
                          s.noShowRate > 15
                            ? 'bg-red-100 text-red-700'
                            : 'bg-sage-100 text-sage-700',
                        )}
                      >
                        {s.noShowRate}%
                      </span>
                    </td>
                    <td className="p-2 text-sm text-right font-medium">
                      ${Math.round(s.revenue).toLocaleString()}
                    </td>
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
          <div className="bg-white rounded-2xl shadow-soft p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">{t('reports.bookings_by_hour')}</h2>
              <ExportButtons reportType="peak-hours" days={days} />
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart
                data={(peakData.byHour || []).filter((h: any) => h.hour >= 7 && h.hour <= 20)}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="hour" tick={{ fontSize: 10 }} tickFormatter={(h) => `${h}:00`} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip labelFormatter={(h) => `${h}:00`} />
                <Bar dataKey="count" fill="#9F8ECB" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-2xl shadow-soft p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">{t('reports.bookings_by_day')}</h2>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart
                data={(peakData.byDay || []).map((d: any) => ({
                  ...d,
                  name: t(`days_short.${DAYS_SHORT[d.day]}`),
                }))}
              >
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

function SummaryCard({
  label,
  value,
  accent,
  subtitle,
}: {
  label: string;
  value: string | number;
  accent?: 'red' | 'green';
  subtitle?: string;
}) {
  return (
    <div className="bg-white rounded-2xl shadow-soft p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p
        className={cn(
          'text-2xl font-serif font-bold mt-1',
          accent === 'red' ? 'text-red-600' : accent === 'green' ? 'text-sage-600' : '',
        )}
      >
        {value}
      </p>
      {subtitle && <p className="text-[11px] text-slate-400 mt-0.5">{subtitle}</p>}
    </div>
  );
}
