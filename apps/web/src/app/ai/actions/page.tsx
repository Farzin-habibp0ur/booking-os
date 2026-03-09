'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { useToast } from '@/lib/toast';
import {
  Sparkles,
  CheckCircle,
  X,
  Clock,
  AlertTriangle,
  AlertCircle,
  Lightbulb,
  Shield,
} from 'lucide-react';

interface ActionCard {
  id: string;
  agentType: string;
  category: string;
  type: string;
  title: string;
  description: string;
  entityType?: string;
  entityId?: string;
  confidence?: number;
  status: 'PENDING' | 'APPROVED' | 'DISMISSED' | 'SNOOZED' | 'EXECUTED';
  createdAt: string;
  metadata?: Record<string, any>;
}

type Category = 'urgent' | 'needs_approval' | 'opportunity' | 'hygiene';

const CATEGORY_CONFIG: Record<
  Category,
  { label: string; icon: any; borderColor: string; bgColor: string; textColor: string }
> = {
  urgent: {
    label: 'Urgent',
    icon: AlertTriangle,
    borderColor: 'border-red-400',
    bgColor: 'bg-red-50',
    textColor: 'text-red-700',
  },
  needs_approval: {
    label: 'Needs Approval',
    icon: AlertCircle,
    borderColor: 'border-amber-400',
    bgColor: 'bg-amber-50',
    textColor: 'text-amber-700',
  },
  opportunity: {
    label: 'Opportunity',
    icon: Lightbulb,
    borderColor: 'border-sage-400',
    bgColor: 'bg-sage-50',
    textColor: 'text-sage-700',
  },
  hygiene: {
    label: 'Hygiene',
    icon: Shield,
    borderColor: 'border-slate-400',
    bgColor: 'bg-slate-50',
    textColor: 'text-slate-700',
  },
};

function categorizeCard(card: ActionCard): Category {
  const cat = (card.category || '').toLowerCase();
  if (cat.includes('urgent') || cat.includes('critical')) return 'urgent';
  if (cat.includes('approval') || cat.includes('review')) return 'needs_approval';
  if (cat.includes('opportunity') || cat.includes('growth') || cat.includes('revenue'))
    return 'opportunity';
  return 'hygiene';
}

