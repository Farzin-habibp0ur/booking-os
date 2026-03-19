'use client';

import { useMemo } from 'react';
import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/cn';
import { Clock, AlertTriangle, Mail, MessageCircle, CheckCircle } from 'lucide-react';

interface ConversationContextBarProps {
  channel: string;
  lastCustomerMessageAt?: string | Date;
  conversationMetadata?: {
    subject?: string;
    smsOptOut?: boolean;
    [key: string]: any;
  };
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return 'Expired';
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h`;
  }
  return `${hours}h ${minutes}m`;
}

export function ConversationContextBar({
  channel,
  lastCustomerMessageAt,
  conversationMetadata,
}: ConversationContextBarProps) {
  const { t } = useI18n();

  const contextInfo = useMemo(() => {
    const lastMsg = lastCustomerMessageAt ? new Date(lastCustomerMessageAt).getTime() : 0;
    const now = Date.now();

    if (channel === 'FACEBOOK' || channel === 'INSTAGRAM') {
      const windowMs24 = 24 * 60 * 60 * 1000;
      const windowMs7d = 7 * 24 * 60 * 60 * 1000;
      const elapsed = now - lastMsg;

      if (!lastMsg) {
        return {
          icon: AlertTriangle,
          text: t('inbox.context_no_window'),
          variant: 'warning' as const,
        };
      }

      if (elapsed < windowMs24) {
        return {
          icon: Clock,
          text: `${t('inbox.context_messaging_window')}: ${formatCountdown(windowMs24 - elapsed)}`,
          variant: 'info' as const,
        };
      }

      if (elapsed < windowMs7d) {
        return {
          icon: AlertTriangle,
          text: `${t('inbox.context_human_agent_window')}: ${formatCountdown(windowMs7d - elapsed)}`,
          variant: 'warning' as const,
        };
      }

      return {
        icon: AlertTriangle,
        text: t('inbox.context_window_expired'),
        variant: 'error' as const,
      };
    }

    if (channel === 'EMAIL' && conversationMetadata?.subject) {
      return {
        icon: Mail,
        text: `${t('inbox.context_subject')}: ${conversationMetadata.subject}`,
        variant: 'info' as const,
      };
    }

    if (channel === 'SMS') {
      if (conversationMetadata?.smsOptOut) {
        return {
          icon: AlertTriangle,
          text: t('inbox.context_sms_opted_out'),
          variant: 'error' as const,
        };
      }
      return {
        icon: CheckCircle,
        text: t('inbox.context_sms_opted_in'),
        variant: 'success' as const,
      };
    }

    return null;
  }, [channel, lastCustomerMessageAt, conversationMetadata, t]);

  if (!contextInfo) return null;

  const { icon: Icon, text, variant } = contextInfo;

  return (
    <div
      className={cn(
        'flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg',
        variant === 'info' && 'bg-blue-50 text-blue-700',
        variant === 'warning' && 'bg-amber-50 text-amber-700',
        variant === 'error' && 'bg-red-50 text-red-700',
        variant === 'success' && 'bg-sage-50 text-sage-700',
      )}
      data-testid="conversation-context-bar"
    >
      <Icon size={14} className="shrink-0" />
      <span className="truncate">{text}</span>
    </div>
  );
}
