'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { usePack } from '@/lib/vertical-pack';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { useMode } from '@/lib/use-mode';
import { getNavItems } from '@/lib/nav-config';
import {
  Search,
  Users,
  BookOpen,
  Scissors,
  MessageSquare,
  UserCog,
  X,
  ArrowRight,
  Plus,
  CalendarPlus,
  UserPlus,
} from 'lucide-react';

interface SearchResults {
  customers: Array<{ id: string; name: string; phone: string; email: string | null }>;
  bookings: Array<{
    id: string;
    startTime: string;
    status: string;
    customer: { name: string };
    service: { name: string };
  }>;
  services: Array<{ id: string; name: string; durationMins: number; price: number }>;
  staff: Array<{ id: string; name: string; email: string; role: string }>;
  conversations: Array<{
    id: string;
    customer: { name: string };
    lastMessageAt: string;
    status: string;
  }>;
  totals?: {
    customers: number;
    bookings: number;
    services: number;
    staff: number;
    conversations: number;
  };
}

interface QuickAction {
  id: string;
  label: string;
  href: string;
  icon: typeof Plus;
}

interface ResultItem {
  type: 'customer' | 'booking' | 'service' | 'staff' | 'conversation';
  id: string;
  label: string;
  sublabel: string;
  href: string;
}

