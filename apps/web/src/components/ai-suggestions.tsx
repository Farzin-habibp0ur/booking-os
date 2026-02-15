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

const INTENT_COLORS: Record<string, string> = {
  BOOK_APPOINTMENT: 'bg-sage-50 text-sage-700',
  CANCEL: 'bg-red-50 text-red-700',
  RESCHEDULE: 'bg-orange-50 text-orange-700',
  INQUIRY: 'bg-sage-100 text-sage-700',
  CONFIRMATION: 'bg-sage-50 text-sage-700',
  GENERAL: 'bg-slate-100 text-slate-600',
};

export default function AiSuggestions({ intent, confidence, draftText, onSendDraft, onDismiss }: AiSuggestionsProps) {
  const { t } = useI18n();
  const [editedText, setEditedText] = useState(draftText);

  useEffect(() => {
    setEditedText(draftText);
  }, [draftText]);

  if (!draftText && !intent) return null;

  return (
    <div className="px-3 py-2 bg-lavender-50 border-t border-lavender-100">
      <div className="flex items-center gap-2 mb-1.5">
        <Sparkles size={13} className="text-lavender-500" />
        <span className="text-[10px] font-semibold text-lavender-600 uppercase tracking-wide">{t('ai.draft_label')}</span>
        {intent && intent !== 'GENERAL' && (
          <span className={cn('text-[9px] px-1.5 py-0.5 rounded-full font-medium', INTENT_COLORS[intent] || INTENT_COLORS.GENERAL)}>
            {t(`ai.intent_${intent.toLowerCase()}`)}
          </span>
        )}
        {confidence !== undefined && confidence > 0 && (
          <span className="text-[9px] text-slate-400">{Math.round(confidence * 100)}%</span>
        )}
      </div>
      {draftText && (
        <div className="space-y-2">
          <textarea
            value={editedText}
            onChange={(e) => setEditedText(e.target.value)}
            rows={3}
            className="w-full text-sm border border-lavender-100 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-lavender-400 resize-none"
          />
          <div className="flex gap-2">
            <button
              onClick={() => onSendDraft(editedText)}
              disabled={!editedText.trim()}
              className="flex items-center gap-1.5 bg-lavender-600 text-white px-3 py-1.5 rounded-xl text-xs hover:bg-lavender-700 disabled:opacity-50 transition-colors"
            >
              <Send size={12} />
              {t('ai.send_draft')}
            </button>
            <button
              onClick={onDismiss}
              className="flex items-center gap-1.5 text-slate-500 hover:text-slate-700 px-3 py-1.5 rounded-xl text-xs border border-slate-200 hover:bg-slate-50 transition-colors"
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
