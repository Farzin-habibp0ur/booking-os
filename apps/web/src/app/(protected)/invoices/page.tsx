'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { ListSkeleton, EmptyState } from '@/components/skeleton';
import { INVOICE_STATUS_STYLES, invoiceBadgeClasses } from '@/lib/design-tokens';
import { FileText, Plus, DollarSign, AlertTriangle, TrendingUp, Clock, Search } from 'lucide-react';

interface Invoice {
  id: string;
  invoiceNumber: string;
  status: string;
  total: number;
  paidAmount: number;
  currency: string;
  dueDate: string;
  createdAt: string;
  customer: { id: string; name: string; email: string };
}

interface Stats {
  totalOutstanding: number;
  outstandingCount: number;
  overdueAmount: number;
  overdueCount: number;
  revenueThisMonth: number;
  paidThisMonthCount: number;
  avgDaysToPay: number;
}

const STATUS_TABS = [
  { value: '', label: 'All' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'SENT', label: 'Sent' },
  { value: 'OVERDUE', label: 'Overdue' },
  { value: 'PARTIALLY_PAID', label: 'Partial' },
  { value: 'PAID', label: 'Paid' },
];

export default function InvoicesPage() {
  const router = useRouter();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const pageSize = 20;

  useEffect(() => {
    loadData();
  }, [statusFilter, page]);

  const loadData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ skip: String(page * pageSize), take: String(pageSize) });
      if (statusFilter) params.set('status', statusFilter);

      const [listRes, statsRes] = await Promise.all([
        api.get<{ data: Invoice[]; total: number }>(`/invoices?${params}`),
        api.get<Stats>('/invoices/stats'),
      ]);
      setInvoices(listRes.data);
      setTotal(listRes.total);
      setStats(statsRes);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const filtered = search
    ? invoices.filter(
        (inv) =>
          inv.invoiceNumber.toLowerCase().includes(search.toLowerCase()) ||
          inv.customer?.name?.toLowerCase().includes(search.toLowerCase()),
      )
    : invoices;

  return (
    <div className="absolute inset-0 overflow-auto">
      <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-serif font-semibold text-slate-900">Invoices</h1>
            <p className="text-sm text-slate-500 mt-0.5">Manage billing and payments</p>
          </div>
          <button
            onClick={() => router.push('/invoices/new')}
            className="flex items-center gap-2 px-4 py-2 bg-sage-600 hover:bg-sage-700 text-white text-sm rounded-xl transition-colors btn-press"
          >
            <Plus size={16} />
            New Invoice
          </button>
        </div>

        {/* Stats bar */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white rounded-2xl shadow-soft p-4">
              <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
                <DollarSign size={14} />
                Outstanding
              </div>
              <p className="text-xl font-serif font-semibold text-slate-900">
                ${stats.totalOutstanding.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">{stats.outstandingCount} invoices</p>
            </div>
            <div className="bg-white rounded-2xl shadow-soft p-4">
              <div className="flex items-center gap-2 text-xs text-red-600 mb-1">
                <AlertTriangle size={14} />
                Overdue
              </div>
              <p className="text-xl font-serif font-semibold text-red-700">
                ${stats.overdueAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">{stats.overdueCount} invoices</p>
            </div>
            <div className="bg-white rounded-2xl shadow-soft p-4">
              <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
                <TrendingUp size={14} />
                Revenue (Month)
              </div>
              <p className="text-xl font-serif font-semibold text-sage-700">
                ${stats.revenueThisMonth.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">{stats.paidThisMonthCount} paid</p>
            </div>
            <div className="bg-white rounded-2xl shadow-soft p-4">
              <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
                <Clock size={14} />
                Avg. Days to Pay
              </div>
              <p className="text-xl font-serif font-semibold text-slate-900">
                {stats.avgDaysToPay}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">days</p>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex gap-1.5">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => {
                  setStatusFilter(tab.value);
                  setPage(0);
                }}
                className={cn(
                  'px-3 py-1.5 text-xs rounded-full transition-colors',
                  statusFilter === tab.value
                    ? 'bg-sage-100 text-sage-800 font-medium'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100',
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="relative ml-auto">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search invoices..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              data-search-input
              className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 border-transparent focus:bg-white focus:ring-2 focus:ring-sage-500 rounded-xl w-48"
            />
          </div>
        </div>

        {/* Invoice list */}
        {loading ? (
          <ListSkeleton rows={6} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No invoices found"
            description={statusFilter ? 'Try a different filter' : 'Create your first invoice'}
            action={{ label: 'New Invoice', onClick: () => router.push('/invoices/new') }}
          />
        ) : (
          <div className="bg-white rounded-2xl shadow-soft overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">
                    Invoice
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">
                    Customer
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 hidden sm:table-cell">
                    Date
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 hidden sm:table-cell">
                    Due
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-slate-500">
                    Amount
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-slate-500">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((inv) => (
                  <tr
                    key={inv.id}
                    onClick={() => router.push(`/invoices/${inv.id}`)}
                    className="border-b border-slate-50 hover:bg-slate-50/50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 font-medium text-slate-900">{inv.invoiceNumber}</td>
                    <td className="px-4 py-3 text-slate-600">{inv.customer?.name}</td>
                    <td className="px-4 py-3 text-slate-500 hidden sm:table-cell">
                      {new Date(inv.createdAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </td>
                    <td className="px-4 py-3 text-slate-500 hidden sm:table-cell">
                      {new Date(inv.dueDate).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-slate-900">
                      ${Number(inv.total).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={cn(
                          'inline-block px-2 py-0.5 text-xs rounded-full',
                          invoiceBadgeClasses(inv.status),
                        )}
                      >
                        {INVOICE_STATUS_STYLES[inv.status]?.label || inv.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {total > pageSize && (
          <div className="flex justify-center gap-2 pt-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-3 py-1.5 text-xs border rounded-lg disabled:opacity-50 hover:bg-slate-50 transition-colors"
            >
              Previous
            </button>
            <span className="px-3 py-1.5 text-xs text-slate-500">
              Page {page + 1} of {Math.ceil(total / pageSize)}
            </span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={(page + 1) * pageSize >= total}
              className="px-3 py-1.5 text-xs border rounded-lg disabled:opacity-50 hover:bg-slate-50 transition-colors"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
