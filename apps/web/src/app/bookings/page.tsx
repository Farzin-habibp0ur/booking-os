'use client';

import { useEffect, useState, useMemo } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { usePack } from '@/lib/vertical-pack';
import { useI18n } from '@/lib/i18n';
import { useToast } from '@/lib/toast';
import { TableRowSkeleton, EmptyState } from '@/components/skeleton';
import { BookOpen, Download, Search, ChevronUp, ChevronDown, Filter, X } from 'lucide-react';
import BookingDetailModal from '@/components/booking-detail-modal';
import BookingFormModal from '@/components/booking-form-modal';
import BulkActionBar from '@/components/bulk-action-bar';
import ExportModal from '@/components/export-modal';
import { ViewPicker } from '@/components/saved-views';
import { statusBadgeClasses } from '@/lib/design-tokens';

const BOOKING_STATUSES = [
  'PENDING',
  'CONFIRMED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
  'NO_SHOW',
  'RESCHEDULED',
];

export default function BookingsPage() {
  const [bookings, setBookings] = useState<any>({ data: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedBooking, setSelectedBooking] = useState<any>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [newBookingOpen, setNewBookingOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkStatusModal, setBulkStatusModal] = useState(false);
  const [bulkAssignModal, setBulkAssignModal] = useState(false);
  const [staff, setStaff] = useState<any[]>([]);
  const [activeViewId, setActiveViewId] = useState<string | null>(null);
  const [showExport, setShowExport] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [staffFilter, setStaffFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [searchDebounce, setSearchDebounce] = useState(0);
  const pack = usePack();
  const { t } = useI18n();
  const { toast } = useToast();

  const currentFilters = { status: statusFilter };

  const handleApplyView = (filters: Record<string, unknown>, viewId: string) => {
    setStatusFilter((filters.status as string) || '');
    setActiveViewId(viewId);
  };

  const handleClearView = () => {
    setStatusFilter('');
    setActiveViewId(null);
  };

  const load = () => {
    const params = statusFilter ? `?status=${statusFilter}&pageSize=50` : '?pageSize=50';
    api
      .get<any>(`/bookings${params}`)
      .then(setBookings)
      .catch((err) => toast(err.message || 'Failed to load bookings', 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [statusFilter]);

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

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchDebounce(Date.now());
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Filter and sort bookings
  const filteredAndSorted = useMemo(() => {
    let filtered = bookings.data || [];

    // Apply text search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (b: any) =>
          (b.customer?.name || '').toLowerCase().includes(q) ||
          (b.service?.name || '').toLowerCase().includes(q),
      );
    }

    // Apply date range filter
    if (dateFrom || dateTo) {
      filtered = filtered.filter((b: any) => {
        const bookingDate = new Date(b.startTime).getTime();
        const fromTime = dateFrom ? new Date(dateFrom).getTime() : 0;
        const toTime = dateTo ? new Date(dateTo + 'T23:59:59').getTime() : Infinity;
        return bookingDate >= fromTime && bookingDate <= toTime;
      });
    }

    // Apply staff filter
    if (staffFilter) {
      filtered = filtered.filter((b: any) => b.staffId === staffFilter);
    }

    // Apply sorting
    if (sortCol) {
      filtered.sort((a: any, b: any) => {
        let aVal: any = a;
        let bVal: any = b;

        if (sortCol === 'customer') {
          aVal = a.customer?.name || '';
          bVal = b.customer?.name || '';
        } else if (sortCol === 'service') {
          aVal = a.service?.name || '';
          bVal = b.service?.name || '';
        } else if (sortCol === 'staff') {
          aVal = a.staff?.name || '';
          bVal = b.staff?.name || '';
        } else if (sortCol === 'startTime') {
          aVal = new Date(a.startTime).getTime();
          bVal = new Date(b.startTime).getTime();
        } else if (sortCol === 'status') {
          aVal = a.status;
          bVal = b.status;
        }

        if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }, [bookings.data, searchQuery, sortCol, sortDir, dateFrom, dateTo, staffFilter, searchDebounce]);

  const handleColumnSort = (col: string) => {
    if (sortCol === col) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
  };

  const SortIndicator = ({ col }: { col: string }) => {
    if (sortCol !== col) return null;
    return sortDir === 'asc' ? (
      <ChevronUp size={14} className="inline ml-1" />
    ) : (
      <ChevronDown size={14} className="inline ml-1" />
    );
  };

  return (
    <div className="p-6" data-tour-target="bookings-table">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
        <h1 className="text-2xl font-serif font-semibold text-slate-900">
          {t('bookings.title', { entity: pack.labels.booking })}
        </h1>
        <div className="flex items-center gap-2 w-full sm:w-auto">
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

      {/* Search bar */}
      <div className="mb-4 relative">
        <Search size={16} className="absolute left-3 top-3 text-slate-400" />
        <input
          type="text"
          placeholder={`${t('common.search')} ${pack.labels.booking.toLowerCase()}...`}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full border border-slate-200 rounded-xl px-10 py-2 text-sm transition-colors focus:outline-none focus:border-sage-500 focus:ring-1 focus:ring-sage-500"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
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
        >
          <Filter size={14} />
          {t('common.filters')}
        </button>
        {(dateFrom || dateTo || staffFilter) && (
          <button
            onClick={() => {
              setDateFrom('');
              setDateTo('');
              setStaffFilter('');
              setShowFilters(false);
            }}
            className="text-xs text-slate-500 hover:text-slate-700 underline"
          >
            Clear filters
          </button>
        )}
      </div>

      {showFilters && (
        <div className="mb-4 p-4 border border-slate-200 rounded-xl bg-white grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-2">
              {t('common.from_date')}
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-2">
              {t('common.to_date')}
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
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
                <th className="w-10 p-3">
                  <input
                    type="checkbox"
                    checked={
                      filteredAndSorted.length > 0 && selectedIds.size === filteredAndSorted.length
                    }
                    onChange={() => {
                      if (selectedIds.size === filteredAndSorted.length) {
                        setSelectedIds(new Set());
                      } else {
                        setSelectedIds(new Set(filteredAndSorted.map((b: any) => b.id)));
                      }
                    }}
                    className="rounded text-sage-600"
                  />
                </th>
                <th
                  className="text-left p-3 text-xs font-medium text-slate-500 uppercase cursor-pointer hover:text-slate-700 select-none"
                  onClick={() => handleColumnSort('customer')}
                >
                  {pack.labels.customer} <SortIndicator col="customer" />
                </th>
                <th
                  className="text-left p-3 text-xs font-medium text-slate-500 uppercase cursor-pointer hover:text-slate-700 select-none"
                  onClick={() => handleColumnSort('service')}
                >
                  {pack.labels.service} <SortIndicator col="service" />
                </th>
                <th
                  className="text-left p-3 text-xs font-medium text-slate-500 uppercase cursor-pointer hover:text-slate-700 select-none"
                  onClick={() => handleColumnSort('staff')}
                >
                  {t('common.provider')} <SortIndicator col="staff" />
                </th>
                <th
                  className="text-left p-3 text-xs font-medium text-slate-500 uppercase cursor-pointer hover:text-slate-700 select-none"
                  onClick={() => handleColumnSort('startTime')}
                >
                  {t('bookings.date_time')} <SortIndicator col="startTime" />
                </th>
                <th
                  className="text-left p-3 text-xs font-medium text-slate-500 uppercase cursor-pointer hover:text-slate-700 select-none"
                  onClick={() => handleColumnSort('status')}
                >
                  {t('common.status')} <SortIndicator col="status" />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading
                ? Array.from({ length: 5 }).map((_, i) => <TableRowSkeleton key={i} cols={6} />)
                : filteredAndSorted.map((b: any) => (
                    <tr
                      key={b.id}
                      className={cn(
                        'hover:bg-slate-50 cursor-pointer',
                        selectedIds.has(b.id) && 'bg-sage-50/50',
                      )}
                    >
                      <td className="w-10 p-3" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(b.id)}
                          onChange={() => toggleSelect(b.id)}
                          className="rounded text-sage-600"
                        />
                      </td>
                      <td className="p-3 text-sm font-medium" onClick={() => handleRowClick(b)}>
                        {b.customer?.name}
                      </td>
                      <td className="p-3 text-sm" onClick={() => handleRowClick(b)}>
                        {b.service?.name}
                      </td>
                      <td className="p-3 text-sm text-slate-600" onClick={() => handleRowClick(b)}>
                        {b.staff?.name || t('common.unassigned')}
                      </td>
                      <td className="p-3 text-sm text-slate-600" onClick={() => handleRowClick(b)}>
                        {new Date(b.startTime).toLocaleString('en-US', {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}
                      </td>
                      <td className="p-3" onClick={() => handleRowClick(b)}>
                        <span
                          className={cn(
                            'text-xs px-2 py-0.5 rounded-full',
                            statusBadgeClasses(b.status),
                          )}
                        >
                          {t(`status.${b.status.toLowerCase()}`)}
                        </span>
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
        {!loading && filteredAndSorted.length === 0 && (
          <EmptyState
            icon={BookOpen}
            title={t('bookings.no_bookings', { entity: pack.labels.booking.toLowerCase() })}
            description={
              searchQuery || statusFilter || dateFrom || dateTo || staffFilter
                ? `No ${pack.labels.booking.toLowerCase()} match your filters`
                : t('bookings.create_first', { entity: pack.labels.booking.toLowerCase() })
            }
            action={
              !(searchQuery || statusFilter || dateFrom || dateTo || staffFilter)
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
