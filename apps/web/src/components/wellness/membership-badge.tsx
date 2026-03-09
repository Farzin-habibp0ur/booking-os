'use client';

import { Crown, Star, Zap, User } from 'lucide-react';
import { cn } from '@/lib/cn';

interface MembershipBadgeProps {
  type: string;
  size?: 'sm' | 'md';
}

const MEMBERSHIP_CONFIG: Record<
  string,
  { icon: typeof Crown; bg: string; text: string; border: string }
> = {
  VIP: { icon: Crown, bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  Annual: { icon: Star, bg: 'bg-sage-50', text: 'text-sage-700', border: 'border-sage-200' },
  Monthly: {
    icon: Zap,
    bg: 'bg-lavender-50',
    text: 'text-lavender-700',
    border: 'border-lavender-200',
  },
  'Drop-in': { icon: User, bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200' },
};

export default function MembershipBadge({ type, size = 'sm' }: MembershipBadgeProps) {
  const config = MEMBERSHIP_CONFIG[type] || MEMBERSHIP_CONFIG['Drop-in'];
  const Icon = config.icon;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border font-medium',
        config.bg,
        config.text,
        config.border,
        size === 'sm' ? 'text-[10px] px-2 py-0.5' : 'text-xs px-2.5 py-1',
      )}
      data-testid="membership-badge"
    >
      <Icon size={size === 'sm' ? 10 : 12} />
      {type}
    </span>
  );
}