function flattenResults(results: SearchResults): ResultItem[] {
  const items: ResultItem[] = [];

  for (const c of results.customers) {
    items.push({
      type: 'customer',
      id: `customer-${c.id}`,
      label: c.name,
      sublabel: c.phone || c.email || '',
      href: `/customers/${c.id}`,
    });
  }

  for (const b of results.bookings) {
    items.push({
      type: 'booking',
      id: `booking-${b.id}`,
      label: `${b.customer?.name} — ${b.service?.name}`,
      sublabel: new Date(b.startTime).toLocaleString('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }),
      href: `/bookings`,
    });
  }

  for (const s of results.services) {
    items.push({
      type: 'service',
      id: `service-${s.id}`,
      label: s.name,
      sublabel: `${s.durationMins}min · $${s.price}`,
      href: `/services`,
    });
  }

  for (const st of results.staff || []) {
    items.push({
      type: 'staff',
      id: `staff-${st.id}`,
      label: st.name,
      sublabel: `${st.role} · ${st.email}`,
      href: `/staff`,
    });
  }

  for (const conv of results.conversations) {
    items.push({
      type: 'conversation',
      id: `conversation-${conv.id}`,
      label: conv.customer?.name || 'Unknown',
      sublabel: conv.lastMessageAt
        ? new Date(conv.lastMessageAt).toLocaleString('en-US', {
            dateStyle: 'medium',
            timeStyle: 'short',
          })
        : '',
      href: `/inbox?conversationId=${conv.id}`,
    });
  }

  return items;
}

const typeIcons: Record<string, typeof Users> = {
  customer: Users,
  booking: BookOpen,
  service: Scissors,
  staff: UserCog,
  conversation: MessageSquare,
};

const defaultTypeLabels: Record<string, string> = {
  customer: 'Customers',
  booking: 'Bookings',
  service: 'Services',
  staff: 'Staff',
  conversation: 'Conversations',
};

const QUICK_ACTIONS: QuickAction[] = [
  { id: 'qa-new-booking', label: 'New Booking', href: '/bookings?new=true', icon: CalendarPlus },
  { id: 'qa-new-customer', label: 'New Customer', href: '/customers?new=true', icon: UserPlus },
];

interface PageItem {
  href: string;
  label: string;
  icon: typeof Search;
  section: string;
}

export default function CommandPalette({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ResultItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pack = usePack();
  const { user } = useAuth();
  const { t } = useI18n();
  const { modeDef } = useMode();

  const typeLabels: Record<string, string> = {
    customer: pack.labels?.customer ? `${pack.labels.customer}s` : defaultTypeLabels.customer,
    booking: pack.labels?.booking ? `${pack.labels.booking}s` : defaultTypeLabels.booking,
    service: pack.labels?.service ? `${pack.labels.service}s` : defaultTypeLabels.service,
    staff: defaultTypeLabels.staff,
    conversation: defaultTypeLabels.conversation,
  };

  // Build page items from shared nav config, filtered by role
  const pageItems: PageItem[] = useMemo(() => {
    const role = user?.role;
    const navItems = getNavItems({
      t,
      packName: pack.name,
      packLabels: pack.labels,
      kanbanEnabled: !!(user?.business?.packConfig as any)?.kanbanEnabled,
    });

    const sections = modeDef?.sections;
    const allSectionPaths = sections
      ? [
          ...sections.workspace,
          ...sections.tools,
          ...sections.insights,
          ...(sections.aiAgents || []),
        ]
      : [];

    return navItems
      .filter((item) => !role || item.roles.includes(role))
      .filter((item) => allSectionPaths.includes(item.href))
      .map((item) => {
        let section = 'Pages';
        if (sections) {
          if (sections.workspace.includes(item.href))
            section = t('nav.section_workspace', undefined) || 'Workspace';
          else if (sections.tools.includes(item.href))
            section = t('nav.section_tools', undefined) || 'Tools';
          else if (sections.insights.includes(item.href))
            section = t('nav.section_insights', undefined) || 'Insights';
          else if (sections.aiAgents?.includes(item.href))
            section = t('nav.section_ai_agents', undefined) || 'AI & Agents';
        }
        return { href: item.href, label: item.label, icon: item.icon, section };
      });
  }, [user, pack, t, modeDef]);

  // Filter pages by query
  const matchingPages = useMemo(() => {
    if (query.length < 1) return [];
    const q = query.toLowerCase();
    return pageItems.filter(
      (p) => p.label.toLowerCase().includes(q) || p.href.toLowerCase().includes(q),
    );
  }, [query, pageItems]);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setResults([]);
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!query || query.length < 2) {
      setResults([]);
      return;
    }

    const timeout = setTimeout(() => {
      setLoading(true);
      api
        .get<SearchResults>(`/search?q=${encodeURIComponent(query)}`)
        .then((data) => {
          setResults(flattenResults(data));
          setActiveIndex(0);
        })
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 300);

    return () => clearTimeout(timeout);
  }, [query]);

  const navigateTo = useCallback(
    (href: string) => {
      onClose();
      router.push(href);
    },
    [onClose, router],
  );

  const navigate = useCallback(
    (item: ResultItem) => {
      // Save to recent searches
      try {
        const recent = JSON.parse(localStorage.getItem('cmd-k-recent') || '[]');
        const updated = [item, ...recent.filter((r: ResultItem) => r.id !== item.id)].slice(0, 5);
        localStorage.setItem('cmd-k-recent', JSON.stringify(updated));
      } catch {
        // localStorage may be unavailable
      }

      navigateTo(item.href);
    },
    [navigateTo],
  );

  // Total selectable items: pages + API results (for keyboard nav)
  const totalSelectableItems = matchingPages.length + results.length;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, totalSelectableItems - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex < matchingPages.length) {
        navigateTo(matchingPages[activeIndex].href);
      } else {
        const resultIndex = activeIndex - matchingPages.length;
        if (results[resultIndex]) {
          navigate(results[resultIndex]);
        }
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  // Scroll active item into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-index="${activeIndex}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  // Load recent items when query is empty
  const [recentItems, setRecentItems] = useState<ResultItem[]>([]);
  useEffect(() => {
    if (isOpen) {
      try {
        setRecentItems(JSON.parse(localStorage.getItem('cmd-k-recent') || '[]'));
      } catch {
        setRecentItems([]);
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const displayItems = query.length >= 2 ? results : recentItems;
  const showRecent = query.length < 2 && recentItems.length > 0;
  const showQuickActions = query.length < 2;
  const hasNoResults =
    query.length >= 2 && !loading && results.length === 0 && matchingPages.length === 0;

  // Group results by type for section headers
  const groupedTypes =
    query.length >= 2
      ? (['customer', 'booking', 'service', 'staff', 'conversation'] as const).filter((type) =>
          displayItems.some((item) => item.type === type),
        )
      : [];

  // Group matching pages by section
  const pageSections = useMemo(() => {
    const sectionOrder = ['Workspace', 'Tools', 'Insights', 'AI & Agents', 'Pages'];
    const groups: Record<string, PageItem[]> = {};
    for (const page of matchingPages) {
      if (!groups[page.section]) groups[page.section] = [];
      groups[page.section].push(page);
    }
    return Object.entries(groups).sort(([a], [b]) => {
      // Sort by known section order, falling back to end
      const idxA = sectionOrder.findIndex((s) => a.includes(s));
      const idxB = sectionOrder.findIndex((s) => b.includes(s));
      return (idxA === -1 ? 99 : idxA) - (idxB === -1 ? 99 : idxB);
    });
  }, [matchingPages]);

  let flatIndex = 0;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]" onClick={onClose}>
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm animate-fade-in" />
      <div
        className="relative bg-white rounded-2xl shadow-soft w-full max-w-lg mx-4 overflow-hidden animate-scale-in"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100">
          <Search size={18} className="text-slate-400 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('cmdk.placeholder', undefined) || 'Search pages, customers, bookings...'}
            className="flex-1 text-sm bg-transparent outline-none placeholder:text-slate-400"
          />
          {query && (
            <button onClick={() => setQuery('')} className="text-slate-400 hover:text-slate-600">
              <X size={16} />
            </button>
          )}
          <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] text-slate-400 bg-slate-100 rounded border border-slate-200">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-80 overflow-y-auto" aria-live="polite">
          {loading && (
            <div className="px-4 py-8 text-center text-sm text-slate-400">Searching...</div>
          )}

          {hasNoResults && (
            <div className="px-4 py-8 text-center text-sm text-slate-400">
              No results for &ldquo;{query}&rdquo;
            </div>
          )}

          {showRecent && (
            <div className="px-4 pt-3 pb-1">
              <p className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">
                Recent
              </p>
            </div>
          )}

          {/* Page navigation results (shown when query matches pages) */}
          {query.length >= 1 && matchingPages.length > 0 && (
            <div data-testid="pages-section">
              {pageSections.map(([sectionName, pages]) => (
                <div key={sectionName}>
                  <div className="px-4 pt-3 pb-1">
                    <p className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">
                      {sectionName}
                    </p>
                  </div>
                  {pages.map((page) => {
                    const currentIndex = flatIndex++;
                    const Icon = page.icon;
                    return (
                      <button
                        key={page.href}
                        data-index={currentIndex}
                        onClick={() => navigateTo(page.href)}
                        className={cn(
                          'w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors',
                          activeIndex === currentIndex
                            ? 'bg-sage-50 text-sage-900'
                            : 'hover:bg-slate-50 text-slate-700',
                        )}
                      >
                        <Icon size={16} className="text-slate-400 flex-shrink-0" />
                        <span className="font-medium">{page.label}</span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          )}

          {/* Grouped API results by type */}
          {!loading &&
            query.length >= 2 &&
            groupedTypes.map((type) => {
              const typeItems = displayItems.filter((item) => item.type === type);
              return (
                <div key={type} data-testid={`group-${type}`}>
                  <div className="px-4 pt-3 pb-1">
                    <p className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">
                      {typeLabels[type]}
                    </p>
                  </div>
                  {typeItems.map((item) => {
                    const currentIndex = flatIndex++;
                    const Icon = typeIcons[item.type] || Search;
                    return (
                      <button
                        key={item.id}
                        data-index={currentIndex}
                        onClick={() => navigate(item)}
                        className={cn(
                          'w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors',
                          activeIndex === currentIndex
                            ? 'bg-sage-50 text-sage-900'
                            : 'hover:bg-slate-50 text-slate-700',
                        )}
                      >
                        <Icon size={16} className="text-slate-400 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{item.label}</p>
                          {item.sublabel && (
                            <p className="text-xs text-slate-400 truncate">{item.sublabel}</p>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              );
            })}

          {/* Recent items (ungrouped) */}
          {!loading &&
            showRecent &&
            recentItems.map((item, index) => {
              const Icon = typeIcons[item.type] || Search;
              return (
                <button
                  key={item.id}
                  data-index={index}
                  onClick={() => navigate(item)}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors',
                    'hover:bg-slate-50 text-slate-700',
                  )}
                >
                  <Icon size={16} className="text-slate-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{item.label}</p>
                    {item.sublabel && (
                      <p className="text-xs text-slate-400 truncate">{item.sublabel}</p>
                    )}
                  </div>
                  <span className="text-[10px] uppercase tracking-wider text-slate-400">
                    {typeLabels[item.type]}
                  </span>
                </button>
              );
            })}

          {/* Quick actions */}
          {showQuickActions && (
            <>
              <div className="px-4 pt-3 pb-1">
                <p className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">
                  Quick Actions
                </p>
              </div>
              {QUICK_ACTIONS.map((action) => {
                const Icon = action.icon;
                return (
                  <button
                    key={action.id}
                    onClick={() => navigateTo(action.href)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-slate-50 text-slate-700 transition-colors"
                    data-testid={action.id}
                  >
                    <Icon size={16} className="text-sage-500 flex-shrink-0" />
                    <span className="font-medium">{action.label}</span>
                  </button>
                );
              })}
            </>
          )}
        </div>

        {/* View all results link */}
        {!loading && query.length >= 2 && results.length > 0 && (
          <button
            onClick={() => navigateTo(`/search?q=${encodeURIComponent(query)}`)}
            className="w-full flex items-center justify-center gap-1 px-4 py-2.5 text-sm text-sage-600 hover:bg-sage-50 border-t border-slate-100 transition-colors"
            data-testid="view-all-results"
          >
            View all results <ArrowRight size={14} />
          </button>
        )}

        {/* Footer */}
        <div className="px-4 py-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
          <div className="flex items-center gap-4">
            <span>
              <kbd className="px-1 py-0.5 bg-slate-100 rounded border border-slate-200 mr-1">
                ↑↓
              </kbd>
              Navigate
            </span>
            <span>
              <kbd className="px-1 py-0.5 bg-slate-100 rounded border border-slate-200 mr-1">↵</kbd>
              Open
            </span>
            <span>
              <kbd className="px-1 py-0.5 bg-slate-100 rounded border border-slate-200 mr-1">
                ESC
              </kbd>
              Close
            </span>
          </div>
          <span data-testid="cmdk-hint">{t('cmdk.hint', undefined) || 'All pages searchable'}</span>
        </div>
      </div>
    </div>
  );
}
