'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/cn';
import { useToast } from '@/lib/toast';
import {
  FileText,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  Filter,
  Sparkles,
  Clock,
  CheckCircle2,
  XCircle,
  Calendar,
  Send,
} from 'lucide-react';

interface ContentDraft {
  id: string;
  title: string;
  body: string;
  contentType: string;
  channel: string;
  pillar?: string;
  status: string;
  agentId?: string;
  scheduledFor?: string;
  publishedAt?: string;
  reviewedById?: string;
  reviewNote?: string;
  createdAt: string;
}

interface Stats {
  byStatus: Record<string, number>;
  byContentType: Record<string, number>;
  byChannel: Record<string, number>;
}

const STATUS_STYLES: Record<string, string> = {
  PENDING_REVIEW: 'bg-lavender-50 text-lavender-700',
  APPROVED: 'bg-sage-50 text-sage-700',
  SCHEDULED: 'bg-blue-50 text-blue-700',
  PUBLISHED: 'bg-emerald-50 text-emerald-700',
  REJECTED: 'bg-red-50 text-red-700',
};

const STATUS_LABELS: Record<string, string> = {
  PENDING_REVIEW: 'Pending',
  APPROVED: 'Approved',
  SCHEDULED: 'Scheduled',
  PUBLISHED: 'Published',
  REJECTED: 'Rejected',
};

const CONTENT_TYPE_LABELS: Record<string, string> = {
  BLOG_POST: 'Blog Post',
  SOCIAL_POST: 'Social Post',
  EMAIL: 'Email',
  CASE_STUDY: 'Case Study',
  VIDEO_SCRIPT: 'Video Script',
  NEWSLETTER: 'Newsletter',
};

const CHANNEL_LABELS: Record<string, string> = {
  BLOG: 'Blog',
  TWITTER: 'Twitter',
  LINKEDIN: 'LinkedIn',
  INSTAGRAM: 'Instagram',
  EMAIL: 'Email',
  YOUTUBE: 'YouTube',
};

