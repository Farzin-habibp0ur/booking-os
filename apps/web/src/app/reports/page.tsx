'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { useI18n } from '@/lib/i18n';
import {
  Download,
  FileText,
  Loader2,
  Mail,
  Clock,
  X,
  Trash2,
  Sparkles,
  BarChart3,
  Calendar,
  ChevronDown,
  Users,
  TrendingUp,
  TrendingDown,
  MessageSquare,
  UserPlus,
} from 'lucide-react';
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
  Line,
  LineChart,
} from 'recharts';

import { statusHex } from '@/lib/design-tokens';
import { EmptyState } from '@/components/skeleton';

const PIE_COLORS = ['#8AA694', '#71907C', '#f59e0b', '#ef4444', '#9F8ECB', '#64748b'];

const STATUS_COLORS: Record<string, string> = new Proxy({} as Record<string, string>, {
  get(_, status: string) {
    return statusHex(status);
  },
});

const DAYS_SHORT = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

// ─── Date Range Presets ──────────────────────────────────────────────
interface DateRange {
  from: string;
  to: string;
  label: string;
}

function getPresetRanges(): { label: string; from: string; to: string }[] {
  const now = new Date();
  const today = now.toISOString().split('T')[0];

  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());

  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

  const quarterMonth = Math.floor(now.getMonth() / 3) * 3;
  const lastQuarterStart = new Date(now.getFullYear(), quarterMonth - 3, 1);
  const lastQuarterEnd = new Date(now.getFullYear(), quarterMonth, 0);

  return [
    { label: 'Today', from: today, to: today },
    { label: 'This Week', from: startOfWeek.toISOString().split('T')[0], to: today },
    { label: 'This Month', from: startOfMonth.toISOString().split('T')[0], to: today },
    {
      label: 'Last Month',
      from: lastMonthStart.toISOString().split('T')[0],
      to: lastMonthEnd.toISOString().split('T')[0],
    },
    {
      label: 'Last Quarter',
      from: lastQuarterStart.toISOString().split('T')[0],
      to: lastQuarterEnd.toISOString().split('T')[0],
    },
  ];
}

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

