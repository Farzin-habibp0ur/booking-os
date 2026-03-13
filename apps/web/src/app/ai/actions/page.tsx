'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { useToast } from '@/lib/toast';
import { getGlobalSocket } from '@/lib/use-socket';
import {
  Sparkles,
  CheckCircle,
  X,
  Clock,
  AlertTriangle,
  AlertCircle,
  Lightbulb,
  Shield,
  LayoutList,
  LayoutGrid,
} from 'lucide-react';
import { ListSkeleton } from '@/components/skeleton';

interface BriefingItem {
  id: string;
  title: string;
  description: string;
  priority: 'URGENT_TODAY' | 'NEEDS_APPROVAL' | 'OPPORTUNITY' | 'HYGIENE';
  sourceAgent: string;
  quickActions: string[];
  category?: string;
  createdAt: string;
  metadata?: Record<string, any>;
}

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
  priority?: number;
  status: 'PENDING' | 'APPROVED' | 'DISMISSED' | 'SNOOZED' | 'EXECUTED';
  createdAt: string;
  metadata?: Record<string, any>;
}

type PriorityKey = 'URGENT_TODAY' | 'NEEDS_APPROVAL' | 'OPPORTUNITY' | 'HYGIENE';
type ViewMode = 'list' | 'kanban';

const PRIORITY_CONFIG: Record<
  PriorityKey,
  { label: string; icon: any; borderColor: string; bgColor: string; textColor: string }
> = {
  URGENT_TODAY: {
    label: 'Urgent',
    icon: AlertTriangle,
    borderColor: 'border-red-400',
    bgColor: 'bg-red-50',
    textColor: 'text-red-700',
  },
  NEEDS_APPROVAL: {
    label: 'Needs Approval',
    icon: AlertCircle,
    borderColor: 'border-amber-400',
    bgColor: 'bg-amber-50',
    textColor: 'text-amber-700',
  },
  OPPORTUNITY: {
    label: 'Opportunity',
    icon: Lightbulb,
    borderColor: 'border-sage-400',
    bgColor: 'bg-sage-50',
    textColor: 'text-sage-700',
  },
  HYGIENE: {
    label: 'Hygiene',
    icon: Shield,
    borderColor: 'border-slate-400',
    bgColor: 'bg-slate-50',
    textColor: 'text-slate-700',
  },
};

