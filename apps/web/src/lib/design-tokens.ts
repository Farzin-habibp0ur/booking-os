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
  RESCHEDULED: {
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-l-blue-400',
    dot: 'bg-blue-500',
    label: 'Rescheduled',
    hex: '#3b82f6',
  },
};

// ---------------------------------------------------------------------------
// Booking color labels (user-applied color coding)
// ---------------------------------------------------------------------------

export const BOOKING_COLOR_LABELS: Record<
  string,
  { bg: string; border: string; dot: string; label: string }
> = {
  sage: { bg: 'bg-sage-50', border: 'border-sage-400', dot: 'bg-sage-500', label: 'Sage' },
  lavender: {
    bg: 'bg-lavender-50',
    border: 'border-lavender-400',
    dot: 'bg-lavender-500',
    label: 'Lavender',
  },
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
// Invoice status styles
// ---------------------------------------------------------------------------

export const INVOICE_STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  DRAFT: { bg: 'bg-slate-100', text: 'text-slate-600', label: 'Draft' },
  SENT: { bg: 'bg-blue-50', text: 'text-blue-700', label: 'Sent' },
  VIEWED: { bg: 'bg-lavender-50', text: 'text-lavender-900', label: 'Viewed' },
  PAID: { bg: 'bg-sage-50', text: 'text-sage-900', label: 'Paid' },
  PARTIALLY_PAID: { bg: 'bg-amber-50', text: 'text-amber-700', label: 'Partially Paid' },
  OVERDUE: { bg: 'bg-red-50', text: 'text-red-700', label: 'Overdue' },
  CANCELLED: { bg: 'bg-slate-100', text: 'text-slate-500', label: 'Cancelled' },
  REFUNDED: { bg: 'bg-rose-50', text: 'text-rose-700', label: 'Refunded' },
};

export function invoiceBadgeClasses(status: string): string {
  const s = INVOICE_STATUS_STYLES[status];
  if (!s) return 'bg-slate-100 text-slate-600';
  return `${s.bg} ${s.text}`;
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
// Referral status styles
// ---------------------------------------------------------------------------

export const REFERRAL_STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  PENDING: { bg: 'bg-lavender-50', text: 'text-lavender-700', label: 'Pending' },
  COMPLETED: { bg: 'bg-sage-50', text: 'text-sage-700', label: 'Completed' },
  EXPIRED: { bg: 'bg-slate-100', text: 'text-slate-500', label: 'Expired' },
  CANCELLED: { bg: 'bg-red-50', text: 'text-red-600', label: 'Cancelled' },
};

// ---------------------------------------------------------------------------
// Clinical photo type styles
// ---------------------------------------------------------------------------

export const PHOTO_TYPE_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  BEFORE: { bg: 'bg-amber-50', text: 'text-amber-700', label: 'Before' },
  AFTER: { bg: 'bg-sage-50', text: 'text-sage-700', label: 'After' },
  PROGRESS: { bg: 'bg-lavender-50', text: 'text-lavender-700', label: 'Progress' },
};

export function photoTypeBadgeClasses(type: string): string {
  const s = PHOTO_TYPE_STYLES[type];
  if (!s) return 'bg-slate-100 text-slate-600';
  return `${s.bg} ${s.text}`;
}

// ---------------------------------------------------------------------------
// Treatment plan status styles
// ---------------------------------------------------------------------------

export const TREATMENT_PLAN_STATUS_STYLES: Record<
  string,
  { bg: string; text: string; label: string }
> = {
  DRAFT: { bg: 'bg-slate-100', text: 'text-slate-600', label: 'Draft' },
  PROPOSED: { bg: 'bg-lavender-50', text: 'text-lavender-900', label: 'Proposed' },
  ACCEPTED: { bg: 'bg-blue-50', text: 'text-blue-700', label: 'Accepted' },
  IN_PROGRESS: { bg: 'bg-amber-50', text: 'text-amber-700', label: 'In Progress' },
  COMPLETED: { bg: 'bg-sage-50', text: 'text-sage-900', label: 'Completed' },
  CANCELLED: { bg: 'bg-red-50', text: 'text-red-700', label: 'Cancelled' },
};

export function treatmentPlanBadgeClasses(status: string): string {
  const s = TREATMENT_PLAN_STATUS_STYLES[status];
  if (!s) return 'bg-slate-100 text-slate-600';
  return `${s.bg} ${s.text}`;
}

