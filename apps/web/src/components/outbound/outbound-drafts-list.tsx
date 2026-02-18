'use client';

import { Check, X, Clock, Send } from 'lucide-react';

interface OutboundDraft {
  id: string;
  content: string;
  status: string;
  channel: string;
  customer?: { id: string; name: string } | null;
  staff?: { id: string; name: string } | null;
  createdAt: string;
}

interface OutboundDraftsListProps {
  drafts: OutboundDraft[];
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
}

const STATUS_STYLES: Record<string, { label: string; style: string }> = {
  DRAFT: { label: 'Draft', style: 'bg-lavender-50 text-lavender-700' },
  APPROVED: { label: 'Approved', style: 'bg-sage-50 text-sage-700' },
  SENT: { label: 'Sent', style: 'bg-sage-100 text-sage-800' },
  REJECTED: { label: 'Rejected', style: 'bg-red-50 text-red-700' },
};

export function OutboundDraftsList({ drafts, onApprove, onReject }: OutboundDraftsListProps) {
  if (drafts.length === 0) {
    return (
      <p data-testid="drafts-empty" className="text-sm text-slate-400 text-center py-6">
        No outbound drafts
      </p>
    );
  }

  return (
    <div data-testid="outbound-drafts-list" className="space-y-3">
      {drafts.map((draft) => {
        const statusConfig = STATUS_STYLES[draft.status] || STATUS_STYLES.DRAFT;

        return (
          <div
            key={draft.id}
            data-testid={`draft-${draft.id}`}
            className="bg-white dark:bg-slate-900 rounded-2xl shadow-soft p-4"
          >
            <div className="flex items-start justify-between mb-2">
              <div>
                <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                  {draft.customer?.name || 'Unknown'}
                </p>
                <p className="text-[10px] text-slate-400">
                  by {draft.staff?.name || 'Staff'} · {draft.channel}
                </p>
              </div>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${statusConfig.style}`}
              >
                {statusConfig.label}
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2">
              {draft.content}
            </p>

            {draft.status === 'DRAFT' && (onApprove || onReject) && (
              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <div className="flex-1" />
                {onReject && (
                  <button
                    onClick={() => onReject(draft.id)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                    data-testid={`reject-${draft.id}`}
                  >
                    <X size={14} />
                  </button>
                )}
                {onApprove && (
                  <button
                    onClick={() => onApprove(draft.id)}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-xl bg-sage-600 text-white hover:bg-sage-700 transition-colors"
                    data-testid={`approve-draft-${draft.id}`}
                  >
                    <Check size={12} /> Approve
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
