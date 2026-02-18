'use client';

import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/cn';

interface ActionCardBadgeProps {
  count: number;
  className?: string;
}

export function ActionCardBadge({ count, className }: ActionCardBadgeProps) {
  if (count === 0) return null;

  return (
    <span
      data-testid="action-card-badge"
      className={cn(
        'inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full',
        'bg-lavender-100 text-lavender-700',
        className,
      )}
    >
      <Sparkles size={10} />
      {count}
    </span>
  );
}