export default function AIActionsPage() {
  const { toast } = useToast();
  const [briefingItems, setBriefingItems] = useState<BriefingItem[]>([]);
  const [fallbackCards, setFallbackCards] = useState<ActionCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [useBriefing, setUseBriefing] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Try dashboard briefing endpoint first (Phase 2)
      const briefingData = await api.get<BriefingItem[]>('/dashboard-briefing/briefing');
      if (Array.isArray(briefingData) && briefingData.length > 0) {
        setBriefingItems(briefingData);
        setUseBriefing(true);
      } else {
        throw new Error('empty briefing');
      }
    } catch {
      // Fallback to action-cards endpoint
      try {
        const data = await api.get<any>('/action-cards?status=PENDING&take=50');
        const items = data?.data || data || [];
        setFallbackCards(Array.isArray(items) ? items : []);
        setUseBriefing(false);
      } catch {
        setFallbackCards([]);
        setUseBriefing(false);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Socket.io real-time updates
  useEffect(() => {
    const socket = getGlobalSocket();
    if (!socket) return;

    const handleNewCard = () => {
      loadData();
    };

    socket.on('action-card:created', handleNewCard);
    socket.on('action-card:updated', handleNewCard);

    return () => {
      socket.off('action-card:created', handleNewCard);
      socket.off('action-card:updated', handleNewCard);
    };
  }, [loadData]);

  const executeAction = async (cardId: string, action: string) => {
    try {
      await api.post(`/dashboard-briefing/briefing/${cardId}/action`, { action });
      // Remove from list
      setBriefingItems((prev) => prev.filter((item) => item.id !== cardId));
      setFallbackCards((prev) => prev.filter((c) => c.id !== cardId));
      setSelectedIds((prev) => {
        const n = new Set(prev);
        n.delete(cardId);
        return n;
      });
      toast(`Action ${action}d`);
    } catch {
      // Fallback to direct action-card endpoints
      try {
        if (action === 'approve') await api.patch(`/action-cards/${cardId}/approve`, {});
        else if (action === 'dismiss') await api.patch(`/action-cards/${cardId}/dismiss`, {});
        else if (action === 'snooze') {
          const until = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString();
          await api.patch(`/action-cards/${cardId}/snooze`, { until });
        }
        setBriefingItems((prev) => prev.filter((item) => item.id !== cardId));
        setFallbackCards((prev) => prev.filter((c) => c.id !== cardId));
        setSelectedIds((prev) => {
          const n = new Set(prev);
          n.delete(cardId);
          return n;
        });
        toast(`Action ${action}d`);
      } catch {
        toast(`Failed to ${action}`, 'error');
      }
    }
  };

  const bulkAction = async (action: string) => {
    const ids = Array.from(selectedIds);
    for (const id of ids) {
      await executeAction(id, action);
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

  // Build grouped items from briefing or fallback
  const grouped: Record<
    PriorityKey,
    Array<{
      id: string;
      title: string;
      description: string;
      sourceAgent: string;
      createdAt: string;
      confidence?: number;
    }>
  > = {
    URGENT_TODAY: [],
    NEEDS_APPROVAL: [],
    OPPORTUNITY: [],
    HYGIENE: [],
  };

  if (useBriefing && briefingItems.length > 0) {
    briefingItems.forEach((item) => {
      const key = item.priority as PriorityKey;
      if (grouped[key]) {
        grouped[key].push({
          id: item.id,
          title: item.title,
          description: item.description,
          sourceAgent: item.sourceAgent,
          createdAt: item.createdAt,
        });
      }
    });
  } else {
    fallbackCards.forEach((card) => {
      const priority = classifyPriority(card.priority || 0, card.category || '');
      grouped[priority].push({
        id: card.id,
        title: card.title,
        description: card.description,
        sourceAgent: card.agentType?.replace(/_/g, ' ') || 'Unknown',
        createdAt: card.createdAt,
        confidence: card.confidence,
      });
    });
  }

  const priorityOrder: PriorityKey[] = ['URGENT_TODAY', 'NEEDS_APPROVAL', 'OPPORTUNITY', 'HYGIENE'];
  const totalItems = priorityOrder.reduce((sum, key) => sum + grouped[key].length, 0);

  if (loading) {
    return (
      <div className="space-y-4" data-testid="actions-loading">
        <ListSkeleton rows={4} />
      </div>
    );
  }

  if (totalItems === 0) {
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
      {/* View Toggle */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {totalItems} pending action{totalItems !== 1 ? 's' : ''}
        </p>
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5">
          <button
            onClick={() => setViewMode('list')}
            className={cn(
              'flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md transition-colors',
              viewMode === 'list'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500',
            )}
            data-testid="view-list"
          >
            <LayoutList size={14} />
            List
          </button>
          <button
            onClick={() => setViewMode('kanban')}
            className={cn(
              'flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md transition-colors',
              viewMode === 'kanban'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500',
            )}
            data-testid="view-kanban"
          >
            <LayoutGrid size={14} />
            Kanban
          </button>
        </div>
      </div>

      {viewMode === 'kanban' ? (
        /* Kanban View */
        <div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
          data-testid="kanban-view"
        >
          {priorityOrder.map((key) => {
            const items = grouped[key];
            const config = PRIORITY_CONFIG[key];
            const Icon = config.icon;
            return (
              <div key={key} className="space-y-3">
                <div className={cn('flex items-center gap-1.5 px-1', config.textColor)}>
                  <Icon size={14} />
                  <h3 className="text-xs font-semibold">{config.label}</h3>
                  <span className="text-[10px] opacity-70">({items.length})</span>
                </div>
                <div className="space-y-2 min-h-[100px]">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className={cn(
                        'rounded-xl bg-white dark:bg-slate-900 p-3 shadow-soft border-l-3 transition-colors',
                        config.borderColor,
                        selectedIds.has(item.id) && 'ring-2 ring-sage-300',
                      )}
                      data-testid={`kanban-card-${item.id}`}
                    >
                      <p className="text-xs font-semibold text-slate-900 dark:text-white mb-1 line-clamp-2">
                        {item.title}
                      </p>
                      <p className="text-[11px] text-slate-500 mb-2 line-clamp-2">
                        {item.description}
                      </p>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => executeAction(item.id, 'approve')}
                          className="p-1 rounded text-sage-600 hover:bg-sage-50 transition-colors"
                          title="Approve"
                        >
                          <CheckCircle size={14} />
                        </button>
                        <button
                          onClick={() => executeAction(item.id, 'dismiss')}
                          className="p-1 rounded text-slate-400 hover:bg-slate-50 transition-colors"
                          title="Dismiss"
                        >
                          <X size={14} />
                        </button>
                        <button
                          onClick={() => executeAction(item.id, 'snooze')}
                          className="p-1 rounded text-slate-400 hover:bg-slate-50 transition-colors"
                          title="Snooze"
                        >
                          <Clock size={14} />
                        </button>
                        <span className="text-[9px] text-slate-400 ml-auto truncate">
                          {item.sourceAgent}
                        </span>
                      </div>
                    </div>
                  ))}
                  {items.length === 0 && (
                    <div className="rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 p-4 text-center">
                      <p className="text-[11px] text-slate-400">No items</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* List View */
        <div className="space-y-6">
          {priorityOrder.map((key) => {
            const items = grouped[key];
            if (items.length === 0) return null;
            const config = PRIORITY_CONFIG[key];
            const Icon = config.icon;

            return (
              <section key={key} data-testid={`category-${key.toLowerCase()}`}>
                <div className={cn('flex items-center gap-2 mb-3', config.textColor)}>
                  <Icon size={18} />
                  <h2 className="font-serif text-base font-semibold">{config.label}</h2>
                  <span className="text-xs ml-1 opacity-70">({items.length})</span>
                </div>

                <div className="space-y-3">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className={cn(
                        'rounded-xl bg-white dark:bg-slate-900 p-4 shadow-soft border-l-4 transition-colors',
                        config.borderColor,
                        selectedIds.has(item.id) && 'ring-2 ring-sage-300',
                      )}
                      data-testid={`action-card-${item.id}`}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(item.id)}
                          onChange={() => toggleSelect(item.id)}
                          className="rounded text-sage-600 mt-1 flex-shrink-0"
                          aria-label={`Select ${item.title}`}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <p className="text-sm font-semibold text-slate-900 dark:text-white">
                              {item.title}
                            </p>
                            {item.confidence != null && (
                              <span className="text-[10px] bg-lavender-50 text-lavender-700 px-2 py-0.5 rounded-full font-medium flex-shrink-0">
                                {Math.round(item.confidence * 100)}% confidence
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-600 dark:text-slate-400 mb-3">
                            {item.description}
                          </p>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => executeAction(item.id, 'approve')}
                              className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg bg-sage-50 text-sage-700 hover:bg-sage-100 transition-colors"
                              data-testid={`approve-${item.id}`}
                            >
                              <CheckCircle size={12} />
                              Approve
                            </button>
                            <button
                              onClick={() => executeAction(item.id, 'dismiss')}
                              className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg bg-slate-50 text-slate-600 hover:bg-slate-100 transition-colors"
                              data-testid={`dismiss-${item.id}`}
                            >
                              <X size={12} />
                              Dismiss
                            </button>
                            <button
                              onClick={() => executeAction(item.id, 'snooze')}
                              className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg bg-slate-50 text-slate-500 hover:bg-slate-100 transition-colors"
                              data-testid={`snooze-${item.id}`}
                            >
                              <Clock size={12} />
                              Snooze
                            </button>
                            <span className="text-[10px] text-slate-400 ml-auto">
                              {item.sourceAgent}
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
        </div>
      )}

      {/* Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-white dark:bg-slate-900 rounded-2xl shadow-soft border border-slate-200 dark:border-slate-700 p-4 z-40"
          data-testid="bulk-bar"
        >
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
              {selectedIds.size} selected
            </span>
            <button
              onClick={() => bulkAction('approve')}
              className="px-3 py-2 text-sm bg-sage-600 text-white rounded-lg hover:bg-sage-700 transition-colors"
              data-testid="bulk-approve"
            >
              Approve All
            </button>
            <button
              onClick={() => bulkAction('dismiss')}
              className="px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              data-testid="bulk-dismiss"
            >
              Dismiss All
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

function classifyPriority(priority: number, category: string): PriorityKey {
  if (priority >= 80) return 'URGENT_TODAY';
  if (priority >= 60 || category === 'CONTENT_REVIEW') return 'NEEDS_APPROVAL';
  if (priority >= 30) return 'OPPORTUNITY';
  return 'HYGIENE';
}
