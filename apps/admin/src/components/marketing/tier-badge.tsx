import { cn } from '@/lib/cn';

export const TIER_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  GREEN: { bg: 'bg-green-50', text: 'text-green-700', label: 'Green' },
  YELLOW: { bg: 'bg-amber-50', text: 'text-amber-700', label: 'Yellow' },
  RED: { bg: 'bg-red-50', text: 'text-red-700', label: 'Red' },
};

interface TierBadgeProps {
  tier: 'GREEN' | 'YELLOW' | 'RED';
  size?: 'sm' | 'md';
  className?: string;
}

export function TierBadge({ tier, size = 'sm', className }: TierBadgeProps) {
  const style = TIER_STYLES[tier];
  if (!style) return null;

  return (
    <span
      data-testid="tier-badge"
      className={cn(
        'inline-flex items-center rounded-full font-bold',
        size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-0.5 text-xs',
        style.bg,
        style.text,
        className,
      )}
    >
      {tier}
    </span>
  );
}
