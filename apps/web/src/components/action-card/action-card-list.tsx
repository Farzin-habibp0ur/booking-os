'use client';

import { useState } from 'react';
import { Send } from 'lucide-react';
import { ActionCard, ActionCardData } from './action-card';
import BulkActionBar from '@/components/bulk-action-bar';

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
  onExecuteCta?: (id: string, ctaAction: string) => Promise<void>;
  onPreview?: (card: ActionCardData) => void;
  onBulkFollowUp?: (cardIds: string[]) => Promise<void>;
  onBulkDismiss?: (cardIds: string[]) => Promise<void>;
  onBulkSnooze?: (cardIds: string[]) => Promise<void>;
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
  onExecuteCta,
  onPreview,
  onBulkFollowUp,
  onBulkDismiss,
  onBulkSnooze,
  filterCategory,
  grouped = true,
  compact = false,
}: ActionCardListProps) {
  const [activeFilter, setActiveFilter] = useState<string | undefined>(filterCategory);
  const [bulkSending, setBulkSending] = useState(false);
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const filtered = activeFilter ? cards.filter((c) => c.category === activeFilter) : cards;

  // Cards eligible for bulk follow-up: PENDING retention/quote cards with suggestedMessages
  const bulkEligible = filtered.filter(
    (c) =>
      c.status === 'PENDING' &&
      (c.type === 'RETENTION_DUE' || c.type === 'STALLED_QUOTE') &&
      (c as any).metadata?.suggestedMessages,
  );

  const handleBulkFollowUp = async () => {
    if (!onBulkFollowUp || bulkEligible.length === 0) return;
    setBulkSending(true);
    try {
      await onBulkFollowUp(bulkEligible.map((c) => c.id));
    } finally {
      setBulkSending(false);
      setShowBulkConfirm(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  const bulkActions = [
    ...(onBulkDismiss
      ? [
          {
            label: 'Dismiss Selected',
            onClick: async () => {
              await onBulkDismiss(Array.from(selectedIds));
              clearSelection();
            },
            variant: 'danger' as const,
          },
        ]
      : []),
    ...(onBulkSnooze
      ? [
          {
            label: 'Snooze Selected',
            onClick: async () => {
              await onBulkSnooze(Array.from(selectedIds));
              clearSelection();
            },
          },
        ]
      : []),
  ];

  if (grouped) {
    const groups = CATEGORY_ORDER.map((cat) => ({
      category: cat,
      label: CATEGORY_LABELS[cat],
      items: filtered.filter((c) => c.category === cat),
    })).filter((g) => g.items.length > 0);

    return (
      <div data-testid="action-card-list" className="space-y-6">
        {/* Filter chips */}
        <div
          className="flex items-center gap-2 flex-wrap"
          role="radiogroup"
          aria-label="Filter action cards by category"
        >
          <button
            onClick={() => setActiveFilter(undefined)}
            role="radio"
            aria-checked={!activeFilter}
            aria-label="Show all action cards"
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
                role="radio"
                aria-checked={activeFilter === cat}
                aria-label={`Filter by ${CATEGORY_LABELS[cat]} cards`}
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

          {/* Bulk follow-up button */}
          {onBulkFollowUp && bulkEligible.length > 1 && (
            <>
              <div className="flex-1" />
              {showBulkConfirm ? (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-600">
                    Create {bulkEligible.length} follow-up drafts?
                  </span>
                  <button
                    onClick={handleBulkFollowUp}
                    disabled={bulkSending}
                    className="px-3 py-1 rounded-full bg-sage-600 text-white hover:bg-sage-700 disabled:opacity-50 transition-colors"
                  >
                    {bulkSending ? 'Creating...' : 'Confirm'}
                  </button>
                  <button
                    onClick={() => setShowBulkConfirm(false)}
                    className="px-3 py-1 rounded-full text-slate-500 hover:bg-slate-100 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowBulkConfirm(true)}
                  className="flex items-center gap-1 text-xs px-3 py-1 rounded-full bg-sage-50 text-sage-700 hover:bg-sage-100 transition-colors"
                >
                  <Send size={12} /> Send All Follow-ups ({bulkEligible.length})
                </button>
              )}
            </>
          )}
        </div>

        {groups.map((group) => (
          <div key={group.category}>
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
              {group.label}
            </h3>
            <div className="space-y-3">
              {group.items.map((card) => (
                <div key={card.id} className="flex items-start gap-2">
                  {(onBulkDismiss || onBulkSnooze) && card.status === 'PENDING' && (
                    <input
                      type="checkbox"
                      checked={selectedIds.has(card.id)}
                      onChange={() => toggleSelect(card.id)}
                      aria-label={`Select card: ${card.title}`}
                      className="mt-4 rounded border-slate-300 text-sage-600 focus:ring-sage-500"
                      data-testid={`select-${card.id}`}
                    />
                  )}
                  <div className="flex-1">
                    <ActionCard
                      card={card}
                      onApprove={onApprove}
                      onDismiss={onDismiss}
                      onSnooze={onSnooze}
                      onExecute={onExecute}
                      onExecuteCta={onExecuteCta}
                      onPreview={onPreview}
                      compact={compact}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-8" data-testid="empty-state">
            No action cards
          </p>
        )}

        <BulkActionBar count={selectedIds.size} onClear={clearSelection} actions={bulkActions} />
      </div>
    );
  }

  return (
    <div data-testid="action-card-list" className="space-y-3">
      {filtered.map((card) => (
        <div key={card.id} className="flex items-start gap-2">
          {(onBulkDismiss || onBulkSnooze) && card.status === 'PENDING' && (
            <input
              type="checkbox"
              checked={selectedIds.has(card.id)}
              onChange={() => toggleSelect(card.id)}
              aria-label={`Select card: ${card.title}`}
              className="mt-4 rounded border-slate-300 text-sage-600 focus:ring-sage-500"
              data-testid={`select-${card.id}`}
            />
          )}
          <div className="flex-1">
            <ActionCard
              card={card}
              onApprove={onApprove}
              onDismiss={onDismiss}
              onSnooze={onSnooze}
              onExecute={onExecute}
              onExecuteCta={onExecuteCta}
              onPreview={onPreview}
              compact={compact}
            />
          </div>
        </div>
      ))}
      {filtered.length === 0 && (
        <p className="text-sm text-slate-400 text-center py-8" data-testid="empty-state">
          No action cards
        </p>
      )}
      <BulkActionBar count={selectedIds.size} onClear={clearSelection} actions={bulkActions} />
    </div>
  );
}
