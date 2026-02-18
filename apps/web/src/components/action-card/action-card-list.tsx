'use client';

import { useState } from 'react';
import { ActionCard, ActionCardData } from './action-card';

const CATEGORY_ORDER = ['URGENT_TODAY', 'NEEDS_APPROVAL', 'OPPORTUNITY', 'HYGIENE'];
const CATEGORY_LABELS: Record<string, string> = {
  URGENT_TODAY: 'Urgent Today',
  NEEDS_APPROVAL: 'Needs Approval',
  OPPORTUNITY: 'Opportunities',
  HYGIENE: 'Maintenance',
};

interface ActionCardListProps {
  cards: ActionCardData[];
  onApprove?: (id: string) => void;
  onDismiss?: (id: string) => void;
  onSnooze?: (id: string) => void;
  onExecute?: (id: string) => void;
  onPreview?: (card: ActionCardData) => void;
  filterCategory?: string;
  grouped?: boolean;
  compact?: boolean;
}

export function ActionCardList({
  cards,
  onApprove,
  onDismiss,
  onSnooze,
  onExecute,
  onPreview,
  filterCategory,
  grouped = true,
  compact = false,
}: ActionCardListProps) {
  const [activeFilter, setActiveFilter] = useState<string | undefined>(filterCategory);

  const filtered = activeFilter ? cards.filter((c) => c.category === activeFilter) : cards;

  if (grouped) {
    const groups = CATEGORY_ORDER.map((cat) => ({
      category: cat,
      label: CATEGORY_LABELS[cat],
      items: filtered.filter((c) => c.category === cat),
    })).filter((g) => g.items.length > 0);

    return (
      <div data-testid="action-card-list" className="space-y-6">
        {/* Filter chips */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setActiveFilter(undefined)}
            className={`text-xs px-3 py-1 rounded-full transition-colors ${
              !activeFilter
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
            data-testid="filter-all"
          >
            All ({cards.length})
          </button>
          {CATEGORY_ORDER.map((cat) => {
            const count = cards.filter((c) => c.category === cat).length;
            if (count === 0) return null;
            return (
              <button
                key={cat}
                onClick={() => setActiveFilter(activeFilter === cat ? undefined : cat)}
                className={`text-xs px-3 py-1 rounded-full transition-colors ${
                  activeFilter === cat
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
                data-testid={`filter-${cat}`}
              >
                {CATEGORY_LABELS[cat]} ({count})
              </button>
            );
          })}
        </div>

        {groups.map((group) => (
          <div key={group.category}>
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
              {group.label}
            </h3>
            <div className="space-y-3">
              {group.items.map((card) => (
                <ActionCard
                  key={card.id}
                  card={card}
                  onApprove={onApprove}
                  onDismiss={onDismiss}
                  onSnooze={onSnooze}
                  onExecute={onExecute}
                  onPreview={onPreview}
                  compact={compact}
                />
              ))}
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-8" data-testid="empty-state">
            No action cards
          </p>
        )}
      </div>
    );
  }

  return (
    <div data-testid="action-card-list" className="space-y-3">
      {filtered.map((card) => (
        <ActionCard
          key={card.id}
          card={card}
          onApprove={onApprove}
          onDismiss={onDismiss}
          onSnooze={onSnooze}
          onExecute={onExecute}
          onPreview={onPreview}
          compact={compact}
        />
      ))}
      {filtered.length === 0 && (
        <p className="text-sm text-slate-400 text-center py-8" data-testid="empty-state">
          No action cards
        </p>
      )}
    </div>
  );
}
