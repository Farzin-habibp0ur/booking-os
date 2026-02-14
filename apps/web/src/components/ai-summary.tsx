'use client';

import { RefreshCw, Sparkles, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { api } from '@/lib/api';
import { useToast } from '@/lib/toast';
import { useI18n } from '@/lib/i18n';

interface AiSummaryProps {
  conversationId: string;
  summary: string;
  onSummaryUpdated: (summary: string) => void;
}

export default function AiSummary({ conversationId, summary, onSummaryUpdated }: AiSummaryProps) {
  const { t } = useI18n();
  const { toast } = useToast();
  const [refreshing, setRefreshing] = useState(false);

  const refreshSummary = async () => {
    setRefreshing(true);
    try {
      const result = await api.post<{ summary: string }>(`/ai/conversations/${conversationId}/summary`);
      onSummaryUpdated(result.summary);
      toast(t('ai.summary_refreshed'));
    } catch (e: any) {
      toast(t('ai.summary_refresh_failed'), 'error');
    }
    setRefreshing(false);
  };

  if (!summary) return null;

  return (
    <div className="p-4 border-b">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Sparkles size={13} className="text-purple-500" />
          <span className="text-xs font-semibold text-gray-500 uppercase">{t('ai.summary_label')}</span>
        </div>
        <button
          onClick={refreshSummary}
          disabled={refreshing}
          className="text-gray-400 hover:text-purple-600 transition-colors"
          title={t('ai.refresh_summary')}
        >
          {refreshing ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
        </button>
      </div>
      <p className="text-xs text-gray-600 leading-relaxed">{summary}</p>
    </div>
  );
}
