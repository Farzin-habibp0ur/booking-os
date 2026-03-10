/**
 * Design Tokens — Booking OS Design System
 *
 * Centralised status colours, elevation constants, and shared style maps
 * used across dashboard, bookings, calendar, inbox, and detail modals.
 *
 * Every component should import from here instead of defining inline maps.
 */

// ---------------------------------------------------------------------------
// Booking status styles (Tailwind class strings)
// ---------------------------------------------------------------------------

export interface StatusStyle {
  /** Background class, e.g. 'bg-lavender-50' */
  bg: string;
  /** Foreground / text class */
  text: string;
  /** Left-border accent (calendar cards) */
  border: string;
  /** Dot colour for the status-dot pattern */
  dot: string;
  /** Human-readable label */
  label: string;
  /** Hex value for chart libraries (recharts / Chart.js) */
  hex: string;
}

export const BOOKING_STATUS_STYLES: Record<string, StatusStyle> = {
  PENDING: {
    bg: 'bg-lavender-50',
    text: 'text-lavender-900',
    border: 'border-l-lavender-500',
    dot: 'bg-lavender-500',
    label: 'Pending',
    hex: '#9F8ECB',
  },
  PENDING_DEPOSIT: {
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-l-amber-400',
    dot: 'bg-amber-400',
    label: 'Pending Deposit',
    hex: '#f59e0b',
  },
  CONFIRMED: {
    bg: 'bg-sage-50',
    text: 'text-sage-900',
    border: 'border-l-sage-500',
    dot: 'bg-sage-500',
    label: 'Confirmed',
    hex: '#8AA694',
  },
  IN_PROGRESS: {
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-l-amber-500',
    dot: 'bg-amber-500',
    label: 'In Progress',
    hex: '#f59e0b',
  },
  COMPLETED: {
    bg: 'bg-sage-50',
    text: 'text-sage-900',
    border: 'border-l-sage-400',
    dot: 'bg-sage-600',
    label: 'Completed',
    hex: '#71907C',
  },
  NO_SHOW: {
    bg: 'bg-red-50',
    text: 'text-red-700',
    border: 'border-l-red-400',
    dot: 'bg-red-500',
    label: 'No Show',
    hex: '#ef4444',
  },
  CANCELLED: {
    bg: 'bg-slate-100',
    text: 'text-slate-600',
    border: 'border-l-slate-300',
    dot: 'bg-slate-400',
    label: 'Cancelled',
    hex: '#64748b',
  },
};

// ---------------------------------------------------------------------------
// Booking color labels (user-applied color coding)
// ---------------------------------------------------------------------------

export const BOOKING_COLOR_LABELS: Record<string, { bg: string; border: string; dot: string; label: string }> = {
  sage: { bg: 'bg-sage-50', border: 'border-sage-400', dot: 'bg-sage-500', label: 'Sage' },
  lavender: { bg: 'bg-lavender-50', border: 'border-lavender-400', dot: 'bg-lavender-500', label: 'Lavender' },
  amber: { bg: 'bg-amber-50', border: 'border-amber-400', dot: 'bg-amber-500', label: 'Amber' },
  sky: { bg: 'bg-sky-50', border: 'border-sky-400', dot: 'bg-sky-500', label: 'Sky' },
  rose: { bg: 'bg-rose-50', border: 'border-rose-400', dot: 'bg-rose-500', label: 'Rose' },
};

// ---------------------------------------------------------------------------
// Booking source styles (for source attribution badges)
// ---------------------------------------------------------------------------

export interface SourceStyle {
  bg: string;
  text: string;
  label: string;
  hex: string;
}

export const BOOKING_SOURCE_STYLES: Record<string, SourceStyle> = {
  MANUAL: { bg: 'bg-slate-100', text: 'text-slate-600', label: 'Manual', hex: '#64748b' },
  PORTAL: { bg: 'bg-sage-50', text: 'text-sage-900', label: 'Portal', hex: '#8AA694' },
  WHATSAPP: { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'WhatsApp', hex: '#10b981' },
  AI: { bg: 'bg-lavender-50', text: 'text-lavender-900', label: 'AI', hex: '#9F8ECB' },
  REFERRAL: { bg: 'bg-sky-50', text: 'text-sky-700', label: 'Referral', hex: '#0ea5e9' },
  WALK_IN: { bg: 'bg-amber-50', text: 'text-amber-700', label: 'Walk-in', hex: '#f59e0b' },
};

