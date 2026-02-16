'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { Search, Users, BookOpen, Scissors, MessageSquare, X } from 'lucide-react';

interface SearchResults {
  customers: Array<{ id: string; name: string; phone: string; email: string | null }>;
  bookings: Array<{ id: string; startTime: string; status: string; customer: { name: string }; service: { name: string } }>;
  services: Array<{ id: string; name: string; durationMins: number; price: number }>;
  conversations: Array<{ id: string; customer: { name: string }; lastMessageAt: string; status: string }>;
}

interface ResultItem {
  type: 'customer' | 'booking' | 'service' | 'conversation';
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
      href: `/customers`,
    });
  }

  for (const b of results.bookings) {
    items.push({
      type: 'booking',
      id: `booking-${b.id}`,
      label: `${b.customer?.name} — ${b.service?.name}`,
      sublabel: new Date(b.startTime).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }),
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

  for (const conv of results.conversations) {
    items.push({
      type: 'conversation',
      id: `conversation-${conv.id}`,
      label: conv.customer?.name || 'Unknown',
      sublabel: conv.lastMessageAt
        ? new Date(conv.lastMessageAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
        : '',
      href: `/inbox`,
    });
  }

  return items;
}

const typeIcons: Record<string, typeof Users> = {
  customer: Users,
  booking: BookOpen,
  service: Scissors,
  conversation: MessageSquare,
};

const typeLabels: Record<string, string> = {
  customer: 'Customers',
  booking: 'Bookings',
  service: 'Services',
  conversation: 'Conversations',
};

export default function CommandPalette({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ResultItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

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
    }, 200);

    return () => clearTimeout(timeout);
  }, [query]);

  const navigate = useCallback(
    (item: ResultItem) => {
      // Save to recent searches
      try {
        const recent = JSON.parse(localStorage.getItem('cmd-k-recent') || '[]');
        const updated = [item, ...recent.filter((r: ResultItem) => r.id !== item.id)].slice(0, 5);
        localStorage.setItem('cmd-k-recent', JSON.stringify(updated));
      } catch {}

      onClose();
      router.push(item.href);
    },
    [onClose, router],
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && results[activeIndex]) {
      e.preventDefault();
      navigate(results[activeIndex]);
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

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]" onClick={onClose}>
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
      <div
        className="relative bg-white rounded-2xl shadow-soft w-full max-w-lg mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
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
            placeholder="Search customers, bookings, services..."
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
        <div ref={listRef} className="max-h-80 overflow-y-auto">
          {loading && (
            <div className="px-4 py-8 text-center text-sm text-slate-400">Searching...</div>
          )}

          {!loading && query.length >= 2 && results.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-slate-400">
              No results for &ldquo;{query}&rdquo;
            </div>
          )}

          {showRecent && (
            <div className="px-4 pt-3 pb-1">
              <p className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">Recent</p>
            </div>
          )}

          {!loading &&
            displayItems.map((item, index) => {
              const Icon = typeIcons[item.type] || Search;
              return (
                <button
                  key={item.id}
                  data-index={index}
                  onClick={() => navigate(item)}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors',
                    (query.length >= 2 ? activeIndex === index : false)
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
                  <span className="text-[10px] uppercase tracking-wider text-slate-400">
                    {typeLabels[item.type]}
                  </span>
                </button>
              );
            })}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-slate-100 flex items-center gap-4 text-[10px] text-slate-400">
          <span>
            <kbd className="px-1 py-0.5 bg-slate-100 rounded border border-slate-200 mr-1">↑↓</kbd>
            Navigate
          </span>
          <span>
            <kbd className="px-1 py-0.5 bg-slate-100 rounded border border-slate-200 mr-1">↵</kbd>
            Open
          </span>
          <span>
            <kbd className="px-1 py-0.5 bg-slate-100 rounded border border-slate-200 mr-1">ESC</kbd>
            Close
          </span>
        </div>
      </div>
    </div>
  );
}