// ---------------------------------------------------------------------------
// Aftercare status styles
// ---------------------------------------------------------------------------

export const AFTERCARE_STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> =
  {
    ACTIVE: { bg: 'bg-blue-50', text: 'text-blue-700', label: 'Active' },
    COMPLETED: { bg: 'bg-sage-50', text: 'text-sage-900', label: 'Completed' },
    CANCELLED: { bg: 'bg-red-50', text: 'text-red-700', label: 'Cancelled' },
    SCHEDULED: { bg: 'bg-lavender-50', text: 'text-lavender-900', label: 'Scheduled' },
    SENT: { bg: 'bg-sage-50', text: 'text-sage-900', label: 'Sent' },
    FAILED: { bg: 'bg-red-50', text: 'text-red-700', label: 'Failed' },
  };

export function aftercareBadgeClasses(status: string): string {
  const s = AFTERCARE_STATUS_STYLES[status];
  if (!s) return 'bg-slate-100 text-slate-600';
  return `${s.bg} ${s.text}`;
}

// ---------------------------------------------------------------------------
// Vehicle status styles (dealership inventory)
// ---------------------------------------------------------------------------

export const VEHICLE_STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  IN_STOCK: { bg: 'bg-sage-50', text: 'text-sage-900', label: 'In Stock' },
  RESERVED: { bg: 'bg-lavender-50', text: 'text-lavender-900', label: 'Reserved' },
  SOLD: { bg: 'bg-slate-100', text: 'text-slate-600', label: 'Sold' },
  IN_TRANSIT: { bg: 'bg-amber-50', text: 'text-amber-700', label: 'In Transit' },
  TRADE_IN: { bg: 'bg-sky-50', text: 'text-sky-700', label: 'Trade-In' },
  ARCHIVED: { bg: 'bg-red-50', text: 'text-red-700', label: 'Archived' },
};

export const VEHICLE_CONDITION_STYLES: Record<string, { bg: string; text: string; label: string }> =
  {
    NEW: { bg: 'bg-sage-50', text: 'text-sage-900', label: 'New' },
    USED: { bg: 'bg-amber-50', text: 'text-amber-700', label: 'Used' },
    CERTIFIED_PRE_OWNED: { bg: 'bg-sky-50', text: 'text-sky-700', label: 'Certified Pre-Owned' },
  };

export function vehicleStatusBadgeClasses(status: string): string {
  const s = VEHICLE_STATUS_STYLES[status];
  if (!s) return 'bg-slate-100 text-slate-600';
  return `${s.bg} ${s.text}`;
}

export function vehicleConditionBadgeClasses(condition: string): string {
  const s = VEHICLE_CONDITION_STYLES[condition];
  if (!s) return 'bg-slate-100 text-slate-600';
  return `${s.bg} ${s.text}`;
}

// ---------------------------------------------------------------------------
// Deal stage styles (dealership pipeline)
// ---------------------------------------------------------------------------

export const DEAL_STAGE_STYLES: Record<
  string,
  { bg: string; text: string; label: string; hex: string }
> = {
  INQUIRY: { bg: 'bg-slate-100', text: 'text-slate-600', label: 'Inquiry', hex: '#64748b' },
  QUALIFIED: {
    bg: 'bg-lavender-50',
    text: 'text-lavender-900',
    label: 'Qualified',
    hex: '#9F8ECB',
  },
  TEST_DRIVE: { bg: 'bg-sky-50', text: 'text-sky-700', label: 'Test Drive', hex: '#0ea5e9' },
  NEGOTIATION: { bg: 'bg-amber-50', text: 'text-amber-700', label: 'Negotiation', hex: '#f59e0b' },
  FINANCE: { bg: 'bg-blue-50', text: 'text-blue-700', label: 'Finance', hex: '#3b82f6' },
  CLOSED_WON: { bg: 'bg-sage-50', text: 'text-sage-900', label: 'Won', hex: '#71907C' },
  CLOSED_LOST: { bg: 'bg-red-50', text: 'text-red-700', label: 'Lost', hex: '#ef4444' },
};

export function dealStageBadgeClasses(stage: string): string {
  const s = DEAL_STAGE_STYLES[stage];
  if (!s) return 'bg-slate-100 text-slate-600';
  return `${s.bg} ${s.text}`;
}

