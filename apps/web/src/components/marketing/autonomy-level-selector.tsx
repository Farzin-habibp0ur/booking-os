import { cn } from '@/lib/cn';
import { Shield } from 'lucide-react';

export const AUTONOMY_LEVELS = [
  {
    value: 'OFF',
    label: 'Off',
    description: 'Disabled — no automated actions',
    color: 'bg-slate-100 text-slate-600 border-slate-200',
    activeColor: 'bg-slate-200 text-slate-900 border-slate-400 ring-2 ring-slate-400',
  },
  {
    value: 'SUGGEST',
    label: 'Suggest',
    description: 'Suggests actions for human approval',
    color: 'bg-blue-50 text-blue-600 border-blue-200',
    activeColor: 'bg-blue-100 text-blue-900 border-blue-400 ring-2 ring-blue-400',
  },
  {
    value: 'AUTO_WITH_REVIEW',
    label: 'Auto + Review',
    description: 'Executes automatically, flagged for review',
    color: 'bg-lavender-50 text-lavender-600 border-lavender-200',
    activeColor: 'bg-lavender-100 text-lavender-900 border-lavender-400 ring-2 ring-lavender-400',
  },
  {
    value: 'FULL_AUTO',
    label: 'Full Auto',
    description: 'Fully autonomous — no human review',
    color: 'bg-sage-50 text-sage-600 border-sage-200',
    activeColor: 'bg-sage-100 text-sage-900 border-sage-400 ring-2 ring-sage-400',
  },
] as const;

interface AutonomyLevelSelectorProps {
  value: string;
  onChange: (level: string) => void;
  recommended?: string;
  disabled?: boolean;
  className?: string;
}

export function AutonomyLevelSelector({
  value,
  onChange,
  recommended,
  disabled = false,
  className,
}: AutonomyLevelSelectorProps) {
  return (
    <div
      data-testid="autonomy-level-selector"
      className={cn('flex gap-2', className)}
    >
      {AUTONOMY_LEVELS.map((level) => {
        const isActive = value === level.value;
        const isRecommended = recommended === level.value;
        return (
          <button
            key={level.value}
            type="button"
            disabled={disabled}
            onClick={() => onChange(level.value)}
            data-testid={`level-${level.value}`}
            className={cn(
              'flex-1 rounded-xl border px-3 py-2 text-center transition-all',
              isActive ? level.activeColor : level.color,
              disabled && 'opacity-50 cursor-not-allowed',
              !disabled && !isActive && 'hover:opacity-80 cursor-pointer',
            )}
          >
            <div className="text-xs font-semibold">{level.label}</div>
            <div className="text-[10px] opacity-70 mt-0.5">{level.description}</div>
            {isRecommended && (
              <div
                className="inline-flex items-center gap-0.5 mt-1 text-[9px] font-medium text-sage-700"
                data-testid="recommended-badge"
              >
                <Shield size={9} />
                Recommended
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
