'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
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
  Search,
  Beaker,
  Send,
  BarChart3,
  Eye,
  Edit3,
} from 'lucide-react';
import { ListSkeleton } from '@/components/skeleton';

interface ContentDraft {
  id: string;
  title: string;
  body: string;
  contentType: string;
  channel: string;
  pillar?: string;
  status: string;
  tier?: string;
  slug?: string;
  qualityScore?: number;
  rejectionCode?: string;
  rejectionReason?: string;
  currentGate?: string;
  platform?: string;
  agentId?: string;
  scheduledFor?: string;
  publishedAt?: string;
  reviewedById?: string;
  reviewNote?: string;
  createdAt: string;
  metadata?: Record<string, any>;
  rejectionLogs?: Array<{
    id: string;
    gate: string;
    rejectionCode: string;
    reason: string;
    severity: string;
    createdAt: string;
  }>;
}

interface PillarBalance {
  pillar: string;
  count: number;
  percentage: number;
}

interface ContentStats {
  byStatus?: Record<string, number>;
  byTier?: Record<string, number>;
  byContentType?: Record<string, number>;
  byPillar?: Record<string, number>;
}

const PIPELINE_STAGES = [
  { key: 'RESEARCH', label: 'Research', icon: Search, gate: 'GATE_1' },
  { key: 'CREATION', label: 'Creation', icon: Edit3, gate: 'GATE_2' },
  { key: 'QUEUE', label: 'Queue', icon: FileText, gate: 'GATE_3' },
  { key: 'REVIEW', label: 'Approve', icon: Eye, gate: null },
  { key: 'PUBLISHED', label: 'Publish', icon: Send, gate: 'GATE_4' },
  { key: 'ANALYZING', label: 'Analyze', icon: BarChart3, gate: null },
];

const TIER_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  GREEN: { bg: 'bg-green-50', text: 'text-green-700', label: 'Green' },
  YELLOW: { bg: 'bg-amber-50', text: 'text-amber-700', label: 'Yellow' },
  RED: { bg: 'bg-red-50', text: 'text-red-700', label: 'Red' },
};

const REJECTION_CODES = [
  { code: 'R01', label: 'R01 — Missing research' },
  { code: 'R02', label: 'R02 — Low quality' },
  { code: 'R03', label: 'R03 — Off-brand' },
  { code: 'R04', label: 'R04 — Duplicate content' },
  { code: 'R05', label: 'R05 — Wrong format' },
  { code: 'R06', label: 'R06 — Missing CTA' },
  { code: 'R07', label: 'R07 — SEO issues' },
  { code: 'R08', label: 'R08 — Factual errors' },
  { code: 'R09', label: 'R09 — Compliance issue' },
  { code: 'R10', label: 'R10 — Other' },
];

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
  INSTAGRAM: 'Instagram',
  TIKTOK: 'TikTok',
  LINKEDIN: 'LinkedIn',
  TWITTER: 'Twitter',
  EMAIL: 'Email',
  YOUTUBE: 'YouTube',
};

const PILLAR_TARGETS: Record<string, number> = {
  'Product Education': 25,
  'Social Proof': 20,
  'Industry Trends': 20,
  'Behind the Scenes': 15,
  'Community & Culture': 20,
};