// ---------------------------------------------------------------------------
// Package purchase status styles
// ---------------------------------------------------------------------------

export const PACKAGE_STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  ACTIVE: { bg: 'bg-sage-50', text: 'text-sage-900', label: 'Active' },
  EXHAUSTED: { bg: 'bg-slate-100', text: 'text-slate-600', label: 'Exhausted' },
  EXPIRED: { bg: 'bg-amber-50', text: 'text-amber-700', label: 'Expired' },
  CANCELLED: { bg: 'bg-red-50', text: 'text-red-700', label: 'Cancelled' },
  REFUNDED: { bg: 'bg-rose-50', text: 'text-rose-700', label: 'Refunded' },
};

export function packageBadgeClasses(status: string): string {
  const s = PACKAGE_STATUS_STYLES[status];
  if (!s) return 'bg-slate-100 text-slate-600';
  return `${s.bg} ${s.text}`;
}

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

// ---------------------------------------------------------------------------
// Marketing Command Center tokens
// ---------------------------------------------------------------------------

/** Content type styles (marketing content drafts) */
export const CONTENT_TYPE_STYLES: Record<
  string,
  { bg: string; text: string; label: string; hex: string }
> = {
  BLOG_POST: { bg: 'bg-sage-50', text: 'text-sage-700', label: 'Blog Post', hex: '#71907C' },
  SOCIAL_POST: {
    bg: 'bg-lavender-50',
    text: 'text-lavender-700',
    label: 'Social Post',
    hex: '#9F8ECB',
  },
  EMAIL: { bg: 'bg-sky-50', text: 'text-sky-700', label: 'Email', hex: '#0ea5e9' },
  CASE_STUDY: { bg: 'bg-amber-50', text: 'text-amber-700', label: 'Case Study', hex: '#f59e0b' },
  VIDEO_SCRIPT: { bg: 'bg-rose-50', text: 'text-rose-700', label: 'Video Script', hex: '#f43f5e' },
  NEWSLETTER: { bg: 'bg-blue-50', text: 'text-blue-700', label: 'Newsletter', hex: '#3b82f6' },
};

export function contentTypeBadgeClasses(type: string): string {
  const s = CONTENT_TYPE_STYLES[type];
  if (!s) return 'bg-slate-100 text-slate-600';
  return `${s.bg} ${s.text}`;
}

/** Content tier styles (GREEN / YELLOW / RED) */
export const TIER_STYLES: Record<
  string,
  { bg: string; text: string; border: string; label: string; hex: string }
> = {
  GREEN: {
    bg: 'bg-green-50',
    text: 'text-green-700',
    border: 'border-green-400',
    label: 'Green',
    hex: '#22c55e',
  },
  YELLOW: {
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-400',
    label: 'Yellow',
    hex: '#f59e0b',
  },
  RED: {
    bg: 'bg-red-50',
    text: 'text-red-700',
    border: 'border-red-400',
    label: 'Red',
    hex: '#ef4444',
  },
};

export function tierBadgeClasses(tier: string): string {
  const s = TIER_STYLES[tier];
  if (!s) return 'bg-slate-100 text-slate-600';
  return `${s.bg} ${s.text}`;
}

/** Action card priority styles */
export const ACTION_CARD_PRIORITY_STYLES: Record<
  string,
  { bg: string; text: string; border: string; label: string; hex: string }
> = {
  URGENT_TODAY: {
    bg: 'bg-red-50',
    text: 'text-red-700',
    border: 'border-red-400',
    label: 'Urgent Today',
    hex: '#ef4444',
  },
  NEEDS_APPROVAL: {
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-400',
    label: 'Needs Approval',
    hex: '#f59e0b',
  },
  OPPORTUNITY: {
    bg: 'bg-sage-50',
    text: 'text-sage-700',
    border: 'border-sage-400',
    label: 'Opportunity',
    hex: '#8AA694',
  },
  HYGIENE: {
    bg: 'bg-slate-100',
    text: 'text-slate-600',
    border: 'border-slate-400',
    label: 'Hygiene',
    hex: '#64748b',
  },
};

export function priorityBadgeClasses(priority: string): string {
  const s = ACTION_CARD_PRIORITY_STYLES[priority];
  if (!s) return 'bg-slate-100 text-slate-600';
  return `${s.bg} ${s.text}`;
}

