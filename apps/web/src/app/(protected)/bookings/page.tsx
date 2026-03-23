'use client';

import { Suspense, useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { usePack } from '@/lib/vertical-pack';
import { useI18n } from '@/lib/i18n';
import { useToast } from '@/lib/toast';
import { useListNavigation, useKeyboardShortcut } from '@/lib/use-keyboard-shortcut';
import { TableRowSkeleton, EmptyState } from '@/components/skeleton';
import {
  BookOpen,
  Download,
  Search,
  ChevronUp,
  ChevronDown,
  Filter,
  X,
  Calendar,
  Printer,
} from 'lucide-react';
import BookingDetailModal from '@/components/booking-detail-modal';
import BookingFormModal from '@/components/booking-form-modal';
import BulkActionBar from '@/components/bulk-action-bar';
import ExportModal from '@/components/export-modal';
import { ViewPicker } from '@/components/saved-views';
import { statusBadgeClasses, BOOKING_COLOR_LABELS } from '@/lib/design-tokens';
import { UpgradeNudge } from '@/components/upgrade-nudge';
import { FeatureDiscovery } from '@/components/feature-discovery';
import { usePlan } from '@/lib/use-plan';

const BOOKING_STATUSES = [
  'PENDING',
  'CONFIRMED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
  'NO_SHOW',
  'RESCHEDULED',
];

type DatePreset = 'today' | 'this_week' | 'this_month' | 'last_30_days' | 'custom' | '';

const STATUS_CHIPS = [
  { value: '', label: 'All' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'CONFIRMED', label: 'Confirmed' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'CANCELLED', label: 'Cancelled' },
  { value: 'NO_SHOW', label: 'No-Show' },
  { value: 'RESCHEDULED', label: 'Rescheduled' },
] as const;

type SortableColumn = 'startTime' | 'customerName' | 'serviceName' | 'status' | 'amount';

function getDatePresetRange(preset: DatePreset): { from: string; to: string } {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const today = `${yyyy}-${mm}-${dd}`;

  switch (preset) {
    case 'today':
      return { from: today, to: today };
    case 'this_week': {
      const dayOfWeek = now.getDay();
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - dayOfWeek);
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      const fmt = (d: Date) =>
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      return { from: fmt(startOfWeek), to: fmt(endOfWeek) };
    }
    case 'this_month': {
      const lastDay = new Date(yyyy, now.getMonth() + 1, 0).getDate();
      return {
        from: `${yyyy}-${mm}-01`,
        to: `${yyyy}-${mm}-${String(lastDay).padStart(2, '0')}`,
      };
    }
    case 'last_30_days': {
      const thirtyAgo = new Date(now);
      thirtyAgo.setDate(now.getDate() - 30);
      const fmt30 = (d: Date) =>
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      return { from: fmt30(thirtyAgo), to: today };
    }
    default:
      return { from: '', to: '' };
  }
}

export default function BookingsPage() {
  return (
    <Suspense>
      <BookingsContent />
    </Suspense>
  );
}

function BookingsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Initialize state from URL search params
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '');
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [dateFrom, setDateFrom] = useState(searchParams.get('dateFrom') || '');
  const [dateTo, setDateTo] = useState(searchParams.get('dateTo') || '');
  const [staffFilter, setStaffFilter] = useState(searchParams.get('staffId') || '');
  const [datePreset, setDatePreset] = useState<DatePreset>(
    (searchParams.get('datePreset') as DatePreset) || '',
  );

  const [bookings, setBookings] = useState<any>({ data: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [selectedBooking, setSelectedBooking] = useState<any>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [newBookingOpen, setNewBookingOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkStatusModal, setBulkStatusModal] = useState(false);
  const [bulkAssignModal, setBulkAssignModal] = useState(false);
  const [staff, setStaff] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [serviceFilter, setServiceFilter] = useState(searchParams.get('serviceId') || '');
  const [activeViewId, setActiveViewId] = useState<string | null>(null);
  const [showExport, setShowExport] = useState(false);
  const [sortBy, setSortBy] = useState<SortableColumn | null>(
    (searchParams.get('sortBy') as SortableColumn) || null,
  );
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(
    (searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc',
  );
  const [showFilters, setShowFilters] = useState(
    !!(
      searchParams.get('dateFrom') ||
      searchParams.get('dateTo') ||
      searchParams.get('staffId') ||
      searchParams.get('serviceId') ||
      searchParams.get('datePreset')
    ),
  );
  const [debouncedSearch, setDebouncedSearch] = useState(searchQuery);
  const pack = usePack();
  const { t } = useI18n();
  const { toast } = useToast();
  const plan = usePlan();

  const currentFilters = { status: statusFilter };

  // Sync filters to URL search params
  const updateUrlParams = useCallback(
    (overrides: Record<string, string> = {}) => {
      const params = new URLSearchParams();
      const values: Record<string, string> = {
        status: statusFilter,
        search: debouncedSearch,
        dateFrom,
        dateTo,
        staffId: staffFilter,
        serviceId: serviceFilter,
        datePreset,
        sortBy: sortBy || '',
        sortOrder: sortBy ? sortOrder : '',
        ...overrides,
      };
      Object.entries(values).forEach(([key, value]) => {
        if (value) params.set(key, value);
      });
      const qs = params.toString();
      router.replace(`/bookings${qs ? `?${qs}` : ''}`, { scroll: false });
    },
    [
      statusFilter,
      debouncedSearch,
      dateFrom,
      dateTo,
      staffFilter,
      serviceFilter,
      datePreset,
      sortBy,
      sortOrder,
      router,
    ],
  );

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Update URL whenever filters change
  useEffect(() => {
    updateUrlParams();
  }, [
    statusFilter,
    debouncedSearch,
    dateFrom,
    dateTo,
    staffFilter,
    serviceFilter,
    datePreset,
    sortBy,
    sortOrder,
  ]);

  const handleApplyView = (filters: Record<string, unknown>, viewId: string) => {
    setStatusFilter((filters.status as string) || '');
    setActiveViewId(viewId);
  };

  const handleClearView = () => {
    setStatusFilter('');
    setActiveViewId(null);
  };

  const load = useCallback(() => {
    const params = new URLSearchParams();
    params.set('pageSize', '50');
    if (statusFilter) params.set('status', statusFilter);
    if (debouncedSearch) params.set('search', debouncedSearch);
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', `${dateTo}T23:59:59`);
    if (staffFilter) params.set('staffId', staffFilter);
    if (serviceFilter) params.set('serviceId', serviceFilter);
    if (sortBy) params.set('sortBy', sortBy);
    if (sortBy) params.set('sortOrder', sortOrder);

    setLoading(true);
    api
      .get<any>(`/bookings?${params.toString()}`)
      .then(setBookings)
      .catch((err) => toast(err.message || 'Failed to load bookings', 'error'))
      .finally(() => setLoading(false));
  }, [
    statusFilter,
    debouncedSearch,
    dateFrom,
    dateTo,
    staffFilter,
    serviceFilter,
    sortBy,
    sortOrder,
    toast,
  ]);

  useEffect(() => {
    load();
  }, [load]);

  const [keyboardIdx, setKeyboardIdx] = useState(-1);

  const handleRowClick = (booking: any) => {
    setSelectedBooking(booking);
    setDetailOpen(true);
  };

  const handleReschedule = (booking: any) => {
    setDetailOpen(false);
    setSelectedBooking(booking);
    setRescheduleOpen(true);
  };

  useEffect(() => {
    api
      .get<any>('/staff')
      .then((s) => setStaff(Array.isArray(s) ? s : s.data || []))
      .catch(() => {});
    api
      .get<any>('/services')
      .then((s) => setServices(Array.isArray(s) ? s : s.data || []))
      .catch(() => {});
  }, []);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === bookings.data.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(bookings.data.map((b: any) => b.id)));
    }
  };

  const handleBulkStatus = async (status: string) => {
    try {
      await api.patch('/bookings/bulk', {
        ids: Array.from(selectedIds),
        action: 'status',
        payload: { status },
      });
      setSelectedIds(new Set());
      setBulkStatusModal(false);
      load();
    } catch (err: any) {
      toast(err.message || 'Failed to update booking status', 'error');
    }
  };

  const handleBulkAssign = async (staffId: string) => {
    try {
      await api.patch('/bookings/bulk', {
        ids: Array.from(selectedIds),
        action: 'assign',
        payload: { staffId },
      });
      setSelectedIds(new Set());
      setBulkAssignModal(false);
      load();
    } catch (err: any) {
      toast(err.message || 'Failed to assign staff', 'error');
    }
  };

  const handleUpdated = () => {
    setDetailOpen(false);
    setRescheduleOpen(false);
    load();
  };

  // Handle date preset selection
  const handleDatePreset = (preset: DatePreset) => {
    setDatePreset(preset);
    if (preset && preset !== 'custom') {
      const range = getDatePresetRange(preset);
      setDateFrom(range.from);
      setDateTo(range.to);
    } else if (preset === '') {
      setDateFrom('');
      setDateTo('');
    }
    // For 'custom', keep existing date values and let user pick
  };

  const handleClearFilters = () => {
    setDateFrom('');
    setDateTo('');
    setStaffFilter('');
    setServiceFilter('');
    setDatePreset('');
    setShowFilters(false);
  };

  const hasActiveFilters = !!(dateFrom || dateTo || staffFilter || serviceFilter || datePreset);
  const activeFilterCount =
    (statusFilter ? 1 : 0) +
    (dateFrom || dateTo ? 1 : 0) +
    (staffFilter ? 1 : 0) +
    (serviceFilter ? 1 : 0) +
    (debouncedSearch ? 1 : 0);

  const sortedBookings = bookings.data || [];

  // J/K list navigation
  useListNavigation(sortedBookings.length, setKeyboardIdx);
  useKeyboardShortcut('Enter', () => {
    if (keyboardIdx >= 0 && keyboardIdx < sortedBookings.length) {
      handleRowClick(sortedBookings[keyboardIdx]);
    }
  });

  const handleColumnSort = (col: SortableColumn) => {
    if (sortBy === col) {
      if (sortOrder === 'desc') {
        setSortOrder('asc');
      } else {
        // Third click clears sort
        setSortBy(null);
      }
    } else {
      setSortBy(col);
      setSortOrder('desc');
    }
  };

  const SortIndicator = ({ col }: { col: string }) => {
    if (sortBy !== col) return null;
    return sortOrder === 'asc' ? (
      <ChevronUp size={14} className="inline ml-1" data-testid="sort-asc" />
    ) : (
      <ChevronDown size={14} className="inline ml-1" data-testid="sort-desc" />
    );
  };

  return (
    <div className="p-6" data-tour-target="bookings-table">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4 print:hidden">
        <h1 className="text-2xl font-serif font-semibold text-slate-900">
          {t('bookings.title', { entity: pack.labels.booking })}
        </h1>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => window.print()}
            className="flex items-center justify-center gap-1 border px-3 py-2 rounded-xl text-sm hover:bg-slate-50 transition-colors"
            data-testid="print-btn"
          >
            <Printer size={16} /> Print
          </button>
          <button
            onClick={() => setShowExport(true)}
            className="flex items-center justify-center gap-1 border px-3 py-2 rounded-xl text-sm hover:bg-slate-50 transition-colors"
          >
            <Download size={16} /> Export CSV
          </button>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-slate-200 rounded-xl px-3 py-2 text-sm transition-colors w-full sm:w-auto"
            data-testid="status-filter"
          >
            <option value="">{t('bookings.all_statuses')}</option>
            {BOOKING_STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`status.${s.toLowerCase()}`)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <UpgradeNudge
        current={bookings.total || 0}
        plan={plan}
        resource="bookings"
        resourceLabel="bookings"
      />
      <FeatureDiscovery
        id="bookings-search"
        title="Search & filter bookings"
        description="Use the search bar and filters to quickly find bookings by customer name, status, date range, or staff member."
      />

      {/* Status Chip Bar */}
      <div className="flex flex-wrap gap-2 mb-4 print:hidden" data-testid="status-chips">
        {STATUS_CHIPS.map((chip) => (
          <button
            key={chip.value}
            onClick={() => setStatusFilter(chip.value)}
            className={cn(
              'rounded-full px-3 py-1.5 text-xs cursor-pointer transition-colors',
              statusFilter === chip.value
                ? 'bg-sage-100 text-sage-800 font-medium'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100',
            )}
            data-testid={`status-chip-${chip.value || 'all'}`}
          >
            {chip.label}
          </button>
        ))}
        <select
          value={staffFilter}
          onChange={(e) => setStaffFilter(e.target.value)}
          className="rounded-xl border-slate-200 border text-sm px-3 py-1.5 ml-2"
          data-testid="staff-chip-filter"
        >
          <option value="">All Staff</option>
          {staff.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select
          value={serviceFilter}
          onChange={(e) => setServiceFilter(e.target.value)}
          className="rounded-xl border-slate-200 border text-sm px-3 py-1.5 ml-2"
          data-testid="service-chip-filter"
        >
          <option value="">All Services</option>
          {services.map((s: any) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      {/* Search bar */}
      <div className="mb-4 relative">
        <Search size={16} className="absolute left-3 top-3 text-slate-400" />
        <input
          type="text"
          placeholder={`${t('common.search')} ${pack.labels.booking.toLowerCase()}...`}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full border border-slate-200 rounded-xl px-10 py-2 text-sm transition-colors focus:outline-none focus:border-sage-500 focus:ring-1 focus:ring-sage-500"
          data-testid="search-input"
          data-search-input
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
            data-testid="search-clear"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Filters bar */}
      <div className="mb-4 flex items-center gap-2">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={cn(
            'flex items-center gap-2 px-3 py-2 rounded-xl text-sm border transition-colors',
            showFilters
              ? 'border-sage-500 bg-sage-50 text-sage-700'
              : 'border-slate-200 hover:bg-slate-50',
          )}
          data-testid="filters-toggle"
        >
          <Filter size={14} />
          {t('common.filters')}
          {activeFilterCount > 0 && (
            <span className="ml-1 bg-sage-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </button>
        {hasActiveFilters && (
          <button
            onClick={handleClearFilters}
            className="text-xs text-slate-500 hover:text-slate-700 underline"
            data-testid="clear-filters"
          >
            Clear filters
          </button>
        )}
      </div>

      {showFilters && (
        <div
          className="mb-4 p-4 border border-slate-200 rounded-xl bg-white"
          data-testid="filters-panel"
        >
          {/* Date preset buttons */}
          <div className="mb-3">
            <label className="block text-xs font-medium text-slate-700 mb-2">Date Range</label>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  { value: 'today', label: 'Today' },
                  { value: 'this_week', label: 'This Week' },
                  { value: 'this_month', label: 'This Month' },
                  { value: 'last_30_days', label: 'Last 30 Days' },
                  { value: 'custom', label: 'Custom' },
                ] as { value: DatePreset; label: string }[]
              ).map((preset) => (
                <button
                  key={preset.value}
                  onClick={() => handleDatePreset(preset.value)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border transition-colors',
                    datePreset === preset.value
                      ? 'border-sage-500 bg-sage-50 text-sage-700'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-600',
                  )}
                  data-testid={`date-preset-${preset.value}`}
                >
                  <Calendar size={14} />
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-2">
                {t('common.from_date')}
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  if (datePreset !== 'custom') setDatePreset('custom');
                }}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                data-testid="date-from"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-2">
                {t('common.to_date')}
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value);
                  if (datePreset !== 'custom') setDatePreset('custom');
                }}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                data-testid="date-to"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-2">
                {t('common.staff')}
              </label>
              <select
                value={staffFilter}
                onChange={(e) => setStaffFilter(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                data-testid="staff-filter"
              >
                <option value="">All staff</option>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      <ViewPicker
        page="bookings"
        currentFilters={currentFilters}
        activeViewId={activeViewId}
        onApplyView={handleApplyView}
        onClearView={handleClearView}
      />

      <div className="bg-white rounded-2xl shadow-soft overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="w-10 p-3 print:hidden">
                  <input
                    type="checkbox"
                    checked={
                      sortedBookings.length > 0 && selectedIds.size === sortedBookings.length
                    }
                    onChange={() => {
                      if (selectedIds.size === sortedBookings.length) {
                        setSelectedIds(new Set());
                      } else {
                        setSelectedIds(new Set(sortedBookings.map((b: any) => b.id)));
                      }
                    }}
                    className="rounded text-sage-600"
                  />
                </th>
                <th
                  className="text-left p-3 text-xs font-medium text-slate-500 uppercase cursor-pointer hover:text-slate-700 select-none print:border print:border-slate-300 print:text-black print:text-xs"
                  onClick={() => handleColumnSort('customerName')}
                  data-testid="sort-header-customer"
                >
                  {pack.labels.customer} <SortIndicator col="customerName" />
                </th>
                <th
                  className="text-left p-3 text-xs font-medium text-slate-500 uppercase cursor-pointer hover:text-slate-700 select-none print:border print:border-slate-300 print:text-black print:text-xs"
                  onClick={() => handleColumnSort('serviceName')}
                  data-testid="sort-header-service"
                >
                  {pack.labels.service} <SortIndicator col="serviceName" />
                </th>
                <th className="text-left p-3 text-xs font-medium text-slate-500 uppercase select-none print:border print:border-slate-300 print:text-black print:text-xs">
                  {t('common.provider')}
                </th>
                <th
                  className="text-left p-3 text-xs font-medium text-slate-500 uppercase cursor-pointer hover:text-slate-700 select-none print:border print:border-slate-300 print:text-black print:text-xs"
                  onClick={() => handleColumnSort('startTime')}
                  data-testid="sort-header-date"
                >
                  {t('bookings.date_time')} <SortIndicator col="startTime" />
                </th>
                <th
                  className="text-left p-3 text-xs font-medium text-slate-500 uppercase cursor-pointer hover:text-slate-700 select-none print:border print:border-slate-300 print:text-black print:text-xs"
                  onClick={() => handleColumnSort('status')}
                  data-testid="sort-header-status"
                >
                  {t('common.status')} <SortIndicator col="status" />
                </th>
                <th
                  className="text-left p-3 text-xs font-medium text-slate-500 uppercase cursor-pointer hover:text-slate-700 select-none print:border print:border-slate-300 print:text-black print:text-xs"
                  onClick={() => handleColumnSort('amount')}
                  data-testid="sort-header-amount"
                >
                  Amount <SortIndicator col="amount" />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading
                ? Array.from({ length: 5 }).map((_, i) => <TableRowSkeleton key={i} cols={7} />)
                : sortedBookings.map((b: any, idx: number) => (
                    <tr
                      key={b.id}
                      className={cn(
                        'hover:bg-slate-50 cursor-pointer print:break-inside-avoid',
                        selectedIds.has(b.id) && 'bg-sage-50/50',
                        keyboardIdx === idx && 'bg-sage-50 border-l-2 border-sage-600',
                      )}
                    >
                      <td className="w-10 p-3 print:hidden" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(b.id)}
                          onChange={() => toggleSelect(b.id)}
                          className="rounded text-sage-600"
                        />
                      </td>
                      <td
                        className="p-3 text-sm font-medium print:border print:border-slate-300 print:text-black print:text-xs"
                        onClick={() => handleRowClick(b)}
                      >
                        {b.customer?.name}
                      </td>
                      <td
                        className="p-3 text-sm print:border print:border-slate-300 print:text-black print:text-xs"
                        onClick={() => handleRowClick(b)}
                      >
                        <span className="flex items-center gap-1.5">
                          {b.colorLabel && BOOKING_COLOR_LABELS[b.colorLabel] && (
                            <span
                              className={cn(
                                'w-2 h-2 rounded-full flex-shrink-0',
                                BOOKING_COLOR_LABELS[b.colorLabel].dot,
                              )}
                              data-testid="color-label-dot"
                            />
                          )}
                          {b.service?.name}
                        </span>
                      </td>
                      <td
                        className="p-3 text-sm text-slate-600 print:border print:border-slate-300 print:text-black print:text-xs"
                        onClick={() => handleRowClick(b)}
                      >
                        {b.staff?.name || t('common.unassigned')}
                      </td>
                      <td
                        className="p-3 text-sm text-slate-600 print:border print:border-slate-300 print:text-black print:text-xs"
                        onClick={() => handleRowClick(b)}
                      >
                        {new Date(b.startTime).toLocaleString('en-US', {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}
                      </td>
                      <td
                        className="p-3 print:border print:border-slate-300 print:text-black print:text-xs"
                        onClick={() => handleRowClick(b)}
                      >
                        <span
                          className={cn(
                            'text-xs px-2 py-0.5 rounded-full',
                            statusBadgeClasses(b.status),
                          )}
                        >
                          {t(`status.${b.status.toLowerCase()}`)}
                        </span>
                      </td>
                      <td
                        className="p-3 text-sm text-slate-600 print:border print:border-slate-300 print:text-black print:text-xs"
                        onClick={() => handleRowClick(b)}
                      >
                        {b.service?.price != null ? `$${Number(b.service.price).toFixed(2)}` : '-'}
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
        {!loading && sortedBookings.length === 0 && (
          <EmptyState
            icon={BookOpen}
            title={t('bookings.no_bookings', { entity: pack.labels.booking.toLowerCase() })}
            description={
              searchQuery || statusFilter || dateFrom || dateTo || staffFilter || serviceFilter
                ? `No ${pack.labels.booking.toLowerCase()} match your filters`
                : t('bookings.create_first', { entity: pack.labels.booking.toLowerCase() })
            }
            action={
              !(searchQuery || statusFilter || dateFrom || dateTo || staffFilter || serviceFilter)
                ? { label: 'Create New Booking', onClick: () => setNewBookingOpen(true) }
                : undefined
            }
          />
        )}
      </div>

      <BookingDetailModal
        booking={selectedBooking}
        isOpen={detailOpen}
        onClose={() => setDetailOpen(false)}
        onUpdated={handleUpdated}
        onReschedule={handleReschedule}
      />

      <BookingFormModal
        isOpen={rescheduleOpen}
        onClose={() => setRescheduleOpen(false)}
        onCreated={handleUpdated}
        customerId={selectedBooking?.customerId}
        customerName={selectedBooking?.customer?.name}
        rescheduleBookingId={selectedBooking?.id}
        rescheduleData={selectedBooking}
      />

      <BookingFormModal
        isOpen={newBookingOpen}
        onClose={() => setNewBookingOpen(false)}
        onCreated={handleUpdated}
      />

      <BulkActionBar
        count={selectedIds.size}
        onClear={() => setSelectedIds(new Set())}
        actions={[
          { label: 'Change Status', onClick: () => setBulkStatusModal(true) },
          { label: 'Assign Staff', onClick: () => setBulkAssignModal(true) },
        ]}
      />

      {bulkStatusModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-soft p-6 w-full max-w-sm">
            <h3 className="text-lg font-serif font-semibold mb-4">Change Status</h3>
            <div className="space-y-2">
              {['CONFIRMED', 'CANCELLED', 'COMPLETED', 'NO_SHOW'].map((s) => (
                <button
                  key={s}
                  onClick={() => handleBulkStatus(s)}
                  className={cn(
                    'w-full text-left px-4 py-2 rounded-xl text-sm hover:bg-slate-50 border border-slate-100 transition-colors',
                    s === 'CANCELLED' && 'text-red-600',
                  )}
                >
                  {t(`status.${s.toLowerCase()}`)}
                </button>
              ))}
            </div>
            <button
              onClick={() => setBulkStatusModal(false)}
              className="mt-4 w-full text-center text-sm text-slate-500 hover:text-slate-700"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {bulkAssignModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-soft p-6 w-full max-w-sm">
            <h3 className="text-lg font-serif font-semibold mb-4">Assign Staff</h3>
            <div className="space-y-2">
              {staff.map((s: any) => (
                <button
                  key={s.id}
                  onClick={() => handleBulkAssign(s.id)}
                  className="w-full text-left px-4 py-2 rounded-xl text-sm hover:bg-slate-50 border border-slate-100 transition-colors"
                >
                  {s.name}
                </button>
              ))}
              {staff.length === 0 && (
                <p className="text-sm text-slate-400 py-2">No staff members found</p>
              )}
            </div>
            <button
              onClick={() => setBulkAssignModal(false)}
              className="mt-4 w-full text-center text-sm text-slate-500 hover:text-slate-700"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      <ExportModal
        isOpen={showExport}
        onClose={() => setShowExport(false)}
        entity="bookings"
        allFields={[
          { key: 'id', label: 'ID' },
          { key: 'customerName', label: 'Customer' },
          { key: 'customerPhone', label: 'Phone' },
          { key: 'customerEmail', label: 'Email' },
          { key: 'serviceName', label: 'Service' },
          { key: 'staffName', label: 'Staff' },
          { key: 'status', label: 'Status' },
          { key: 'startTime', label: 'Start Time' },
          { key: 'endTime', label: 'End Time' },
          { key: 'notes', label: 'Notes' },
          { key: 'createdAt', label: 'Created' },
        ]}
      />
    </div>
  );
}
