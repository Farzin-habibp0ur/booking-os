'use client';

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, AlertCircle, Sparkles, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/cn';
import { api } from '@/lib/api';
import { useToast } from '@/lib/toast';
import { BriefingCard, BriefingCardData } from './briefing-card';
import { OpportunityCard } from './opportunity-card';

interface BriefingGroup {
  category: string;
  label: string;
  cards: BriefingCardData[];
}

interface BriefingResult {
  groups: BriefingGroup[];
  totalPending: number;
  urgentCount: number;
  lastRefreshed: string;
}

const CATEGORY_META: Record<string, { icon: typeof AlertCircle; color: string }> = {
  URGENT_TODAY: { icon: AlertCircle, color: 'text-red-600' },
  NEEDS_APPROVAL: { icon: Sparkles, color: 'text-lavender-600' },
  OPPORTUNITY: { icon: TrendingUp, color: 'text-sage-600' },
  HYGIENE: { icon: RefreshCw, color: 'text-slate-500' },
};

interface BriefingFeedProps {
  onCardAction?: (card: BriefingCardData) => void;
}

export function BriefingFeed({ onCardAction }: BriefingFeedProps) {
  const { toast } = useToast();
  const [briefing, setBriefing] = useState<BriefingResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadBriefing = useCallback(async () => {
    try {
      setError(null);
      const data = await api.get('/briefing');
      setBriefing(data as BriefingResult);
    } catch (err: any) {
      const msg = err.message || 'Failed to load briefing';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBriefing();
  }, [loadBriefing]);

  const handleApprove = async (id: string) => {
    try {
      await api.patch(`/action-cards/${id}`, { status: 'APPROVED' });
      toast('Card approved', 'success');
      loadBriefing();
    } catch (err: any) {
      toast(err.message || 'Failed to approve card', 'error');
    }
  };

  const handleDismiss = async (id: string) => {
    try {
      await api.patch(`/action-cards/${id}`, { status: 'DISMISSED' });
      toast('Card dismissed', 'success');
      loadBriefing();
    } catch (err: any) {
      toast(err.message || 'Failed to dismiss card', 'error');
    }
  };

  if (loading) {
    return (
      <div data-testid="briefing-loading" className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-2xl bg-slate-50 dark:bg-slate-900 animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div
        data-testid="briefing-error"
        className="rounded-2xl bg-red-50 dark:bg-red-950/30 p-6 text-center"
      >
        <AlertCircle className="mx-auto mb-2 text-red-400" size={24} />
        <p className="text-sm text-red-600 dark:text-red-400 mb-3">{error}</p>
        <button
          onClick={() => {
            setLoading(true);
            loadBriefing();
          }}
          className="text-xs text-red-600 hover:text-red-700 underline"
          data-testid="briefing-retry"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!briefing || briefing.totalPending === 0) {
    return (
      <div
        data-testid="briefing-empty"
        className="rounded-2xl bg-sage-50 dark:bg-sage-950/30 p-8 text-center"
      >
        <Sparkles className="mx-auto mb-3 text-sage-400" size={28} />
        <h3 className="text-sm font-medium text-sage-900 dark:text-sage-100 mb-1">All clear</h3>
        <p className="text-xs text-sage-500">No action items right now. Great job!</p>
      </div>
    );
  }

  return (
    <div data-testid="briefing-feed" className="space-y-6">
      {/* Summary header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 font-serif">
            Daily Briefing
          </h2>
          {briefing.urgentCount > 0 && (
            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 text-red-700">
              {briefing.urgentCount} urgent
            </span>
          )}
        </div>
        <button
          onClick={() => {
            setLoading(true);
            loadBriefing();
          }}
          className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors"
          data-testid="briefing-refresh"
          title="Refresh"
        >
          <RefreshCw size={16} />
        </button>
      </div>

      {/* Groups */}
      {briefing.groups.map((group) => {
        const meta = CATEGORY_META[group.category];
        const GroupIcon = meta?.icon || Sparkles;
        const isOpportunity = group.category === 'OPPORTUNITY';

        return (
          <div key={group.category} data-testid={`briefing-group-${group.category}`}>
            <div className="flex items-center gap-2 mb-3">
              <GroupIcon size={14} className={cn(meta?.color || 'text-slate-500')} />
              <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                {group.label}
              </h3>
              <span className="text-[10px] text-slate-400">({group.cards.length})</span>
            </div>
            <div className="space-y-3">
              {group.cards.map((card) =>
                isOpportunity ? (
                  <OpportunityCard key={card.id} card={card} onAction={onCardAction} />
                ) : (
                  <BriefingCard
                    key={card.id}
                    card={card}
                    onApprove={handleApprove}
                    onDismiss={handleDismiss}
                    onView={onCardAction}
                  />
                ),
              )}
            </div>
          </div>
        );
      })}

      {/* Footer */}
      <p className="text-[10px] text-slate-300 dark:text-slate-600 text-center">
        Last updated {new Date(briefing.lastRefreshed).toLocaleTimeString()}
      </p>
    </div>
  );
}