export default function ContentQueuePage() {
  const { toast } = useToast();
  const [drafts, setDrafts] = useState<ContentDraft[]>([]);
  const [stats, setStats] = useState<ContentStats | null>(null);
  const [pillarBalance, setPillarBalance] = useState<PillarBalance[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [contentTypeFilter, setContentTypeFilter] = useState('');
  const [tierFilter, setTierFilter] = useState('');
  const [channelFilter, setChannelFilter] = useState('');
  const [pillarFilter, setPillarFilter] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectCode, setRejectCode] = useState('R01');
  const [rejectReason, setRejectReason] = useState('');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set('status', 'IN_REVIEW');
      if (contentTypeFilter) params.set('contentType', contentTypeFilter);
      if (tierFilter) params.set('tier', tierFilter);
      if (channelFilter) params.set('channel', channelFilter);
      if (pillarFilter) params.set('pillar', pillarFilter);
      params.set('take', '50');

      const [draftsRes, statsRes, balanceRes] = await Promise.all([
        api.get<any>(`/marketing-content?${params.toString()}`).catch(() => ({ data: [], total: 0 })),
        api.get<ContentStats>('/marketing-content/stats').catch(() => null),
        api.get<PillarBalance[]>('/marketing-content/pillar-balance').catch(() => []),
      ]);

      const items = draftsRes?.data || draftsRes || [];
      setDrafts(Array.isArray(items) ? items : []);
      setTotal(draftsRes?.total || items.length || 0);
      setStats(statsRes as ContentStats);
      setPillarBalance(Array.isArray(balanceRes) ? balanceRes : []);
    } catch {
      setDrafts([]);
    } finally {
      setLoading(false);
    }
  }, [contentTypeFilter, tierFilter, channelFilter, pillarFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleApprove = async (id: string) => {
    try {
      await api.post(`/marketing-content/${id}/review`, { action: 'approve' });
      toast('Content approved');
      fetchData();
    } catch {
      toast('Failed to approve', 'error');
    }
  };

  const handleReject = async (id: string) => {
    if (!rejectReason.trim()) {
      toast('Please provide a rejection reason', 'error');
      return;
    }
    try {
      await api.post(`/marketing-content/${id}/review`, {
        action: 'reject',
        rejectionCode: rejectCode,
        reason: rejectReason,
      });
      toast('Content rejected');
      setRejectingId(null);
      setRejectCode('R01');
      setRejectReason('');
      fetchData();
    } catch {
      toast('Failed to reject', 'error');
    }
  };

  const handleBulkApprove = async () => {
    try {
      await api.post('/marketing-content/bulk-review', {
        ids: Array.from(selectedIds),
        action: 'approve',
      });
      toast(`${selectedIds.size} items approved`);
      setSelectedIds(new Set());
      fetchData();
    } catch {
      toast('Failed to bulk approve', 'error');
    }
  };

  const handleBulkReject = async () => {
    try {
      await api.post('/marketing-content/bulk-review', {
        ids: Array.from(selectedIds),
        action: 'reject',
        rejectionCode: 'R10',
        reason: 'Bulk rejected',
      });
      toast(`${selectedIds.size} items rejected`);
      setSelectedIds(new Set());
      fetchData();
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

  // Pipeline stage counts from stats
  const getStageCounts = () => {
    const byStatus = stats?.byStatus || {};
    return {
      RESEARCH: byStatus.DRAFT || 0,
      CREATION: byStatus.IN_PROGRESS || 0,
      QUEUE: byStatus.QUEUED || 0,
      REVIEW: byStatus.IN_REVIEW || 0,
      PUBLISHED: byStatus.PUBLISHED || 0,
      ANALYZING: byStatus.ANALYZING || 0,
    };
  };

  const stageCounts = getStageCounts();

  return (
    <div className="space-y-6" data-testid="content-queue-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl font-bold text-slate-900 dark:text-white">
            Content Queue
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Review and approve AI-generated marketing content
          </p>
        </div>
      </div>

      {/* Pipeline Visualization */}
      <div
        className="rounded-2xl bg-white dark:bg-slate-900 p-5 shadow-soft border border-slate-100 dark:border-slate-800"
        data-testid="pipeline-viz"
      >
        <div className="flex items-center justify-between">
          {PIPELINE_STAGES.map((stage, idx) => {
            const Icon = stage.icon;
            const count = stageCounts[stage.key as keyof typeof stageCounts] || 0;
            const isActive = stage.key === 'REVIEW';
            return (
              <div key={stage.key} className="flex items-center flex-1">
                <div className={cn('flex flex-col items-center flex-1', isActive && 'scale-105')}>
                  <div
                    className={cn(
                      'w-10 h-10 rounded-xl flex items-center justify-center mb-1.5',
                      isActive
                        ? 'bg-lavender-100 text-lavender-700'
                        : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
                    )}
                  >
                    <Icon size={18} />
                  </div>
                  <p className={cn(
                    'text-[11px] font-medium',
                    isActive ? 'text-lavender-700' : 'text-slate-600 dark:text-slate-400',
                  )}>
                    {stage.label}
                  </p>
                  <p className={cn(
                    'text-lg font-bold',
                    isActive ? 'text-lavender-700' : 'text-slate-900 dark:text-white',
                  )}>
                    {count}
                  </p>
                </div>
                {idx < PIPELINE_STAGES.length - 1 && (
                  <div className="w-8 h-px bg-slate-200 dark:bg-slate-700 flex-shrink-0 mx-1" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-3 space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-2 items-center" data-testid="filter-bar">
            <Filter size={16} className="text-slate-400" />
            {/* Tier Filter */}
            {['', 'GREEN', 'YELLOW', 'RED'].map((tier) => (
              <button
                key={tier}
                onClick={() => setTierFilter(tier)}
                className={cn(
                  'px-3 py-1 rounded-full text-xs font-medium transition-colors',
                  tierFilter === tier
                    ? tier === '' ? 'bg-slate-900 text-white' : cn(TIER_STYLES[tier]?.bg, TIER_STYLES[tier]?.text, 'ring-2 ring-offset-1', tier === 'GREEN' ? 'ring-green-400' : tier === 'YELLOW' ? 'ring-amber-400' : 'ring-red-400')
                    : tier === '' ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' : cn(TIER_STYLES[tier]?.bg, TIER_STYLES[tier]?.text, 'opacity-60 hover:opacity-100'),
                )}
                data-testid={`tier-${tier || 'all'}`}
              >
                {tier ? TIER_STYLES[tier]?.label : 'All Tiers'}
              </button>
            ))}
            <select
              value={contentTypeFilter}
              onChange={(e) => setContentTypeFilter(e.target.value)}
              className="ml-2 text-xs border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 bg-white dark:bg-slate-800"
              data-testid="content-type-filter"
            >
              <option value="">All Types</option>
              {Object.entries(CONTENT_TYPE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <select
              value={channelFilter}
              onChange={(e) => setChannelFilter(e.target.value)}
              className="text-xs border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 bg-white dark:bg-slate-800"
              data-testid="channel-filter"
            >
              <option value="">All Channels</option>
              {Object.entries(CHANNEL_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <select
              value={pillarFilter}
              onChange={(e) => setPillarFilter(e.target.value)}
              className="text-xs border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 bg-white dark:bg-slate-800"
              data-testid="pillar-filter"
            >
              <option value="">All Pillars</option>
              {Object.keys(PILLAR_TARGETS).map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          {/* Bulk Actions */}
          {selectedIds.size > 0 && (
            <div
              className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700"
              data-testid="bulk-actions"
            >
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                {selectedIds.size} selected
              </span>
              <button
                onClick={handleBulkApprove}
                className="px-3 py-1.5 bg-sage-600 text-white text-sm rounded-lg hover:bg-sage-700 transition-colors"
                data-testid="bulk-approve-btn"
              >
                Approve All
              </button>
              <button
                onClick={handleBulkReject}
                className="px-3 py-1.5 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition-colors"
                data-testid="bulk-reject-btn"
              >
                Reject All
              </button>
              <button
                onClick={() => setSelectedIds(new Set())}
                className="px-3 py-1.5 text-sm text-slate-500 hover:text-slate-700"
              >
                Cancel
              </button>
            </div>
          )}

          {/* Content Cards */}
          {loading ? (
            <ListSkeleton rows={4} />
          ) : drafts.length === 0 ? (
            <div
              className="rounded-2xl bg-lavender-50 dark:bg-slate-900/50 border border-lavender-100 dark:border-slate-800 p-12 shadow-soft text-center"
              data-testid="empty-state"
            >
              <FileText size={48} className="mx-auto mb-4 text-lavender-400" />
              <h3 className="font-serif text-lg text-slate-900 dark:text-white mb-2">
                No content drafts
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                AI-generated content will appear here for review
              </p>
            </div>
          ) : (
            <div className="space-y-3" data-testid="drafts-list">
              {drafts.map((draft) => (
                <div
                  key={draft.id}
                  className="rounded-2xl bg-white dark:bg-slate-900 shadow-soft border border-slate-100 dark:border-slate-800 overflow-hidden"
                  data-testid="draft-card"
                >
                  <div className="p-4">
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(draft.id)}
                        onChange={() => toggleSelect(draft.id)}
                        className="mt-1.5 rounded text-sage-600"
                        data-testid="draft-checkbox"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <h3 className="font-medium text-slate-900 dark:text-white truncate">
                            {draft.title}
                          </h3>
                          {/* Tier Badge */}
                          {draft.tier && TIER_STYLES[draft.tier] && (
                            <span
                              className={cn(
                                'px-2 py-0.5 rounded-full text-[10px] font-bold',
                                TIER_STYLES[draft.tier].bg,
                                TIER_STYLES[draft.tier].text,
                              )}
                              data-testid="tier-badge"
                            >
                              {draft.tier}
                            </span>
                          )}
                          {/* Content Type Badge */}
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                            {CONTENT_TYPE_LABELS[draft.contentType] || draft.contentType}
                          </span>
                          {/* Channel Badge */}
                          {draft.platform && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-50 text-blue-600">
                              {draft.platform}
                            </span>
                          )}
                          {/* Agent Badge */}
                          {draft.agentId && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-lavender-50 text-lavender-600">
                              <Sparkles size={9} />
                              {draft.agentId}
                            </span>
                          )}
                          {/* Quality Score */}
                          {draft.qualityScore != null && (
                            <span
                              className={cn(
                                'px-2 py-0.5 rounded-full text-[10px] font-bold',
                                draft.qualityScore >= 80 ? 'bg-green-50 text-green-700' : draft.qualityScore >= 50 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700',
                              )}
                              data-testid="quality-score"
                            >
                              Q: {draft.qualityScore}
                            </span>
                          )}
                        </div>
                        {/* Pillar */}
                        {draft.pillar && (
                          <span className="text-[10px] text-lavender-600 font-medium">
                            {draft.pillar.replace(/_/g, ' ')}
                          </span>
                        )}
                        <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 line-clamp-2">
                          {draft.body?.slice(0, 200)}
                          {(draft.body?.length || 0) > 200 ? '...' : ''}
                        </p>
                        <div className="flex items-center gap-3 mt-2 text-[11px] text-slate-400">
                          <span className="inline-flex items-center gap-1">
                            <Clock size={11} />
                            {new Date(draft.createdAt).toLocaleDateString()}
                          </span>
                          {draft.body && (
                            <span>{draft.body.split(/\s+/).length} words</span>
                          )}
                          {draft.currentGate && (
                            <span className="text-lavender-500">{draft.currentGate.replace('_', ' ')}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button
                          onClick={() => handleApprove(draft.id)}
                          className="p-2 rounded-lg bg-sage-50 text-sage-600 hover:bg-sage-100 transition-colors"
                          title="Approve"
                          data-testid="approve-btn"
                        >
                          <Check size={16} />
                        </button>
                        <button
                          onClick={() => setRejectingId(rejectingId === draft.id ? null : draft.id)}
                          className="p-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                          title="Reject"
                          data-testid="reject-btn"
                        >
                          <X size={16} />
                        </button>
                        <button
                          onClick={() => setExpandedId(expandedId === draft.id ? null : draft.id)}
                          className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-400 hover:bg-slate-100 transition-colors"
                          data-testid="expand-btn"
                        >
                          {expandedId === draft.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                      </div>
                    </div>

                    {/* Reject Form */}
                    {rejectingId === draft.id && (
                      <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/10 rounded-xl space-y-2" data-testid="reject-form">
                        <select
                          value={rejectCode}
                          onChange={(e) => setRejectCode(e.target.value)}
                          className="w-full text-xs border border-red-200 rounded-lg px-3 py-1.5 bg-white"
                          data-testid="reject-code-select"
                        >
                          {REJECTION_CODES.map((rc) => (
                            <option key={rc.code} value={rc.code}>{rc.label}</option>
                          ))}
                        </select>
                        <textarea
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                          placeholder="Reason for rejection..."
                          className="w-full text-xs border border-red-200 rounded-lg px-3 py-1.5 resize-none"
                          rows={2}
                          data-testid="reject-reason-input"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleReject(draft.id)}
                            className="px-3 py-1.5 bg-red-600 text-white text-xs rounded-lg hover:bg-red-700 transition-colors"
                            data-testid="confirm-reject-btn"
                          >
                            Confirm Reject
                          </button>
                          <button
                            onClick={() => { setRejectingId(null); setRejectReason(''); }}
                            className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Expanded Content */}
                  {expandedId === draft.id && (
                    <div className="border-t border-slate-100 dark:border-slate-800" data-testid="expanded-content">
                      {/* Full body */}
                      <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/50">
                        <p className="text-xs font-medium text-slate-600 mb-2">Full Content</p>
                        <div className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap max-h-64 overflow-y-auto">
                          {draft.body}
                        </div>
                      </div>
                      {/* Gate Status */}
                      {draft.currentGate && (
                        <div className="px-4 py-2 border-t border-slate-100 dark:border-slate-800">
                          <p className="text-xs text-slate-500">
                            <span className="font-medium">Current Gate:</span>{' '}
                            <span className="text-lavender-600">{draft.currentGate}</span>
                          </p>
                        </div>
                      )}
                      {/* Metadata */}
                      {draft.metadata && Object.keys(draft.metadata).length > 0 && (
                        <div className="px-4 py-2 border-t border-slate-100 dark:border-slate-800">
                          <p className="text-xs font-medium text-slate-600 mb-1">Metadata</p>
                          <pre className="text-[10px] text-slate-500 overflow-x-auto">
                            {JSON.stringify(draft.metadata, null, 2)}
                          </pre>
                        </div>
                      )}
                      {/* Rejection History */}
                      {draft.rejectionLogs && draft.rejectionLogs.length > 0 && (
                        <div className="px-4 py-2 border-t border-slate-100 dark:border-slate-800" data-testid="rejection-history">
                          <p className="text-xs font-medium text-red-600 mb-2">Rejection History</p>
                          <div className="space-y-1.5">
                            {draft.rejectionLogs.map((log) => (
                              <div key={log.id} className="flex items-start gap-2 text-[11px]">
                                <span className={cn(
                                  'px-1.5 py-0.5 rounded text-[9px] font-bold',
                                  log.severity === 'CRITICAL' ? 'bg-red-100 text-red-700' : log.severity === 'MAJOR' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600',
                                )}>
                                  {log.rejectionCode}
                                </span>
                                <span className="text-slate-600">{log.reason}</span>
                                <span className="text-slate-400 ml-auto flex-shrink-0">
                                  {log.gate} · {new Date(log.createdAt).toLocaleDateString()}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
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

        {/* Pillar Balance Sidebar */}
        <div className="lg:col-span-1">
          <div
            className="rounded-2xl bg-white dark:bg-slate-900 p-5 shadow-soft border border-slate-100 dark:border-slate-800 sticky top-8"
            data-testid="pillar-sidebar"
          >
            <h3 className="font-serif text-sm font-semibold text-slate-900 dark:text-white mb-4">
              Pillar Balance
            </h3>
            <div className="space-y-3">
              {Object.entries(PILLAR_TARGETS).map(([pillar, target]) => {
                const found = pillarBalance.find((p) => p.pillar === pillar);
                const actual = found?.percentage || 0;
                const diff = actual - target;
                return (
                  <div key={pillar}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-slate-700 dark:text-slate-300">{pillar}</span>
                      <span className={cn(
                        'text-[10px] font-medium',
                        Math.abs(diff) <= 5 ? 'text-green-600' : diff > 0 ? 'text-amber-600' : 'text-red-600',
                      )}>
                        {Math.round(actual)}% / {target}%
                      </span>
                    </div>
                    <div className="relative h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all',
                          Math.abs(diff) <= 5 ? 'bg-green-500' : diff > 0 ? 'bg-amber-500' : 'bg-red-400',
                        )}
                        style={{ width: `${Math.min(actual, 100)}%` }}
                      />
                      {/* Target marker */}
                      <div
                        className="absolute top-0 bottom-0 w-0.5 bg-slate-400"
                        style={{ left: `${target}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-[10px] text-slate-400 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              Bars show actual %. Markers show ideal target.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
