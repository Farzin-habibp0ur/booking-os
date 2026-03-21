'use client';

import { cn } from '@/lib/cn';
import { MessageSquare, Instagram, Facebook, Mail, MessageCircle, Globe } from 'lucide-react';

export type ChannelFilter =
  | 'ALL'
  | 'WHATSAPP'
  | 'INSTAGRAM'
  | 'FACEBOOK'
  | 'SMS'
  | 'EMAIL'
  | 'WEB_CHAT';

interface ChannelFilterProps {
  selected: ChannelFilter;
  onChange: (channel: ChannelFilter) => void;
  unreadCounts?: Record<string, number>;
}

const CHANNELS: { key: ChannelFilter; label: string; icon: any }[] = [
  { key: 'ALL', label: 'All', icon: null },
  { key: 'WHATSAPP', label: 'WhatsApp', icon: MessageSquare },
  { key: 'INSTAGRAM', label: 'Instagram', icon: Instagram },
  { key: 'FACEBOOK', label: 'Messenger', icon: Facebook },
  { key: 'SMS', label: 'SMS', icon: MessageCircle },
  { key: 'EMAIL', label: 'Email', icon: Mail },
  { key: 'WEB_CHAT', label: 'Web', icon: Globe },
];

export function ChannelFilterBar({ selected, onChange, unreadCounts }: ChannelFilterProps) {
  return (
    <div
      className="flex items-center gap-1 px-3 py-1.5 border-b border-slate-100 overflow-x-auto"
      role="tablist"
      aria-label="Filter by channel"
    >
      {CHANNELS.map(({ key, label, icon: Icon }) => {
        const count = key === 'ALL' ? undefined : unreadCounts?.[key];

        return (
          <button
            key={key}
            onClick={() => onChange(key)}
            role="tab"
            aria-selected={selected === key}
            className={cn(
              'inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg transition-colors whitespace-nowrap',
              selected === key
                ? 'bg-sage-50 text-sage-700 font-medium'
                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700',
            )}
            data-testid={`channel-filter-${key.toLowerCase()}`}
          >
            {Icon && <Icon size={12} />}
            {label}
            {count != null && count > 0 && (
              <span className="ml-0.5 inline-flex items-center justify-center min-w-[16px] h-4 px-1 text-[10px] font-semibold text-white bg-red-500 rounded-full">
                {count > 99 ? '99+' : count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
