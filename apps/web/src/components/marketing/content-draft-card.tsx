import { cn } from '@/lib/cn';
import {
  Check,
  X,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Clock,
} from 'lucide-react';
import { TierBadge } from './tier-badge';

const CONTENT_TYPE_LABELS: Record<string, string> = {
  BLOG_POST: 'Blog Post',
  SOCIAL_POST: 'Social Post',
  EMAIL: 'Email',
  CASE_STUDY: 'Case Study',
  VIDEO_SCRIPT: 'Video Script',
  NEWSLETTER: 'Newsletter',
};

export interface ContentDraft {
  id: string;
  title: string;
  body: string;
  contentType: string;
  tier?: string;
  pillar?: string;
  platform?: string;
  agentId?: string;
  qualityScore?: number;
  currentGate?: string;
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

interface ContentDraftCardProps {
  draft: ContentDraft;
  isExpanded: boolean;
  isSelected: boolean;
  onApprove: () => void;
  onReject: () => void;
  onEdit?: () => void;
  onExpand: () => void;
  onSelect: () => void;
}

export function ContentDraftCard({
  draft,
  isExpanded,
  isSelected,
  onApprove,
  onReject,
  onExpand,
  onSelect,
}: ContentDraftCardProps) {
  return (
    <div
      data-testid="content-draft-card"
      className="rounded-2xl bg-white shadow-soft border border-slate-100 overflow-hidden"
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onSelect}
            className="mt-1.5 rounded text-sage-600"
            data-testid="draft-checkbox"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h3 className="font-medium text-slate-900 truncate">{draft.title}</h3>
              {draft.tier && (
                <TierBadge tier={draft.tier as 'GREEN' | 'YELLOW' | 'RED'} />
              )}
              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600">
                {CONTENT_TYPE_LABELS[draft.contentType] || draft.contentType}
              </span>
              {draft.platform && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-50 text-blue-600">
                  {draft.platform}
                </span>
              )}
              {draft.agentId && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-lavender-50 text-lavender-600">
                  <Sparkles size={9} />
                  {draft.agentId}
                </span>
              )}
              {draft.qualityScore != null && (
                <span
                  className={cn(
                    'px-2 py-0.5 rounded-full text-[10px] font-bold',
                    draft.qualityScore >= 80
                      ? 'bg-green-50 text-green-700'
                      : draft.qualityScore >= 50
                        ? 'bg-amber-50 text-amber-700'
                        : 'bg-red-50 text-red-700',
                  )}
                  data-testid="quality-score"
                >
                  Q: {draft.qualityScore}
                </span>
              )}
            </div>
            {draft.pillar && (
              <span className="text-[10px] text-lavender-600 font-medium">
                {draft.pillar.replace(/_/g, ' ')}
              </span>
            )}
            <p className="text-xs text-slate-600 mt-1 line-clamp-2">
              {draft.body?.slice(0, 200)}
              {(draft.body?.length || 0) > 200 ? '...' : ''}
            </p>
            <div className="flex items-center gap-3 mt-2 text-[11px] text-slate-400">
              <span className="inline-flex items-center gap-1">
                <Clock size={11} />
                {new Date(draft.createdAt).toLocaleDateString()}
              </span>
              {draft.body && <span>{draft.body.split(/\s+/).length} words</span>}
              {draft.currentGate && (
                <span className="text-lavender-500">{draft.currentGate.replace('_', ' ')}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              onClick={onApprove}
              className="p-2 rounded-lg bg-sage-50 text-sage-600 hover:bg-sage-100 transition-colors"
              title="Approve"
              data-testid="approve-btn"
            >
              <Check size={16} />
            </button>
            <button
              onClick={onReject}
              className="p-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
              title="Reject"
              data-testid="reject-btn"
            >
              <X size={16} />
            </button>
            <button
              onClick={onExpand}
              className="p-2 rounded-lg bg-slate-50 text-slate-400 hover:bg-slate-100 transition-colors"
              data-testid="expand-btn"
            >
              {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </div>
        </div>
      </div>

      {isExpanded && (
        <div className="border-t border-slate-100" data-testid="expanded-content">
          <div className="px-4 py-3 bg-slate-50">
            <p className="text-xs font-medium text-slate-600 mb-2">Full Content</p>
            <div className="text-sm text-slate-700 whitespace-pre-wrap max-h-64 overflow-y-auto">
              {draft.body}
            </div>
          </div>
          {draft.currentGate && (
            <div className="px-4 py-2 border-t border-slate-100">
              <p className="text-xs text-slate-500">
                <span className="font-medium">Current Gate:</span>{' '}
                <span className="text-lavender-600">{draft.currentGate}</span>
              </p>
            </div>
          )}
          {draft.metadata && Object.keys(draft.metadata).length > 0 && (
            <div className="px-4 py-2 border-t border-slate-100">
              <p className="text-xs font-medium text-slate-600 mb-1">Metadata</p>
              <pre className="text-[10px] text-slate-500 overflow-x-auto">
                {JSON.stringify(draft.metadata, null, 2)}
              </pre>
            </div>
          )}
          {draft.rejectionLogs && draft.rejectionLogs.length > 0 && (
            <div className="px-4 py-2 border-t border-slate-100" data-testid="rejection-history">
              <p className="text-xs font-medium text-red-600 mb-2">Rejection History</p>
              <div className="space-y-1.5">
                {draft.rejectionLogs.map((log) => (
                  <div key={log.id} className="flex items-start gap-2 text-[11px]">
                    <span
                      className={cn(
                        'px-1.5 py-0.5 rounded text-[9px] font-bold',
                        log.severity === 'CRITICAL'
                          ? 'bg-red-100 text-red-700'
                          : log.severity === 'MAJOR'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-slate-100 text-slate-600',
                      )}
                    >
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
  );
}
