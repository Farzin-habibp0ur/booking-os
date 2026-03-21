'use client';

import { useState } from 'react';
import { X, Send, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/cn';
import { api } from '@/lib/api';
import { useToast } from '@/lib/toast';
import { ActionCardData } from './action-card';
import { CHANNEL_STYLES } from '@/lib/design-tokens';

interface ActionCardPreviewProps {
  card: ActionCardData;
  onClose: () => void;
  onApprove?: (id: string) => void;
  onDismiss?: (id: string) => void;
  onExecuteCta?: (id: string, ctaAction: string) => Promise<void>;
}

const CHANNEL_LIST = ['SMS', 'WHATSAPP', 'EMAIL', 'INSTAGRAM', 'FACEBOOK'];

export function ActionCardPreview({
  card,
  onClose,
  onApprove,
  onDismiss,
  onExecuteCta,
}: ActionCardPreviewProps) {
  const { toast } = useToast();
  const preview = card.preview;
  const metadata = (card as any).metadata || {};
  const suggestedMessages = metadata.suggestedMessages;
  const customerChannels: string[] = metadata.customerChannels || [];
  const recommendedChannel: string = metadata.recommendedChannel || '';

  // Filter channels: only show those the customer has, or all if no info
  const availableChannels = customerChannels.length > 0
    ? CHANNEL_LIST.filter((ch) => customerChannels.includes(ch))
    : suggestedMessages
      ? CHANNEL_LIST.filter((ch) => suggestedMessages[ch])
      : [];

  const [selectedChannel, setSelectedChannel] = useState(
    recommendedChannel || availableChannels[0] || 'WHATSAPP',
  );
  const [sending, setSending] = useState(false);

  const getMessageForChannel = (ch: string): { subject?: string; body: string } | null => {
    if (!suggestedMessages) return null;
    const msg = suggestedMessages[ch] || suggestedMessages.DEFAULT;
    if (!msg) return null;
    if (typeof msg === 'string') return { body: msg };
    return { subject: msg.subject, body: msg.body };
  };

  const currentMessage = getMessageForChannel(selectedChannel);

  const handleSendFollowup = async () => {
    if (!onExecuteCta) return;
    setSending(true);
    try {
      await onExecuteCta(card.id, 'send_followup');
      toast('Follow-up draft created. Review in inbox.');
      onClose();
    } catch (e: any) {
      toast(e?.message || 'Failed to create follow-up', 'error');
    } finally {
      setSending(false);
    }
  };

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

          {/* Message Preview — for cards with suggestedMessages */}
          {suggestedMessages && currentMessage && (
            <div className="border border-slate-100 dark:border-slate-800 rounded-xl overflow-hidden">
              <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                <MessageSquare size={14} className="text-slate-500" />
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Message Preview
                </span>
              </div>

              {/* Channel tabs */}
              {availableChannels.length > 1 && (
                <div className="flex gap-1 px-3 py-2 border-b border-slate-100 dark:border-slate-700">
                  {availableChannels.map((ch) => {
                    const style = CHANNEL_STYLES[ch as keyof typeof CHANNEL_STYLES];
                    return (
                      <button
                        key={ch}
                        onClick={() => setSelectedChannel(ch)}
                        className={cn(
                          'text-[10px] px-2 py-1 rounded-full font-medium transition-colors',
                          selectedChannel === ch
                            ? style
                              ? `${style.bg} ${style.text}`
                              : 'bg-sage-100 text-sage-700'
                            : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100',
                        )}
                      >
                        {ch}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Message content */}
              <div className="p-3">
                {currentMessage.subject && (
                  <p className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Subject: {currentMessage.subject}
                  </p>
                )}
                <p className="text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap">
                  {currentMessage.body}
                </p>
                {selectedChannel === 'SMS' && (
                  <p className="text-[10px] text-slate-400 mt-2">
                    {currentMessage.body.length} / 160 characters
                    {currentMessage.body.length > 160 && ' (multi-segment)'}
                  </p>
                )}
              </div>
            </div>
          )}

          {preview && !suggestedMessages && (
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

        <div className="flex items-center justify-end gap-2 p-4 border-t border-slate-100 dark:border-slate-800">
          {onDismiss && card.status === 'PENDING' && (
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
          {suggestedMessages && onExecuteCta && card.status === 'PENDING' && (
            <button
              onClick={handleSendFollowup}
              disabled={sending}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-xl bg-sage-600 text-white hover:bg-sage-700 disabled:opacity-50 transition-colors"
              data-testid="preview-send-followup"
            >
              <Send size={14} />
              {sending ? 'Creating draft...' : 'Send Follow-up'}
            </button>
          )}
          {!suggestedMessages && onApprove && card.status === 'PENDING' && (
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
      </div>
    </div>
  );
}
