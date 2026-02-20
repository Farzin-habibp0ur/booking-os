'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { Shield, Search, ChevronLeft, ChevronRight } from 'lucide-react';

interface AuditLog {
  id: string;
  actorId: string;
  actorEmail: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  reason: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

interface AuditResponse {
  items: AuditLog[];
  total: number;
  page: number;
  pageSize: number;
}

function formatAction(action: string): string {
  return action
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/^\w/, (c) => c.toUpperCase());
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const ACTION_COLORS: Record<string, string> = {
  VIEW_AS_START: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  VIEW_AS_END: 'bg-sage-50 text-sage-700 dark:bg-sage-900/30 dark:text-sage-400',
  BUSINESS_LOOKUP: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  SUPPORT_CASE_CREATE:
    'bg-lavender-50 text-lavender-700 dark:bg-lavender-900/30 dark:text-lavender-400',
  SUPPORT_CASE_UPDATE:
    'bg-lavender-50 text-lavender-700 dark:bg-lavender-900/30 dark:text-lavender-400',
};

export default function ConsoleAuditPage() {
  const [data, setData] = useState<AuditResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [actionTypes, setActionTypes] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (actionFilter) params.set('action', actionFilter);
      params.set('page', String(page));
      params.set('pageSize', String(pageSize));

      const result = await api.get<AuditResponse>(`/admin/audit-logs?${params.toString()}`);
      setData(result);
    } catch (err) {
      console.error('Failed to fetch audit logs', err);
    } finally {
      setLoading(false);
    }
  }, [search, actionFilter, page]);

  useEffect(() => {
    api
      .get<string[]>('/admin/audit-logs/action-types')
      .then(setActionTypes)
      .catch(() => {});
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => fetchLogs(), 300);
    return () => clearTimeout(timer);
  }, [fetchLogs]);

  const totalPages = data ? Math.ceil(data.total / pageSize) : 0;

  return (
    <div className="p-6 md:p-8 max-w-7xl">
      <h1 className="text-2xl font-serif font-bold text-slate-900 dark:text-white mb-6">
        Security & Audit
      </h1>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="text"
            placeholder="Search by actor, action, or target..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border-transparent focus:bg-white dark:focus:bg-slate-700 focus:ring-2 focus:ring-sage-500 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400"
          />
        </div>
        <select
          value={actionFilter}
          onChange={(e) => {
            setActionFilter(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border-transparent rounded-xl text-sm text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-sage-500"
        >
          <option value="">All Actions</option>
          {actionTypes.map((a) => (
            <option key={a} value={a}>
              {formatAction(a)}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-soft overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sage-600" />
          </div>
        ) : !data || data.items.length === 0 ? (
          <div className="text-center py-16">
            <Shield className="mx-auto text-slate-300 dark:text-slate-600 mb-4" size={48} />
            <p className="text-sm text-slate-500">No audit logs found</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800">
                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">
                      Time
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">
                      Actor
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">
                      Action
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase hidden md:table-cell">
                      Target
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase hidden lg:table-cell">
                      Reason
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                  {data.items.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                        {formatDate(log.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-slate-900 dark:text-white truncate max-w-[200px]">
                        {log.actorEmail}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-1 rounded-lg text-xs font-medium ${ACTION_COLORS[log.action] || 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}
                        >
                          {formatAction(log.action)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500 hidden md:table-cell">
                        {log.targetType ? (
                          <span className="text-xs">
                            {log.targetType}:{' '}
                            <span className="font-mono text-slate-400">
                              {log.targetId?.slice(0, 12)}...
                            </span>
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-500 hidden lg:table-cell truncate max-w-[200px]">
                        {log.reason || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 dark:border-slate-800">
              <span className="text-xs text-slate-500">{data.total} total entries</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="text-xs text-slate-500">
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
