'use client';

import { useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { CHANNEL_STYLES } from '@/lib/design-tokens';
import { MessageSquare, Instagram, Facebook, Mail, MessageCircle, Globe, Plus } from 'lucide-react';

const CHANNEL_ICONS: Record<string, any> = {
  WHATSAPP: MessageSquare,
  INSTAGRAM: Instagram,
  FACEBOOK: Facebook,
  SMS: MessageCircle,
  EMAIL: Mail,
  WEB_CHAT: Globe,
};

interface CustomerChannels {
  phone?: string;
  email?: string;
  instagramUserId?: string;
  facebookPsid?: string;
  webChatSessionId?: string;
}

interface ChannelsOnFileProps {
  channels: CustomerChannels;
  onAddIdentifier?: (type: 'email' | 'phone', value: string) => void;
}

function channelList(channels: CustomerChannels): Array<{ channel: string; identifier: string }> {
  const list: Array<{ channel: string; identifier: string }> = [];
  if (channels.phone) list.push({ channel: 'WHATSAPP', identifier: channels.phone });
  if (channels.phone) list.push({ channel: 'SMS', identifier: channels.phone });
  if (channels.email) list.push({ channel: 'EMAIL', identifier: channels.email });
  if (channels.instagramUserId)
    list.push({ channel: 'INSTAGRAM', identifier: channels.instagramUserId });
  if (channels.facebookPsid) list.push({ channel: 'FACEBOOK', identifier: channels.facebookPsid });
  if (channels.webChatSessionId)
    list.push({ channel: 'WEB_CHAT', identifier: channels.webChatSessionId });
  return list;
}

export function ChannelsOnFile({ channels, onAddIdentifier }: ChannelsOnFileProps) {
  const { t } = useI18n();
  const available = channelList(channels);
  const [addingType, setAddingType] = useState<'email' | 'phone' | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (type: 'email' | 'phone') => {
    const trimmed = inputValue.trim();
    if (!trimmed) return;

    if (type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError(t('inbox.invalid_email'));
      return;
    }
    if (type === 'phone' && !/^\+[1-9]\d{1,14}$/.test(trimmed)) {
      setError(t('inbox.invalid_phone'));
      return;
    }

    onAddIdentifier?.(type, trimmed);
    setAddingType(null);
    setInputValue('');
    setError(null);
  };

  const missingEmail = !channels.email;
  const missingPhone = !channels.phone;

  if (available.length === 0 && !onAddIdentifier) return null;

  return (
    <div
      className="space-y-1.5"
      aria-label="Customer channels on file"
      data-testid="channels-on-file"
    >
      <h4 className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">
        {t('inbox.channels_on_file')}
      </h4>
      <div className="space-y-1">
        {available.map(({ channel, identifier }) => {
          const style = CHANNEL_STYLES[channel];
          const Icon = CHANNEL_ICONS[channel];
          return (
            <div
              key={`${channel}-${identifier}`}
              className="flex items-center gap-2 text-xs text-slate-600"
            >
              {Icon && <Icon size={12} className={style?.text || 'text-slate-400'} />}
              <span className="font-medium">{style?.label || channel}</span>
              <span className="text-slate-400 truncate text-[10px]">{identifier}</span>
            </div>
          );
        })}
      </div>

      {onAddIdentifier && (missingEmail || missingPhone) && (
        <div className="space-y-1 pt-1 border-t border-slate-100">
          {missingEmail && addingType !== 'email' && (
            <button
              onClick={() => {
                setAddingType('email');
                setInputValue('');
              }}
              className="flex items-center gap-1 text-[10px] text-sage-600 hover:text-sage-700 transition-colors"
              data-testid="add-email-button"
            >
              <Plus size={10} />
              {t('inbox.add_email')}
            </button>
          )}
          {missingPhone && addingType !== 'phone' && (
            <button
              onClick={() => {
                setAddingType('phone');
                setInputValue('');
              }}
              className="flex items-center gap-1 text-[10px] text-sage-600 hover:text-sage-700 transition-colors"
              data-testid="add-phone-button"
            >
              <Plus size={10} />
              {t('inbox.add_phone')}
            </button>
          )}

          {addingType && (
            <>
              <div className="flex items-center gap-1">
                <input
                  type={addingType === 'email' ? 'email' : 'tel'}
                  value={inputValue}
                  onChange={(e) => {
                    setInputValue(e.target.value);
                    if (error) setError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSubmit(addingType);
                    if (e.key === 'Escape') {
                      setAddingType(null);
                      setInputValue('');
                    }
                  }}
                  placeholder={addingType === 'email' ? 'email@example.com' : '+1234567890'}
                  className="flex-1 text-[10px] px-1.5 py-0.5 rounded border border-slate-200 bg-white focus:ring-1 focus:ring-sage-500 outline-none"
                  autoFocus
                  data-testid={`add-${addingType}-input`}
                />
                <button
                  onClick={() => handleSubmit(addingType)}
                  className="text-[10px] px-1.5 py-0.5 rounded bg-sage-600 text-white hover:bg-sage-700 transition-colors"
                >
                  {t('inbox.add_save')}
                </button>
                <button
                  onClick={() => {
                    setAddingType(null);
                    setInputValue('');
                    setError(null);
                  }}
                  className="text-[10px] px-1.5 py-0.5 text-slate-400 hover:text-slate-600"
                >
                  ✕
                </button>
              </div>
              {error && (
                <p className="text-[10px] text-red-500" data-testid="add-identifier-error">
                  {error}
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
