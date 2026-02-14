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
  BOOK_APPOINTMENT: 'bg-green-100 text-green-700',
  CANCEL: 'bg-red-100 text-red-700',
  RESCHEDULE: 'bg-orange-100 text-orange-700',
  INQUIRY: 'bg-blue-100 text-blue-700',
  CONFIRMATION: 'bg-emerald-100 text-emerald-700',
  GENERAL: 'bg-gray-100 text-gray-600',
};

export default function AiSuggestions({ intent, confidence, draftText, onSendDraft, onDismiss }: AiSuggestionsProps) {
  const { t } = useI18n();
  const [editedText, setEditedText] = useState(draftText);

  useEffect(() => {
    setEditedText(draftText);
  }, [draftText]);

  if (!draftText && !intent) return null;

  return (
    <div className="px-3 py-2 bg-gradient-to-r from-purple-50 to-blue-50 border-t">
      <div className="flex items-center gap-2 mb-1.5">
        <Sparkles size={13} className="text-purple-500" />
        <span className="text-[10px] font-semibold text-purple-600 uppercase tracking-wide">{t('ai.draft_label')}</span>
        {intent && intent !== 'GENERAL' && (
          <span className={cn('text-[9px] px-1.5 py-0.5 rounded-full font-medium', INTENT_COLORS[intent] || INTENT_COLORS.GENERAL)}>
            {t(`ai.intent_${intent.toLowerCase()}`)}
          </span>
        )}
        {confidence !== undefined && confidence > 0 && (
          <span className="text-[9px] text-gray-400">{Math.round(confidence * 100)}%</span>
        )}
      </div>
      {draftText && (
        <div className="space-y-2">
          <textarea
            value={editedText}
            onChange={(e) => setEditedText(e.target.value)}
            rows={3}
            className="w-full text-sm border border-purple-200 rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-purple-400 resize-none"
          />
          <div className="flex gap-2">
            <button
              onClick={() => onSendDraft(editedText)}
              disabled={!editedText.trim()}
              className="flex items-center gap-1.5 bg-purple-600 text-white px-3 py-1.5 rounded-md text-xs hover:bg-purple-700 disabled:opacity-50"
            >
              <Send size={12} />
              {t('ai.send_draft')}
            </button>
            <button
              onClick={onDismiss}
              className="flex items-center gap-1.5 text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-md text-xs border hover:bg-gray-50"
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
