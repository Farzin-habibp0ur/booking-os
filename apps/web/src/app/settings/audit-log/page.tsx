'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Shield, Download, ChevronDown, ChevronRight, ArrowLeft, Search } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { DiffViewer } from '@/components/action-history';

interface ActionHistoryItem {
  id: string;
  actorType: string;
  actorId: string;
  actorName?: string;
  action: string;
  entityType: string;
  entityId: string;
  description?: string;
  diff?: { before?: any; after?: any };
  metadata?: any;
  createdAt: string;
}

interface ActionHistoryResponse {
  items: ActionHistoryItem[];
  total: number;
  page: number;
  pageSize: number;
}

const ACTOR_TYPES = ['All', 'STAFF', 'AI', 'SYSTEM', 'CUSTOMER'] as const;
const ENTITY_TYPES = [
  'All',
  'BOOKING',
  'CONVERSATION',
  'CUSTOMER',
  'ACTION_CARD',
  'SETTING',
  'STAFF',
] as const;
const ACTIONS = [
  'All',
  'BOOKING_CREATED',
  'BOOKING_UPDATED',
  'BOOKING_CANCELLED',
  'BOOKING_STATUS_CHANGED',
  'CONVERSATION_ASSIGNED',
  'CONVERSATION_STATUS_CHANGED',
  'CARD_APPROVED',
  'CARD_DISMISSED',
  'CARD_EXECUTED',
  'SETTING_CHANGED',
] as const;

const ACTOR_LABELS: Record<string, string> = {
  All: 'All Actors',
  STAFF: 'Staff',
  AI: 'AI',
  SYSTEM: 'System',
  CUSTOMER: 'Customer',
};

const ENTITY_LABELS: Record<string, string> = {
  All: 'All Resources',
  BOOKING: 'Booking',
  CONVERSATION: 'Conversation',
  CUSTOMER: 'Customer',
  ACTION_CARD: 'Action Card',
  SETTING: 'Setting',
  STAFF: 'Staff',
};

const ACTION_LABELS: Record<string, string> = {
  All: 'All Actions',
  BOOKING_CREATED: 'Created',
  BOOKING_UPDATED: 'Updated',
  BOOKING_CANCELLED: 'Cancelled',
  BOOKING_STATUS_CHANGED: 'Status Changed',
  CONVERSATION_ASSIGNED: 'Assigned',
  CONVERSATION_STATUS_CHANGED: 'Status Changed',
  CARD_APPROVED: 'Approved',
  CARD_DISMISSED: 'Dismissed',
  CARD_EXECUTED: 'Executed',
  SETTING_CHANGED: 'Setting Changed',
};

const ACTOR_TYPE_COLORS: Record<string, string> = {
  STAFF: 'bg-sage-50 text-sage-700',
  AI: 'bg-lavender-50 text-lavender-700',
  SYSTEM: 'bg-slate-100 text-slate-600',
  CUSTOMER: 'bg-amber-50 text-amber-700',
};

const PAGE_SIZE = 20;

