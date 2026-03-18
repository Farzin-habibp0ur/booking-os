'use client';

import { cn } from '@/lib/cn';
import { MessageSquare, Instagram, Globe } from 'lucide-react';

export type ChannelFilter = 'ALL' | 'WHATSAPP' | 'INSTAGRAM' | 'WEB';

interface ChannelFilterProps {
  selected: ChannelFilter;
  onChange: (channel: ChannelFilter) => void;
}

const CHANNELS: { key: ChannelFilter; label: string; icon: any }[] = [
  { key: 'ALL', label: 'All', icon: null },
  { key: 'WHATSAPP', label: 'WhatsApp', icon: MessageSquare },
  { key: 'INSTAGRAM', label: 'Instagram', icon: Instagram },
  { key: 'WEB', label: 'Web', icon: Globe },
];

export function ChannelFilterBar({ selected, onChange }: ChannelFilterProps) {
  return (
    <div className="flex items-center gap-1 px-3 py-1.5 border-b border-slate-100">
      {CHANNELS.map(({ key, label, icon: Icon }) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          className={cn(
            'inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg transition-colors',
            selected === key
              ? 'bg-sage-50 text-sage-700 font-medium'
              : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700',
          )}
          data-testid={`channel-filter-${key.toLowerCase()}`}
        >
          {Icon && <Icon size={12} />}
          {label}
        </button>
      ))}
    </div>
  );
}
