'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, MessageSquare, CalendarCheck, Zap, Info, Check, Trash2 } from 'lucide-react';
import { cn } from '@/lib/cn';
import { type AppNotification, formatRelativeTime } from '@/components/notification-bell';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'notifications';

const FILTER_TABS: { value: AppNotification['type'] | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'message', label: 'Messages' },
  { value: 'booking', label: 'Bookings' },
  { value: 'action', label: 'Actions' },
  { value: 'system', label: 'System' },
];

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
// Helpers
// ---------------------------------------------------------------------------

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
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications));
  } catch {
    // quota exceeded
  }
}

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [activeFilter, setActiveFilter] = useState<AppNotification['type'] | 'all'>('all');

  useEffect(() => {
    setNotifications(loadNotifications());
  }, []);

  useEffect(() => {
    saveNotifications(notifications);
  }, [notifications]);

  const filtered =
    activeFilter === 'all' ? notifications : notifications.filter((n) => n.type === activeFilter);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const clearAll = () => {
    setNotifications([]);
  };

  const handleClick = (notif: AppNotification) => {
    setNotifications((prev) => prev.map((n) => (n.id === notif.id ? { ...n, read: true } : n)));
    if (notif.href) {
      router.push(notif.href);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Bell size={28} className="text-sage-600" />
            <h1 className="font-serif text-2xl font-bold text-slate-900 dark:text-white">
              Notifications
            </h1>
            {unreadCount > 0 && (
              <span className="text-xs font-medium text-sage-700 bg-sage-100 px-2 py-0.5 rounded-full">
                {unreadCount} unread
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={markAllRead}
              disabled={unreadCount === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-sage-600 hover:bg-sage-50 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              data-testid="mark-all-read-btn"
            >
              <Check size={14} />
              Mark all as read
            </button>
            <button
              onClick={clearAll}
              disabled={notifications.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              data-testid="clear-all-btn"
            >
              <Trash2 size={14} />
              Clear all
            </button>
          </div>
        </div>

        {/* Filter tabs */}
        <div
          className="flex gap-1 mb-6 bg-white dark:bg-slate-900 rounded-xl p-1 border border-slate-100 dark:border-slate-800"
          data-testid="filter-tabs"
        >
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveFilter(tab.value)}
              className={cn(
                'flex-1 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors',
                activeFilter === tab.value
                  ? 'bg-sage-100 text-sage-700 dark:bg-sage-900/30 dark:text-sage-400'
                  : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200',
              )}
              data-testid={`filter-tab-${tab.value}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Notification list */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-soft border border-slate-100 dark:border-slate-800 overflow-hidden">
          {filtered.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center py-16 text-slate-400"
              data-testid="empty-state"
            >
              <Bell size={40} className="mb-3 opacity-40" />
              <p className="text-sm font-medium">No notifications</p>
              <p className="text-xs mt-1">
                {activeFilter === 'all'
                  ? "You're all caught up!"
                  : `No ${activeFilter} notifications`}
              </p>
            </div>
          ) : (
            filtered.map((notif) => {
              const Icon = TYPE_ICONS[notif.type] || Info;
              const colorClass = TYPE_COLORS[notif.type] || TYPE_COLORS.system;
              return (
                <button
                  key={notif.id}
                  onClick={() => handleClick(notif)}
                  className={cn(
                    'flex items-start gap-4 w-full px-5 py-4 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50 border-b border-slate-50 dark:border-slate-800/50 last:border-b-0',
                    !notif.read && 'bg-sage-50/30 dark:bg-sage-900/10',
                  )}
                  data-testid="notification-row"
                >
                  <span
                    className={cn(
                      'flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-xl mt-0.5',
                      colorClass,
                    )}
                  >
                    <Icon size={18} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                      {notif.title}
                    </p>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                      {notif.description}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      {formatRelativeTime(notif.timestamp)}
                    </p>
                  </div>
                  {!notif.read && (
                    <span
                      className="flex-shrink-0 w-2.5 h-2.5 rounded-full bg-sage-500 mt-2"
                      data-testid="unread-indicator"
                    />
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
