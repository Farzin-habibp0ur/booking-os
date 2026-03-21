'use client';

import { useMemo } from 'react';
import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/cn';
import { Clock, AlertTriangle, Mail, MessageCircle, CheckCircle, MessageSquare, FileText } from 'lucide-react';

interface ConversationContextBarProps {
  channel: string;
  lastCustomerMessageAt?: string | Date;
  conversationMetadata?: {
    subject?: string;
    smsOptOut?: boolean;
    [key: string]: any;
  };
  onUseTemplate?: () => void;
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
  onUseTemplate,
}: ConversationContextBarProps) {
  const { t } = useI18n();

  const contextInfo = useMemo(() => {
    const lastMsg = lastCustomerMessageAt ? new Date(lastCustomerMessageAt).getTime() : 0;
    const now = Date.now();

    if (channel === 'WHATSAPP') {
      const windowMs24 = 24 * 60 * 60 * 1000;
      const elapsed = now - lastMsg;

      if (!lastMsg || elapsed >= windowMs24) {
        return {
          icon: MessageSquare,
          text: t('inbox.wa_template_required'),
          variant: 'warning' as const,
          showTemplateAction: true,
        };
      }

      if (elapsed >= windowMs24 * 0.8) {
        return {
          icon: Clock,
          text: `WhatsApp window closing: ${formatCountdown(windowMs24 - elapsed)}`,
          variant: 'warning' as const,
          showTemplateAction: false,
        };
      }

      return null;
    }

    if (channel === 'FACEBOOK' || channel === 'INSTAGRAM') {
      const windowMs24 = 24 * 60 * 60 * 1000;
      const windowMs7d = 7 * 24 * 60 * 60 * 1000;
      const elapsed = now - lastMsg;

      if (!lastMsg) {
        return {
          icon: AlertTriangle,
          text: t('inbox.context_no_window'),
          variant: 'warning' as const,
          showTemplateAction: false,
        };
      }

      if (elapsed < windowMs24) {
        return {
          icon: Clock,
          text: `${t('inbox.context_messaging_window')}: ${formatCountdown(windowMs24 - elapsed)}`,
          variant: 'info' as const,
          showTemplateAction: false,
        };
      }

      if (elapsed < windowMs7d) {
        return {
          icon: AlertTriangle,
          text: `${t('inbox.context_human_agent_window')}: ${formatCountdown(windowMs7d - elapsed)}`,
          variant: 'warning' as const,
          showTemplateAction: false,
        };
      }

      return {
        icon: AlertTriangle,
        text: t('inbox.context_window_expired'),
        variant: 'error' as const,
        showTemplateAction: false,
      };
    }

    if (channel === 'EMAIL' && conversationMetadata?.subject) {
      return {
        icon: Mail,
        text: `${t('inbox.context_subject')}: ${conversationMetadata.subject}`,
        variant: 'info' as const,
        showTemplateAction: false,
      };
    }

    if (channel === 'SMS') {
      if (conversationMetadata?.smsOptOut) {
        return {
          icon: AlertTriangle,
          text: t('inbox.context_sms_opted_out'),
          variant: 'error' as const,
          showTemplateAction: false,
        };
      }
      return {
        icon: CheckCircle,
        text: t('inbox.context_sms_opted_in'),
        variant: 'success' as const,
        showTemplateAction: false,
      };
    }

    return null;
  }, [channel, lastCustomerMessageAt, conversationMetadata, t]);

  if (!contextInfo) return null;

  const { icon: Icon, text, variant, showTemplateAction } = contextInfo;

  return (
    <div
      className={cn(
        'flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg mb-1.5',
        variant === 'info' && 'bg-blue-50 text-blue-700',
        variant === 'warning' && 'bg-amber-50 text-amber-700',
        variant === 'error' && 'bg-red-50 text-red-700',
        variant === 'success' && 'bg-sage-50 text-sage-700',
      )}
      data-testid="conversation-context-bar"
    >
      <Icon size={14} className="shrink-0" />
      <span className="truncate flex-1">{text}</span>
      {showTemplateAction && onUseTemplate && (
        <button
          onClick={onUseTemplate}
          className="flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-100 hover:bg-amber-200 text-amber-800 flex-shrink-0"
          data-testid="use-template-btn"
        >
          <FileText size={10} />
          Use template
        </button>
      )}
    </div>
  );
}
