'use client';

import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/cn';
import { CHANNEL_STYLES } from '@/lib/design-tokens';
import {
  ChevronDown,
  MessageSquare,
  Instagram,
  Facebook,
  Mail,
  MessageCircle,
  Globe,
} from 'lucide-react';

const CHANNEL_ICONS: Record<string, any> = {
  WHATSAPP: MessageSquare,
  INSTAGRAM: Instagram,
  FACEBOOK: Facebook,
  SMS: MessageCircle,
  EMAIL: Mail,
  WEB_CHAT: Globe,
};

interface ReplyChannelSwitcherProps {
  currentChannel: string;
  availableChannels: string[];
  onChannelChange: (channel: string) => void;
}

export function ReplyChannelSwitcher({
  currentChannel,
  availableChannels,
  onChannelChange,
}: ReplyChannelSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (availableChannels.length <= 1) return null;

  const currentStyle = CHANNEL_STYLES[currentChannel];
  const CurrentIcon = CHANNEL_ICONS[currentChannel];

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg border transition-colors',
          currentStyle
            ? `${currentStyle.bg} ${currentStyle.text} ${currentStyle.border}`
            : 'bg-slate-50 text-slate-600 border-slate-200',
        )}
        data-testid="reply-channel-switcher"
      >
        {CurrentIcon && <CurrentIcon size={12} />}
        <span>{currentStyle?.label || currentChannel}</span>
        <ChevronDown size={10} />
      </button>

      {isOpen && (
        <div className="absolute bottom-full left-0 mb-1 w-44 bg-white rounded-xl shadow-soft-sm border border-slate-100 py-1 z-50 animate-dropdown-open">
          {availableChannels.map((ch) => {
            const style = CHANNEL_STYLES[ch];
            const Icon = CHANNEL_ICONS[ch];
            return (
              <button
                key={ch}
                onClick={() => {
                  onChannelChange(ch);
                  setIsOpen(false);
                }}
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-colors',
                  ch === currentChannel
                    ? 'bg-slate-50 font-medium text-slate-900'
                    : 'text-slate-600 hover:bg-slate-50',
                )}
                data-testid={`reply-channel-option-${ch.toLowerCase()}`}
              >
                {Icon && <Icon size={12} className={style?.text || ''} />}
                <span>{style?.label || ch}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
