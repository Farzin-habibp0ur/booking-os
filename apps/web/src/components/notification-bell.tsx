'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bell, MessageSquare, CalendarCheck, Zap, Info, Check } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useSocket } from '@/lib/use-socket';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AppNotification {
  id: string;
  type: 'message' | 'booking' | 'action' | 'system';
  title: string;
  description: string;
  timestamp: string; // ISO string
  read: boolean;
  href?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'notifications';
const MAX_STORED = 50;
const MAX_DISPLAYED = 20;

function loadNotifications(): AppNotification[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveNotifications(notifications: AppNotification[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications.slice(0, MAX_STORED)));
  } catch {
    // quota exceeded — silently ignore
  }
}

export function formatRelativeTime(isoString: string): string {
  const now = Date.now();
  const then = new Date(isoString).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay === 1) return 'Yesterday';
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(isoString).toLocaleDateString();
}

function generateId(): string {
  return `notif-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const TYPE_ICONS: Record<AppNotification['type'], typeof Bell> = {
  message: MessageSquare,
  booking: CalendarCheck,
  action: Zap,
  system: Info,
};

const TYPE_COLORS: Record<AppNotification['type'], string> = {
  message: 'text-sage-600 bg-sage-50',
  booking: 'text-lavender-600 bg-lavender-50',
  action: 'text-amber-600 bg-amber-50',
  system: 'text-slate-500 bg-slate-100',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function NotificationBell() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load from localStorage on mount
  useEffect(() => {
    setNotifications(loadNotifications());
  }, []);

  // Persist whenever notifications change
  useEffect(() => {
    saveNotifications(notifications);
  }, [notifications]);

  // Add a notification to the top of the list
  const addNotification = useCallback(
    (notif: Omit<AppNotification, 'id' | 'timestamp' | 'read'>) => {
      setNotifications((prev) => {
        const next: AppNotification[] = [
          {
            ...notif,
            id: generateId(),
            timestamp: new Date().toISOString(),
            read: false,
          },
          ...prev,
        ].slice(0, MAX_STORED);
        return next;
      });
    },
    [],
  );

  // Socket event listeners
  useSocket({
    'message:new': (data: any) => {
      const customerName = data?.customer?.name || data?.customerName || 'a customer';
      addNotification({
        type: 'message',
        title: 'New message',
        description: `New message from ${customerName}`,
        href: '/inbox',
      });
    },
    'booking:updated': (data: any) => {
      const customer = data?.customer?.name || data?.customerName || 'Customer';
      const service = data?.service?.name || data?.serviceName || 'service';
      addNotification({
        type: 'booking',
        title: 'Booking updated',
        description: `Booking updated: ${customer} — ${service}`,
        href: '/bookings',
      });
    },
    'action-card:created': () => {
      addNotification({
        type: 'action',
        title: 'Action card created',
        description: 'New action card created',
        href: '/ai/actions',
      });
    },
  });

  const unreadCount = notifications.filter((n) => !n.read).length;
  const displayedNotifications = notifications.slice(0, MAX_DISPLAYED);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const markRead = (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  };

  const handleNotificationClick = (notif: AppNotification) => {
    markRead(notif.id);
    if (notif.href) {
      router.push(notif.href);
    }
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      {/* Bell button */}
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="relative flex items-center justify-center w-9 h-9 rounded-xl text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
        aria-label="Notifications"
        data-testid="notification-bell"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-red-500 rounded-full"
            data-testid="notification-badge"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white dark:bg-slate-900 rounded-2xl shadow-soft border border-slate-100 dark:border-slate-800 z-50 overflow-hidden animate-dropdown-open"
          data-testid="notification-dropdown"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800">
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              Notifications
            </h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="flex items-center gap-1 text-xs text-sage-600 hover:text-sage-700 dark:text-sage-400 transition-colors"
                data-testid="mark-all-read"
              >
                <Check size={14} />
                Mark all as read
              </button>
            )}
          </div>

          {/* Notification list */}
          <div className="max-h-80 overflow-y-auto">
            {displayedNotifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-slate-400">
                No notifications yet
              </div>
            ) : (
              displayedNotifications.map((notif) => {
                const Icon = TYPE_ICONS[notif.type] || Info;
                const colorClass = TYPE_COLORS[notif.type] || TYPE_COLORS.system;
                return (
                  <button
                    key={notif.id}
                    onClick={() => handleNotificationClick(notif)}
                    className={cn(
                      'flex items-start gap-3 w-full px-4 py-3 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50',
                      !notif.read && 'bg-sage-50/30 dark:bg-sage-900/10',
                    )}
                    data-testid="notification-item"
                  >
                    <span
                      className={cn(
                        'flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-lg mt-0.5',
                        colorClass,
                      )}
                    >
                      <Icon size={16} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
                        {notif.title}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        {notif.description}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {formatRelativeTime(notif.timestamp)}
                      </p>
                    </div>
                    {!notif.read && (
                      <span
                        className="flex-shrink-0 w-2 h-2 rounded-full bg-sage-500 mt-2"
                        data-testid="unread-dot"
                      />
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-slate-100 dark:border-slate-800 px-4 py-2">
            <Link
              href="/notifications"
              onClick={() => setOpen(false)}
              className="block text-center text-xs text-sage-600 hover:text-sage-700 dark:text-sage-400 font-medium py-1 transition-colors"
              data-testid="view-all-link"
            >
              View all
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
