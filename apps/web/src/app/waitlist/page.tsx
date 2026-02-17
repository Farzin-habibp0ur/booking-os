'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { TableRowSkeleton, EmptyState } from '@/components/skeleton';
import { ClipboardList, X, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import TooltipNudge from '@/components/tooltip-nudge';

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

  const load = () => {
    const params = new URLSearchParams();
    if (statusFilter) params.set('status', statusFilter);
    if (serviceFilter) params.set('serviceId', serviceFilter);
    const qs = params.toString() ? `?${params.toString()}` : '';
    api
      .get<any[]>(`/waitlist${qs}`)
      .then(setEntries)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [statusFilter, serviceFilter]);

  useEffect(() => {
    api.get<any[]>('/services').then(setServices).catch(console.error);
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

  return (
    <div className="p-6">
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

      <div className="bg-white rounded-2xl shadow-soft overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="text-left p-3 text-xs font-medium text-slate-500 uppercase">
                  Customer
                </th>
                <th className="text-left p-3 text-xs font-medium text-slate-500 uppercase">
                  Service
                </th>
                <th className="text-left p-3 text-xs font-medium text-slate-500 uppercase">
                  Preferred Staff
                </th>
                <th className="text-left p-3 text-xs font-medium text-slate-500 uppercase">
                  Time Window
                </th>
                <th className="text-left p-3 text-xs font-medium text-slate-500 uppercase">
                  Status
                </th>
                <th className="text-left p-3 text-xs font-medium text-slate-500 uppercase">
                  Added
                </th>
                <th className="text-left p-3 text-xs font-medium text-slate-500 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading
                ? Array.from({ length: 5 }).map((_, i) => <TableRowSkeleton key={i} cols={7} />)
                : entries.map((entry) => {
                    const StatusIcon = statusIcons[entry.status];
                    return (
                      <tr key={entry.id} className="hover:bg-slate-50">
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
    </div>
  );
}
