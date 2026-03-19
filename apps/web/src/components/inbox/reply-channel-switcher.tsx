'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
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
  const [focusedIndex, setFocusedIndex] = useState(-1);
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

  // Reset focused index when dropdown opens/closes
  useEffect(() => {
    if (isOpen) {
      setFocusedIndex(-1);
    }
  }, [isOpen]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
        return;
      }
      if (e.key === 'Tab') {
        setIsOpen(false);
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setFocusedIndex((prev) =>
          Math.min(prev + 1, availableChannels.length - 1),
        );
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusedIndex((prev) => Math.max(prev - 1, 0));
      }
      if (e.key === 'Enter' && focusedIndex >= 0) {
        e.preventDefault();
        onChannelChange(availableChannels[focusedIndex]);
        setIsOpen(false);
      }
    },
    [focusedIndex, availableChannels, onChannelChange],
  );

  if (availableChannels.length <= 1) return null;

  const currentStyle = CHANNEL_STYLES[currentChannel];
  const CurrentIcon = CHANNEL_ICONS[currentChannel];

  return (
    <div className="relative" ref={ref} onKeyDown={handleKeyDown}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label="Switch reply channel"
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
        <div
          className="absolute bottom-full left-0 mb-1 w-44 bg-white rounded-xl shadow-soft-sm border border-slate-100 py-1 z-50 animate-dropdown-open"
          role="listbox"
          aria-label="Available channels"
        >
          {availableChannels.map((ch, index) => {
            const style = CHANNEL_STYLES[ch];
            const Icon = CHANNEL_ICONS[ch];
            return (
              <button
                key={ch}
                onClick={() => {
                  onChannelChange(ch);
                  setIsOpen(false);
                }}
                role="option"
                aria-selected={ch === currentChannel}
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-colors',
                  ch === currentChannel
                    ? 'bg-slate-50 font-medium text-slate-900'
                    : 'text-slate-600 hover:bg-slate-50',
                  focusedIndex === index && 'ring-2 ring-inset ring-sage-500',
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
