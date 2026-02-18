'use client';

import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { usePack } from '@/lib/vertical-pack';
import { useI18n } from '@/lib/i18n';
import { Search, Users, BookOpen, Scissors, MessageSquare, Loader2 } from 'lucide-react';

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
  conversations: Array<{
    id: string;
    customer: { name: string };
    lastMessageAt: string;
    status: string;
  }>;
  totals: { customers: number; bookings: number; services: number; conversations: number };
}

const typeIcons: Record<string, typeof Users> = {
  customer: Users,
  booking: BookOpen,
  service: Scissors,
  conversation: MessageSquare,
};

const ENTITY_TYPES = ['customer', 'booking', 'service', 'conversation'] as const;
type EntityType = (typeof ENTITY_TYPES)[number];

export default function SearchPageWrapper() {
  return (
    <Suspense fallback={null}>
      <SearchPage />
    </Suspense>
  );
}

function SearchPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pack = usePack();
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);

  const initialQuery = searchParams.get('q') || '';
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeType, setActiveType] = useState<EntityType | null>(null);
  const [offsets, setOffsets] = useState<Record<string, number>>({
    customer: 0,
    booking: 0,
    service: 0,
    conversation: 0,
  });

  const typeLabels: Record<string, string> = {
    customer: pack.labels?.customer ? `${pack.labels.customer}s` : 'Customers',
    booking: pack.labels?.booking ? `${pack.labels.booking}s` : 'Bookings',
    service: pack.labels?.service ? `${pack.labels.service}s` : 'Services',
    conversation: 'Conversations',
  };

  const performSearch = useCallback(async (q: string, type?: EntityType | null) => {
    if (!q || q.trim().length < 2) {
      setResults(null);
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams({ q: q.trim() });
      if (type) params.set('types', type);
      params.set('limit', '10');
      const data = await api.get<SearchResults>(`/search?${params.toString()}`);
      setResults(data);
      setOffsets({ customer: 0, booking: 0, service: 0, conversation: 0 });
    } catch {
      setResults(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (initialQuery) {
      performSearch(initialQuery, activeType);
    }
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!query || query.length < 2) return;

    const timeout = setTimeout(() => {
      performSearch(query, activeType);
    }, 300);

    return () => clearTimeout(timeout);
  }, [query, activeType, performSearch]);

  const handleTypeFilter = (type: EntityType | null) => {
    setActiveType(type);
    setOffsets({ customer: 0, booking: 0, service: 0, conversation: 0 });
  };

  const loadMore = async (type: EntityType) => {
    if (!query || !results) return;
    const newOffset = offsets[type] + 10;
    try {
      const params = new URLSearchParams({
        q: query.trim(),
        types: type,
        limit: '10',
        offset: String(newOffset),
      });
      const data = await api.get<SearchResults>(`/search?${params.toString()}`);
      const key =
        type === 'customer'
          ? 'customers'
          : type === 'booking'
            ? 'bookings'
            : type === 'service'
              ? 'services'
              : 'conversations';
      setResults((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          [key]: [...prev[key], ...data[key]],
        };
      });
      setOffsets((prev) => ({ ...prev, [type]: newOffset }));
    } catch {
      // silently fail load more
    }
  };

  const navigateTo = (href: string) => {
    router.push(href);
  };

  const getHref = (type: string, id: string): string => {
    switch (type) {
      case 'customer':
        return `/customers/${id}`;
      case 'booking':
        return `/bookings`;
      case 'service':
        return `/services`;
      case 'conversation':
        return `/inbox?conversationId=${id}`;
      default:
        return '/';
    }
  };

  const visibleTypes = activeType
    ? [activeType]
    : ENTITY_TYPES.filter((type) => {
        if (!results) return false;
        const key =
          type === 'customer'
            ? 'customers'
            : type === 'booking'
              ? 'bookings'
              : type === 'service'
                ? 'services'
                : 'conversations';
        return results[key].length > 0;
      });

  const totalResults = results
    ? results.totals.customers +
      results.totals.bookings +
      results.totals.services +
      results.totals.conversations
    : 0;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1
        className="text-2xl font-serif font-semibold text-slate-900 mb-6"
        data-testid="search-title"
      >
        {t('search.title')}
      </h1>

      {/* Search input */}
      <div className="relative mb-4">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('search.placeholder')}
          className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-sage-500 focus:border-transparent shadow-soft"
          data-testid="search-input"
        />
      </div>

      {/* Type filter chips */}
      {results && (
        <div className="flex items-center gap-2 mb-6" data-testid="type-filters">
          <button
            onClick={() => handleTypeFilter(null)}
            className={cn(
              'text-xs px-3 py-1.5 rounded-full font-medium transition-colors',
              activeType === null
                ? 'bg-sage-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
            )}
            data-testid="filter-all"
          >
            {t('search.all')} ({totalResults})
          </button>
          {ENTITY_TYPES.map((type) => {
            const count =
              results.totals[
                type === 'customer'
                  ? 'customers'
                  : type === 'booking'
                    ? 'bookings'
                    : type === 'service'
                      ? 'services'
                      : 'conversations'
              ];
            if (count === 0 && activeType !== type) return null;
            return (
              <button
                key={type}
                onClick={() => handleTypeFilter(type)}
                className={cn(
                  'text-xs px-3 py-1.5 rounded-full font-medium transition-colors',
                  activeType === type
                    ? 'bg-sage-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                )}
                data-testid={`filter-${type}`}
              >
                {typeLabels[type]} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-12" data-testid="search-loading">
          <Loader2 size={24} className="animate-spin text-slate-400" />
        </div>
      )}

      {/* Empty state */}
      {!loading && query.length >= 2 && results && totalResults === 0 && (
        <div className="text-center py-12" data-testid="search-empty">
          <Search size={32} className="mx-auto mb-3 text-slate-300" />
          <p className="text-sm text-slate-500">{t('search.no_results', { query })}</p>
        </div>
      )}

      {/* No query state */}
      {!loading && query.length < 2 && (
        <div className="text-center py-12" data-testid="search-prompt">
          <Search size={32} className="mx-auto mb-3 text-slate-300" />
          <p className="text-sm text-slate-500">{t('search.enter_query')}</p>
        </div>
      )}

      {/* Grouped results */}
      {!loading &&
        results &&
        visibleTypes.map((type) => {
          const key =
            type === 'customer'
              ? 'customers'
              : type === 'booking'
                ? 'bookings'
                : type === 'service'
                  ? 'services'
                  : 'conversations';
          const items = results[key];
          const total = results.totals[key];
          const Icon = typeIcons[type];
          const hasMore = items.length < total;

          if (items.length === 0) return null;

          return (
            <div key={type} className="mb-6" data-testid={`section-${type}`}>
              <h2 className="text-xs font-semibold text-slate-500 uppercase mb-2">
                {typeLabels[type]} ({total})
              </h2>
              <div className="bg-white rounded-2xl shadow-soft overflow-hidden">
                {items.map((item: any) => {
                  const id = item.id;
                  const href = getHref(type, id);
                  let label = '';
                  let sublabel = '';

                  if (type === 'customer') {
                    label = item.name;
                    sublabel = item.phone || item.email || '';
                  } else if (type === 'booking') {
                    label = `${item.customer?.name} — ${item.service?.name}`;
                    sublabel = new Date(item.startTime).toLocaleString('en-US', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    });
                  } else if (type === 'service') {
                    label = item.name;
                    sublabel = `${item.durationMins}min · $${item.price}`;
                  } else if (type === 'conversation') {
                    label = item.customer?.name || 'Unknown';
                    sublabel = item.lastMessageAt
                      ? new Date(item.lastMessageAt).toLocaleString('en-US', {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })
                      : '';
                  }

                  return (
                    <button
                      key={`${type}-${id}`}
                      onClick={() => navigateTo(href)}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-b-0"
                      data-testid="search-result"
                    >
                      <Icon size={16} className="text-slate-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{label}</p>
                        {sublabel && <p className="text-xs text-slate-400 truncate">{sublabel}</p>}
                      </div>
                    </button>
                  );
                })}
              </div>
              {hasMore && (
                <button
                  onClick={() => loadMore(type)}
                  className="mt-2 text-xs text-sage-600 hover:text-sage-700 font-medium transition-colors"
                  data-testid={`load-more-${type}`}
                >
                  {t('search.load_more', { type: typeLabels[type] })}
                </button>
              )}
            </div>
          );
        })}
    </div>
  );
}
