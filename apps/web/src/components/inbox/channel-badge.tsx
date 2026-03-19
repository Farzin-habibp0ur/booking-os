'use client';

import { cn } from '@/lib/cn';
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

interface ChannelBadgeProps {
  channel: string;
  size?: 'sm' | 'md';
  showLabel?: boolean;
  className?: string;
}

export function ChannelBadge({
  channel,
  size = 'sm',
  showLabel = true,
  className,
}: ChannelBadgeProps) {
  const style = CHANNEL_STYLES[channel];
  const Icon = CHANNEL_ICONS[channel];
  const label = style?.label || channel;
  const iconSize = size === 'sm' ? 12 : 14;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md font-medium',
        size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs',
        style ? `${style.bg} ${style.text}` : 'bg-slate-100 text-slate-600',
        className,
      )}
      data-testid={`channel-badge-${channel.toLowerCase()}`}
    >
      {Icon && <Icon size={iconSize} />}
      {showLabel && label}
    </span>
  );
}
