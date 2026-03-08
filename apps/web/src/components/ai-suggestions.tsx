'use client';

import { Sparkles, Send, X } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/cn';

interface AiSuggestionsProps {
  intent?: string;
  confidence?: number;
  draftText: string;
  onSendDraft: (text: string) => void;
  onDismiss: () => void;
}

export default function AiSuggestions({
  intent,
  confidence,
  draftText,
  onSendDraft,
  onDismiss,
}: AiSuggestionsProps) {
  const { t } = useI18n();
  const [editedText, setEditedText] = useState(draftText);

  useEffect(() => {
    setEditedText(draftText);
  }, [draftText]);

  if (!draftText && !intent) return null;

  return (
    <div className="px-3 py-2 bg-lavender-50 dark:bg-lavender-900/20 border border-dashed border-lavender-200 dark:border-lavender-800 rounded-xl mx-3 my-2">
      <div className="flex items-center gap-2 mb-2">
        <Sparkles size={14} className="text-lavender-600 dark:text-lavender-400 flex-shrink-0" />
        <span className="text-xs text-lavender-700 dark:text-lavender-300 font-medium flex-1">
          {t('ai.draft_label')}
        </span>
        <button
          onClick={onDismiss}
          className="text-lavender-400 hover:text-lavender-600 dark:hover:text-lavender-300 flex-shrink-0"
        >
          <X size={14} />
        </button>
      </div>
      {draftText && (
        <div className="space-y-2">
          <textarea
            value={editedText}
            onChange={(e) => setEditedText(e.target.value)}
            rows={3}
            className="w-full text-xs border border-lavender-200 dark:border-lavender-700 rounded-lg px-2.5 py-1.5 bg-white dark:bg-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-lavender-400 dark:focus:ring-lavender-500 resize-none"
          />
          <div className="flex gap-2">
            <button
              onClick={() => onSendDraft(editedText)}
              disabled={!editedText.trim()}
              className="flex items-center gap-1 bg-lavender-600 dark:bg-lavender-700 text-white px-2.5 py-1 rounded-lg text-xs hover:bg-lavender-700 dark:hover:bg-lavender-600 disabled:opacity-50 transition-colors"
            >
              <Send size={12} />
              {t('ai.send_draft')}
            </button>
            <button
              onClick={onDismiss}
              className="flex items-center gap-1 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 px-2.5 py-1 rounded-lg text-xs border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              <X size={12} />
              {t('ai.dismiss_draft')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
