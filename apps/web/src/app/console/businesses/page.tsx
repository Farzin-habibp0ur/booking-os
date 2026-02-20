'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { Search, Building2 } from 'lucide-react';
import { cn } from '@/lib/cn';

interface BusinessItem {
  id: string;
  name: string;
  slug: string;
  verticalPack: string;
  health: 'green' | 'yellow' | 'red';
  owner: { email: string; name: string } | null;
  plan: string;
  billingStatus: string | null;
  lastActive: string | null;
  counts: { bookings: number; customers: number };
}

interface BusinessListResponse {
  items: BusinessItem[];
  total: number;
  page: number;
  pageSize: number;
}

const HEALTH_COLORS: Record<string, string> = {
  green: 'bg-emerald-400',
  yellow: 'bg-amber-400',
  red: 'bg-red-400',
};

const PLAN_STYLES: Record<string, string> = {
  trial: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  basic: 'bg-sage-50 text-sage-700 dark:bg-sage-900/20 dark:text-sage-400',
  pro: 'bg-lavender-50 text-lavender-700 dark:bg-lavender-900/20 dark:text-lavender-400',
};

const BILLING_STYLES: Record<string, string> = {
  active: 'bg-sage-50 text-sage-700',
  past_due: 'bg-amber-50 text-amber-700',
  canceled: 'bg-red-50 text-red-700',
  trialing: 'bg-lavender-50 text-lavender-700',
};

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return '1 day ago';
  if (diffDays < 30) return `${diffDays} days ago`;
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths === 1) return '1 month ago';
  return `${diffMonths} months ago`;
}

export default function BusinessDirectoryPage() {
  const router = useRouter();
  const [data, setData] = useState<BusinessListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [plan, setPlan] = useState('');
  const [billingStatus, setBillingStatus] = useState('');
  const [health, setHealth] = useState('');
  const [page, setPage] = useState(1);

  const fetchBusinesses = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (plan) params.set('plan', plan);
      if (billingStatus) params.set('billingStatus', billingStatus);
      if (health) params.set('health', health);
      params.set('page', String(page));
      params.set('pageSize', '20');

      const result = await api.get<BusinessListResponse>(`/admin/businesses?${params.toString()}`);
      setData(result);
    } catch {
      setData({ items: [], total: 0, page: 1, pageSize: 20 });
    } finally {
      setLoading(false);
    }
  }, [search, plan, billingStatus, health, page]);

  useEffect(() => {
    fetchBusinesses();
  }, [fetchBusinesses]);

  // Debounce search
  const [searchInput, setSearchInput] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const totalPages = data ? Math.ceil(data.total / data.pageSize) : 0;

  return (
    <div className="p-6 md:p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-serif font-bold text-slate-900 dark:text-white">Businesses</h1>
        <span className="text-sm text-slate-500">{data ? `${data.total} total` : ''}</span>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="text"
            placeholder="Search by name, slug, or owner email..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border-transparent rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sage-500 focus:bg-white dark:focus:bg-slate-900"
            data-testid="search-input"
          />
        </div>
        <select
          value={plan}
          onChange={(e) => {
            setPlan(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl text-sm border-transparent focus:outline-none focus:ring-2 focus:ring-sage-500"
          data-testid="filter-plan"
        >
          <option value="">All Plans</option>
          <option value="trial">Trial</option>
          <option value="basic">Basic</option>
          <option value="pro">Pro</option>
        </select>
        <select
          value={billingStatus}
          onChange={(e) => {
            setBillingStatus(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl text-sm border-transparent focus:outline-none focus:ring-2 focus:ring-sage-500"
          data-testid="filter-billing"
        >
          <option value="">All Billing</option>
          <option value="active">Active</option>
          <option value="past_due">Past Due</option>
          <option value="canceled">Canceled</option>
          <option value="trialing">Trialing</option>
        </select>
        <select
          value={health}
          onChange={(e) => {
            setHealth(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl text-sm border-transparent focus:outline-none focus:ring-2 focus:ring-sage-500"
          data-testid="filter-health"
        >
          <option value="">All Health</option>
          <option value="green">Green</option>
          <option value="yellow">Yellow</option>
          <option value="red">Red</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-soft overflow-hidden">
        {loading ? (
          <div className="p-12 text-center" data-testid="loading">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sage-600 mx-auto" />
          </div>
        ) : data && data.items.length === 0 ? (
          <div className="p-12 text-center" data-testid="empty-state">
            <Building2 className="mx-auto text-slate-300 dark:text-slate-600 mb-3" size={40} />
            <p className="text-sm text-slate-500">No businesses found</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800">
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Business
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider hidden md:table-cell">
                  Health
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider hidden lg:table-cell">
                  Owner
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider hidden md:table-cell">
                  Plan
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider hidden lg:table-cell">
                  Billing
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider hidden xl:table-cell">
                  Vertical
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider hidden lg:table-cell">
                  Last Active
                </th>
              </tr>
            </thead>
            <tbody>
              {data?.items.map((biz) => (
                <tr
                  key={biz.id}
                  onClick={() => router.push(`/console/businesses/${biz.id}`)}
                  className="border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors"
                  data-testid={`business-row-${biz.id}`}
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900 dark:text-white">{biz.name}</div>
                    <div className="text-xs text-slate-400">{biz.slug}</div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span
                      className={cn(
                        'inline-block w-2.5 h-2.5 rounded-full',
                        HEALTH_COLORS[biz.health] || 'bg-slate-300',
                      )}
                      title={biz.health}
                    />
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400 hidden lg:table-cell">
                    {biz.owner?.email || '—'}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span
                      className={cn(
                        'inline-block px-2 py-0.5 text-xs rounded-lg font-medium capitalize',
                        PLAN_STYLES[biz.plan] || PLAN_STYLES.trial,
                      )}
                    >
                      {biz.plan}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    {biz.billingStatus ? (
                      <span
                        className={cn(
                          'inline-block px-2 py-0.5 text-xs rounded-lg font-medium',
                          BILLING_STYLES[biz.billingStatus] || '',
                        )}
                      >
                        {biz.billingStatus.replace('_', ' ')}
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400 capitalize hidden xl:table-cell">
                    {biz.verticalPack}
                  </td>
                  <td className="px-4 py-3 text-slate-500 hidden lg:table-cell">
                    {timeAgo(biz.lastActive)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 text-sm rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 disabled:opacity-40 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            Previous
          </button>
          <span className="text-sm text-slate-500">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1.5 text-sm rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 disabled:opacity-40 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
