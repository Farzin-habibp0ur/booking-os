'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { useToast } from '@/lib/toast';
import { TableRowSkeleton, EmptyState } from '@/components/skeleton';
import {
  ClipboardList,
  X,
  CheckCircle2,
  Clock,
  AlertCircle,
  Trash2,
  CheckCheck,
} from 'lucide-react';
import BulkActionBar from '@/components/bulk-action-bar';
import TooltipNudge from '@/components/tooltip-nudge';
import { ViewPicker } from '@/components/saved-views';
import { SortableHeader } from '@/components/sortable-header';

const statusColors: Record<string, string> = {
  ACTIVE: 'bg-sage-100 text-sage-700',
  OFFERED: 'bg-amber-100 text-amber-700',
  BOOKED: 'bg-sage-50 text-sage-900',
  EXPIRED: 'bg-slate-100 text-slate-600',
  CANCELLED: 'bg-red-100 text-red-700',
};

const statusIcons: Record<string, React.ComponentType<any>> = {
  ACTIVE: Clock,
  OFFERED: AlertCircle,
  BOOKED: CheckCircle2,
};

export default function WaitlistPage() {
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [serviceFilter, setServiceFilter] = useState('');
  const [services, setServices] = useState<any[]>([]);
  const [activeViewId, setActiveViewId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const { toast } = useToast();

  const handleSort = (column: string) => {
    if (sortBy === column) {
      if (sortOrder === 'desc') {
        setSortOrder('asc');
      } else {
        setSortBy(null);
      }
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
  };

  const currentFilters = { status: statusFilter, serviceId: serviceFilter };

  const handleApplyView = (filters: Record<string, unknown>, viewId: string) => {
    setStatusFilter((filters.status as string) || '');
    setServiceFilter((filters.serviceId as string) || '');
    setActiveViewId(viewId);
  };

  const handleClearView = () => {
    setStatusFilter('');
    setServiceFilter('');
    setActiveViewId(null);
  };

  const load = () => {
    const params = new URLSearchParams();
    if (statusFilter) params.set('status', statusFilter);
    if (serviceFilter) params.set('serviceId', serviceFilter);
    if (sortBy) {
      params.set('sortBy', sortBy);
      params.set('sortOrder', sortOrder);
    }
    const qs = params.toString() ? `?${params.toString()}` : '';
    api
      .get<any[]>(`/waitlist${qs}`)
      .then(setEntries)
      .catch((err: any) => toast(err.message || 'Failed to load waitlist entries', 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [statusFilter, serviceFilter, sortBy, sortOrder]);

  useEffect(() => {
    api
      .get<any[]>('/services')
      .then(setServices)
      .catch((err: any) => toast(err.message || 'Failed to load services', 'error'));
  }, []);

  const handleCancel = async (id: string) => {
    if (!confirm('Cancel this waitlist entry?')) return;
    try {
      await api.del(`/waitlist/${id}`);
      load();
    } catch (err: any) {
      alert(err.message || 'Failed to cancel');
    }
  };

  const handleResolve = async (entry: any) => {
    const bookingId = prompt('Enter the booking ID to resolve this entry:');
    if (!bookingId) return;
    try {
      await api.patch(`/waitlist/${entry.id}/resolve`, { bookingId });
      load();
    } catch (err: any) {
      alert(err.message || 'Failed to resolve');
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === entries.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(entries.map((e: any) => e.id)));
    }
  };

  const handleBulkRemove = async () => {
    if (!confirm(`Remove ${selectedIds.size} waitlist entries?`)) return;
    try {
      await api.post('/waitlist/bulk', {
        ids: Array.from(selectedIds),
        action: 'remove',
      });
      setSelectedIds(new Set());
      load();
    } catch (err: any) {
      toast(err.message || 'Failed to remove entries', 'error');
    }
  };

  const handleBulkResolve = async () => {
    try {
      await api.post('/waitlist/bulk', {
        ids: Array.from(selectedIds),
        action: 'resolve',
      });
      setSelectedIds(new Set());
      load();
    } catch (err: any) {
      toast(err.message || 'Failed to resolve entries', 'error');
    }
  };

  return (
    <div className="p-6" data-tour-target="waitlist-table">
      <TooltipNudge
        id="waitlist-intro"
        title="How the waitlist works"
        description="When a customer can't find availability, they can join the waitlist. When a slot opens up (e.g. cancellation), matching customers are automatically notified."
      />
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
        <h1 className="text-2xl font-serif font-semibold text-slate-900">Waitlist</h1>
        <div className="flex gap-2 w-full sm:w-auto">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-slate-200 rounded-xl px-3 py-2 text-sm transition-colors flex-1 sm:flex-none"
          >
            <option value="">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="OFFERED">Offered</option>
            <option value="BOOKED">Booked</option>
            <option value="EXPIRED">Expired</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
          <select
            value={serviceFilter}
            onChange={(e) => setServiceFilter(e.target.value)}
            className="border border-slate-200 rounded-xl px-3 py-2 text-sm transition-colors flex-1 sm:flex-none"
          >
            <option value="">All Services</option>
            {services.map((s: any) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <ViewPicker
        page="waitlist"
        currentFilters={currentFilters}
        activeViewId={activeViewId}
        onApplyView={handleApplyView}
        onClearView={handleClearView}
      />

      <div className="bg-white rounded-2xl shadow-soft overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="w-10 p-3">
                  <input
                    type="checkbox"
                    checked={entries.length > 0 && selectedIds.size === entries.length}
                    onChange={toggleSelectAll}
                    className="rounded text-sage-600"
                  />
                </th>
                <th className="text-left p-3">
                  <span className="text-xs font-medium text-slate-500 uppercase">Customer</span>
                </th>
                <th className="text-left p-3">
                  <span className="text-xs font-medium text-slate-500 uppercase">Service</span>
                </th>
                <th className="text-left p-3">
                  <span className="text-xs font-medium text-slate-500 uppercase">
                    Preferred Staff
                  </span>
                </th>
                <th className="text-left p-3">
                  <span className="text-xs font-medium text-slate-500 uppercase">Time Window</span>
                </th>
                <th className="text-left p-3">
                  <SortableHeader
                    label="Status"
                    column="status"
                    currentSort={sortBy}
                    currentOrder={sortOrder}
                    onSort={handleSort}
                  />
                </th>
                <th className="text-left p-3">
                  <SortableHeader
                    label="Added"
                    column="createdAt"
                    currentSort={sortBy}
                    currentOrder={sortOrder}
                    onSort={handleSort}
                  />
                </th>
                <th className="text-left p-3">
                  <span className="text-xs font-medium text-slate-500 uppercase">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading
                ? Array.from({ length: 5 }).map((_, i) => <TableRowSkeleton key={i} cols={8} />)
                : entries.map((entry) => {
                    const StatusIcon = statusIcons[entry.status];
                    return (
                      <tr
                        key={entry.id}
                        className={cn(
                          'hover:bg-slate-50',
                          selectedIds.has(entry.id) && 'bg-sage-50/50',
                        )}
                      >
                        <td className="w-10 p-3" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedIds.has(entry.id)}
                            onChange={() => toggleSelect(entry.id)}
                            className="rounded text-sage-600"
                          />
                        </td>
                        <td className="p-3 text-sm">
                          <p className="font-medium">{entry.customer?.name}</p>
                          <p className="text-xs text-slate-500">{entry.customer?.phone}</p>
                        </td>
                        <td className="p-3 text-sm">{entry.service?.name}</td>
                        <td className="p-3 text-sm text-slate-600">{entry.staff?.name || 'Any'}</td>
                        <td className="p-3 text-sm text-slate-600">
                          {entry.timeWindowStart && entry.timeWindowEnd
                            ? `${entry.timeWindowStart} - ${entry.timeWindowEnd}`
                            : entry.notes || '—'}
                        </td>
                        <td className="p-3">
                          <span
                            className={cn(
                              'inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full',
                              statusColors[entry.status] || 'bg-slate-100 text-slate-600',
                            )}
                          >
                            {StatusIcon && <StatusIcon size={12} />}
                            {entry.status}
                          </span>
                        </td>
                        <td className="p-3 text-sm text-slate-500">
                          {new Date(entry.createdAt).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </td>
                        <td className="p-3">
                          <div className="flex gap-1">
                            {entry.status === 'ACTIVE' && (
                              <>
                                <button
                                  onClick={() => handleResolve(entry)}
                                  className="text-xs bg-sage-50 text-sage-700 px-2 py-1 rounded-lg hover:bg-sage-100 transition-colors"
                                >
                                  Resolve
                                </button>
                                <button
                                  onClick={() => handleCancel(entry.id)}
                                  className="text-xs bg-red-50 text-red-600 px-2 py-1 rounded-lg hover:bg-red-100 transition-colors"
                                >
                                  Cancel
                                </button>
                              </>
                            )}
                            {entry.status === 'OFFERED' && (
                              <button
                                onClick={() => handleCancel(entry.id)}
                                className="text-xs bg-red-50 text-red-600 px-2 py-1 rounded-lg hover:bg-red-100 transition-colors"
                              >
                                Cancel
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
            </tbody>
          </table>
        </div>
        {!loading && entries.length === 0 && (
          <EmptyState
            icon={ClipboardList}
            title="No waitlist entries"
            description={
              statusFilter
                ? `No ${statusFilter.toLowerCase()} entries found.`
                : 'Customers will appear here when they join the waitlist.'
            }
          />
        )}
      </div>

      <BulkActionBar
        count={selectedIds.size}
        onClear={() => setSelectedIds(new Set())}
        actions={[
          { label: 'Mark Resolved', onClick: handleBulkResolve },
          { label: 'Remove Selected', onClick: handleBulkRemove, variant: 'danger' },
        ]}
      />
    </div>
  );
}
