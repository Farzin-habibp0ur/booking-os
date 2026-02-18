'use client';

import { X } from 'lucide-react';
import { ActionCardData } from './action-card';

interface ActionCardPreviewProps {
  card: ActionCardData;
  onClose: () => void;
  onApprove?: (id: string) => void;
  onDismiss?: (id: string) => void;
}

export function ActionCardPreview({ card, onClose, onApprove, onDismiss }: ActionCardPreviewProps) {
  const preview = card.preview;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
      data-testid="action-card-preview"
    >
      <div
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-lg max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{card.title}</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            data-testid="close-preview"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">{card.description}</p>

          {card.suggestedAction && (
            <div className="bg-lavender-50 dark:bg-lavender-950/30 rounded-xl p-3">
              <p className="text-xs font-medium text-lavender-700 mb-1">Suggested Action</p>
              <p className="text-sm text-lavender-900 dark:text-lavender-200">
                {card.suggestedAction}
              </p>
            </div>
          )}

          {preview && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Preview</p>
              {preview.before && (
                <div className="bg-red-50 dark:bg-red-950/20 rounded-xl p-3">
                  <p className="text-[10px] font-medium text-red-500 mb-1">Before</p>
                  <pre className="text-xs text-red-900 dark:text-red-200 whitespace-pre-wrap">
                    {typeof preview.before === 'string'
                      ? preview.before
                      : JSON.stringify(preview.before, null, 2)}
                  </pre>
                </div>
              )}
              {preview.after && (
                <div className="bg-sage-50 dark:bg-sage-950/20 rounded-xl p-3">
                  <p className="text-[10px] font-medium text-sage-500 mb-1">After</p>
                  <pre className="text-xs text-sage-900 dark:text-sage-200 whitespace-pre-wrap">
                    {typeof preview.after === 'string'
                      ? preview.after
                      : JSON.stringify(preview.after, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>

        {card.status === 'PENDING' && (onApprove || onDismiss) && (
          <div className="flex items-center justify-end gap-2 p-4 border-t border-slate-100 dark:border-slate-800">
            {onDismiss && (
              <button
                onClick={() => {
                  onDismiss(card.id);
                  onClose();
                }}
                className="px-4 py-2 text-sm rounded-xl text-slate-600 hover:bg-slate-100 transition-colors"
                data-testid="preview-dismiss"
              >
                Dismiss
              </button>
            )}
            {onApprove && (
              <button
                onClick={() => {
                  onApprove(card.id);
                  onClose();
                }}
                className="px-4 py-2 text-sm font-medium rounded-xl bg-sage-600 text-white hover:bg-sage-700 transition-colors"
                data-testid="preview-approve"
              >
                Approve
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
