'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { api } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { Search, ChevronLeft, ChevronRight, CreditCard } from 'lucide-react';
import Link from 'next/link';

interface SubscriptionItem {
  id: string;
  businessId: string;
  businessName: string;
  businessSlug: string;
  ownerEmail: string | null;
  plan: string;
  status: string;
  currentPeriodEnd: string;
  createdAt: string;
}

interface ListResponse {
  items: SubscriptionItem[];
  total: number;
  page: number;
  pageSize: number;
}

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-sage-50 text-sage-900 dark:bg-sage-900/30 dark:text-sage-400',
  trialing: 'bg-lavender-50 text-lavender-900 dark:bg-lavender-900/30 dark:text-lavender-400',
  past_due: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  canceled: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

const PLAN_COLORS: Record<string, string> = {
  basic: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  pro: 'bg-lavender-50 text-lavender-900 dark:bg-lavender-900/30 dark:text-lavender-400',
};

export default function SubscriptionsPage() {
  const router = useRouter();
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const searchTimer = useRef<NodeJS.Timeout | null>(null);

  const fetchSubscriptions = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (planFilter) params.set('plan', planFilter);
      if (statusFilter) params.set('status', statusFilter);
      params.set('page', String(page));
      params.set('pageSize', '20');

      const result = await api.get<ListResponse>(
        `/admin/billing/subscriptions?${params.toString()}`,
      );
      setData(result);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load subscriptions');
    } finally {
      setLoading(false);
    }
  }, [search, planFilter, statusFilter, page]);

  useEffect(() => {
    fetchSubscriptions();
  }, [fetchSubscriptions]);

  const handleSearchChange = (value: string) => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setSearch(value);
      setPage(1);
    }, 300);
  };

  const totalPages = data ? Math.ceil(data.total / data.pageSize) : 0;

  if (error && !data) {
    return (
      <div className="p-6 md:p-8 max-w-6xl">
        <h1 className="text-2xl font-serif font-bold text-slate-900 dark:text-white mb-6">
          Subscriptions
        </h1>
        <div
          className="bg-red-50 dark:bg-red-900/20 rounded-2xl p-6 text-red-700 dark:text-red-400"
          data-testid="subscriptions-error"
        >
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-6xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-400 mb-4">
        <Link href="/console/billing" className="hover:text-slate-600">
          Billing
        </Link>
        <ChevronRight size={14} />
        <span className="text-slate-900 dark:text-white">Subscriptions</span>
      </div>

      <h1 className="text-2xl font-serif font-bold text-slate-900 dark:text-white mb-6">
        Subscriptions
      </h1>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search businesses..."
            defaultValue={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border-transparent rounded-xl text-sm focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-sage-500 outline-none"
            data-testid="search-input"
          />
        </div>
        <select
          value={planFilter}
          onChange={(e) => {
            setPlanFilter(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl text-sm border-transparent focus:ring-2 focus:ring-sage-500 outline-none"
          data-testid="plan-filter"
        >
          <option value="">All Plans</option>
          <option value="basic">Basic</option>
          <option value="pro">Pro</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl text-sm border-transparent focus:ring-2 focus:ring-sage-500 outline-none"
          data-testid="status-filter"
        >
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="trialing">Trialing</option>
          <option value="past_due">Past Due</option>
          <option value="canceled">Canceled</option>
        </select>
      </div>

      {/* Table */}
      {loading && !data ? (
        <div className="animate-pulse space-y-3" data-testid="subscriptions-loading">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-14 bg-slate-200 dark:bg-slate-800 rounded-xl" />
          ))}
        </div>
      ) : !data || data.items.length === 0 ? (
        <div
          className="bg-white dark:bg-slate-900 rounded-2xl shadow-soft p-8 text-center"
          data-testid="subscriptions-empty"
        >
          <CreditCard size={40} className="text-slate-300 mx-auto mb-3" />
          <p className="text-lg font-medium text-slate-900 dark:text-white">
            No subscriptions found
          </p>
          <p className="text-sm text-slate-400 mt-1">Try adjusting your filters.</p>
        </div>
      ) : (
        <>
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-soft overflow-hidden">
            <table className="w-full" data-testid="subscriptions-table">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800">
                  <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider px-4 py-3">
                    Business
                  </th>
                  <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider px-4 py-3">
                    Plan
                  </th>
                  <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider px-4 py-3">
                    Status
                  </th>
                  <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider px-4 py-3 hidden md:table-cell">
                    Owner
                  </th>
                  <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider px-4 py-3 hidden md:table-cell">
                    Period End
                  </th>
                  <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider px-4 py-3 hidden lg:table-cell">
                    Created
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((item) => (
                  <tr
                    key={item.id}
                    onClick={() => router.push(`/console/businesses/${item.businessId}`)}
                    className="border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors"
                    data-testid={`sub-row-${item.id}`}
                  >
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-slate-900 dark:text-white">
                        {item.businessName}
                      </p>
                      <p className="text-xs text-slate-400">{item.businessSlug}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs font-medium px-2 py-1 rounded-full capitalize ${PLAN_COLORS[item.plan] || ''}`}
                      >
                        {item.plan}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs font-medium px-2 py-1 rounded-full ${STATUS_COLORS[item.status] || ''}`}
                      >
                        {item.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="text-sm text-slate-500">{item.ownerEmail || '—'}</span>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="text-sm text-slate-500">
                        {new Date(item.currentPeriodEnd).toLocaleDateString()}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <span className="text-sm text-slate-500">
                        {new Date(item.createdAt).toLocaleDateString()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4" data-testid="pagination">
              <span className="text-sm text-slate-400">
                {data.total} subscription{data.total !== 1 ? 's' : ''} total
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed"
                  data-testid="prev-page"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="text-sm text-slate-600 dark:text-slate-300">
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed"
                  data-testid="next-page"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
