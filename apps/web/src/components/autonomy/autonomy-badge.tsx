'use client';

import { Shield, ShieldCheck, ShieldOff } from 'lucide-react';
import { cn } from '@/lib/cn';

const LEVEL_CONFIG: Record<string, { icon: typeof Shield; label: string; style: string }> = {
  OFF: {
    icon: ShieldOff,
    label: 'Off',
    style: 'bg-slate-100 text-slate-500',
  },
  ASSISTED: {
    icon: Shield,
    label: 'Assisted',
    style: 'bg-lavender-50 text-lavender-600',
  },
  AUTO: {
    icon: ShieldCheck,
    label: 'Auto',
    style: 'bg-sage-50 text-sage-600',
  },
};

interface AutonomyBadgeProps {
  level: string;
  className?: string;
}

export function AutonomyBadge({ level, className }: AutonomyBadgeProps) {
  const config = LEVEL_CONFIG[level] || LEVEL_CONFIG.ASSISTED;
  const Icon = config.icon;

  return (
    <span
      data-testid="autonomy-badge"
      className={cn(
        'inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full',
        config.style,
        className,
      )}
    >
      <Icon size={10} />
      {config.label}
    </span>
  );
}
