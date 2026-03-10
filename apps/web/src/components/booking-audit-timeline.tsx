'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import {
  CalendarCheck,
  Pencil,
  RefreshCw,
  XCircle,
  ArrowRight,
} from 'lucide-react';

interface AuditEntry {
  id: string;
  bookingId: string;
  businessId: string;
  userId: string | null;
  userName: string;
  action: string;
  changes: Array<{ field: string; from?: string; to?: string }>;
  ipAddress: string | null;
  createdAt: string;
}

interface BookingAuditTimelineProps {
  bookingId: string;
}

const ACTION_CONFIG: Record<
  string,
  { icon: typeof CalendarCheck; color: string; bgColor: string; lineColor: string }
> = {
  CREATED: {
    icon: CalendarCheck,
    color: 'text-sage-700',
    bgColor: 'bg-sage-100',
    lineColor: 'border-sage-200',
  },
  UPDATED: {
    icon: Pencil,
    color: 'text-slate-600',
    bgColor: 'bg-slate-100',
    lineColor: 'border-slate-200',
  },
  RESCHEDULED: {
    icon: RefreshCw,
    color: 'text-amber-700',
    bgColor: 'bg-amber-100',
    lineColor: 'border-amber-200',
  },
  CANCELLED: {
    icon: XCircle,
    color: 'text-red-600',
    bgColor: 'bg-red-100',
    lineColor: 'border-red-200',
  },
  STATUS_CHANGED: {
    icon: ArrowRight,
    color: 'text-slate-600',
    bgColor: 'bg-slate-100',
    lineColor: 'border-slate-200',
  },
};

function formatFieldName(field: string): string {
  const map: Record<string, string> = {
    startTime: 'Start time',
    endTime: 'End time',
    staffId: 'Staff',
    serviceId: 'Service',
    customerId: 'Customer',
    locationId: 'Location',
    resourceId: 'Resource',
    colorLabel: 'Color label',
    status: 'Status',
    notes: 'Notes',
  };
  return map[field] || field;
}

function formatValue(field: string, value: any): string {
  if (value === null || value === undefined) return 'none';
  if (field === 'startTime' || field === 'endTime') {
    const d = new Date(value);
    if (!isNaN(d.getTime())) {
      return d.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    }
  }
  return String(value);
}

function describeChange(entry: AuditEntry): string {
  const changes = entry.changes || [];
  if (entry.action === 'CREATED') {
    return 'Booking created';
  }
  if (entry.action === 'CANCELLED') {
    return 'Booking cancelled';
  }
  if (entry.action === 'STATUS_CHANGED' && changes.length > 0) {
    const c = changes[0];
    return `Status changed from ${formatValue('status', c.from)} to ${formatValue('status', c.to)}`;
  }
  if (entry.action === 'RESCHEDULED') {
    const timeChange = changes.find((c) => c.field === 'startTime');
    if (timeChange) {
      return `Rescheduled from ${formatValue('startTime', timeChange.from)} to ${formatValue('startTime', timeChange.to)}`;
    }
    return 'Booking rescheduled';
  }
  // UPDATED — list each field change
  if (changes.length > 0) {
    return changes
      .map(
        (c) =>
          `${formatFieldName(c.field)} changed from ${formatValue(c.field, c.from)} to ${formatValue(c.field, c.to)}`,
      )
      .join('; ');
  }
  return 'Booking updated';
}

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} minute${diffMin !== 1 ? 's' : ''} ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hour${diffHr !== 1 ? 's' : ''} ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${diffDay} day${diffDay !== 1 ? 's' : ''} ago`;
  return new Date(dateStr).toLocaleDateString();
}

export default function BookingAuditTimeline({ bookingId }: BookingAuditTimelineProps) {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!bookingId) return;
    setLoading(true);
    api
      .get<AuditEntry[]>(`/bookings/${bookingId}/audit-log`)
      .then((data) => setEntries(Array.isArray(data) ? data : []))
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, [bookingId]);

  if (loading) {
    return (
      <div className="space-y-3" data-testid="audit-timeline-loading">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-3 animate-pulse">
            <div className="w-7 h-7 rounded-full bg-slate-200 flex-shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 bg-slate-200 rounded w-1/3" />
              <div className="h-3 bg-slate-100 rounded w-2/3" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <p className="text-sm text-slate-400" data-testid="audit-timeline-empty">
        No activity recorded yet
      </p>
    );
  }

  return (
    <div className="relative" data-testid="audit-timeline">
      {/* Vertical timeline line */}
      <div className="absolute left-[13px] top-4 bottom-4 w-px bg-slate-200" />

      <div className="space-y-4">
        {entries.map((entry, idx) => {
          const config = ACTION_CONFIG[entry.action] || ACTION_CONFIG.UPDATED;
          const Icon = config.icon;
          return (
            <div key={entry.id} className="relative flex gap-3" data-testid="audit-entry">
              {/* Icon */}
              <div
                className={cn(
                  'w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 z-10',
                  config.bgColor,
                )}
              >
                <Icon size={14} className={config.color} />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 pb-1">
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-medium text-slate-700">{entry.userName}</span>
                  <span className="text-slate-400">{relativeTime(entry.createdAt)}</span>
                </div>
                <p className={cn('text-sm mt-0.5', config.color)}>{describeChange(entry)}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
