'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/cn';
import {
  Calendar,
  MessageSquare,
  StickyNote,
  Clock,
  FileText,
  Megaphone,
  Loader2,
  ChevronDown,
} from 'lucide-react';

interface TimelineEvent {
  id: string;
  type: string;
  timestamp: string;
  title: string;
  description: string;
  metadata: any;
  isSystemEvent: boolean;
  deepLink: string | null;
}

interface TimelineResponse {
  events: TimelineEvent[];
  total: number;
  hasMore: boolean;
}

const TYPE_CONFIG: Record<string, { icon: any; color: string; label: string }> = {
  booking: { icon: Calendar, color: 'bg-sage-500', label: 'Bookings' },
  conversation: { icon: MessageSquare, color: 'bg-blue-500', label: 'Messages' },
  note: { icon: StickyNote, color: 'bg-amber-500', label: 'Notes' },
  waitlist: { icon: Clock, color: 'bg-lavender-500', label: 'Waitlist' },
  quote: { icon: FileText, color: 'bg-emerald-500', label: 'Quotes' },
  campaign: { icon: Megaphone, color: 'bg-pink-500', label: 'Campaigns' },
};

export default function CustomerTimeline({ customerId }: { customerId: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [showSystem, setShowSystem] = useState(true);
  const [offset, setOffset] = useState(0);
  const LIMIT = 20;

  const loadTimeline = async (reset = false) => {
    const isLoadMore = !reset && offset > 0;
    if (isLoadMore) setLoadingMore(true);
    else setLoading(true);

    try {
      const params = new URLSearchParams();
      params.set('limit', String(LIMIT));
      params.set('offset', String(reset ? 0 : offset));
      params.set('showSystem', String(showSystem));
      if (activeFilter) params.set('types', activeFilter);

      const res = await api.get<TimelineResponse>(`/customers/${customerId}/timeline?${params}`);
      if (reset || offset === 0) {
        setEvents(res.events);
      } else {
        setEvents((prev) => [...prev, ...res.events]);
      }
      setTotal(res.total);
      setHasMore(res.hasMore);
    } catch (e) {
      console.error(e);
    }

    setLoading(false);
    setLoadingMore(false);
  };

  useEffect(() => {
    setOffset(0);
    loadTimeline(true);
  }, [customerId, activeFilter, showSystem]);

  useEffect(() => {
    if (offset > 0) loadTimeline();
  }, [offset]);

  const handleLoadMore = () => {
    setOffset((prev) => prev + LIMIT);
  };

  const handleEventClick = (event: TimelineEvent) => {
    if (event.deepLink) {
      router.push(event.deepLink);
    }
  };

  const formatTimestamp = (ts: string) => {
    const date = new Date(ts);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatAbsoluteTimestamp = (ts: string) => {
    return new Date(ts).toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Compute per-type counts from loaded events
  const typeCounts = events.reduce<Record<string, number>>((acc, e) => {
    acc[e.type] = (acc[e.type] || 0) + 1;
    return acc;
  }, {});

  const typeFilters = Object.entries(TYPE_CONFIG);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8" data-testid="timeline-loading">
        <Loader2 size={24} className="animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="p-4 flex-1 overflow-y-auto" data-testid="customer-timeline">
      {/* Filter Bar */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <button
          onClick={() => setActiveFilter(null)}
          className={cn(
            'text-xs px-3 py-1.5 rounded-full transition-colors',
            !activeFilter
              ? 'bg-sage-100 text-sage-700 font-medium'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
          )}
          data-testid="filter-all"
        >
          {t('customer_detail.timeline_all')} ({total})
        </button>
        {typeFilters.map(([type, config]) => (
          <button
            key={type}
            onClick={() => setActiveFilter(activeFilter === type ? null : type)}
            className={cn(
              'text-xs px-3 py-1.5 rounded-full transition-colors',
              activeFilter === type
                ? 'bg-sage-100 text-sage-700 font-medium'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
            )}
            data-testid={`filter-${type}`}
          >
            {config.label}
            {(typeCounts[type] || 0) > 0 && (
              <span className="ml-1 text-[10px] bg-white/60 px-1 rounded-full">
                {typeCounts[type]}
              </span>
            )}
          </button>
        ))}
        <label className="flex items-center gap-1.5 text-xs text-slate-500 ml-auto cursor-pointer">
          <input
            type="checkbox"
            checked={showSystem}
            onChange={(e) => setShowSystem(e.target.checked)}
            className="rounded"
            data-testid="system-toggle"
          />
          {t('customer_detail.timeline_system_events')}
        </label>
      </div>

      {/* Timeline */}
      {events.length === 0 ? (
        <div className="text-center py-12 text-slate-400" data-testid="timeline-empty">
          <Clock size={32} className="mx-auto mb-2 text-slate-300" />
          <p className="text-sm">{t('customer_detail.timeline_empty')}</p>
        </div>
      ) : (
        <div className="relative">
          {/* Vertical connector line */}
          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-slate-200" />

          <div className="space-y-4">
            {events.map((event) => {
              const config = TYPE_CONFIG[event.type] || {
                icon: Calendar,
                color: 'bg-slate-500',
                label: event.type,
              };
              const Icon = config.icon;

              return (
                <div
                  key={event.id}
                  className={cn(
                    'relative flex items-start gap-3 pl-0',
                    event.deepLink && 'cursor-pointer group',
                  )}
                  onClick={() => handleEventClick(event)}
                  data-testid="timeline-event"
                >
                  {/* Icon circle */}
                  <div
                    className={cn(
                      'relative z-10 flex items-center justify-center w-8 h-8 rounded-full text-white flex-shrink-0',
                      config.color,
                    )}
                  >
                    <Icon size={14} />
                  </div>

                  {/* Event card */}
                  <div
                    className={cn(
                      'flex-1 bg-white rounded-xl shadow-soft p-3 transition-colors',
                      event.deepLink && 'group-hover:bg-slate-50',
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-slate-900">{event.title}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{event.description}</p>
                      </div>
                      <span className="text-[10px] text-slate-400 whitespace-nowrap">
                        {formatTimestamp(event.timestamp)}
                      </span>
                    </div>
                    {event.isSystemEvent && (
                      <span className="inline-block mt-1.5 text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">
                        System
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Load More */}
          {hasMore && (
            <div className="mt-4 text-center">
              <button
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="text-sm text-sage-600 hover:text-sage-700 font-medium flex items-center gap-1 mx-auto disabled:opacity-50"
                data-testid="load-more-btn"
              >
                {loadingMore ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <ChevronDown size={14} />
                )}
                {t('customer_detail.timeline_load_more')}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
