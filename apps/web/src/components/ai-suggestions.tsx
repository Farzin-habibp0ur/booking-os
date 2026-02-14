'use client';

import { Sparkles } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/cn';

interface AiSuggestionsProps {
  intent?: string;
  confidence?: number;
  suggestions: string[];
  onSendSuggestion: (text: string) => void;
}

const INTENT_COLORS: Record<string, string> = {
  BOOK_APPOINTMENT: 'bg-green-100 text-green-700',
  CANCEL: 'bg-red-100 text-red-700',
  RESCHEDULE: 'bg-orange-100 text-orange-700',
  INQUIRY: 'bg-blue-100 text-blue-700',
  CONFIRMATION: 'bg-emerald-100 text-emerald-700',
  GENERAL: 'bg-gray-100 text-gray-600',
};

export default function AiSuggestions({ intent, confidence, suggestions, onSendSuggestion }: AiSuggestionsProps) {
  const { t } = useI18n();

  if (!suggestions.length && !intent) return null;

  return (
    <div className="px-3 py-2 bg-gradient-to-r from-purple-50 to-blue-50 border-t">
      <div className="flex items-center gap-2 mb-1.5">
        <Sparkles size={13} className="text-purple-500" />
        <span className="text-[10px] font-semibold text-purple-600 uppercase tracking-wide">{t('ai.suggestions_label')}</span>
        {intent && intent !== 'GENERAL' && (
          <span className={cn('text-[9px] px-1.5 py-0.5 rounded-full font-medium', INTENT_COLORS[intent] || INTENT_COLORS.GENERAL)}>
            {t(`ai.intent_${intent.toLowerCase()}`)}
          </span>
        )}
        {confidence !== undefined && confidence > 0 && (
          <span className="text-[9px] text-gray-400">{Math.round(confidence * 100)}%</span>
        )}
      </div>
      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {suggestions.map((s, i) => (
            <button
              key={i}
              onClick={() => onSendSuggestion(s)}
              className="text-xs bg-white hover:bg-purple-50 hover:text-purple-700 border border-purple-200 px-3 py-1.5 rounded-full transition-colors shadow-sm"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