function ExportButtons({ reportType, dateParams }: { reportType: string; dateParams: string }) {
  const [exporting, setExporting] = useState<ExportFormat | null>(null);

  const handleExport = async (format: ExportFormat) => {
    setExporting(format);
    try {
      const content = await api.getText(
        `/reports/${reportType}/export?${dateParams}&format=${format}`,
      );
      const ext = format === 'pdf' ? 'html' : 'csv';
      const mime = format === 'pdf' ? 'text/html;charset=utf-8;' : 'text/csv;charset=utf-8;';
      triggerDownload(
        content,
        `${reportType}-${new Date().toISOString().split('T')[0]}.${ext}`,
        mime,
      );
    } catch {
      // silently fail
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

// ─── Date Range Picker ───────────────────────────────────────────────
function DateRangePicker({
  range,
  onChange,
}: {
  range: DateRange;
  onChange: (r: DateRange) => void;
}) {
  const [open, setOpen] = useState(false);
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const presets = useMemo(() => getPresetRanges(), []);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-sm hover:border-sage-300 transition-colors"
      >
        <Calendar size={14} className="text-slate-400" />
        <span className="font-medium">{range.label}</span>
        <ChevronDown size={14} className="text-slate-400" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1.5 z-30 bg-white rounded-xl shadow-xl border border-slate-100 w-72 p-3 animate-dropdown-open">
          <div className="space-y-1 mb-3">
            {presets.map((p) => (
              <button
                key={p.label}
                onClick={() => {
                  onChange({ ...p });
                  setOpen(false);
                }}
                className={cn(
                  'w-full text-left px-3 py-1.5 rounded-lg text-sm transition-colors',
                  range.label === p.label
                    ? 'bg-sage-50 text-sage-800 font-medium'
                    : 'hover:bg-slate-50 text-slate-600',
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="border-t border-slate-100 pt-3">
            <p className="text-xs font-medium text-slate-500 mb-2">Custom Range</p>
            <div className="flex gap-2 items-center">
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="flex-1 bg-slate-50 border-transparent rounded-lg px-2 py-1 text-xs focus:bg-white focus:ring-2 focus:ring-sage-500"
              />
              <span className="text-xs text-slate-400">to</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="flex-1 bg-slate-50 border-transparent rounded-lg px-2 py-1 text-xs focus:bg-white focus:ring-2 focus:ring-sage-500"
              />
            </div>
            <button
              onClick={() => {
                if (customFrom && customTo) {
                  onChange({ from: customFrom, to: customTo, label: 'Custom' });
                  setOpen(false);
                }
              }}
              disabled={!customFrom || !customTo}
              className="mt-2 w-full px-3 py-1.5 text-xs rounded-lg bg-sage-600 text-white font-medium disabled:opacity-50 hover:bg-sage-700 transition-colors"
            >
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Staff Filter ────────────────────────────────────────────────────
function StaffFilter({
  staffList,
  selected,
  onChange,
}: {
  staffList: { id: string; name: string }[];
  selected: string;
  onChange: (id: string) => void;
}) {
  return (
    <select
      value={selected}
      onChange={(e) => onChange(e.target.value)}
      aria-label="Filter by staff"
      className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-sm focus:ring-2 focus:ring-sage-500 focus:border-sage-300"
    >
      <option value="">All Staff</option>
      {staffList.map((s) => (
        <option key={s.id} value={s.id}>
          {s.name}
        </option>
      ))}
    </select>
  );
}

// ─── Dashboard Section Tabs ──────────────────────────────────────────
const SECTIONS = [
  { key: 'revenue', label: 'Revenue', icon: TrendingUp },
  { key: 'bookings', label: 'Bookings', icon: BarChart3 },
  { key: 'staff', label: 'Staff', icon: Users },
  { key: 'communication', label: 'Communication', icon: MessageSquare },
  { key: 'clients', label: 'Clients', icon: UserPlus },
] as const;

type SectionKey = (typeof SECTIONS)[number]['key'];

// ─── Schedule Modals (preserved from existing) ───────────────────────

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-backdrop">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6 animate-modal-enter">
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-backdrop">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 p-6 animate-modal-enter">
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

// ─── Main Page ───────────────────────────────────────────────────────

export default function ReportsPage() {
  const { t } = useI18n();
  const presets = useMemo(() => getPresetRanges(), []);
  const [dateRange, setDateRange] = useState<DateRange>(() => ({
    ...presets[2], // This Month
  }));
  const [staffFilter, setStaffFilter] = useState('');
  const [activeSection, setActiveSection] = useState<SectionKey>('revenue');
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showManageModal, setShowManageModal] = useState(false);
  const [scheduleCount, setScheduleCount] = useState(0);

  // Staff list for filter
  const [staffList, setStaffList] = useState<{ id: string; name: string }[]>([]);

  // Existing report data
  const [bookingsData, setBookingsData] = useState<any[]>([]);
  const [revenueData, setRevenueData] = useState<any[]>([]);
  const [noShowData, setNoShowData] = useState<any>(null);
  const [serviceData, setServiceData] = useState<any[]>([]);
  const [staffData, setStaffData] = useState<any[]>([]);
  const [statusData, setStatusData] = useState<any[]>([]);
  const [peakData, setPeakData] = useState<any>(null);
  const [conversionData, setConversionData] = useState<any>(null);
  const [sourceData, setSourceData] = useState<any[]>([]);

  // New report data
  const [revenueSummary, setRevenueSummary] = useState<any>(null);
  const [staffUtilization, setStaffUtilization] = useState<any[]>([]);
  const [clientMetrics, setClientMetrics] = useState<any>(null);
  const [commMetrics, setCommMetrics] = useState<any>(null);

  const dateParams = useMemo(() => {
    return `from=${dateRange.from}&to=${dateRange.to}`;
  }, [dateRange]);

  const loadScheduleCount = () => {
    api
      .get<any[]>('/reports/schedules')
      .then((s) => setScheduleCount(s.length))
      .catch(() => {});
  };

  const loadStaffList = () => {
    api
      .get<any[]>('/staff')
      .then((data) => setStaffList(data.map((s: any) => ({ id: s.id, name: s.name }))))
      .catch(() => {});
  };

  const loadAll = useCallback(() => {
    const q = dateParams + (staffFilter ? `&staffId=${staffFilter}` : '');

    api.get<any[]>(`/reports/bookings-over-time?${dateParams}`).then(setBookingsData).catch(() => {});
    api.get<any[]>(`/reports/revenue-over-time?${dateParams}`).then(setRevenueData).catch(() => {});
    api.get<any>(`/reports/no-show-rate?${dateParams}`).then(setNoShowData).catch(() => {});
    api.get<any[]>(`/reports/service-breakdown?${dateParams}`).then(setServiceData).catch(() => {});
    api.get<any[]>(`/reports/staff-performance?${dateParams}`).then(setStaffData).catch(() => {});
    api.get<any[]>(`/reports/status-breakdown?${dateParams}`).then(setStatusData).catch(() => {});
    api.get<any>(`/reports/peak-hours?${dateParams}`).then(setPeakData).catch(() => {});
    api.get<any>(`/reports/consult-conversion?${dateParams}`).then(setConversionData).catch(() => {});
    api.get<any[]>(`/reports/source-breakdown?${dateParams}`).then(setSourceData).catch(() => {});

    // New endpoints
    api.get<any>(`/reports/revenue-summary?${q}`).then(setRevenueSummary).catch(() => {});
    api.get<any[]>(`/reports/staff-utilization?${dateParams}`).then(setStaffUtilization).catch(() => {});
    api.get<any>(`/reports/client-metrics?${dateParams}`).then(setClientMetrics).catch(() => {});
    api.get<any>(`/reports/communication-metrics?${dateParams}`).then(setCommMetrics).catch(() => {});
  }, [dateParams, staffFilter]);

  useEffect(() => {
    loadAll();
    loadScheduleCount();
    loadStaffList();
  }, [loadAll]);

  const totalBookings = statusData.reduce((sum, s) => sum + s.count, 0);
  const totalRevenue = revenueData.reduce((sum, d) => sum + d.revenue, 0);

  return (
    <div className="absolute inset-0 overflow-auto">
      <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
        <ScheduleModal
          isOpen={showScheduleModal}
          onClose={() => setShowScheduleModal(false)}
          onSaved={loadScheduleCount}
        />
        <ScheduleManager isOpen={showManageModal} onClose={() => setShowManageModal(false)} />

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
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
          <div className="flex items-center gap-3 flex-wrap">
            <StaffFilter staffList={staffList} selected={staffFilter} onChange={setStaffFilter} />
            <DateRangePicker range={dateRange} onChange={setDateRange} />
            <button
              onClick={() => setShowScheduleModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium transition-colors"
            >
              <Mail size={14} />
              Schedule Email
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          <SummaryCard label={t('reports.total_bookings')} value={totalBookings} />
          <SummaryCard
            label={t('reports.revenue')}
            value={`$${Math.round(totalRevenue).toLocaleString()}`}
            change={revenueSummary?.revenueChange}
          />
          <SummaryCard
            label={t('reports.no_show_rate')}
            value={noShowData ? `${noShowData.rate}%` : '\u2014'}
            accent={noShowData?.rate > 15 ? 'red' : 'green'}
          />
          <SummaryCard
            label={t('reports.avg_response')}
            value={commMetrics ? `${commMetrics.avgResponseMinutes}m` : '\u2014'}
            accent={commMetrics?.avgResponseMinutes > 15 ? 'red' : 'green'}
          />
          <SummaryCard
            label="Consult \u2192 Treatment"
            value={conversionData ? `${conversionData.rate}%` : '\u2014'}
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
              View \u2192
            </span>
          </div>
        </Link>

        {/* Section Tabs */}
        <div className="flex gap-1.5 bg-slate-100 rounded-xl p-0.5 w-fit">
          {SECTIONS.map((s) => {
            const Icon = s.icon;
            return (
              <button
                key={s.key}
                onClick={() => setActiveSection(s.key)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm transition-colors',
                  activeSection === s.key
                    ? 'bg-white shadow-sm font-medium text-slate-900'
                    : 'text-slate-500 hover:text-slate-700',
                )}
              >
                <Icon size={14} />
                {s.label}
              </button>
            );
          })}
        </div>

        {/* ─── Revenue Section ──────────────────────────────────────────── */}
        {activeSection === 'revenue' && (
          <div className="space-y-6">
            {/* Revenue Summary Cards */}
            {revenueSummary && (
              <div className="grid grid-cols-3 gap-4">
                <SummaryCard
                  label="Total Revenue"
                  value={`$${revenueSummary.totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
                  change={revenueSummary.revenueChange}
                />
                <SummaryCard
                  label="Completed Bookings"
                  value={revenueSummary.bookingCount}
                />
                <SummaryCard
                  label="Avg. per Booking"
                  value={`$${revenueSummary.avgPerBooking.toFixed(2)}`}
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-6">
              {/* Revenue Over Time */}
              <div className="bg-white rounded-2xl shadow-soft p-4">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold">{t('reports.revenue_over_time')}</h2>
                  <ExportButtons reportType="revenue-over-time" dateParams={dateParams} />
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

              {/* Revenue by Service */}
              <div className="bg-white rounded-2xl shadow-soft p-4">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold">Revenue by Service</h2>
                  <ExportButtons reportType="service-breakdown" dateParams={dateParams} />
                </div>
                {(revenueSummary?.byService || []).length === 0 ? (
                  <EmptyState
                    icon={BarChart3}
                    title="No revenue data"
                    description="Revenue breakdown will appear once there are completed bookings."
                  />
                ) : (
                  <div className="space-y-3">
                    {(revenueSummary?.byService || []).map((s: any, i: number) => {
                      const maxRev = revenueSummary?.byService[0]?.revenue || 1;
                      return (
                        <div key={i}>
                          <div className="flex items-center justify-between text-sm mb-1">
                            <span className="font-medium">{s.name}</span>
                            <span className="text-slate-500">
                              ${Math.round(s.revenue).toLocaleString()} ({s.count})
                            </span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-2">
                            <div
                              className="h-2 rounded-full"
                              style={{
                                width: `${(s.revenue / maxRev) * 100}%`,
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
            </div>

            {/* Revenue by Staff */}
            {(revenueSummary?.byStaff || []).length > 0 && (
              <div className="bg-white rounded-2xl shadow-soft p-4">
                <h2 className="font-semibold mb-4">Revenue by Staff</h2>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={revenueSummary.byStaff}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `$${v}`} />
                    <Tooltip formatter={(v: number) => [`$${v}`, 'Revenue']} />
                    <Bar dataKey="revenue" fill="#8AA694" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}

        {/* ─── Bookings Section ─────────────────────────────────────────── */}
        {activeSection === 'bookings' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-6">
              {/* Bookings Over Time */}
              <div className="bg-white rounded-2xl shadow-soft p-4">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold">{t('reports.bookings_over_time')}</h2>
                  <ExportButtons reportType="bookings-over-time" dateParams={dateParams} />
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

              {/* Status Breakdown */}
              <div className="bg-white rounded-2xl shadow-soft p-4">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold">{t('reports.status_breakdown')}</h2>
                  <ExportButtons reportType="status-breakdown" dateParams={dateParams} />
                </div>
                {statusData.length === 0 ? (
                  <EmptyState
                    icon={BarChart3}
                    title="Not enough data"
                    description="Status breakdown will populate once you have bookings."
                  />
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

            <div className="grid grid-cols-2 gap-6">
              {/* Service Breakdown */}
              <div className="bg-white rounded-2xl shadow-soft p-4">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold">{t('reports.service_popularity')}</h2>
                  <ExportButtons reportType="service-breakdown" dateParams={dateParams} />
                </div>
                {serviceData.length === 0 ? (
                  <EmptyState
                    icon={BarChart3}
                    title="Not enough data"
                    description="Service breakdown will appear once you have bookings."
                  />
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

              {/* Source Breakdown */}
              <div className="bg-white rounded-2xl shadow-soft p-4">
                <h2 className="font-semibold mb-4">Booking Sources</h2>
                {sourceData.length === 0 ? (
                  <EmptyState
                    icon={BarChart3}
                    title="No source data"
                    description="Source breakdown will appear once you have bookings."
                  />
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={sourceData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="source" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#9F8ECB" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Peak Hours */}
            {peakData && (
              <div className="grid grid-cols-2 gap-6">
                <div className="bg-white rounded-2xl shadow-soft p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="font-semibold">{t('reports.bookings_by_hour')}</h2>
                    <ExportButtons reportType="peak-hours" dateParams={dateParams} />
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
                  <h2 className="font-semibold mb-4">{t('reports.bookings_by_day')}</h2>
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
        )}

        {/* ─── Staff Section ────────────────────────────────────────────── */}
        {activeSection === 'staff' && (
          <div className="space-y-6">
            {/* Staff Performance Table */}
            <div className="bg-white rounded-2xl shadow-soft p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold">{t('reports.staff_performance')}</h2>
                <ExportButtons reportType="staff-performance" dateParams={dateParams} />
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

            {/* Staff Utilization */}
            <div className="bg-white rounded-2xl shadow-soft p-4">
              <h2 className="font-semibold mb-4">Staff Utilization</h2>
              {staffUtilization.length === 0 ? (
                <p className="text-slate-400 text-sm py-4 text-center">No utilization data available</p>
              ) : (
                <div className="space-y-4">
                  {staffUtilization.map((s) => (
                    <div key={s.staffId}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="font-medium">{s.name}</span>
                        <span className="text-slate-500">
                          {s.bookedHours}h / {s.availableHours}h · {s.utilization}%
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-3">
                        <div
                          className={cn(
                            'h-3 rounded-full transition-all',
                            s.utilization >= 80
                              ? 'bg-sage-500'
                              : s.utilization >= 50
                                ? 'bg-amber-400'
                                : 'bg-red-400',
                          )}
                          style={{ width: `${Math.min(100, s.utilization)}%` }}
                        />
                      </div>
                      <div className="flex gap-4 mt-1 text-xs text-slate-400">
                        <span>{s.totalBookings} bookings</span>
                        <span>{s.completed} completed</span>
                        <span>{s.noShows} no-shows</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── Communication Section ────────────────────────────────────── */}
        {activeSection === 'communication' && (
          <div className="space-y-6">
            {commMetrics && (
              <div className="grid grid-cols-4 gap-4">
                <SummaryCard label="Conversations" value={commMetrics.totalConversations} />
                <SummaryCard label="Messages" value={commMetrics.totalMessages} />
                <SummaryCard
                  label="Avg. Response"
                  value={`${commMetrics.avgResponseMinutes}m`}
                  accent={commMetrics.avgResponseMinutes > 15 ? 'red' : 'green'}
                />
                <SummaryCard
                  label="SLA Compliance"
                  value={`${commMetrics.slaRate}%`}
                  accent={commMetrics.slaRate >= 90 ? 'green' : 'red'}
                  subtitle="Under 15 min"
                />
              </div>
            )}

            {/* Response Time Trend */}
            <div className="bg-white rounded-2xl shadow-soft p-4">
              <h2 className="font-semibold mb-4">Response Time Trend</h2>
              {(commMetrics?.responseTimeTrend || []).length === 0 ? (
                <EmptyState
                  icon={MessageSquare}
                  title="No response data"
                  description="Response time trends will appear once there are conversations."
                />
              ) : (
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={commMetrics.responseTimeTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(d) => d.slice(5)} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${v}m`} />
                    <Tooltip formatter={(v: number) => [`${v} min`, 'Avg Response']} />
                    <Line
                      type="monotone"
                      dataKey="avgMinutes"
                      stroke="#9F8ECB"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        )}

        {/* ─── Clients Section ──────────────────────────────────────────── */}
        {activeSection === 'clients' && (
          <div className="space-y-6">
            {clientMetrics && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <SummaryCard label="Total Customers" value={clientMetrics.totalCustomers} />
                <SummaryCard label="New Customers" value={clientMetrics.newCustomers} accent="green" />
                <SummaryCard label="Returning" value={clientMetrics.returningCustomers} />
                <SummaryCard
                  label="Retention Rate"
                  value={`${clientMetrics.retentionRate}%`}
                  accent={clientMetrics.retentionRate >= 50 ? 'green' : 'red'}
                />
              </div>
            )}

            {/* New vs Returning Chart */}
            {clientMetrics && (
              <div className="grid grid-cols-2 gap-6">
                <div className="bg-white rounded-2xl shadow-soft p-4">
                  <h2 className="font-semibold mb-4">New vs Returning</h2>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'New', value: clientMetrics.newBookingCustomers },
                          { name: 'Returning', value: clientMetrics.returningCustomers },
                        ]}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                      >
                        <Cell fill="#8AA694" />
                        <Cell fill="#9F8ECB" />
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex justify-center gap-6 mt-2">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-sm bg-[#8AA694]" />
                      <span className="text-sm">New ({clientMetrics.newBookingCustomers})</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-sm bg-[#9F8ECB]" />
                      <span className="text-sm">Returning ({clientMetrics.returningCustomers})</span>
                    </div>
                  </div>
                </div>

                {/* Top Clients */}
                <div className="bg-white rounded-2xl shadow-soft p-4">
                  <h2 className="font-semibold mb-4">Top Clients by Revenue</h2>
                  {(clientMetrics.topClients || []).length === 0 ? (
                    <EmptyState
                      icon={Users}
                      title="No client data"
                      description="Top clients will appear once there are completed bookings."
                    />
                  ) : (
                    <div className="space-y-2 max-h-[220px] overflow-y-auto">
                      {(clientMetrics.topClients || []).map((c: any, i: number) => (
                        <div
                          key={i}
                          className="flex items-center justify-between py-1.5 border-b border-slate-50 last:border-0"
                        >
                          <div>
                            <p className="text-sm font-medium">{c.name}</p>
                            <p className="text-xs text-slate-400">{c.visits} visits</p>
                          </div>
                          <p className="text-sm font-medium text-sage-700">
                            ${Math.round(c.revenue).toLocaleString()}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Consult Conversion */}
            {conversionData && (
              <div className="bg-white rounded-2xl shadow-soft p-4">
                <h2 className="font-semibold mb-4">Consult to Treatment Conversion</h2>
                <div className="flex items-center gap-8">
                  <div className="text-center">
                    <p className="text-3xl font-serif font-bold text-sage-700">
                      {conversionData.rate}%
                    </p>
                    <p className="text-xs text-slate-500 mt-1">Conversion Rate</p>
                  </div>
                  <div className="flex-1 grid grid-cols-2 gap-4">
                    <div className="bg-slate-50 rounded-xl p-3 text-center">
                      <p className="text-lg font-semibold">{conversionData.consultCustomers}</p>
                      <p className="text-xs text-slate-500">Consult Customers</p>
                    </div>
                    <div className="bg-sage-50 rounded-xl p-3 text-center">
                      <p className="text-lg font-semibold text-sage-700">{conversionData.converted}</p>
                      <p className="text-xs text-slate-500">Converted</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Summary Card ────────────────────────────────────────────────────

function SummaryCard({
  label,
  value,
  accent,
  subtitle,
  change,
}: {
  label: string;
  value: string | number;
  accent?: 'red' | 'green';
  subtitle?: string;
  change?: number;
}) {
  return (
    <div className="bg-white rounded-2xl shadow-soft p-4 animate-card-hover">
      <p className="text-xs text-slate-500">{label}</p>
      <div className="flex items-center gap-2 mt-1">
        <p
          className={cn(
            'text-2xl font-serif font-bold',
            accent === 'red' ? 'text-red-600' : accent === 'green' ? 'text-sage-600' : '',
          )}
        >
          {value}
        </p>
        {change !== undefined && change !== 0 && (
          <span
            className={cn(
              'flex items-center gap-0.5 text-xs font-medium px-1.5 py-0.5 rounded-full',
              change > 0 ? 'text-sage-700 bg-sage-50' : 'text-red-600 bg-red-50',
            )}
          >
            {change > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {Math.abs(change)}%
          </span>
        )}
      </div>
      {subtitle && <p className="text-[11px] text-slate-400 mt-0.5">{subtitle}</p>}
    </div>
  );
}
