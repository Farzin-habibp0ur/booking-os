import { useCallback, useRef } from 'react';
import { api } from '@/lib/api';

export function useDraftAutosave(conversationId: string | undefined, staffId: string | undefined) {
  const timerRef = useRef<NodeJS.Timeout>(undefined);

  const save = useCallback(
    (channel: string, content: string, subject?: string) => {
      if (!conversationId || !staffId) return;
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(async () => {
        try {
          await api.put('/outbound/draft/auto-save', {
            conversationId,
            channel,
            content,
            subject,
          });
        } catch {
          // Silent fail — auto-save is best-effort
        }
      }, 1500);
    },
    [conversationId, staffId],
  );

  const load = useCallback(async (): Promise<
    Record<string, { text: string; subject?: string }>
  > => {
    if (!conversationId) return {};
    try {
      const res = await api.get<Array<{ channel: string; content: string; subject?: string }>>(
        `/outbound/draft/auto-save?conversationId=${conversationId}`,
      );
      const drafts: Record<string, { text: string; subject?: string }> = {};
      for (const d of res || []) {
        drafts[`${conversationId}:${d.channel}`] = {
          text: d.content,
          subject: d.subject || undefined,
        };
      }
      return drafts;
    } catch {
      return {};
    }
  }, [conversationId]);

  const clear = useCallback(
    (channel: string) => {
      if (!conversationId || !staffId) return;
      clearTimeout(timerRef.current);
      api
        .put('/outbound/draft/auto-save', { conversationId, channel, content: '' })
        .catch(() => {});
    },
    [conversationId, staffId],
  );

  return { save, load, clear };
}