/** Agent category styles (Content / Distribution / Analytics) */
export const AGENT_CATEGORY_STYLES: Record<
  string,
  { bg: string; text: string; label: string; hex: string }
> = {
  content: {
    bg: 'bg-lavender-50',
    text: 'text-lavender-700',
    label: 'Content',
    hex: '#9F8ECB',
  },
  distribution: {
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    label: 'Distribution',
    hex: '#3b82f6',
  },
  analytics: {
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    label: 'Analytics',
    hex: '#f59e0b',
  },
};

export function agentCategoryBadgeClasses(category: string): string {
  const s = AGENT_CATEGORY_STYLES[category];
  if (!s) return 'bg-slate-100 text-slate-600';
  return `${s.bg} ${s.text}`;
}

/** Autonomy level styles */
export const AUTONOMY_LEVEL_STYLES: Record<
  string,
  { bg: string; text: string; label: string; hex: string }
> = {
  OFF: { bg: 'bg-slate-100', text: 'text-slate-600', label: 'Off', hex: '#64748b' },
  SUGGEST: {
    bg: 'bg-lavender-50',
    text: 'text-lavender-700',
    label: 'Suggest',
    hex: '#9F8ECB',
  },
  AUTO_WITH_REVIEW: {
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    label: 'Auto + Review',
    hex: '#f59e0b',
  },
  FULL_AUTO: {
    bg: 'bg-sage-50',
    text: 'text-sage-700',
    label: 'Full Auto',
    hex: '#71907C',
  },
};

export function autonomyBadgeClasses(level: string): string {
  const s = AUTONOMY_LEVEL_STYLES[level];
  if (!s) return 'bg-slate-100 text-slate-600';
  return `${s.bg} ${s.text}`;
}

/** Pipeline stage styles (6-stage content pipeline) */
export const PIPELINE_STAGE_STYLES: Record<
  string,
  { bg: string; text: string; label: string; hex: string }
> = {
  research: {
    bg: 'bg-slate-100',
    text: 'text-slate-600',
    label: 'Research',
    hex: '#64748b',
  },
  creation: {
    bg: 'bg-lavender-50',
    text: 'text-lavender-700',
    label: 'Creation',
    hex: '#9F8ECB',
  },
  queue: {
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    label: 'Queue',
    hex: '#f59e0b',
  },
  approve: {
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    label: 'Approve',
    hex: '#3b82f6',
  },
  publish: {
    bg: 'bg-sage-50',
    text: 'text-sage-700',
    label: 'Publish',
    hex: '#71907C',
  },
  analyze: {
    bg: 'bg-sky-50',
    text: 'text-sky-700',
    label: 'Analyze',
    hex: '#0ea5e9',
  },
};

// ---------------------------------------------------------------------------
// Channel styles (omnichannel messaging)
// ---------------------------------------------------------------------------

export interface ChannelStyle {
  bg: string;
  text: string;
  border: string;
  label: string;
  hex: string;
}

export const CHANNEL_STYLES: Record<string, ChannelStyle> = {
  WHATSAPP: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-400',
    label: 'WhatsApp',
    hex: '#25D366',
  },
  INSTAGRAM: {
    bg: 'bg-pink-50',
    text: 'text-pink-700',
    border: 'border-pink-400',
    label: 'Instagram',
    hex: '#E4405F',
  },
  FACEBOOK: {
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-400',
    label: 'Messenger',
    hex: '#0084FF',
  },
  SMS: {
    bg: 'bg-slate-100',
    text: 'text-slate-700',
    border: 'border-slate-400',
    label: 'SMS',
    hex: '#64748b',
  },
  EMAIL: {
    bg: 'bg-sky-50',
    text: 'text-sky-700',
    border: 'border-sky-400',
    label: 'Email',
    hex: '#0ea5e9',
  },
  WEB_CHAT: {
    bg: 'bg-lavender-50',
    text: 'text-lavender-700',
    border: 'border-lavender-400',
    label: 'Web Chat',
    hex: '#9F8ECB',
  },
};

export function channelBadgeClasses(channel: string): string {
  const s = CHANNEL_STYLES[channel];
  if (!s) return 'bg-slate-100 text-slate-600';
  return `${s.bg} ${s.text}`;
}
