'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import {
  LifeBuoy,
  Search,
  Plus,
  ChevronLeft,
  ChevronRight,
  X,
  MessageSquare,
} from 'lucide-react';

interface SupportCase {
  id: string;
  businessId: string;
  businessName: string;
  subject: string;
  description: string;
  status: string;
  priority: string;
  category: string | null;
  resolution: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  _count: { notes: number };
}

interface SupportCaseDetail extends Omit<SupportCase, '_count'> {
  business: { id: string; name: string; slug: string };
  notes: Array<{
    id: string;
    authorName: string;
    content: string;
    createdAt: string;
  }>;
}

interface ListResponse {
  items: SupportCase[];
  total: number;
  page: number;
  pageSize: number;
}

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-sage-50 text-sage-900 dark:bg-sage-900/30 dark:text-sage-400',
  in_progress: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  resolved: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  closed: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
};

const PRIORITY_COLORS: Record<string, string> = {
  low: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  normal: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  high: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  urgent: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

function timeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function ConsoleSupportPage() {
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedCase, setSelectedCase] = useState<SupportCaseDetail | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const pageSize = 20;

  const fetchCases = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);
      if (priorityFilter) params.set('priority', priorityFilter);
      params.set('page', String(page));
      params.set('pageSize', String(pageSize));

      const result = await api.get<ListResponse>(`/admin/support-cases?${params.toString()}`);
      setData(result);
    } catch (err) {
      console.error('Failed to fetch support cases', err);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, priorityFilter, page]);

  useEffect(() => {
    const timer = setTimeout(() => fetchCases(), 300);
    return () => clearTimeout(timer);
  }, [fetchCases]);

  const openDetail = async (id: string) => {
    try {
      const detail = await api.get<SupportCaseDetail>(`/admin/support-cases/${id}`);
      setSelectedCase(detail);
      setShowDetail(true);
    } catch (err) {
      console.error('Failed to fetch case detail', err);
    }
  };

  const totalPages = data ? Math.ceil(data.total / pageSize) : 0;

  return (
    <div className="p-6 md:p-8 max-w-7xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-serif font-bold text-slate-900 dark:text-white">Support Cases</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl text-sm font-medium hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors"
        >
          <Plus size={16} />
          New Case
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="text"
            placeholder="Search cases..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border-transparent focus:bg-white dark:focus:bg-slate-700 focus:ring-2 focus:ring-sage-500 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border-transparent rounded-xl text-sm text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-sage-500"
        >
          <option value="">All Status</option>
          <option value="open">Open</option>
          <option value="in_progress">In Progress</option>
          <option value="resolved">Resolved</option>
          <option value="closed">Closed</option>
        </select>
        <select
          value={priorityFilter}
          onChange={(e) => { setPriorityFilter(e.target.value); setPage(1); }}
          className="px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border-transparent rounded-xl text-sm text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-sage-500"
        >
          <option value="">All Priority</option>
          <option value="urgent">Urgent</option>
          <option value="high">High</option>
          <option value="normal">Normal</option>
          <option value="low">Low</option>
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
            <LifeBuoy className="mx-auto text-slate-300 dark:text-slate-600 mb-4" size={48} />
            <p className="text-sm text-slate-500">No support cases found</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800">
                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Subject</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase hidden md:table-cell">Business</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase hidden sm:table-cell">Priority</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase hidden lg:table-cell">Notes</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                  {data.items.map((c) => (
                    <tr
                      key={c.id}
                      onClick={() => openDetail(c.id)}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer"
                    >
                      <td className="px-4 py-3 text-slate-900 dark:text-white font-medium truncate max-w-[250px]">{c.subject}</td>
                      <td className="px-4 py-3 text-slate-500 hidden md:table-cell truncate max-w-[150px]">{c.businessName}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-lg text-xs font-medium ${STATUS_COLORS[c.status] || ''}`}>
                          {c.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <span className={`px-2 py-1 rounded-lg text-xs font-medium ${PRIORITY_COLORS[c.priority] || ''}`}>
                          {c.priority}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500 hidden lg:table-cell">
                        <div className="flex items-center gap-1">
                          <MessageSquare size={12} />
                          {c._count.notes}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{timeAgo(c.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 dark:border-slate-800">
              <span className="text-xs text-slate-500">{data.total} total cases</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="text-xs text-slate-500">Page {page} of {totalPages}</span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Create Case Modal */}
      {showCreate && <CreateCaseModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); fetchCases(); }} />}

      {/* Case Detail Drawer */}
      {showDetail && selectedCase && (
        <CaseDetailDrawer
          caseData={selectedCase}
          onClose={() => { setShowDetail(false); setSelectedCase(null); }}
          onUpdated={() => { fetchCases(); openDetail(selectedCase.id); }}
        />
      )}
    </div>
  );
}

function CreateCaseModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [businessId, setBusinessId] = useState('');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('normal');
  const [category, setCategory] = useState('');
  const [businesses, setBusinesses] = useState<Array<{ id: string; name: string }>>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get<{ items: Array<{ id: string; name: string }> }>('/admin/businesses?pageSize=100')
      .then((r) => setBusinesses(r.items))
      .catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessId || !subject || !description) {
      setError('All fields are required');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await api.post('/admin/support-cases', {
        businessId,
        subject,
        description,
        priority,
        category: category || undefined,
      });
      onCreated();
    } catch (err: any) {
      setError(err?.message || 'Failed to create case');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl max-w-lg w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">New Support Case</h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Business</label>
            <select
              value={businessId}
              onChange={(e) => setBusinessId(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border-transparent rounded-xl text-sm focus:ring-2 focus:ring-sage-500"
              required
            >
              <option value="">Select a business</option>
              {businesses.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Subject</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border-transparent rounded-xl text-sm focus:ring-2 focus:ring-sage-500"
              placeholder="Brief description of the issue"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border-transparent rounded-xl text-sm focus:ring-2 focus:ring-sage-500 resize-none"
              placeholder="Detailed description..."
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border-transparent rounded-xl text-sm focus:ring-2 focus:ring-sage-500"
              >
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border-transparent rounded-xl text-sm focus:ring-2 focus:ring-sage-500"
              >
                <option value="">None</option>
                <option value="billing">Billing</option>
                <option value="technical">Technical</option>
                <option value="feature_request">Feature Request</option>
                <option value="bug">Bug</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2.5 text-sm bg-sage-600 text-white rounded-xl hover:bg-sage-700 transition-colors disabled:opacity-50"
            >
              {submitting ? 'Creating...' : 'Create Case'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CaseDetailDrawer({
  caseData,
  onClose,
  onUpdated,
}: {
  caseData: SupportCaseDetail;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [newNote, setNewNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);

  const addNote = async () => {
    if (!newNote.trim()) return;
    setSubmitting(true);
    try {
      await api.post(`/admin/support-cases/${caseData.id}/notes`, { content: newNote });
      setNewNote('');
      onUpdated();
    } catch (err) {
      console.error('Failed to add note', err);
    } finally {
      setSubmitting(false);
    }
  };

  const updateStatus = async (status: string) => {
    setStatusUpdating(true);
    try {
      await api.patch(`/admin/support-cases/${caseData.id}`, { status });
      onUpdated();
    } catch (err) {
      console.error('Failed to update status', err);
    } finally {
      setStatusUpdating(false);
    }
  };

  const nextStatus: Record<string, { label: string; value: string }> = {
    open: { label: 'Start Working', value: 'in_progress' },
    in_progress: { label: 'Mark Resolved', value: 'resolved' },
    resolved: { label: 'Close Case', value: 'closed' },
  };

  const action = nextStatus[caseData.status];

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex justify-end">
      <div className="bg-white dark:bg-slate-900 w-full max-w-lg shadow-xl flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3 min-w-0">
            <span className={`px-2 py-1 rounded-lg text-xs font-medium ${STATUS_COLORS[caseData.status] || ''}`}>
              {caseData.status.replace('_', ' ')}
            </span>
            <span className={`px-2 py-1 rounded-lg text-xs font-medium ${PRIORITY_COLORS[caseData.priority] || ''}`}>
              {caseData.priority}
            </span>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">{caseData.subject}</h2>
            <p className="text-sm text-slate-500">
              {caseData.business.name} &middot; {timeAgo(caseData.createdAt)}
            </p>
          </div>

          <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4">
            <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{caseData.description}</p>
          </div>

          {caseData.resolution && (
            <div className="bg-sage-50 dark:bg-sage-900/20 rounded-xl p-4">
              <p className="text-xs font-medium text-sage-700 dark:text-sage-400 mb-1">Resolution</p>
              <p className="text-sm text-sage-900 dark:text-sage-300 whitespace-pre-wrap">{caseData.resolution}</p>
            </div>
          )}

          {/* Status Action */}
          {action && (
            <button
              onClick={() => updateStatus(action.value)}
              disabled={statusUpdating}
              className="w-full px-4 py-2.5 text-sm bg-sage-600 text-white rounded-xl hover:bg-sage-700 transition-colors disabled:opacity-50"
            >
              {statusUpdating ? 'Updating...' : action.label}
            </button>
          )}

          {/* Notes */}
          <div>
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Notes</h3>
            {caseData.notes.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">No notes yet</p>
            ) : (
              <div className="space-y-3">
                {caseData.notes.map((note) => (
                  <div key={note.id} className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3">
                    <div className="flex justify-between text-xs text-slate-500 mb-1">
                      <span className="font-medium">{note.authorName}</span>
                      <span>{timeAgo(note.createdAt)}</span>
                    </div>
                    <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{note.content}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Add Note */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800">
          <div className="flex gap-2">
            <input
              type="text"
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Add a note..."
              className="flex-1 px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border-transparent rounded-xl text-sm focus:ring-2 focus:ring-sage-500"
              onKeyDown={(e) => e.key === 'Enter' && addNote()}
            />
            <button
              onClick={addNote}
              disabled={submitting || !newNote.trim()}
              className="px-4 py-2.5 text-sm bg-sage-600 text-white rounded-xl hover:bg-sage-700 transition-colors disabled:opacity-50"
            >
              {submitting ? '...' : 'Add'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
