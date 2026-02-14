'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { usePack } from '@/lib/vertical-pack';
import { TableRowSkeleton, EmptyState } from '@/components/skeleton';
import { BookOpen } from 'lucide-react';
import BookingDetailModal from '@/components/booking-detail-modal';
import BookingFormModal from '@/components/booking-form-modal';

const statusColors: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700',
  CONFIRMED: 'bg-blue-100 text-blue-700',
  IN_PROGRESS: 'bg-purple-100 text-purple-700',
  COMPLETED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-gray-100 text-gray-600',
  NO_SHOW: 'bg-red-100 text-red-700',
};

export default function BookingsPage() {
  const [bookings, setBookings] = useState<any>({ data: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedBooking, setSelectedBooking] = useState<any>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const pack = usePack();

  const load = () => {
    const params = statusFilter ? `?status=${statusFilter}&pageSize=50` : '?pageSize=50';
    api.get<any>(`/bookings${params}`).then(setBookings).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [statusFilter]);

  const handleRowClick = (booking: any) => {
    setSelectedBooking(booking);
    setDetailOpen(true);
  };

  const handleReschedule = (booking: any) => {
    setDetailOpen(false);
    setSelectedBooking(booking);
    setRescheduleOpen(true);
  };

  const handleUpdated = () => {
    setDetailOpen(false);
    setRescheduleOpen(false);
    load();
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">{pack.labels.booking}s</h1>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="border rounded-md px-3 py-2 text-sm">
          <option value="">All statuses</option>
          {Object.keys(statusColors).map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="bg-white border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left p-3 text-xs font-medium text-gray-500 uppercase">{pack.labels.customer}</th>
              <th className="text-left p-3 text-xs font-medium text-gray-500 uppercase">{pack.labels.service}</th>
              <th className="text-left p-3 text-xs font-medium text-gray-500 uppercase">Staff</th>
              <th className="text-left p-3 text-xs font-medium text-gray-500 uppercase">Date & Time</th>
              <th className="text-left p-3 text-xs font-medium text-gray-500 uppercase">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => <TableRowSkeleton key={i} cols={5} />)
            ) : (
              bookings.data.map((b: any) => (
                <tr key={b.id} onClick={() => handleRowClick(b)} className="hover:bg-gray-50 cursor-pointer">
                  <td className="p-3 text-sm font-medium">{b.customer?.name}</td>
                  <td className="p-3 text-sm">{b.service?.name}</td>
                  <td className="p-3 text-sm text-gray-600">{b.staff?.name || 'Unassigned'}</td>
                  <td className="p-3 text-sm text-gray-600">
                    {new Date(b.startTime).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
                  </td>
                  <td className="p-3">
                    <span className={cn('text-xs px-2 py-0.5 rounded-full', statusColors[b.status])}>{b.status}</span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        {!loading && bookings.data.length === 0 && (
          <EmptyState
            icon={BookOpen}
            title={`No ${pack.labels.booking.toLowerCase()}s found`}
            description={statusFilter ? `No ${pack.labels.booking.toLowerCase()}s with status "${statusFilter}".` : `Create your first ${pack.labels.booking.toLowerCase()} from the calendar or inbox.`}
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
    </div>
  );
}