// Convenience helpers -------------------------------------------------------

/** Badge-style classes (bg + text combined) — used in bookings table, badges */
export function statusBadgeClasses(status: string): string {
  const s = BOOKING_STATUS_STYLES[status];
  if (!s) return 'bg-slate-100 text-slate-600';
  return `${s.bg} ${s.text}`;
}

/** Calendar card classes (bg + border + text) */
export function statusCalendarClasses(status: string): {
  bg: string;
  border: string;
  text: string;
} {
  const s = BOOKING_STATUS_STYLES[status];
  if (!s) return { bg: 'bg-slate-50', border: 'border-l-slate-400', text: 'text-slate-500' };
  return { bg: s.bg, border: s.border, text: s.text };
}

/** Hex colour for chart libraries */
export function statusHex(status: string): string {
  return BOOKING_STATUS_STYLES[status]?.hex ?? '#64748b';
}

// ---------------------------------------------------------------------------
// Non-booking domain statuses
// ---------------------------------------------------------------------------

export const OUTBOUND_STATUS_STYLES: Record<string, { label: string; style: string }> = {
  DRAFT: { label: 'Draft', style: 'bg-lavender-50 text-lavender-700' },
  APPROVED: { label: 'Approved', style: 'bg-sage-50 text-sage-700' },
  SENT: { label: 'Sent', style: 'bg-sage-100 text-sage-800' },
  REJECTED: { label: 'Rejected', style: 'bg-red-50 text-red-700' },
};

export const SUPPORT_STATUS_STYLES: Record<string, string> = {
  open: 'bg-sage-50 text-sage-900 dark:bg-sage-900/30 dark:text-sage-400',
  in_progress: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  resolved: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  closed: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
};

export const SUBSCRIPTION_STATUS_STYLES: Record<string, string> = {
  active: 'bg-sage-50 text-sage-900',
  trialing: 'bg-lavender-50 text-lavender-900',
  past_due: 'bg-amber-50 text-amber-700',
  canceled: 'bg-red-50 text-red-700',
};

// ---------------------------------------------------------------------------
// Conversation status styles
// ---------------------------------------------------------------------------

export interface ConversationStatusStyle {
  bg: string;
  text: string;
  dot: string;
  label: string;
}

export const CONVERSATION_STATUS_STYLES: Record<string, ConversationStatusStyle> = {
  OPEN: {
    bg: 'bg-sage-50',
    text: 'text-sage-900',
    dot: 'bg-sage-500',
    label: 'Open',
  },
  WAITING: {
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    dot: 'bg-amber-500',
    label: 'Waiting',
  },
  RESOLVED: {
    bg: 'bg-slate-100',
    text: 'text-slate-600',
    dot: 'bg-slate-400',
    label: 'Resolved',
  },
  SNOOZED: {
    bg: 'bg-lavender-50',
    text: 'text-lavender-900',
    dot: 'bg-lavender-500',
    label: 'Snoozed',
  },
};

// ---------------------------------------------------------------------------
// Elevation (shadow) tokens
// ---------------------------------------------------------------------------

export const ELEVATION = {
  /** Standard card surface */
  card: 'shadow-soft rounded-2xl',
  /** Small card / popover */
  cardSm: 'shadow-soft-sm rounded-xl',
  /** Modal / dialog overlay */
  modal: 'shadow-soft-lg rounded-2xl',
  /** Dropdown / menu */
  dropdown: 'shadow-soft-sm rounded-xl',
  /** Floating action / fab */
  fab: 'shadow-soft rounded-full',
} as const;

// ---------------------------------------------------------------------------
// Spacing helpers (8px grid reference)
// ---------------------------------------------------------------------------

export const SPACING = {
  /** Section padding on pages */
  pagePx: 'px-4 sm:px-6',
  pagePy: 'py-4 sm:py-6',
  page: 'p-4 sm:p-6',
  /** Card internal padding */
  cardPad: 'p-5',
  /** Gap between grid items */
  gridGap: 'gap-4 sm:gap-6',
} as const;
