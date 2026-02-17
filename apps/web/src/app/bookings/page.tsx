'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { usePack } from '@/lib/vertical-pack';
import { useI18n } from '@/lib/i18n';
import { TableRowSkeleton, EmptyState } from '@/components/skeleton';
import { BookOpen } from 'lucide-react';
import BookingDetailModal from '@/components/booking-detail-modal';
import BookingFormModal from '@/components/booking-form-modal';
import BulkActionBar from '@/components/bulk-action-bar';

const statusColors: Record<string, string> = {
  PENDING: 'bg-lavender-100 text-lavender-700',
  PENDING_DEPOSIT: 'bg-amber-100 text-amber-700',
  CONFIRMED: 'bg-sage-100 text-sage-700',
  IN_PROGRESS: 'bg-amber-100 text-amber-700',
  COMPLETED: 'bg-sage-50 text-sage-900',
  CANCELLED: 'bg-slate-100 text-slate-600',
  NO_SHOW: 'bg-red-100 text-red-700',
};

export default function BookingsPage() {
  const [bookings, setBookings] = useState<any>({ data: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedBooking, setSelectedBooking] = useState<any>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkStatusModal, setBulkStatusModal] = useState(false);
  const [bulkAssignModal, setBulkAssignModal] = useState(false);
  const [staff, setStaff] = useState<any[]>([]);
  const pack = usePack();
  const { t } = useI18n();

  const load = () => {
    const params = statusFilter ? `?status=${statusFilter}&pageSize=50` : '?pageSize=50';
    api
      .get<any>(`/bookings${params}`)
      .then(setBookings)
      .catch(console.error)
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
    await api.patch('/bookings/bulk', {
      ids: Array.from(selectedIds),
      action: 'status',
      payload: { status },
    });
    setSelectedIds(new Set());
    setBulkStatusModal(false);
    load();
  };

  const handleBulkAssign = async (staffId: string) => {
    await api.patch('/bookings/bulk', {
      ids: Array.from(selectedIds),
      action: 'assign',
      payload: { staffId },
    });
    setSelectedIds(new Set());
    setBulkAssignModal(false);
    load();
  };

  const handleUpdated = () => {
    setDetailOpen(false);
    setRescheduleOpen(false);
    load();
  };

  return (
    <div className="p-6" data-tour-target="bookings-table">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
        <h1 className="text-2xl font-serif font-semibold text-slate-900">
          {t('bookings.title', { entity: pack.labels.booking })}
        </h1>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-slate-200 rounded-xl px-3 py-2 text-sm transition-colors w-full sm:w-auto"
        >
          <option value="">{t('bookings.all_statuses')}</option>
          {Object.keys(statusColors).map((s) => (
            <option key={s} value={s}>
              {t(`status.${s.toLowerCase()}`)}
            </option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-2xl shadow-soft overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="w-10 p-3">
                  <input
                    type="checkbox"
                    checked={bookings.data.length > 0 && selectedIds.size === bookings.data.length}
                    onChange={toggleSelectAll}
                    className="rounded text-sage-600"
                  />
                </th>
                <th className="text-left p-3 text-xs font-medium text-slate-500 uppercase">
                  {pack.labels.customer}
                </th>
                <th className="text-left p-3 text-xs font-medium text-slate-500 uppercase">
                  {pack.labels.service}
                </th>
                <th className="text-left p-3 text-xs font-medium text-slate-500 uppercase">
                  {t('common.name')}
                </th>
                <th className="text-left p-3 text-xs font-medium text-slate-500 uppercase">
                  {t('bookings.date_time')}
                </th>
                <th className="text-left p-3 text-xs font-medium text-slate-500 uppercase">
                  {t('common.status')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading
                ? Array.from({ length: 5 }).map((_, i) => <TableRowSkeleton key={i} cols={6} />)
                : bookings.data.map((b: any) => (
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
                          className={cn('text-xs px-2 py-0.5 rounded-full', statusColors[b.status])}
                        >
                          {t(`status.${b.status.toLowerCase()}`)}
                        </span>
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
        {!loading && bookings.data.length === 0 && (
          <EmptyState
            icon={BookOpen}
            title={t('bookings.no_bookings', { entity: pack.labels.booking.toLowerCase() })}
            description={
              statusFilter
                ? t('bookings.no_bookings_status', {
                    entity: pack.labels.booking.toLowerCase(),
                    status: t(`status.${statusFilter.toLowerCase()}`),
                  })
                : t('bookings.create_first', { entity: pack.labels.booking.toLowerCase() })
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
    </div>
  );
}
