'use client';

import { TrendingUp, Calendar, Zap, Users, Sparkles, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/cn';
import { BriefingCardData } from './briefing-card';

const OPPORTUNITY_ICONS: Record<string, typeof TrendingUp> = {
  OPEN_SLOT: Calendar,
  WAITLIST_MATCH: Zap,
  RETENTION_DUE: Users,
};

interface OpportunityCardProps {
  card: BriefingCardData;
  onAction?: (card: BriefingCardData) => void;
}

export function OpportunityCard({ card, onAction }: OpportunityCardProps) {
  const Icon = OPPORTUNITY_ICONS[card.type] || TrendingUp;

  return (
    <div
      data-testid={`opportunity-card-${card.id}`}
      className={cn(
        'rounded-2xl border border-sage-100 dark:border-sage-900/30',
        'bg-gradient-to-br from-sage-50 to-white dark:from-sage-950/30 dark:to-slate-900',
        'p-4 transition-all hover:shadow-soft cursor-pointer',
      )}
      onClick={() => onAction?.(card)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onAction?.(card)}
    >
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-xl bg-sage-100 dark:bg-sage-900/50 text-sage-700 dark:text-sage-400 shrink-0">
          <Icon size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-sage-900 dark:text-sage-100">{card.title}</h4>
          <p className="text-xs text-sage-600 dark:text-sage-400 mt-0.5 line-clamp-2">
            {card.description}
          </p>
        </div>
      </div>

      {card.suggestedAction && (
        <div className="mt-3 pt-3 border-t border-sage-100 dark:border-sage-800/50">
          <div className="flex items-center gap-2">
            <Sparkles size={12} className="text-sage-500" />
            <span className="text-xs text-sage-600 dark:text-sage-400 flex-1">
              {card.suggestedAction}
            </span>
            <ArrowRight size={14} className="text-sage-400" />
          </div>
        </div>
      )}
    </div>
  );
}
