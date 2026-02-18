'use client';

import { Sparkles, Pause, User } from 'lucide-react';
import { cn } from '@/lib/cn';

type AiState = 'drafting' | 'paused' | 'human_takeover';

const STATE_CONFIG: Record<AiState, { icon: typeof Sparkles; label: string; style: string }> = {
  drafting: {
    icon: Sparkles,
    label: 'AI drafting',
    style: 'bg-lavender-50 text-lavender-600 border-lavender-100',
  },
  paused: {
    icon: Pause,
    label: 'AI paused',
    style: 'bg-amber-50 text-amber-600 border-amber-100',
  },
  human_takeover: {
    icon: User,
    label: 'Human takeover',
    style: 'bg-sage-50 text-sage-600 border-sage-100',
  },
};

interface AiStateIndicatorProps {
  state: AiState;
  className?: string;
}

export function AiStateIndicator({ state, className }: AiStateIndicatorProps) {
  const config = STATE_CONFIG[state];
  const Icon = config.icon;

  return (
    <span
      data-testid="ai-state-indicator"
      className={cn(
        'inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full border',
        config.style,
        className,
      )}
    >
      <Icon size={12} />
      {config.label}
    </span>
  );
}
