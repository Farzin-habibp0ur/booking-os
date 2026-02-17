'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { useAuth } from '@/lib/auth';
import { usePack } from '@/lib/vertical-pack';
import {
  Kanban,
  RefreshCw,
  User,
  Clock,
  Wrench,
  Car,
  Filter,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────

interface KanbanBooking {
  id: string;
  kanbanStatus: string | null;
  startTime: string;
  endTime: string;
  notes: string | null;
  status: string;
  customer: {
    id: string;
    name: string;
    phone: string;
    customFields?: Record<string, any>;
  };
  service: { id: string; name: string; durationMins: number };
  staff: { id: string; name: string } | null;
}

const KANBAN_COLUMNS = [
  { status: 'CHECKED_IN', label: 'Checked In', color: 'bg-blue-50 border-blue-200 text-blue-800' },
  { status: 'DIAGNOSING', label: 'Diagnosing', color: 'bg-amber-50 border-amber-200 text-amber-800' },
  { status: 'AWAITING_APPROVAL', label: 'Awaiting Approval', color: 'bg-lavender-50 border-lavender-200 text-lavender-800' },
  { status: 'IN_PROGRESS', label: 'In Progress', color: 'bg-sage-50 border-sage-200 text-sage-800' },
  { status: 'READY_FOR_PICKUP', label: 'Ready for Pickup', color: 'bg-green-50 border-green-200 text-green-800' },
];

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function ServiceBoardPage() {
  const { user } = useAuth();
  const pack = usePack();
  const [bookings, setBookings] = useState<KanbanBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [dragItem, setDragItem] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const [staffFilter, setStaffFilter] = useState('');
  const [staff, setStaff] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadBoard = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (staffFilter) params.set('staffId', staffFilter);
      const data = await api.get<KanbanBooking[]>(`/bookings/kanban?${params.toString()}`);
      setBookings(data);
    } catch {
      // ignore
    }
  }, [staffFilter]);

  const loadStaff = useCallback(async () => {
    try {
      const data = await api.get<any>('/staff');
      setStaff(Array.isArray(data) ? data : data?.data || []);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadBoard(), loadStaff()]).finally(() => setLoading(false));
  }, [loadBoard, loadStaff]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(loadBoard, 30000);
    return () => clearInterval(interval);
  }, [loadBoard]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadBoard();
    setRefreshing(false);
  };

  const handleDragStart = (bookingId: string) => {
    setDragItem(bookingId);
  };

  const handleDragOver = (e: React.DragEvent, colStatus: string) => {
    e.preventDefault();
    setDragOverCol(colStatus);
  };

  const handleDrop = async (e: React.DragEvent, targetStatus: string) => {
    e.preventDefault();
    setDragOverCol(null);
    if (!dragItem) return;

    const booking = bookings.find((b) => b.id === dragItem);
    if (!booking || booking.kanbanStatus === targetStatus) {
      setDragItem(null);
      return;
    }

    // Optimistic update
    setBookings((prev) =>
      prev.map((b) => (b.id === dragItem ? { ...b, kanbanStatus: targetStatus } : b)),
    );
    setDragItem(null);

    try {
      await api.patch(`/bookings/${dragItem}/kanban-status`, { kanbanStatus: targetStatus });
    } catch {
      // Revert on failure
      loadBoard();
    }
  };

  const handleDragEnd = () => {
    setDragItem(null);
    setDragOverCol(null);
  };

  // Check-in action: Set kanbanStatus on a confirmed booking
  const handleCheckIn = async (bookingId: string) => {
    try {
      await api.patch(`/bookings/${bookingId}/kanban-status`, { kanbanStatus: 'CHECKED_IN' });
      loadBoard();
    } catch {
      // ignore
    }
  };

  const getColumnBookings = (status: string) =>
    bookings.filter((b) => b.kanbanStatus === status);

  // Bookings that are confirmed but not yet on the board
  const pendingCheckIn = bookings.filter((b) => !b.kanbanStatus && b.status === 'CONFIRMED');

  return (
    <div className="p-6 h-full flex flex-col">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4 shrink-0">
        <div>
          <h1 className="text-2xl font-serif font-semibold text-slate-900 dark:text-slate-100">
            Service Board
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {bookings.length} active job{bookings.length !== 1 ? 's' : ''} on the board
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Staff Filter */}
          <div className="flex items-center gap-1.5">
            <Filter size={14} className="text-slate-400" />
            <select
              value={staffFilter}
              onChange={(e) => setStaffFilter(e.target.value)}
              className="border border-slate-200 dark:border-slate-700 rounded-xl px-2 py-1.5 text-sm bg-white dark:bg-slate-800"
            >
              <option value="">All Staff</option>
              {staff.map((s: any) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="flex-1 overflow-x-auto">
        <div className="flex gap-4 min-w-[1200px] h-full pb-4">
          {KANBAN_COLUMNS.map((col) => {
            const colBookings = getColumnBookings(col.status);

            return (
              <div
                key={col.status}
                className={cn(
                  'flex-1 min-w-[220px] flex flex-col rounded-2xl transition-colors',
                  dragOverCol === col.status
                    ? 'bg-sage-50/50 dark:bg-sage-900/10 ring-2 ring-sage-300'
                    : 'bg-slate-50/50 dark:bg-slate-800/30',
                )}
                onDragOver={(e) => handleDragOver(e, col.status)}
                onDrop={(e) => handleDrop(e, col.status)}
                onDragLeave={() => setDragOverCol(null)}
              >
                {/* Column Header */}
                <div className="p-3 shrink-0">
                  <div className="flex items-center justify-between">
                    <span
                      className={cn(
                        'text-xs font-semibold px-2 py-1 rounded-lg border',
                        col.color,
                      )}
                    >
                      {col.label}
                    </span>
                    <span className="text-xs text-slate-400 font-medium">
                      {colBookings.length}
                    </span>
                  </div>
                </div>

                {/* Cards */}
                <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-2">
                  {loading ? (
                    Array.from({ length: 2 }).map((_, i) => (
                      <div key={i} className="bg-white dark:bg-slate-900 rounded-xl p-3 animate-pulse">
                        <div className="h-3 bg-slate-200 rounded w-3/4 mb-2" />
                        <div className="h-2 bg-slate-100 rounded w-1/2" />
                      </div>
                    ))
                  ) : colBookings.length === 0 ? (
                    <div className="text-center py-8 text-slate-300 text-xs">
                      No jobs
                    </div>
                  ) : (
                    colBookings.map((booking) => (
                      <KanbanCard
                        key={booking.id}
                        booking={booking}
                        onDragStart={() => handleDragStart(booking.id)}
                        onDragEnd={handleDragEnd}
                        isDragging={dragItem === booking.id}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Kanban Card ────────────────────────────────────────────────────────────

function KanbanCard({
  booking,
  onDragStart,
  onDragEnd,
  isDragging,
}: {
  booking: KanbanBooking;
  onDragStart: () => void;
  onDragEnd: () => void;
  isDragging: boolean;
}) {
  const dossier = booking.customer.customFields || {};
  const vehicleInfo = [dossier.year, dossier.make, dossier.model].filter(Boolean).join(' ');

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={cn(
        'bg-white dark:bg-slate-900 rounded-xl shadow-soft p-3 cursor-grab active:cursor-grabbing transition-opacity border border-transparent hover:border-slate-200 dark:hover:border-slate-700',
        isDragging && 'opacity-50',
      )}
    >
      {/* Customer Name */}
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
          {booking.customer.name}
        </span>
      </div>

      {/* Vehicle Info */}
      {vehicleInfo && (
        <div className="flex items-center gap-1 mb-1.5">
          <Car size={12} className="text-slate-400 shrink-0" />
          <span className="text-xs text-slate-600 dark:text-slate-400 truncate">
            {vehicleInfo}
          </span>
        </div>
      )}

      {/* VIN */}
      {dossier.vin && (
        <div className="text-[10px] text-slate-400 mb-1.5 font-mono truncate">
          VIN: {dossier.vin}
        </div>
      )}

      {/* Service */}
      <div className="flex items-center gap-1 mb-1.5">
        <Wrench size={12} className="text-slate-400 shrink-0" />
        <span className="text-xs text-slate-500 truncate">{booking.service.name}</span>
      </div>

      {/* Staff + Time */}
      <div className="flex items-center justify-between text-[10px] text-slate-400">
        {booking.staff && (
          <div className="flex items-center gap-1">
            <User size={10} />
            <span className="truncate">{booking.staff.name}</span>
          </div>
        )}
        <div className="flex items-center gap-1">
          <Clock size={10} />
          <span>
            {new Date(booking.startTime).toLocaleTimeString('en-US', {
              hour: 'numeric',
              minute: '2-digit',
            })}
          </span>
        </div>
      </div>
    </div>
  );
}
