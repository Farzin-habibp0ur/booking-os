'use client';

import { CHANNEL_STYLES } from '@/lib/design-tokens';
import { MessageSquare, Instagram, Facebook, Mail, MessageCircle, Globe } from 'lucide-react';

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

export function ChannelsOnFile({ channels }: ChannelsOnFileProps) {
  const available = channelList(channels);
  if (available.length === 0) return null;

  return (
    <div className="space-y-1.5" aria-label="Customer channels on file" data-testid="channels-on-file">
      <h4 className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">Channels</h4>
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
    </div>
  );
}
