'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { ChevronRight, CheckCircle, AlertTriangle } from 'lucide-react';
import Link from 'next/link';

interface PastDueItem {
  id: string;
  businessId: string;
  businessName: string;
  ownerEmail: string | null;
  plan: string;
  currentPeriodEnd: string;
  daysPastDue: number;
}

function agingColor(days: number): string {
  if (days >= 15) return 'text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400';
  if (days >= 8) return 'text-orange-600 bg-orange-50 dark:bg-orange-900/20 dark:text-orange-400';
  return 'text-amber-600 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400';
}

export default function PastDuePage() {
  const router = useRouter();
  const [items, setItems] = useState<PastDueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPastDue = useCallback(async () => {
    try {
      setLoading(true);
      const result = await api.get<PastDueItem[]>('/admin/billing/past-due');
      setItems(result);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load past-due accounts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPastDue();
  }, [fetchPastDue]);

  if (loading) {
    return (
      <div className="p-6 md:p-8 max-w-5xl" data-testid="past-due-loading">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-200 dark:bg-slate-800 rounded w-48" />
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-16 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 md:p-8 max-w-5xl">
        <h1 className="text-2xl font-serif font-bold text-slate-900 dark:text-white mb-6">Past-Due Accounts</h1>
        <div className="bg-red-50 dark:bg-red-900/20 rounded-2xl p-6 text-red-700 dark:text-red-400" data-testid="past-due-error">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-5xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-400 mb-4">
        <Link href="/console/billing" className="hover:text-slate-600">Billing</Link>
        <ChevronRight size={14} />
        <span className="text-slate-900 dark:text-white">Past-Due</span>
      </div>

      <h1 className="text-2xl font-serif font-bold text-slate-900 dark:text-white mb-6">Past-Due Accounts</h1>

      {items.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-soft p-8 text-center" data-testid="past-due-empty">
          <CheckCircle size={40} className="text-sage-500 mx-auto mb-3" />
          <p className="text-lg font-medium text-slate-900 dark:text-white">No past-due accounts</p>
          <p className="text-sm text-slate-400 mt-1">All accounts are in good standing.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-soft overflow-hidden">
          <table className="w-full" data-testid="past-due-table">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800">
                <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider px-4 py-3">Business</th>
                <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider px-4 py-3">Plan</th>
                <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider px-4 py-3 hidden md:table-cell">Owner</th>
                <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider px-4 py-3">Days Past Due</th>
                <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider px-4 py-3 hidden md:table-cell">Period End</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr
                  key={item.id}
                  onClick={() => router.push(`/console/businesses/${item.businessId}`)}
                  className="border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors"
                  data-testid={`past-due-row-${item.businessId}`}
                >
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-slate-900 dark:text-white">{item.businessName}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-medium px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 capitalize">
                      {item.plan}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className="text-sm text-slate-500">{item.ownerEmail || '—'}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${agingColor(item.daysPastDue)}`} data-testid={`days-badge-${item.businessId}`}>
                      {item.daysPastDue}d
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className="text-sm text-slate-500">
                      {new Date(item.currentPeriodEnd).toLocaleDateString()}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