export default function ContentQueuePage() {
  const { t } = useI18n();
  const { toast } = useToast();
  const [drafts, setDrafts] = useState<ContentDraft[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [contentTypeFilter, setContentTypeFilter] = useState('');
  const [channelFilter, setChannelFilter] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [rejectNoteId, setRejectNoteId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState('');

  const fetchDrafts = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      if (contentTypeFilter) params.set('contentType', contentTypeFilter);
      if (channelFilter) params.set('channel', channelFilter);
      params.set('take', '50');

      const [draftsRes, statsRes] = await Promise.all([
        api.get<{ data: ContentDraft[]; total: number }>(`/content-queue?${params.toString()}`),
        api.get<Stats>('/content-queue/stats'),
      ]);
      setDrafts(draftsRes.data);
      setTotal(draftsRes.total);
      setStats(statsRes);
    } catch {
      // handled by api client
    } finally {
      setLoading(false);
    }
  }, [statusFilter, contentTypeFilter, channelFilter]);

  useEffect(() => {
    fetchDrafts();
  }, [fetchDrafts]);

  const handleApprove = async (id: string) => {
    try {
      await api.post(`/content-queue/${id}/approve`, {});
      toast('Content approved', 'success');
      fetchDrafts();
    } catch {
      toast('Failed to approve', 'error');
    }
  };

  const handleReject = async (id: string) => {
    if (!rejectNote.trim()) return;
    try {
      await api.post(`/content-queue/${id}/reject`, { reviewNote: rejectNote });
      toast('Content rejected', 'success');
      setRejectNoteId(null);
      setRejectNote('');
      fetchDrafts();
    } catch {
      toast('Failed to reject', 'error');
    }
  };

  const handleBulkApprove = async () => {
    try {
      await api.post('/content-queue/bulk-approve', { ids: Array.from(selectedIds) });
      toast(`${selectedIds.size} items approved`, 'success');
      setSelectedIds(new Set());
      fetchDrafts();
    } catch {
      toast('Failed to bulk approve', 'error');
    }
  };

  const handleBulkReject = async () => {
    const note = prompt('Enter rejection reason:');
    if (!note) return;
    try {
      await api.post('/content-queue/bulk-reject', {
        ids: Array.from(selectedIds),
        reviewNote: note,
      });
      toast(`${selectedIds.size} items rejected`, 'success');
      setSelectedIds(new Set());
      fetchDrafts();
    } catch {
      toast('Failed to bulk reject', 'error');
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

  const pendingCount = stats?.byStatus?.PENDING_REVIEW || 0;
  const approvedCount = stats?.byStatus?.APPROVED || 0;
  const publishedCount = stats?.byStatus?.PUBLISHED || 0;

  return (
    <div className="space-y-6" data-testid="content-queue-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Content Queue</h1>
          <p className="text-sm text-slate-500 mt-1">
            Review and approve AI-generated marketing content
          </p>
        </div>
      </div>

      {/* Stats Strip */}
      <div className="grid grid-cols-3 gap-4" data-testid="stats-strip">
        <div className="rounded-2xl bg-lavender-50 p-4">
          <div className="text-sm text-lavender-600">Pending Review</div>
          <div className="text-2xl font-bold text-lavender-700">{pendingCount}</div>
        </div>
        <div className="rounded-2xl bg-sage-50 p-4">
          <div className="text-sm text-sage-600">Approved</div>
          <div className="text-2xl font-bold text-sage-700">{approvedCount}</div>
        </div>
        <div className="rounded-2xl bg-emerald-50 p-4">
          <div className="text-sm text-emerald-600">Published</div>
          <div className="text-2xl font-bold text-emerald-700">{publishedCount}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center" data-testid="filter-bar">
        <Filter size={16} className="text-slate-400" />
        {['', 'PENDING_REVIEW', 'APPROVED', 'SCHEDULED', 'PUBLISHED', 'REJECTED'].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={cn(
              'px-3 py-1 rounded-full text-xs font-medium transition-colors',
              statusFilter === s
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
            )}
          >
            {s ? STATUS_LABELS[s] : 'All'}
          </button>
        ))}
        <select
          value={contentTypeFilter}
          onChange={(e) => setContentTypeFilter(e.target.value)}
          className="ml-2 text-xs border rounded-lg px-2 py-1"
          data-testid="content-type-filter"
        >
          <option value="">All Types</option>
          {Object.entries(CONTENT_TYPE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <select
          value={channelFilter}
          onChange={(e) => setChannelFilter(e.target.value)}
          className="ml-1 text-xs border rounded-lg px-2 py-1"
          data-testid="channel-filter"
        >
          <option value="">All Channels</option>
          {Object.entries(CHANNEL_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>

      {/* Bulk Actions */}
      {selectedIds.size > 0 && (
        <div
          className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl"
          data-testid="bulk-actions"
        >
          <span className="text-sm font-medium">{selectedIds.size} selected</span>
          <button
            onClick={handleBulkApprove}
            className="px-3 py-1 bg-sage-600 text-white text-sm rounded-lg hover:bg-sage-700"
          >
            Approve All
          </button>
          <button
            onClick={handleBulkReject}
            className="px-3 py-1 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700"
          >
            Reject All
          </button>
        </div>
      )}

      {/* Content Cards */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 rounded-2xl bg-slate-100 animate-pulse" />
          ))}
        </div>
      ) : drafts.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <FileText size={48} className="mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium">No content drafts</p>
          <p className="text-sm mt-1">AI-generated content will appear here for review</p>
        </div>
      ) : (
        <div className="space-y-4" data-testid="drafts-list">
          {drafts.map((draft) => (
            <div
              key={draft.id}
              className="rounded-2xl border bg-white shadow-sm overflow-hidden"
              data-testid="draft-card"
            >
              <div className="p-4">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(draft.id)}
                    onChange={() => toggleSelect(draft.id)}
                    className="mt-1 rounded"
                    data-testid="draft-checkbox"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-medium text-slate-900 truncate">{draft.title}</h3>
                      <span
                        className={cn(
                          'px-2 py-0.5 rounded-full text-xs font-medium',
                          STATUS_STYLES[draft.status] || 'bg-slate-100 text-slate-600',
                        )}
                        data-testid="status-badge"
                      >
                        {STATUS_LABELS[draft.status] || draft.status}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                        {CONTENT_TYPE_LABELS[draft.contentType] || draft.contentType}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                        {CHANNEL_LABELS[draft.channel] || draft.channel}
                      </span>
                      {draft.pillar && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-lavender-50 text-lavender-600">
                          {draft.pillar.replace(/_/g, ' ')}
                        </span>
                      )}
                      {draft.agentId && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-50 text-purple-600">
                          <Sparkles size={10} />
                          AI Generated
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-500 mt-1 line-clamp-2">
                      {draft.body.slice(0, 200)}
                      {draft.body.length > 200 ? '...' : ''}
                    </p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
                      <span className="inline-flex items-center gap-1">
                        <Clock size={12} />
                        {new Date(draft.createdAt).toLocaleDateString()}
                      </span>
                      {draft.scheduledFor && (
                        <span className="inline-flex items-center gap-1">
                          <Calendar size={12} />
                          Scheduled: {new Date(draft.scheduledFor).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {draft.status === 'PENDING_REVIEW' && (
                      <>
                        <button
                          onClick={() => handleApprove(draft.id)}
                          className="p-2 rounded-lg bg-sage-50 text-sage-600 hover:bg-sage-100"
                          title="Approve"
                          data-testid="approve-btn"
                        >
                          <Check size={16} />
                        </button>
                        <button
                          onClick={() =>
                            setRejectNoteId(rejectNoteId === draft.id ? null : draft.id)
                          }
                          className="p-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100"
                          title="Reject"
                          data-testid="reject-btn"
                        >
                          <X size={16} />
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => setExpandedId(expandedId === draft.id ? null : draft.id)}
                      className="p-2 rounded-lg bg-slate-50 text-slate-400 hover:bg-slate-100"
                      data-testid="expand-btn"
                    >
                      {expandedId === draft.id ? (
                        <ChevronUp size={16} />
                      ) : (
                        <ChevronDown size={16} />
                      )}
                    </button>
                  </div>
                </div>

                {/* Reject note input */}
                {rejectNoteId === draft.id && (
                  <div className="mt-3 flex gap-2" data-testid="reject-form">
                    <input
                      type="text"
                      value={rejectNote}
                      onChange={(e) => setRejectNote(e.target.value)}
                      placeholder="Reason for rejection..."
                      className="flex-1 text-sm border rounded-lg px-3 py-1.5"
                      data-testid="reject-note-input"
                    />
                    <button
                      onClick={() => handleReject(draft.id)}
                      className="px-3 py-1.5 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700"
                      data-testid="confirm-reject-btn"
                    >
                      Confirm Reject
                    </button>
                  </div>
                )}

                {/* Review note display */}
                {draft.reviewNote && draft.status === 'REJECTED' && (
                  <div
                    className="mt-2 p-2 bg-red-50 rounded-lg text-sm text-red-700"
                    data-testid="review-note"
                  >
                    <strong>Feedback:</strong> {draft.reviewNote}
                  </div>
                )}
              </div>

              {/* Expanded content */}
              {expandedId === draft.id && (
                <div
                  className="border-t px-4 py-3 bg-slate-50 text-sm text-slate-700 whitespace-pre-wrap"
                  data-testid="expanded-content"
                >
                  {draft.body}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {total > drafts.length && (
        <p className="text-center text-sm text-slate-400">
          Showing {drafts.length} of {total} drafts
        </p>
      )}
    </div>
  );
}
