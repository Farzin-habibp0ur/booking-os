'use client';

import { useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { useSocket } from './use-socket';

interface MarketingSocketOptions {
  /** Called when a new action card is created — use to increment badge or show toast */
  onActionCardCreated?: (data: any) => void;
  /** Called when an action card is updated — use to refresh the list */
  onActionCardUpdated?: (data: any) => void;
  /** Called when an agent run completes — use to show toast or refresh agent data */
  onAgentRunCompleted?: (data: { agentType: string; cardsCreated: number }) => void;
  /** Called when a content draft changes status — use to refresh queue */
  onContentDraftStatusChanged?: (data: any) => void;
}

/**
 * Registers Socket.io listeners for Marketing Command Center events.
 * Handlers fire only when provided; callers decide what to do (toast, refresh, etc.).
 */
export function useMarketingSocket(options: MarketingSocketOptions = {}) {
  const pathname = usePathname();

  const handleActionCreated = useCallback(
    (data: any) => {
      options.onActionCardCreated?.(data);
    },
    [options.onActionCardCreated],
  );

  const handleActionUpdated = useCallback(
    (data: any) => {
      options.onActionCardUpdated?.(data);
    },
    [options.onActionCardUpdated],
  );

  const handleAgentRunCompleted = useCallback(
    (data: any) => {
      options.onAgentRunCompleted?.(data);
    },
    [options.onAgentRunCompleted],
  );

  const handleDraftStatusChanged = useCallback(
    (data: any) => {
      options.onContentDraftStatusChanged?.(data);
    },
    [options.onContentDraftStatusChanged],
  );

  useSocket({
    'action-card:created': handleActionCreated,
    'action-card:updated': handleActionUpdated,
    'agent-run:completed': handleAgentRunCompleted,
    'content-draft:status-changed': handleDraftStatusChanged,
  });
}
