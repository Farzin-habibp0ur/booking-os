'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Calendar, Clock, DollarSign, User } from 'lucide-react';
import { cn } from '@/lib/cn';
import { statusBadgeClasses } from '@/lib/design-tokens';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

function portalFetch(path: string) {
  const token = typeof window !== 'undefined' ? sessionStorage.getItem('portal-token') : null;
  return fetch(`${API_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then((r) => {
    if (r.status === 401) {
      sessionStorage.removeItem('portal-token');
      window.location.href = `/portal/${window.location.pathname.split('/')[2]}`;
      throw new Error('Unauthorized');
    }
    return r.json();
  });
}

type StatusFilter = '' | 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED';

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'CONFIRMED', label: 'Upcoming' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

export default function PortalBookingsPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const [bookings, setBookings] = useState<any>({ data: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const token = sessionStorage.getItem('portal-token');
    if (!token) {
      router.replace(`/portal/${slug}`);
      return;
    }
    loadBookings();
  }, [slug, statusFilter, page]);

  const loadBookings = () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page) });
    if (statusFilter) params.set('status', statusFilter);
    portalFetch(`/portal/bookings?${params}`)
      .then(setBookings)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push(`/portal/${slug}/dashboard`)}
          className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <ArrowLeft size={18} className="text-slate-600" />
        </button>
        <h1 className="text-2xl font-serif font-semibold text-slate-900">My Bookings</h1>
      </div>

      {/* Status filters */}
      <div className="flex gap-2" data-testid="status-filters">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => {
              setStatusFilter(f.value);
              setPage(1);
            }}
            className={cn(
              'px-3 py-1.5 text-xs rounded-full transition-colors',
              statusFilter === f.value
                ? 'bg-sage-100 text-sage-800 font-medium'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100',
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Booking cards */}
      <div className="space-y-3" data-testid="booking-list">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl shadow-soft p-4 animate-pulse">
              <div className="h-4 bg-slate-200 rounded w-1/3 mb-2" />
              <div className="h-3 bg-slate-100 rounded w-2/3" />
            </div>
          ))
        ) : bookings.data.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <Calendar size={32} className="mx-auto mb-3 opacity-50" />
            <p className="text-sm">No bookings found</p>
          </div>
        ) : (
          bookings.data.map((b: any) => (
            <div key={b.id} className="bg-white rounded-2xl shadow-soft p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-900">{b.service?.name}</p>
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <Calendar size={12} />
                      {new Date(b.startTime).toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock size={12} />
                      {new Date(b.startTime).toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </span>
                    {b.service?.durationMins && <span>{b.service.durationMins} min</span>}
                  </div>
                  {b.staff?.name && (
                    <p className="flex items-center gap-1 text-xs text-slate-400 mt-1">
                      <User size={12} /> {b.staff.name}
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <span
                    className={cn('text-xs px-2 py-0.5 rounded-full', statusBadgeClasses(b.status))}
                  >
                    {b.status}
                  </span>
                  {b.service?.price != null && (
                    <span className="flex items-center gap-0.5 text-xs text-slate-500">
                      <DollarSign size={10} />
                      {Number(b.service.price).toFixed(2)}
                    </span>
                  )}
                </div>
              </div>
              {b.status === 'COMPLETED' && (
                <button
                  onClick={() => router.push(`/book/${slug}?service=${b.service?.name}`)}
                  className="mt-3 text-xs text-sage-600 hover:text-sage-700 font-medium"
                  data-testid="book-again-btn"
                >
                  Book Again
                </button>
              )}
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {bookings.total > 10 && (
        <div className="flex justify-center gap-2 pt-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 text-xs border rounded-lg disabled:opacity-50 hover:bg-slate-50 transition-colors"
          >
            Previous
          </button>
          <span className="px-3 py-1.5 text-xs text-slate-500">
            Page {page} of {Math.ceil(bookings.total / 10)}
          </span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={page >= Math.ceil(bookings.total / 10)}
            className="px-3 py-1.5 text-xs border rounded-lg disabled:opacity-50 hover:bg-slate-50 transition-colors"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
