'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useToast } from '@/lib/toast';
import { cn } from '@/lib/cn';
import { ArrowLeft, Copy, Merge, XCircle, Clock, Loader2, ChevronRight } from 'lucide-react';
import { TableRowSkeleton, EmptyState } from '@/components/skeleton';

type DuplicateStatus = 'PENDING' | 'SNOOZED' | 'MERGED' | 'NOT_DUPLICATE';

const statusTabs: { key: DuplicateStatus | ''; label: string }[] = [
  { key: '', label: 'All' },
  { key: 'PENDING', label: 'Pending' },
  { key: 'SNOOZED', label: 'Snoozed' },
  { key: 'MERGED', label: 'Resolved' },
];

export default function DuplicatesPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [data, setData] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<DuplicateStatus | ''>('PENDING');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const load = (status?: DuplicateStatus | '') => {
    setLoading(true);
    const filter = status ?? statusFilter;
    const params = filter ? `?status=${filter}&pageSize=50` : '?pageSize=50';
    api
      .get<any>(`/customers/duplicates${params}`)
      .then((res) => {
        setData(res.data || []);
        setTotal(res.total || 0);
      })
      .catch((err) => toast(err.message || 'Failed to load duplicates', 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [statusFilter]);

  const handleMerge = async (id: string) => {
    setActionLoading(id);
    try {
      await api.post(`/customers/duplicates/${id}/merge`);
      toast('Customers merged successfully');
      load();
    } catch (err: any) {
      toast(err.message || 'Merge failed', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleNotDuplicate = async (id: string) => {
    setActionLoading(id);
    try {
      await api.post(`/customers/duplicates/${id}/not-duplicate`);
      toast('Marked as not duplicate');
      load();
    } catch (err: any) {
      toast(err.message || 'Action failed', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleSnooze = async (id: string) => {
    setActionLoading(id);
    try {
      await api.post(`/customers/duplicates/${id}/snooze`);
      toast('Snoozed for later review');
      load();
    } catch (err: any) {
      toast(err.message || 'Action failed', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={() => router.push('/customers')}
          className="text-slate-400 hover:text-slate-600 transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-serif font-semibold text-slate-900">Review Duplicates</h1>
          <p className="text-sm text-slate-500">{total} duplicate candidates found</p>
        </div>
      </div>

      <div className="flex gap-1 mb-4">
        {statusTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setStatusFilter(tab.key as DuplicateStatus | '')}
            className={cn(
              'px-3 py-1.5 rounded-lg text-sm transition-colors',
              statusFilter === tab.key
                ? 'bg-sage-100 text-sage-700 font-medium'
                : 'text-slate-500 hover:bg-slate-100',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {loading ? (
          <div className="bg-white rounded-2xl shadow-soft p-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <TableRowSkeleton key={i} cols={4} />
            ))}
          </div>
        ) : data.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-soft">
            <EmptyState
              icon={Copy}
              title="No duplicates found"
              description={
                statusFilter
                  ? `No ${statusFilter.toLowerCase()} duplicate candidates`
                  : 'No duplicate candidates detected'
              }
            />
          </div>
        ) : (
          data.map((dup: any) => (
            <DuplicateCard
              key={dup.id}
              duplicate={dup}
              isLoading={actionLoading === dup.id}
              onMerge={() => handleMerge(dup.id)}
              onNotDuplicate={() => handleNotDuplicate(dup.id)}
              onSnooze={() => handleSnooze(dup.id)}
              onViewCustomer={(id: string) => router.push(`/customers/${id}`)}
            />
          ))
        )}
      </div>
    </div>
  );
}

function DuplicateCard({
  duplicate,
  isLoading,
  onMerge,
  onNotDuplicate,
  onSnooze,
  onViewCustomer,
}: {
  duplicate: any;
  isLoading: boolean;
  onMerge: () => void;
  onNotDuplicate: () => void;
  onSnooze: () => void;
  onViewCustomer: (id: string) => void;
}) {
  const c1 = duplicate.customer1;
  const c2 = duplicate.customer2;
  const confidence = Math.round((duplicate.confidence || 0) * 100);
  const matchFields = duplicate.matchFields || [];
  const isResolved = duplicate.status === 'MERGED' || duplicate.status === 'NOT_DUPLICATE';

  return (
    <div className="bg-white rounded-2xl shadow-soft p-4">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'text-xs px-2 py-0.5 rounded-full font-medium',
              confidence >= 80
                ? 'bg-red-50 text-red-700'
                : confidence >= 50
                  ? 'bg-amber-50 text-amber-700'
                  : 'bg-slate-100 text-slate-600',
            )}
          >
            {confidence}% match
          </span>
          <span className="text-xs text-slate-400">{matchFields.join(', ')}</span>
        </div>
        {duplicate.status !== 'PENDING' && (
          <span
            className={cn(
              'text-xs px-2 py-0.5 rounded-full',
              duplicate.status === 'MERGED' && 'bg-sage-50 text-sage-700',
              duplicate.status === 'NOT_DUPLICATE' && 'bg-slate-100 text-slate-600',
              duplicate.status === 'SNOOZED' && 'bg-amber-50 text-amber-700',
            )}
          >
            {duplicate.status === 'NOT_DUPLICATE' ? 'Not Duplicate' : duplicate.status}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <CustomerCard customer={c1} onView={() => onViewCustomer(c1?.id)} />
        <CustomerCard customer={c2} onView={() => onViewCustomer(c2?.id)} />
      </div>

      {!isResolved && (
        <div className="flex gap-2 pt-2 border-t">
          <button
            onClick={onMerge}
            disabled={isLoading}
            className="flex items-center gap-1 px-3 py-1.5 bg-sage-600 text-white rounded-xl text-sm hover:bg-sage-700 disabled:opacity-50 transition-colors"
          >
            {isLoading ? <Loader2 size={14} className="animate-spin" /> : <Merge size={14} />}
            Merge
          </button>
          <button
            onClick={onNotDuplicate}
            disabled={isLoading}
            className="flex items-center gap-1 px-3 py-1.5 border rounded-xl text-sm hover:bg-slate-50 disabled:opacity-50 transition-colors"
          >
            <XCircle size={14} /> Not Duplicate
          </button>
          <button
            onClick={onSnooze}
            disabled={isLoading}
            className="flex items-center gap-1 px-3 py-1.5 border rounded-xl text-sm hover:bg-slate-50 disabled:opacity-50 transition-colors"
          >
            <Clock size={14} /> Snooze
          </button>
        </div>
      )}
    </div>
  );
}

function CustomerCard({ customer, onView }: { customer: any; onView: () => void }) {
  if (!customer)
    return <div className="bg-slate-50 rounded-xl p-3 text-sm text-slate-400">Deleted</div>;

  return (
    <button
      onClick={onView}
      className="bg-slate-50 rounded-xl p-3 text-left hover:bg-slate-100 transition-colors group"
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-900">{customer.name}</p>
        <ChevronRight size={14} className="text-slate-300 group-hover:text-slate-500" />
      </div>
      <p className="text-xs text-slate-500 mt-0.5">{customer.phone}</p>
      {customer.email && <p className="text-xs text-slate-500">{customer.email}</p>}
      {customer.tags?.length > 0 && (
        <div className="flex gap-1 mt-1.5">
          {customer.tags.slice(0, 3).map((tag: string) => (
            <span key={tag} className="text-xs bg-white px-1.5 py-0.5 rounded-full text-slate-500">
              {tag}
            </span>
          ))}
        </div>
      )}
    </button>
  );
}