function timeAgo(date: string): string {
  const mins = Math.floor((Date.now() - new Date(date).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function AuditLogPage() {
  const [data, setData] = useState<ActionHistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [entityType, setEntityType] = useState('All');
  const [action, setAction] = useState('All');
  const [actorType, setActorType] = useState('All');
  const [search, setSearch] = useState('');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('pageSize', String(PAGE_SIZE));
      if (entityType !== 'All') params.set('entityType', entityType);
      if (action !== 'All') params.set('action', action);
      const result = await api.get<ActionHistoryResponse>(`/action-history?${params.toString()}`);
      setData(result);
    } catch {
      setData({ items: [], total: 0, page: 1, pageSize: PAGE_SIZE });
    }
    setLoading(false);
  }, [page, entityType, action]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    setPage(1);
  }, [entityType, action, actorType]);

  const handleExport = async () => {
    try {
      const params = new URLSearchParams();
      if (entityType !== 'All') params.set('entityType', entityType);
      if (actorType !== 'All') params.set('actorType', actorType);
      const csv = await api.getText(`/action-history/export?${params.toString()}`);
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'audit-log.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // Export failed silently
    }
  };

  const filteredItems = (data?.items || []).filter((item) => {
    if (actorType !== 'All' && item.actorType !== actorType) return false;
    if (search && !(item.description || '').toLowerCase().includes(search.toLowerCase()))
      return false;
    return true;
  });

  const totalPages = Math.ceil((data?.total || 0) / PAGE_SIZE);

  return (
    <div className="p-6 max-w-5xl">
      <Link
        href="/settings"
        className="inline-flex items-center gap-1 text-sm text-sage-600 hover:text-sage-700 dark:text-sage-400 dark:hover:text-sage-300 mb-3 transition-colors"
      >
        <ArrowLeft size={14} />
        Back to Settings
      </Link>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Shield size={24} className="text-sage-600" />
          <h1 className="text-2xl font-serif font-semibold text-slate-900">Audit Log</h1>
        </div>
        <button
          onClick={handleExport}
          className="inline-flex items-center gap-2 border border-slate-200 px-4 py-2 rounded-xl text-sm hover:bg-slate-50 transition-colors"
          data-testid="export-csv-btn"
        >
          <Download size={14} />
          Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl shadow-soft p-4 mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={actorType}
            onChange={(e) => setActorType(e.target.value)}
            className="bg-slate-50 border-transparent focus:bg-white focus:ring-2 focus:ring-sage-500 rounded-xl text-sm px-3 py-2"
            data-testid="filter-actor-type"
          >
            {ACTOR_TYPES.map((t) => (
              <option key={t} value={t}>
                {ACTOR_LABELS[t]}
              </option>
            ))}
          </select>

          <select
            value={entityType}
            onChange={(e) => setEntityType(e.target.value)}
            className="bg-slate-50 border-transparent focus:bg-white focus:ring-2 focus:ring-sage-500 rounded-xl text-sm px-3 py-2"
            data-testid="filter-entity-type"
          >
            {ENTITY_TYPES.map((t) => (
              <option key={t} value={t}>
                {ENTITY_LABELS[t]}
              </option>
            ))}
          </select>

          <select
            value={action}
            onChange={(e) => setAction(e.target.value)}
            className="bg-slate-50 border-transparent focus:bg-white focus:ring-2 focus:ring-sage-500 rounded-xl text-sm px-3 py-2"
            data-testid="filter-action"
          >
            {ACTIONS.map((a) => (
              <option key={a} value={a}>
                {ACTION_LABELS[a]}
              </option>
            ))}
          </select>

          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search descriptions..."
              className="w-full bg-slate-50 border-transparent focus:bg-white focus:ring-2 focus:ring-sage-500 rounded-xl text-sm pl-9 pr-3 py-2"
              data-testid="search-input"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-soft overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-3 animate-pulse" data-testid="loading-skeleton">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 bg-slate-100 rounded-xl" />
            ))}
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="p-12 text-center" data-testid="empty-state">
            <p className="text-slate-400 text-sm">No activity found</p>
          </div>
        ) : (
          <table className="w-full text-sm" data-testid="audit-table">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="text-left p-3 text-xs font-medium text-slate-500 w-8" />
                <th className="text-left p-3 text-xs font-medium text-slate-500">Timestamp</th>
                <th className="text-left p-3 text-xs font-medium text-slate-500">Actor</th>
                <th className="text-left p-3 text-xs font-medium text-slate-500">Action</th>
                <th className="text-left p-3 text-xs font-medium text-slate-500">Resource</th>
                <th className="text-left p-3 text-xs font-medium text-slate-500">Description</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item, idx) => {
                const isExpanded = expandedRow === item.id;
                const hasDiff = item.diff && (item.diff.before || item.diff.after);
                const hasMetadata = item.metadata && Object.keys(item.metadata).length > 0;
                const isExpandable = hasDiff || hasMetadata;

                return (
                  <tr key={item.id} data-testid={`audit-row-${item.id}`} className="group">
                    <td colSpan={6} className="p-0">
                      <div
                        className={cn(
                          'flex items-center p-3 transition-colors',
                          idx % 2 === 1 && 'bg-slate-50/30',
                          isExpandable && 'cursor-pointer hover:bg-slate-50',
                        )}
                        onClick={() => {
                          if (isExpandable) {
                            setExpandedRow(isExpanded ? null : item.id);
                          }
                        }}
                      >
                        <div className="w-8 flex-shrink-0">
                          {isExpandable &&
                            (isExpanded ? (
                              <ChevronDown size={14} className="text-slate-400" />
                            ) : (
                              <ChevronRight size={14} className="text-slate-400" />
                            ))}
                        </div>
                        <div className="flex-1 min-w-[100px]">
                          <span title={new Date(item.createdAt).toLocaleString()}>
                            {timeAgo(item.createdAt)}
                          </span>
                        </div>
                        <div className="flex-1 min-w-[120px]">
                          <span className="mr-2">{item.actorName || 'Unknown'}</span>
                          <span
                            className={cn(
                              'inline-block text-[10px] px-1.5 py-0.5 rounded-full font-medium',
                              ACTOR_TYPE_COLORS[item.actorType] || 'bg-slate-100 text-slate-600',
                            )}
                          >
                            {item.actorType}
                          </span>
                        </div>
                        <div className="flex-1 min-w-[100px] font-medium text-slate-700">
                          {ACTION_LABELS[item.action] || item.action}
                        </div>
                        <div className="flex-1 min-w-[100px] text-slate-500">
                          {ENTITY_LABELS[item.entityType] || item.entityType}
                        </div>
                        <div className="flex-[2] min-w-[150px] text-slate-600 truncate">
                          {item.description || '-'}
                        </div>
                      </div>
                      {isExpanded && (
                        <div
                          className="px-11 pb-4 pt-1 border-t border-slate-100 bg-slate-50/50"
                          data-testid={`audit-row-expanded-${item.id}`}
                        >
                          {hasDiff && (
                            <div>
                              <p className="text-xs font-medium text-slate-500 mb-2">Changes</p>
                              <DiffViewer before={item.diff?.before} after={item.diff?.after} />
                            </div>
                          )}
                          {hasMetadata && !hasDiff && (
                            <div>
                              <p className="text-xs font-medium text-slate-500 mb-2">Metadata</p>
                              <pre className="text-xs text-slate-600 bg-white rounded-lg p-3 overflow-auto max-h-40">
                                {JSON.stringify(item.metadata, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {!loading && (data?.total || 0) > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
            <p className="text-xs text-slate-500">{data?.total || 0} total entries</p>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="text-sm px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                data-testid="pagination-prev"
              >
                Previous
              </button>
              <span className="text-xs text-slate-500" data-testid="pagination-info">
                Page {page} of {totalPages || 1}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="text-sm px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                data-testid="pagination-next"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