export default function AIActionsPage() {
  const toast = useToast();
  const [cards, setCards] = useState<ActionCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 20;

  const loadCards = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<any>(
        `/action-cards?status=PENDING&page=${page}&pageSize=${pageSize}`,
      );
      const items = data?.data || data || [];
      setCards(Array.isArray(items) ? items : []);
      setTotal(data?.total || items.length || 0);
    } catch {
      setCards([]);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    loadCards();
  }, [loadCards]);

  const approveCard = async (id: string) => {
    try {
      await api.patch(`/action-cards/${id}/approve`, {});
      setCards((prev) => prev.filter((c) => c.id !== id));
      setSelectedIds((prev) => {
        const n = new Set(prev);
        n.delete(id);
        return n;
      });
      toast('Action approved');
    } catch {
      toast('Failed to approve', 'error');
    }
  };

  const dismissCard = async (id: string) => {
    try {
      await api.patch(`/action-cards/${id}/dismiss`, {});
      setCards((prev) => prev.filter((c) => c.id !== id));
      setSelectedIds((prev) => {
        const n = new Set(prev);
        n.delete(id);
        return n;
      });
      toast('Action dismissed');
    } catch {
      toast('Failed to dismiss', 'error');
    }
  };

  const snoozeCard = async (id: string) => {
    try {
      const until = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      await api.patch(`/action-cards/${id}/snooze`, { until });
      setCards((prev) => prev.filter((c) => c.id !== id));
      setSelectedIds((prev) => {
        const n = new Set(prev);
        n.delete(id);
        return n;
      });
      toast('Action snoozed for 24 hours');
    } catch {
      toast('Failed to snooze', 'error');
    }
  };

  const bulkApprove = async () => {
    const ids = Array.from(selectedIds);
    for (const id of ids) {
      await approveCard(id);
    }
    setSelectedIds(new Set());
  };

  const bulkDismiss = async () => {
    const ids = Array.from(selectedIds);
    for (const id of ids) {
      await dismissCard(id);
    }
    setSelectedIds(new Set());
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  // Group cards by category
  const grouped: Record<Category, ActionCard[]> = {
    urgent: [],
    needs_approval: [],
    opportunity: [],
    hygiene: [],
  };
  cards.forEach((card) => {
    const cat = categorizeCard(card);
    grouped[cat].push(card);
  });

  const categoryOrder: Category[] = ['urgent', 'needs_approval', 'opportunity', 'hygiene'];
  const totalPages = Math.ceil(total / pageSize);

  if (loading) {
    return (
      <div className="space-y-4" data-testid="actions-loading">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-soft animate-pulse"
          >
            <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-1/3 mb-3" />
            <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-full" />
          </div>
        ))}
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div
        className="rounded-2xl bg-lavender-50 dark:bg-slate-900/50 border border-lavender-100 dark:border-slate-800 p-12 shadow-soft text-center"
        data-testid="actions-empty"
      >
        <Sparkles className="mx-auto mb-4 text-lavender-400" size={48} />
        <h3 className="font-serif text-lg text-slate-900 dark:text-white mb-2">All caught up!</h3>
        <p className="text-slate-600 dark:text-slate-400">No pending actions.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="actions-page">
      {categoryOrder.map((cat) => {
        const items = grouped[cat];
        if (items.length === 0) return null;
        const config = CATEGORY_CONFIG[cat];
        const Icon = config.icon;

        return (
          <section key={cat} data-testid={`category-${cat}`}>
            <div className={cn('flex items-center gap-2 mb-3', config.textColor)}>
              <Icon size={18} />
              <h2 className="font-serif text-base font-semibold">{config.label}</h2>
              <span className="text-xs ml-1 opacity-70">({items.length})</span>
            </div>

            <div className="space-y-3">
              {items.map((card) => (
                <div
                  key={card.id}
                  className={cn(
                    'rounded-xl bg-white dark:bg-slate-900 p-4 shadow-soft border-l-4 transition-colors',
                    config.borderColor,
                    selectedIds.has(card.id) && 'ring-2 ring-sage-300',
                  )}
                  data-testid={`action-card-${card.id}`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(card.id)}
                      onChange={() => toggleSelect(card.id)}
                      className="rounded text-sage-600 mt-1 flex-shrink-0"
                      aria-label={`Select ${card.title}`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div>
                          <p className="text-sm font-semibold text-slate-900 dark:text-white">
                            {card.title}
                          </p>
                          {card.entityType && (
                            <p className="text-[11px] text-slate-400 mt-0.5">
                              {card.entityType}: {card.entityId}
                            </p>
                          )}
                        </div>
                        {card.confidence != null && (
                          <span className="text-[10px] bg-lavender-50 text-lavender-700 px-2 py-0.5 rounded-full font-medium flex-shrink-0">
                            {Math.round(card.confidence * 100)}% confidence
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mb-3">
                        {card.description}
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => approveCard(card.id)}
                          className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg bg-sage-50 text-sage-700 hover:bg-sage-100 transition-colors"
                          data-testid={`approve-${card.id}`}
                        >
                          <CheckCircle size={12} />
                          Approve
                        </button>
                        <button
                          onClick={() => dismissCard(card.id)}
                          className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg bg-slate-50 text-slate-600 hover:bg-slate-100 transition-colors"
                          data-testid={`dismiss-${card.id}`}
                        >
                          <X size={12} />
                          Dismiss
                        </button>
                        <button
                          onClick={() => snoozeCard(card.id)}
                          className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg bg-slate-50 text-slate-500 hover:bg-slate-100 transition-colors"
                          data-testid={`snooze-${card.id}`}
                        >
                          <Clock size={12} />
                          Snooze
                        </button>
                        <span className="text-[10px] text-slate-400 ml-auto">
                          {card.agentType?.replace(/_/g, ' ')}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        );
      })}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-sm text-slate-500">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}

      {/* Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-white rounded-2xl shadow-soft border border-slate-200 p-4 z-40"
          data-testid="bulk-bar"
        >
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-slate-700">{selectedIds.size} selected</span>
            <button
              onClick={bulkApprove}
              className="px-3 py-2 text-sm bg-sage-600 text-white rounded-lg hover:bg-sage-700 transition-colors"
              data-testid="bulk-approve"
            >
              Approve All Selected
            </button>
            <button
              onClick={bulkDismiss}
              className="px-3 py-2 text-sm border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
              data-testid="bulk-dismiss"
            >
              Dismiss All Selected
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="px-3 py-2 text-sm text-slate-500 hover:text-slate-700 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
