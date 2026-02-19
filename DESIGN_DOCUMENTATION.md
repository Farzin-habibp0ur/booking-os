# Booking OS — Complete Product & UI Documentation

> **Purpose:** This document provides a comprehensive reference of the entire Booking OS application — its features, pages, components, data models, design system, and user flows. Use it as context for generating high-fidelity UI designs and exploring UX improvements.
>
> **Last updated:** February 2026

---

## 1. Product Overview

**Booking OS** is a multi-tenant SaaS platform for service-based businesses (aesthetic clinics, car dealerships, salons, spas) to manage bookings, customer conversations, and operations — with AI-powered agentic automation.

### Core Capabilities
- **Appointment scheduling** with calendar views, conflict detection, recurring bookings, and automated reminders
- **WhatsApp messaging inbox** with real-time updates, AI auto-replies, and conversation management
- **AI booking assistant** that guides customers through booking/cancellation/rescheduling via chat
- **Customer management** with profiles, tags, import/export, AI chat, and bulk actions
- **Staff management** with roles, working hours, time off, and email invitations
- **Service catalog** with categories, pricing, durations, buffer times, deposit requirements, and service kinds
- **Analytics & reports** with charts for bookings, revenue, staff performance, peak hours, consult conversion
- **Multi-language support** (English, Spanish) with customizable per-business translation overrides
- **Billing integration** via Stripe (basic/pro plans), deposit collection
- **Calendar sync** — Google Calendar OAuth integration, iCal feed generation
- **Vertical packs** — industry-specific configurations (aesthetic, dealership, salon, tutoring, general)
- **Public booking portal** — Customer-facing booking page at `/book/{slug}` with waitlist join
- **Setup wizard** — 10-step onboarding flow with feature readiness checklist and test booking
- **Dark mode** — System preference detection, manual toggle, full UI coverage
- **Global search** — Cmd+K command palette across customers, bookings, services, conversations

### Phase 1: Outcome Machine for Aesthetics (Complete — 27/27 tasks)
- **Consult vs Treatment types** with service kind badges (CONSULT/TREATMENT/OTHER)
- **Aesthetics intake fields** — 7-field Clinic Intake card in inbox sidebar with amber dot indicators
- **Automated follow-ups** — Consult → treatment follow-up, aftercare instructions, 24h check-in
- **Deposit-required bookings** — PENDING_DEPOSIT status, send deposit request action, manager override with reason
- **Clinic policies** — Cancel/reschedule windows enforced on staff and customer actions
- **Customer self-serve** — Branded reschedule/cancel pages via secure token links
- **ROI dashboard** — 6 metrics with baseline comparison, recovered revenue estimate, weekly review with email
- **Onboarding** — Go-live checklist, first 10 bookings milestones, feature readiness checklist
- **Template pack** — 10 templates with unresolved variable warnings
- **Notification timeline** — All actions logged and visible in booking detail
- **Role-based permissions** — Money/policy actions restricted with explanations

### Phase 2: Automation & Growth Engine (Complete — 13/13 batches)
- **Waitlist system** — Join waitlist, auto-offers on cancellation, 1-tap claim via token, backfill metrics
- **Bulk actions** — Multi-select on bookings (status change, staff assign) and customers (tag/untag)
- **Global search (Cmd+K)** — Command palette with keyboard navigation, grouped results, recent searches
- **Campaign system** — Audience segmentation, 4-step builder wizard, throttled dispatch, send tracking, attribution
- **Offers & referrals** — Offers CRUD, referral source tracking on public bookings
- **Automation suite** — 3 built-in playbooks, custom rule builder, 6 triggers, activity log with quiet hours and frequency caps
- **Contextual tooltips + empty states** — Onboarding tips, enhanced empty states with CTAs
- **Dark mode** — System/Light/Dark picker, full UI coverage with dark: variants
- **Visual polish** — CSS keyframe animations, chart theme with brand palette, prefers-reduced-motion

### UX Phase 1: Role-based Modes + Mission Control + Saved Views (Complete — 6/6 batches)
- **Role-based Modes** — Mode switcher (admin/agent/provider), mode-grouped sidebar nav with primary/secondary split and "More" toggle, role-appropriate landing pages, vertical-aware labels
- **Mission Control Dashboard** — Mode-adaptive layout with KPI strip, "My Work" section, AttentionCards, dashboard-pinned saved views
- **Saved Views** — Named filter/sort presets on list pages (inbox, bookings, customers, waitlist), sidebar-pinnable, dashboard-pinnable, personal + shared (admin-governed)
- **Staff preferences** — JSON column on Staff for cross-device mode persistence

### UX Phase 2: Customer Hub + Unified Timeline + Global Search (Bundle B) (Complete — 7/7 batches)
- **Customer Hub** — Redesigned `/customers/{id}` with sticky header, context row (last booking, last conversation, waitlist count), notes tab, message deep link, vertical modules (IntakeCard for aesthetic, quotes for dealership)
- **Customer Notes** — New `CustomerNote` model with full CRUD, staff ownership validation
- **Unified Timeline** — Timeline API endpoint (6 data sources: bookings, conversations, notes, waitlist, quotes, campaigns), `CustomerTimeline` component with type filtering, pagination, deep linking
- **Enhanced Search** — Search API with offset, types filter, totals; Cmd+K fixed hrefs to detail pages, grouped results, vertical-aware labels, "View all results" link; dedicated `/search` page
- **Inbox Deep Linking** — `?conversationId=` URL param auto-selects conversation, customer name links to profile

### Agentic-First Transformation — Milestone 1: Agentic Foundations & Trust Rails (Complete — commit d8be527)
- **ActionCard system** — 4 new Prisma models (ActionCard, ActionHistory, AutonomyConfig, OutboundDraft), 4 new API modules with full CRUD
- **Action Cards** — AI-generated action recommendations with approve/dismiss/snooze/execute lifecycle, priority levels, expiry cron
- **Action History** — Unified audit trail with polymorphic entity references (entityType + entityId), tracks STAFF/SYSTEM/AI performers
- **Autonomy Configuration** — Per-action-type autonomy levels (OFF/SUGGEST/AUTO_WITH_REVIEW/FULL_AUTO), approval thresholds, cooldown periods
- **Outbound Drafts** — Staff-initiated outbound messages with scheduling, channel selection, draft/queue/send lifecycle
- **14 new frontend components** — Action card list/item/detail/badge/filters, action history list/item/filters, autonomy settings/level picker, outbound compose/draft list, recent changes panel
- **Integration** — ActionCardBadge in inbox, OutboundCompose in inbox, RecentChangesPanel in customer detail, /settings/autonomy page

### Agentic-First Transformation — Milestone 2: Daily Briefing Agent (Complete — 4/4 batches)
- **OpportunityDetectorService** — Cron-based scanner detecting deposit pending bookings, overdue conversation replies, and open time slots
- **BriefingService** — Grouped ActionCard feed aggregating detected opportunities into a prioritized daily briefing
- **BriefingController** — `GET /briefing` (grouped feed) and `GET /briefing/opportunities` (raw opportunity list)
- **Frontend components** — BriefingCard, OpportunityCard, BriefingFeed (3 components in `components/briefing/`)
- **Dashboard integration** — BriefingFeed rendered above admin metric cards on the dashboard, cards navigate to inbox/bookings/customers based on entity data

### Agentic-First Transformation — Milestone 3: Inbox-as-OS (Complete — 5/5 batches)
- **Agent Framework** (Batch 3a) — 4 new Prisma models (AgentConfig, AgentRun, AgentFeedback, DuplicateCandidate), agent module with AgentFrameworkService, AgentSchedulerService, AgentController, AGENT_PROCESSING BullMQ queue
- **Conversation Action Handler** (Batch 3b) — ConversationActionHandler (`ai/conversation-action-handler.ts`) for executing conversation-level actions from action cards, ActionCardInline frontend component
- **Policy Compliance & Deposits** (Batch 3c) — PolicyComplianceService for automated policy enforcement, DepositCardHandler for deposit-related action cards, deposit-card.tsx frontend component
- **Human Takeover** (Batch 3d) — HumanTakeoverService for AI-to-human escalation flow, ClarificationHandler for requesting clarification from staff, human-takeover-banner.tsx frontend component
- **Vertical Actions** (Batch 3e) — VerticalActionHandler (`ai/vertical-action-handler.ts`) for vertical-specific action execution (aesthetic, dealership workflows)

### Agentic-First Transformation — Milestone 4: Background Agents (Complete)
- **5 Background Agents** — WaitlistAgent (auto-match waitlist entries to cancelled slots), RetentionAgent (detect at-risk customers, generate win-back action cards), DataHygieneAgent (duplicate detection, incomplete profile flagging), SchedulingOptimizerAgent (gap detection, optimal slot suggestions), QuoteFollowupAgent (expired quote reminders, follow-up action cards)
- **Agent Scheduler** — Cron-driven scheduler runs agents per their AgentConfig schedule, tracks AgentRun status/results/errors
- **Agent Feedback** — New AgentFeedback API module with staff feedback CRUD (thumbs up/down + comments) and aggregation stats for agent run outcomes
- **Frontend components** — agent-feedback-buttons.tsx (inline feedback on agent runs), agent-performance.tsx (run history, success rates, feedback summary), retention-card.tsx (win-back recommendations), duplicate-merge-card.tsx (merge/dismiss duplicate customers)
- **Settings page** — `/settings/agents` page for enabling/disabling agents, configuring schedules and autonomy levels per agent type

### Agentic-First Transformation — Milestone 5: Vertical Pack Agents (Complete)
- **Agent Skills Catalog** — New AgentSkills API module providing per-pack skill definitions with business-level overrides
- **Pack-specific agent behaviors** — Agents adapt skills and action card types based on business vertical pack (aesthetic: aftercare follow-ups, consult conversion; dealership: quote follow-up, service bay optimization)
- **Frontend components** — skill-card.tsx (skill catalog display with enable/disable), vertical-launch-checklist.tsx (vertical-specific agent readiness checklist), waitlist-match-card.tsx (waitlist auto-match opportunities), quote-followup-card.tsx (expired/pending quote follow-up actions), ai-state-indicator.tsx (real-time agent processing status)
- **Final counts (all 5 milestones):** 3,158 tests total (1,937 API + 1,221 web)

### UX Upgrade Pack — Release 1 (Batches 1a–1h) (Complete)
- **Media Attachments** (Batch 1a) — New `MessageAttachment` model, Attachment API module (upload + download), `POST /conversations/:id/messages/media`, `GET /attachments/:id/download`. 18 tests.
- **Delivery/Read Receipts** (Batch 1b) — New fields on Message (`deliveryStatus`, `deliveredAt`, `readAt`, `failureReason`), `updateDeliveryStatus()` in MessageService, WebSocket `message:status` event, `POST /webhook/whatsapp/status`. 7 tests.
- **Inbox Media UI + Receipt Indicators** (Batch 1c) — New components: `delivery-status.tsx` (delivery/read indicators), `media-message.tsx` (image/doc/audio display), `media-composer.tsx` (file attachment composer). 14 tests.
- **Outbound Initiation + Collision Detection** (Batch 1d) — `POST /outbound/send-direct` endpoint, InboxGateway presence tracking (`viewing:start`/`viewing:stop`/`presence:update`), "Send Message" button on customer detail, presence pills in inbox. 4 tests.
- **Calendar Month View** (Batch 1e) — `GET /bookings/calendar/month-summary`, 6x7 CSS grid month view, colored dots (sage=confirmed, lavender=pending, red=cancelled), click-to-drill (day). 13 tests.
- **Working Hours + Time-Off Visualization** (Batch 1f) — `GET /availability/calendar-context`, non-working hours gray shading, time-off red shading with badge. 6 tests.
- **Drag-and-Drop Reschedule + Recommended Slots** (Batch 1g) — `GET /availability/recommended-slots` (top 5 scored by proximity + staff balance), `RecommendedSlots` component, HTML5 DnD (draggable cards, drop targets, 30-min snap, conflict detection, confirmation popover). 7 tests.
- **Final counts:** 3,227 tests total (1,982 API + 1,245 web), +69 new tests

### UX Upgrade Pack — Release 2 (Batches 2a–2g) (Complete)
- **CSV Export API** (Batch 2a) — New Export module with `GET /customers/export`, `GET /bookings/export`, streaming CSV response (RFC 4180), field selection, date range filters, 10k row cap. 20 tests.
- **Export UI + Duplicate Review Page** (Batch 2b) — `ExportModal` component, export buttons on list pages, `/customers/duplicates` page with status tabs and merge/dismiss/snooze actions. 14 tests.
- **Audit Export + Timeline Polish** (Batch 2c) — `GET /action-history/export` CSV endpoint, customer timeline count badges per event type. 13 tests.
- **Today Timeline Component** (Batch 2d) — `TodayTimeline` replacing flat appointments list, vertical timeline with time markers (8AM–7PM), current time indicator, gap indicators, quick action buttons (Start/Complete/No-Show/Open Chat). 14 tests.
- **Enhanced Attention Cards + Actionable KPIs** (Batch 2e) — Primary action buttons on attention cards (Send Reminders/Open Queue/Confirm Schedule), "Resolve next" navigation, expand/collapse for >3 items, clickable KPI cards linking to relevant pages. 16 tests.
- **Briefing Card Snooze + Expandable Details** (Batch 2f) — Snooze dropdown (1h/4h/tomorrow/next week), expandable detail section, category border colors (red/lavender/sage), auto-refresh every 5 minutes. 11 tests.
- **Integration + Documentation** (Batch 2g) — ActionHistory logging for CSV exports, i18n keys, documentation updates.
- **Final counts:** 3,309 tests total (2,003 API + 1,306 web), +82 new tests

### Tech Stack
| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15, React 19, TypeScript |
| Styling | Tailwind CSS 4 (utility-first) |
| Icons | lucide-react v0.468 |
| Charts | Recharts v2.15 |
| Real-time | Socket.io |
| Backend | NestJS 11, TypeScript |
| Database | PostgreSQL 16 + Prisma 6 ORM |
| AI | Claude API (Anthropic) |
| Payments | Stripe |
| Email | Resend |
| Messaging | WhatsApp Business Cloud API |
| Monitoring | Sentry |

### Default Seed Data (Demo Accounts)

**Glow Aesthetic Clinic** (slug: glow-aesthetic)
- **Login:** sarah@glowclinic.com / password123
- **Staff:** Dr. Sarah Chen (Admin), Maria Garcia (Agent), Dr. Emily Park (Service Provider)
- **Services:** Botox ($350/30min, deposit $100), Dermal Filler ($500/45min), Chemical Peel ($200/60min), Microneedling ($275/45min), Consultation (Free/20min)
- **Customers:** 20+ including Emma Wilson (VIP), James Thompson, Sofia Rodriguez, Liam Parker

**Metro Auto Group** (slug: metro-auto)
- **Login:** mike@metroauto.com / password123
- **Staff:** Mike Torres (Admin), Jen Davis (Agent), Carlos Ruiz (Service Provider), Priya Shah (Service Provider)
- **Services:** Oil Change, Full Detailing, Brake Service, Tire Rotation, Pre-Purchase Inspection

---

## 2. Design System — "Minimalist Premium"

> The active design system is defined in `CLAUDE.md`. Think Apple Health meets Stripe — lots of whitespace, subtle shadows, highly legible typography, and deliberate use of color.

### 2.1 Color Palette

**Sage (primary actions, confirmations, success)**
| Token | Hex | Usage |
|-------|-----|-------|
| sage-50 | #F4F7F5 | Confirmed/completed status bg, light highlights |
| sage-100 | #E4EBE6 | Hover states, selected items |
| sage-500 | #8AA694 | Secondary elements |
| sage-600 | #71907C | Primary buttons, CTAs |
| sage-900 | #3A4D41 | Dark text on sage bg |

**Lavender (AI features, highlights, pending states)**
| Token | Hex | Usage |
|-------|-----|-------|
| lavender-50 | #F5F3FA | AI element bg, pending status bg |
| lavender-100 | #EBE7F5 | AI borders, hover states |
| lavender-500 | #9F8ECB | AI accents |
| lavender-600 | #8A75BD | AI buttons |
| lavender-900 | #4A3B69 | AI text, pending status text |

**Status Badge Colors (muted, pastel tones)**
| Status | Background | Text | Usage |
|--------|-----------|------|-------|
| CONFIRMED / COMPLETED | sage-50 | sage-900 | Confirmed bookings, completed |
| PENDING / PENDING_DEPOSIT | lavender-50 | lavender-900 | Awaiting action |
| IN_PROGRESS | amber-50 | amber-700 | Currently in session |
| CANCELLED / NO_SHOW | red-50 | red-700 | Cancelled or no-show |

**Conversation Status Colors**
| Status | Color |
|--------|-------|
| OPEN | sage/green |
| WAITING | amber |
| SNOOZED | lavender/purple |
| RESOLVED | slate/gray |

**Surfaces**
| Surface | Color |
|---------|-------|
| Page background | #FCFCFD (warm off-white) |
| Cards/Modals | white |
| Modal overlay | black/30 |
| Sidebar | white + shadow |
| Dark mode bg | slate-900 |

**Text**
| Level | Color |
|-------|-------|
| Primary | slate-800 |
| Secondary | slate-500 |
| Muted | slate-400 |
| Dark mode primary | slate-100 |
| Dark mode secondary | slate-400 |

### 2.2 Typography
- **UI / Data font:** `Inter` (Google Fonts) — set as Tailwind's default `font-sans`
- **Display / Header font:** `Playfair Display` (Google Fonts) — set as Tailwind's `font-serif`
- Use `font-serif` for large metrics, page titles, and high-impact headers
- Use `font-sans` (Inter) for body text, labels, buttons, and data
- Text sizes: text-xs, text-sm, text-base, text-lg, text-xl, text-2xl used throughout

### 2.3 Component Library
- **No third-party component library** (no shadcn, Radix, Material UI)
- All components are hand-built with Tailwind utility classes
- Class merging via `clsx` + `tailwind-merge` (cn() utility)

### 2.4 Layout Patterns
- **Sidebar navigation:** Fixed left sidebar, flex-1 main content, Sun/Moon dark mode toggle
- **Grid layouts:** Responsive grid-cols-1 → md:grid-cols-2 → lg:grid-cols-4
- **Card pattern:** White background, `rounded-2xl`, `shadow-soft` (0 12px 40px -12px rgba(0,0,0,0.05)), no borders
- **Page headers:** Title (text-2xl font-bold font-serif) + optional subtitle + action buttons

### 2.5 Interactive Patterns

**Buttons**
- Primary: `bg-sage-600 hover:bg-sage-700 text-white rounded-xl` with subtle hover transitions
- Dark: `bg-slate-900 hover:bg-slate-800 text-white rounded-xl`
- Danger: `bg-red-600 text-white hover:bg-red-700 rounded-xl`
- AI/Lavender: `bg-lavender-600 text-white hover:bg-lavender-700 rounded-xl`
- Disabled: opacity-50 cursor-not-allowed

**Form Inputs**
- `bg-slate-50 border-transparent focus:bg-white focus:ring-2 focus:ring-sage-500 rounded-xl`
- Controlled components with useState
- Required fields marked with `*`
- Error display: AlertCircle icon + red-50 bg + red-700 text

**Badges/Pills**
- Status: px-2 py-0.5 rounded-full text-xs font-medium (colors per status table above)
- Tags: px-2 py-0.5 rounded text-xs
- Role: ADMIN=lavender, SERVICE_PROVIDER=sage, AGENT=slate

**Modals**
- Right drawer: fixed right-0 top-0 h-full w-[480px] z-50, slideInRight animation
- Center modal: fixed inset centered, max-w-lg/xl, max-h-[80vh], z-50, scaleIn animation
- Overlay: bg-black/30, click to dismiss
- Confirmation dialog: nested absolute overlay within modal
- Auth cards: `rounded-3xl`

**Toast Notifications**
- Fixed bottom-right, z-[100]
- 3-second auto-dismiss
- Types: success (sage), error (red), info (lavender)
- Icons: CheckCircle2, AlertCircle, Info
- Slide-in animation from right

**Animations (CSS keyframes)**
- `slideUp` — modals entering from below
- `fadeIn` — general fade entrance
- `scaleIn` — center modals scaling in
- `slideInRight` — drawer modals sliding from right
- All respect `prefers-reduced-motion`

### 2.6 Icons
- **Library:** lucide-react
- **Navigation icons:** LayoutDashboard, MessageSquare, Calendar, Users, BookOpen, Scissors, UserCog, BarChart3, Settings, LogOut, Zap (automations), Megaphone (campaigns), Clock (waitlist), Search
- **Action icons:** X, Plus, Pencil, Trash2, Send, RefreshCw, Search, Filter
- **Status icons:** AlertCircle, CheckCircle2, AlertTriangle, Clock, Info
- **AI icons:** Sparkles, Loader2 (spinning)
- **Theme icons:** Sun, Moon (dark mode toggle)
- **Standard size:** 16-18px in navigation, 14-16px inline, 48px for empty states

### 2.7 Dark Mode
- **Strategy:** Tailwind `darkMode: 'class'`
- **Toggle:** Sun/Moon icon in sidebar
- **Settings:** System / Light / Dark picker in settings page
- **Storage:** localStorage + system preference detection via `use-theme` hook
- **Coverage:** Full — all pages, cards, tables, inputs, charts, navigation
- **Charts:** Brand palette theme (sage/lavender) adapts to dark backgrounds

---

## 3. Pages & Screens (Complete Inventory)

### 3.1 Public Pages (No Authentication)

#### Login Page (`/login`)
- Centered card on gray background
- App title "Booking OS" + subtitle
- Email + Password inputs
- "Sign in" button (blue, full-width)
- Links: "Sign up" and "Forgot password?"
- Success banner if redirected from password reset

#### Sign Up Page (`/signup`)
- Centered card
- Business name, Admin name, Email, Password inputs
- "Create account" button
- Link: "Already have an account? Sign in"
- On success: redirects to `/setup`

#### Forgot Password (`/forgot-password`)
- Centered card
- Email input → "Send reset link" button
- After submit: success message "If an account exists for {email}, we've sent a password reset link"

#### Reset Password (`/reset-password?token=...`)
- Centered card
- New password + Confirm password inputs (min 8 chars)
- Validation: passwords must match

#### Accept Invite (`/accept-invite?token=...`)
- Centered card
- Password + Confirm password inputs
- "Set password & join" button
- On success: redirects to `/dashboard`

---

### 3.2 Setup Wizard (`/setup`) — 10 Steps

A linear onboarding wizard with progress bar. Each step has a title, subtitle, and navigation (Back/Next/Finish).

| Step | Name | What It Contains |
|------|------|-----------------|
| 0 | Clinic Type | Vertical pack selector: Aesthetic Clinic (recommended) or General Practice. Auto-installs services, templates, settings for chosen pack. |
| 1 | Business Info | Business name input, timezone dropdown, currency dropdown |
| 2 | Connect WhatsApp | Green info box, Connect WhatsApp button, Skip for now option |
| 3 | Add Staff | Staff list with status/role badges, invite form (name, email, role dropdown), resend invite button |
| 4 | Define Services | Service list (editable/deletable), add service form (name, duration, price, kind), edit mode with inline inputs |
| 5 | Working Hours | Staff member tabs, per-day schedule (Sunday–Saturday), Working/Off toggle + time pickers |
| 6 | Templates | Template list showing name, category badge, body in code box, variable badges |
| 7 | Profile Requirements | Two categories (Basic/Medical), checkbox per field to mark as required |
| 8 | Import Customers | Three cards: CSV import (drag-drop + preview table), Conversation import (with AI profile generation), Manual import (link to customers page) |
| 9 | Test & Finish | Feature readiness checklist (6 items with green/amber indicators), Create Test Booking button, Open WhatsApp Simulator button, Go to Dashboard button |

---

### 3.3 Dashboard (`/dashboard`) — Mode-Adaptive

The dashboard layout adapts based on the active mode (admin/agent/provider).

**Agent/Provider modes show:**
- **KPI Strip** — 3 compact role-appropriate metrics, clickable → relevant pages with action subtitles (R2)
- **My Work** — Personal assigned conversations + today's bookings + completed count
- **Attention Cards** — Items needing action with primary action buttons (Send Reminders/Open Queue/Confirm Schedule), expand/collapse for >3 items, "Resolve next" navigation (R2)
- **Dashboard-pinned Saved Views** — Clickable cards linking to filtered list pages
- **Today's Schedule** (agent only)

**Admin mode shows the full dashboard:**

**Top: Daily Briefing Feed**
- `BriefingFeed` component rendered above metric cards
- Grouped action cards from `OpportunityDetectorService` (deposit pending, overdue replies, open slots)
- Each `BriefingCard` / `OpportunityCard` navigates to the relevant page (inbox, bookings, customers) based on entity data
- Briefing cards use contextual CTA labels per card type (e.g., "Send Reminder" for deposit pending, "Nudge Staff" for overdue replies, "Follow Up" for stalled quotes) instead of generic "Approve"
- Approve/dismiss use dedicated API routes (`PATCH /action-cards/:id/approve`, `PATCH /action-cards/:id/dismiss`)
- Snooze dropdown (1h/4h/tomorrow/next week) on briefing cards, expandable detail section, category border colors (R2)
- Auto-refresh every 5 minutes (R2)

**Today's Appointments: TodayTimeline** (R2)
- Vertical timeline with time markers (8AM–7PM), booking cards positioned chronologically
- Current time red indicator, gap indicators for free time
- Quick action buttons: Start (IN_PROGRESS), Complete, No-Show, Open Chat

**Metric Cards (4-column grid)**
1. **Bookings This Week** — calendar icon (blue), count, "vs last week" with % change arrow
2. **Revenue (30 days)** — dollar icon (green), formatted currency
3. **Total Customers** — users icon (purple), count, "X new this week"
4. **Open Conversations** — message icon (orange), count, "Avg response X mins"

**Middle: Secondary Metrics (3-column grid)**
1. **No-Show Rate** — percentage with progress bar (color: red >15%, amber >5%, green ≤5%)
2. **Avg Response Time** — minutes with status text ("Excellent" ≤5m / "Good" ≤15m / "Needs improvement")
3. **This Week by Status** — color dots + status name + count for each booking status

**Dashboard-Pinned Saved Views (if any exist):**
- 2-4 column grid of clickable cards
- Each card shows: icon, view name, page name
- Click navigates to the page with the saved view filters applied

**Bottom: Two-Column Section**
- **Left: Today's Appointments** — time-ordered list with customer name, service, staff, status badge. Empty state: "No appointments today"
- **Right: Unassigned Conversations** — customer name, last message preview, "Unassigned" orange badge, time ago. Empty state: green checkmark + "All caught up"

---

### 3.4 Calendar (`/calendar`)

**Header:** Date navigation (< Today >), date display, staff filter chips (toggle), Day/Week/Month view toggle, "+ New Booking" button

**Day View:**
- Time gutter (8am–7pm, hourly slots)
- Multiple columns (one per selected staff member)
- Staff column header: name + role
- Booking cards positioned by time, color-coded by status:
  - PENDING=yellow border, CONFIRMED=blue, IN_PROGRESS=green, COMPLETED=gray, CANCELLED=red+strikethrough, NO_SHOW=orange
- Card content: time range, customer name, service name
- Non-working hours shaded gray, time-off periods shaded red with "Time Off" badge
- Draggable booking cards with HTML5 DnD (30-min snap to drop targets, conflict detection, confirmation popover)

**Week View:**
- 7 day columns with abbreviated day names
- Today highlighted in blue
- Compact booking cards with customer name + time
- Non-working hours and time-off visualization

**Month View:**
- 6x7 CSS grid calendar layout
- Colored dots per day: sage=confirmed, lavender=pending, red=cancelled
- Day number + booking count summary
- Click day → drills to day view for that date
- Prev/next month navigation

**Recommended Slots:**
- `RecommendedSlots` component shown during drag-and-drop reschedule
- Top 5 slots scored by proximity to original time + staff workload balance
- Click slot to auto-fill reschedule

**Interactions:**
- Click time slot → BookingFormModal (create)
- Click booking card → BookingDetailModal (view/edit)
- Click "+ New Booking" → BookingFormModal
- Drag booking card → drop on time slot → confirmation popover with conflict check
- Click month day → drill to day view

---

### 3.5 Bookings List (`/bookings`)

**Header:** Title + status filter dropdown (All / each status)

**Saved Views:** ViewPicker pill tabs for saved filter presets + "Save current" button

**Table columns:** Customer | Service | Staff Name | Date/Time | Status badge

**Interactions:** Click row → BookingDetailModal

**Empty state:** BookOpen icon + "No bookings yet" + description

---

### 3.6 Inbox (`/inbox`) — 4-Panel Layout

**Panel 1: Filter Sidebar (w-48)**
- Title "Inbox"
- Filter items with counts: All, Unassigned (orange badge), Mine, Overdue (red badge), Waiting, Snoozed (purple badge), Closed

**Panel 2: Conversation List (w-80)**
- Search box with clear button
- Per conversation: overdue red dot, customer name, "New" blue badge, last message preview, status badge, assigned staff, time ago, first 3 tags

**Panel 3: Message Thread (flex-1)**
- **Header:** Customer name + phone, snooze button, "Resume auto-reply" (purple), close conversation, "+ New Booking", presence pills (who else is viewing)
- **Messages:** Inbound (left, white/border), Outbound (right, blue bg/white text), timestamps, staff name labels, delivery status indicators (sent/delivered/read checkmarks), media attachments (inline images, document links, audio players)
- **AI Suggestions section:** Purple-to-blue gradient bg, intent badge (color-coded), editable textarea, Send/Dismiss buttons
- **Composer:** Template menu (Files icon), quick replies toggle (Zap icon), media attachment button (paperclip icon, `MediaComposer`), auto-expanding textarea, Send button

**Panel 4: Info Sidebar (w-72)**
Two tabs: **Info** | **Notes**

**Info tab:**
- Customer avatar circle + name + phone + email
- Customer tags (removable badges + add input)
- AI Summary (purple sparkles icon, refresh button)
- AI Booking/Cancel/Reschedule Panel (step progress, confirm/dismiss)
- Conversation tags (editable)
- Assigned To dropdown ("Assign to me" link)
- Snoozed Until display
- Upcoming Bookings (max 3)

**Notes tab:**
- Notes list (yellow sticky style: content + staff name + timestamp + delete)
- Add note textarea + "Add Note" button

**Real-time events via Socket.io:** new messages, conversation updates, AI suggestions, auto-replies, booking updates, AI transfer to human

---

### 3.7 Customers (`/customers`)

**Header:** Title, "X total customers" subtitle, Import button, "+ Add Customer" button

**Search bar:** Text input + search button (live search)

**Table columns:** Name | Phone | Email | Tags (blue badges) | Date Created

**Click row** → navigates to `/customers/{id}`

**Modals:**
- CustomerForm: Name, Phone, Email inputs
- ImportModal: CSV upload (drag-drop + preview), Conversation import (with AI), Export CSV

---

### 3.8 Customer Detail (`/customers/{id}`) — Customer Hub

**Header:** Back button, customer name (large), "Since {date}" subtitle, "Message" button + "+ New Booking" button

**Context Row:** Last booking date, last conversation date, conversation count, active waitlist count

**3-Column Layout:**

**Left Column (1/3):**
1. Contact Info card (name, phone, email, address) with edit button
2. Tags card (removable tags + add input)
3. Quick Stats card: total bookings, total spent, upcoming, no-shows (red if >0)
4. Next Appointment card (if exists): date, time, service, staff

**Right Column (2/3) — Tabbed card (5 tabs):**

**AI Chat tab:**
- Chat interface with user messages (right/sage) and AI responses (left/gray)
- 4 prompt chips: "Summarize customer...", "What treatments...", "Upcoming appointments...", "Any allergies..."
- Chat input with send button

**Timeline tab:**
- `CustomerTimeline` component — unified activity feed from 6 sources
- Filter chips: All, Bookings, Messages, Notes, Waitlist, Quotes, Campaigns
- System events toggle
- Deep links to booking detail, inbox with conversationId, campaigns
- Load more pagination

**Bookings tab:**
- Upcoming section + History section
- Each booking: date+time, service, staff+price, status badge

**Notes tab:**
- Composer textarea + "Add Note" button
- Yellow sticky note cards: content, author, timestamp, edit/delete (owner only)

**Details tab:**
- Grid: full name, phone, email, customer since, tags, custom fields
- Edit modal: name, email, tags (comma-separated), custom fields (boolean=checkbox, select=dropdown, text=input)

**Vertical Modules (below main grid):**
- Collapsible section with ChevronDown toggle
- Aesthetic pack (`pack.slug === 'aesthetic'`): `IntakeCard` with clinic intake fields
- Dealership pack (`pack.slug === 'dealership'`): Quotes summary (pending/approved/total), quote rows with status badges

---

### 3.9 Services (`/services`)

**Header:** Title, "X active services" subtitle, "Show inactive" checkbox, "+ Add Service" button

**Grouped by category:** Each category section header → 3-column responsive grid of service cards

**Service card:**
- Name (bold)
- Description (2-line truncated)
- Badges: "Inactive" (red), "Deposit Required" (amber)
- Duration (clock icon) + Price (dollar icon, or "Free")
- Buffer times (if set): timer icon + "X mins before/after"
- Edit button (pencil)

**ServiceForm modal:** Name, Description textarea, Duration (min 5, step 5), Price (decimal), Category text, Buffer Before/After, Deposit Required checkbox, Deactivate/Reactivate toggle

---

### 3.10 Staff (`/staff`)

**Header:** Title + "+ Add Staff" button

**Expandable table:**
- Columns: expand arrow | Name | Email | Role badge | Status badge
- Role badges: ADMIN=lavender, SERVICE_PROVIDER=sage, AGENT=slate
- Status: Active=green, Inactive=red, "Invite Pending" with resend/revoke

**Expanded row tabs:**

**Working Hours tab:** Per day (Sun–Sat): day name, Working/Off toggle, start time + end time pickers, Save button

**Time Off tab:** Existing entries (date range + reason + delete button), Add form (start date + end date + reason + Add button), count badge

**StaffForm modal:** Name, Email, Password, Role dropdown (Agent/Service Provider/Admin)

---

### 3.11 Reports (`/reports`)

**Header:** Title + period selector buttons (7 days | 30 days | 90 days)

**Summary cards (4-column):** Total Bookings, Revenue, No-Show Rate (color-coded), Avg Response Time (color-coded)

**Charts (2-column rows):**
1. Bookings Over Time (area chart, blue) | Revenue Over Time (area chart, green)
2. Service Popularity (horizontal bar list with booking count + revenue) | Status Breakdown (donut chart with legend)

**Staff Performance table:** Staff Name | Total Bookings | Completed | No-Shows | No-Show Rate (badge) | Revenue

**Peak Hours (if data):** Bookings by Hour (bar chart, 7am–8pm) | Bookings by Day (bar chart, Mon–Sun)

---

### 3.12 Settings (`/settings`)

**Settings Home:**
- Business Info card: name, phone, timezone (read-only), vertical pack (read-only), Save button
- Change Password card: current password, new password, confirm password
- Quick Links grid (cards with icons linking to sub-pages):
  Message Templates, Translations, Profile Fields, AI Settings, AI Autonomy, Agent Skills, Account & Import, Notifications, Billing, Calendar, Offers, Policies, Waitlist Settings, Setup Wizard

#### AI Settings (`/settings/ai`)
- Master toggle: Enable AI Assistance
- Auto Reply Suggestions toggle
- Booking Assistant toggle
- Auto-Reply section: enable toggle → mode radio (all / selected intents) → intent checkboxes (GENERAL_INQUIRY, BOOK_APPOINTMENT, CANCEL_APPOINTMENT, RESCHEDULE_APPOINTMENT)
- AI Personality textarea

#### Templates (`/settings/templates`)
- Category filter buttons with counts: ALL | CONFIRMATION | REMINDER | FOLLOW_UP | CANCELLATION | CONSULT_FOLLOW_UP | AFTERCARE | TREATMENT_CHECK_IN | DEPOSIT_REQUIRED | RESCHEDULE_LINK | CANCEL_LINK | CUSTOM
- Template cards: name, category badge, body in code box, variable badges
- Preview toggle: shows resolved template with sample data; unresolved {{vars}} show amber warning badge + red highlight
- TemplateForm modal: name, category dropdown, body textarea (monospace), variable insertion buttons, detected variables display (green=recognized, orange=unknown), live preview

#### Translations (`/settings/translations`)
- Locale buttons (English | Espanol)
- Search box (searches keys + defaults + overrides)
- Filter: "Show all" / "Show overrides only" with override count
- Grouped table by section (common, dashboard, inbox, etc.)
- Per row: key (code style), English default, current value with inline edit, reset button for overrides

#### Profile Fields (`/settings/profile-fields`)
- Two sections: Basic Fields, Medical Fields
- Per field: label, type indicator, required checkbox
- Fields: firstName, lastName, email, dateOfBirth, address, allergies, medicalNotes, emergencyContact

#### Account & Import (`/settings/account`)
- CSV Import: drag-drop zone, preview table (10 rows), Import button, result counts
- Conversation Import: "Include messages" checkbox, Generate Profiles button, result counts
- Export: "Export as CSV" button

#### Calendar Sync (`/settings/calendar`)
- Google Calendar connection management
- Connect/disconnect buttons per provider
- iCal feed URL generation and regeneration

#### Billing (`/settings/billing`)
- Stripe subscription management (Basic/Pro plans)
- Checkout, customer portal links

#### Notifications (`/settings/notifications`)
- Channel preferences (WhatsApp, email, or both)
- Follow-up delay hours, consult follow-up days, treatment check-in hours

#### Offers (`/settings/offers`)
- Offers CRUD: name, description, terms, applicable services, validity dates, max redemptions
- Active/inactive toggle

#### Policies (`/settings/policies`)
- Cancellation window (hours before appointment)
- Reschedule window (hours before appointment)
- Policy copy text shown to customers

#### Waitlist Settings (`/settings/waitlist`)
- Max offers per cancellation
- Offer expiry time
- Quiet hours (start/end)

#### Agent Settings (`/settings/agents`)
- Per-agent configuration for 5 background agents (waitlist, retention, data-hygiene, scheduling-optimizer, quote-followup)
- Enable/disable toggle per agent type
- Schedule configuration (cron expression or interval)
- Autonomy level selector per agent (OFF/SUGGEST/AUTO_WITH_REVIEW/FULL_AUTO)
- Agent performance summary: run history, success rates, staff feedback stats
- Saves to `AgentConfig` model (unique per businessId + agentType)

#### Autonomy Settings (`/settings/autonomy`)
- Per-action-type autonomy level configuration
- `AutonomySettings` component with list of action types
- `AutonomyLevelPicker` — visual selector for autonomy levels (OFF / SUGGEST / AUTO_WITH_REVIEW / FULL_AUTO)
- Approval threshold configuration (e.g., require approval above certain amount)
- Cooldown minutes and notification toggles per action type
- Saves to `AutonomyConfig` model (unique per businessId + actionType)

---

### 3.13 Waitlist (`/waitlist`)

**Header:** Title + entry count

**Table columns:** Customer | Service | Preferred Staff | Date Range | Time Window | Status badge | Actions

**Features:**
- Filter by status (ACTIVE, OFFERED, BOOKED, EXPIRED, CANCELLED)
- Resolve entries manually
- Dashboard metrics card: total entries, offers sent, claimed, fill rate, avg time to claim
- Onboarding tooltip for first-time users

---

### 3.14 Automations (`/automations`)

**Built-in Playbooks section:**
- 3 playbook cards (No-Show Prevention, Consult Conversion, Re-engagement)
- Each shows: name, description, "what will happen" summary, toggle on/off

**Custom Rules section:**
- Rules table: name, trigger badge, active toggle, actions
- "+ New Rule" button → `/automations/new`

**Activity Log section:**
- Searchable, filterable log of automation executions
- Per entry: rule name, customer, action, outcome badge (SENT/SKIPPED/FAILED), timestamp

**New Automation page (`/automations/new`):**
- 4-step wizard: Trigger → Filters → Actions → Review
- 6 trigger types with descriptions
- Filter options vary by trigger
- Action: SEND_TEMPLATE with template picker
- Safety settings: quiet hours, frequency cap

---

### 3.15 Campaigns (`/campaigns`)

**Campaign List:**
- Table: name, status badge (DRAFT/SCHEDULED/SENDING/SENT/CANCELLED), audience size, send stats, created date
- "+ New Campaign" button

**Campaign Detail (`/campaigns/[id]`):**
- Stats grid: total sends, delivered, read, failed, booking conversions
- Campaign config summary
- Send log table

**New Campaign (`/campaigns/new`):**
- 4-step wizard: Audience → Template → Schedule → Review
- Audience step: segment filters (tags, last booking, service kind, no upcoming, exclude do-not-message), live preview count + sample names
- Template step: template picker with variable preview
- Schedule step: send now or schedule, throttle rate (messages/minute)
- Review step: summary of all selections

---

### 3.16 ROI Dashboard (`/roi`)

**Tab bar:** Dashboard | Weekly Review

**Dashboard tab:**
- 6 metric cards: No-Show Rate, Consult → Treatment Conversion, Avg Response Time, Revenue, Staff Utilization, Deposit Compliance
- Each shows: current value, baseline value, delta badge (green=improved, red=worsened)
- Recovered Revenue estimate card with "How we calculate this" methodology link

**Weekly Review tab:**
- Week-over-week comparison table (6 metrics × 2 periods)
- Delta badges per metric
- "Email Review" button to send summary to team

---

## 4. Data Models

### 4.1 Entity Relationship Overview (43 Models)

```
Business (1) ──┬── (*) Staff ──── (*) WorkingHours
               │                  ├── (*) TimeOff
               │                  ├── (*) CalendarConnection
               │                  └── (*) StaffLocation ──── Location
               ├── (*) Customer ──── (*) CustomerNote
               ├── (*) Service
               ├── (*) Booking ──── (*) Reminder
               │    │               ├── (*) Payment
               │    │               └── (*) Quote
               │    ├── Location (optional)
               │    └── Resource (optional)
               ├── (*) RecurringSeries
               ├── (*) Conversation ──── (*) Message ──── (*) MessageAttachment
               │    │                    └── (*) ConversationNote
               │    └── Location (optional)
               ├── (*) Location ──── (*) Resource
               ├── (*) MessageTemplate
               ├── (*) Translation
               ├── (1) Subscription
               ├── (*) AiUsage
               ├── (*) Token
               ├── (*) RoiBaseline
               ├── (*) WaitlistEntry
               ├── (*) AutomationRule ──── (*) AutomationLog
               ├── (*) Campaign ──── (*) CampaignSend
               ├── (*) Offer ──── (*) OfferRedemption
               ├── (*) SavedView
               ├── (*) VerticalPackVersion
               ├── (*) ActionCard ──── (*) ActionHistory
               ├── (*) AutonomyConfig
               ├── (*) OutboundDraft
               ├── (*) AgentConfig
               ├── (*) AgentRun ──── (*) AgentFeedback
               └── (*) DuplicateCandidate
```

### 4.2 Key Models

#### Business
| Field | Type | Notes |
|-------|------|-------|
| name | String | Business display name |
| slug | String (unique) | URL-friendly identifier |
| phone | String? | Business phone |
| timezone | String | Default: "UTC" |
| verticalPack | String | "aesthetic", "salon", "tutoring", "general" |
| packConfig | JSON | Business-specific settings (requiredProfileFields, requireConsultation, etc.) |
| defaultLocale | String | "en" or "es" |
| aiSettings | JSON | AI configuration (enabled, autoReply, personality, etc.) |

#### Staff
| Field | Type | Notes |
|-------|------|-------|
| name | String | Display name |
| email | String (unique) | Login email |
| passwordHash | String? | Null = invite pending |
| role | String | "ADMIN", "SERVICE_PROVIDER", "AGENT" |
| locale | String? | Staff language preference |
| preferences | JSON | Mode/landing prefs `{ mode, landingPath }` |
| isActive | Boolean | Soft delete |

#### Customer
| Field | Type | Notes |
|-------|------|-------|
| name | String | Customer name |
| phone | String | Phone number (unique per business) |
| email | String? | Optional email |
| tags | String[] | Custom tags (VIP, Regular, New, etc.) |
| customFields | JSON | Flexible profile data (allergies, medicalNotes, etc.) |

#### Service
| Field | Type | Notes |
|-------|------|-------|
| name | String | Service name |
| durationMins | Int | Duration in minutes |
| price | Float | Price (0 = free) |
| category | String | Grouping category |
| isActive | Boolean | Soft delete |
| depositRequired | Boolean | Requires deposit |
| depositAmount | Float? | Deposit amount |
| bufferBefore | Int | Buffer minutes before |
| bufferAfter | Int | Buffer minutes after |

#### Booking
| Field | Type | Notes |
|-------|------|-------|
| customerId | FK | Customer reference |
| serviceId | FK | Service reference |
| staffId | FK? | Optional staff assignment |
| conversationId | FK? | Optional conversation link |
| status | String | PENDING/CONFIRMED/IN_PROGRESS/COMPLETED/CANCELLED/NO_SHOW |
| startTime | DateTime | Appointment start |
| endTime | DateTime | Auto-calculated from service duration |
| notes | String? | Booking notes |
| Indexes | | [businessId], [businessId, startTime], [businessId, status] |

#### Conversation
| Field | Type | Notes |
|-------|------|-------|
| customerId | FK | Customer reference |
| assignedToId | FK? | Assigned staff |
| channel | String | "WHATSAPP" or "WEB" |
| status | String | OPEN/WAITING/RESOLVED/SNOOZED |
| lastMessageAt | DateTime? | For ordering/SLA |
| snoozedUntil | DateTime? | Snooze expiry |
| tags | String[] | Conversation tags |
| metadata | JSON | AI state, drafts, booking state |

#### Message
| Field | Type | Notes |
|-------|------|-------|
| direction | String | "INBOUND" or "OUTBOUND" |
| senderStaffId | FK? | Null for inbound |
| content | String | Message body |
| contentType | String | TEXT/IMAGE/DOCUMENT/AUDIO |
| externalId | String? | WhatsApp message ID |
| deliveryStatus | String? | SENT/DELIVERED/READ/FAILED (UX Upgrade Pack R1) |
| deliveredAt | DateTime? | Timestamp when delivered (UX Upgrade Pack R1) |
| readAt | DateTime? | Timestamp when read (UX Upgrade Pack R1) |
| failureReason | String? | Delivery failure reason (UX Upgrade Pack R1) |

#### MessageAttachment (New — UX Upgrade Pack R1)
| Field | Type | Notes |
|-------|------|-------|
| id | String (CUID) | Primary key |
| messageId | FK | Parent message |
| businessId | FK | Tenant isolation |
| fileName | String | Original file name |
| fileType | String | MIME type (image/jpeg, application/pdf, etc.) |
| fileSize | Int | File size in bytes |
| storageKey | String | Storage path/key for the file |
| thumbnailKey | String? | Storage path/key for thumbnail (images) |
| createdAt | DateTime | Upload timestamp |

#### SavedView
| Field | Type | Notes |
|-------|------|-------|
| id | String (CUID) | Primary key |
| businessId | FK | Parent business |
| staffId | FK? | Creator (null = shared business-level) |
| page | String | "inbox", "bookings", "customers", "waitlist" |
| name | String | Display name |
| filters | JSON | Serialized filter state (page-specific) |
| icon | String? | Lucide icon name (flag, bell, star, etc.) |
| color | String? | Color key (sage, lavender, amber) |
| isPinned | Boolean | Appears in sidebar |
| isDashboard | Boolean | Appears on Mission Control dashboard |
| isShared | Boolean | Visible to all staff (admin-controlled) |
| sortOrder | Int | Display ordering |

#### Other Models
- **CustomerNote:** customerId, staffId, businessId, content, createdAt, updatedAt (staff ownership validated for edit/delete)
- **Reminder:** bookingId, templateId, scheduledAt, sentAt, status (PENDING/SENT/FAILED/CANCELLED), type (REMINDER/CONSULT_FOLLOW_UP/AFTERCARE/TREATMENT_CHECK_IN)
- **MessageTemplate:** name, category (11 types), body (with {{variables}}), variables[]
- **WorkingHours:** staffId, dayOfWeek (0-6), startTime/endTime ("HH:mm"), isOff
- **TimeOff:** staffId, startDate, endDate, reason
- **Translation:** locale, key, value (per business overrides)
- **Subscription:** stripeCustomerId, stripeSubscriptionId, plan (basic/pro), status (active/past_due/canceled/trialing)
- **Payment:** bookingId, stripePaymentIntentId, amount, currency, status (pending/succeeded/failed/refunded)
- **AiUsage:** date, count (daily tracking)
- **Token:** token (unique), type (PASSWORD_RESET/STAFF_INVITE/RESCHEDULE_LINK/CANCEL_LINK/EMAIL_VERIFY), email, expiresAt, usedAt
- **RoiBaseline:** goLiveDate, baselineStart/End, metrics (JSON)
- **CalendarConnection:** staffId, provider (google/outlook), accessToken/refreshToken (encrypted AES-256-GCM), icalFeedToken, syncEnabled
- **RecurringSeries:** customerId, serviceId, staffId, timeOfDay, daysOfWeek[], intervalWeeks, totalCount, endsAt
- **WaitlistEntry:** customerId, serviceId, staffId, timeWindow, dateRange, status (ACTIVE/OFFERED/BOOKED/EXPIRED/CANCELLED), offeredSlot (JSON), claimedAt
- **AutomationRule:** name, trigger (6 types), filters (JSON), actions (JSON), isActive, playbook, quietStart/End, maxPerCustomerPerDay
- **AutomationLog:** automationRuleId, bookingId, customerId, action, outcome (SENT/SKIPPED/FAILED), reason
- **Campaign:** name, status (DRAFT/SCHEDULED/SENDING/SENT/CANCELLED), templateId, filters (JSON), throttlePerMinute, stats (JSON)
- **CampaignSend:** campaignId, customerId, status (PENDING/SENT/DELIVERED/READ/FAILED), sentAt, bookingId (attribution)
- **Offer:** name, description, terms, serviceIds[], validFrom/Until, isActive, maxRedemptions, currentRedemptions
- **ActionCard:** businessId, type (DEPOSIT_PENDING/OVERDUE_REPLY/OPEN_SLOT/etc.), category (URGENT_TODAY/NEEDS_APPROVAL/OPPORTUNITY/HYGIENE), priority (0-100 int), title, description ("Because..." text), suggestedAction, preview (JSON diff), ctaConfig (JSON buttons), status (PENDING/APPROVED/DISMISSED/SNOOZED/EXECUTED/EXPIRED), autonomyLevel (OFF/ASSISTED/AUTO), snoozedUntil, expiresAt, bookingId?, customerId?, conversationId?, staffId?, resolvedById?, metadata — Agentic action recommendations
- **ActionHistory:** businessId, actorType (STAFF/AI/SYSTEM/CUSTOMER), actorId?, actorName?, action (BOOKING_CREATED/CARD_APPROVED/etc.), entityType (BOOKING/CONVERSATION/CUSTOMER/ACTION_CARD/SETTING), entityId, description?, diff (JSON before/after), metadata — Unified polymorphic audit trail
- **AutonomyConfig:** businessId, actionType (unique per biz), autonomyLevel (OFF/ASSISTED/AUTO), requiredRole?, constraints (JSON {maxPerDay, maxAmount}) — Per-action-type autonomy configuration
- **OutboundDraft:** businessId, customerId (FK), staffId (FK), channel (WHATSAPP), content, status (DRAFT/APPROVED/SENT/REJECTED), approvedById?, sentAt?, conversationId? — Staff-initiated outbound message drafts
- **AgentConfig:** businessId, agentType (WAITLIST/RETENTION/DATA_HYGIENE/SCHEDULING_OPTIMIZER/QUOTE_FOLLOWUP), isEnabled, autonomyLevel (AUTO/SUGGEST/REQUIRE_APPROVAL), config (JSON), roleVisibility (String[]) — Per-business agent configuration
- **AgentRun:** businessId, agentType, status (RUNNING/COMPLETED/FAILED), cardsCreated (Int), error?, startedAt, completedAt — Agent execution run tracking
- **AgentFeedback:** businessId, actionCardId (FK), staffId (FK), rating (HELPFUL/NOT_HELPFUL), comment? — Staff feedback on agent suggestions
- **DuplicateCandidate:** businessId, customerId1 (FK), customerId2 (FK), confidence (Float), matchFields (String[]), status (PENDING/MERGED/NOT_DUPLICATE/SNOOZED), resolvedBy?, resolvedAt — Duplicate customer detection candidates

---

## 5. Key User Flows

### 5.1 New Business Onboarding
1. Sign up (business name, owner info) → redirect to setup wizard
2. 9-step wizard: business info → WhatsApp → staff → services → hours → templates → profile fields → import customers → finish
3. Redirect to dashboard

### 5.2 Booking Creation (Manual)
1. Click "+ New Booking" (from calendar, customer detail, or inbox)
2. Select customer, service, optional staff
3. Pick date → system fetches available time slots
4. Select time slot → add optional notes
5. Submit → booking created with CONFIRMED status + 24h reminder auto-scheduled

### 5.3 AI-Assisted Booking (via Chat)
1. Customer sends message via WhatsApp
2. AI detects booking intent → shows booking panel in sidebar
3. AI guides through steps: service → date → time → confirm
4. If customer profile incomplete → AI collects missing required fields
5. On confirmation → booking auto-created, confirmation message sent

### 5.4 Conversation Management
1. Inbound message creates/reopens conversation
2. Appears in Inbox with AI draft suggestion
3. Agent can: send AI draft, edit and send, write own reply, assign to staff
4. Agent can: snooze (with timer), add tags, add notes, close (resolve)
5. AI auto-reply can handle messages automatically (configurable per intent)

### 5.5 Customer Journey
1. First contact: customer auto-created from phone number
2. Profile enriched via: AI extraction from messages, manual edit, import
3. Required profile fields collected by AI before booking confirmation
4. Customer detail page: AI chat, booking history, stats, tags, custom fields

---

## 6. AI Features

### 6.1 AI Draft Suggestions
- Shown in purple-to-blue gradient box in message composer area
- Displays: intent badge (color-coded), confidence level, editable draft text
- Agent can send as-is, edit, or dismiss

### 6.2 AI Auto-Reply
- Configurable: all messages or selected intents only
- Intents: GENERAL_INQUIRY, BOOK_APPOINTMENT, CANCEL_APPOINTMENT, RESCHEDULE_APPOINTMENT
- When active, AI responds automatically without agent intervention
- "Resume auto-reply" purple button appears when human takes over

### 6.3 AI Booking Panel
- Displayed in inbox sidebar during booking flow
- Three modes with color themes:
  - **Book:** purple, 4 steps (service → date → time → confirm)
  - **Cancel:** red, 2 steps (identify → confirm)
  - **Reschedule:** orange, 4 steps (identify → new date → new time → confirm)
- Progress bar, info rows (label + value), step counter

### 6.4 AI Customer Chat
- On customer detail page, "AI Chat" tab
- Natural language Q&A about the customer
- Pre-filled prompt chips for common queries
- Conversation-style interface

### 6.5 AI Conversation Summary
- Purple sparkles icon in inbox sidebar
- Auto-generated summary of conversation
- Refresh button to regenerate

### 6.6 AI Profile Collection
- When required profile fields are missing during booking
- AI conversationally asks for 1-2 fields at a time
- Collected data saved to customer customFields
- Booking proceeds once all required fields collected

---

## 7. Internationalization

### Supported Locales
- **en** (English) — 589 translation keys
- **es** (Spanish) — complete translation

### Translation Sections
common, app, nav, login, dashboard, inbox, calendar, bookings, customers, customer_detail, services, staff, days, days_short, reports, settings, translations, templates, setup, ai, import, status, errors

### Features
- Per-business translation overrides (stored in DB)
- Variable interpolation: `{{variable}}`
- Dynamic entity labels per vertical pack (Customer/Client, Booking/Appointment, Service/Treatment)
- Staff locale preference persistence
- Language picker in sidebar footer (Globe icon)

---

## 8. Real-Time Features (Socket.io)

Events handled in the inbox:
- `message:new` — new inbound/outbound message
- `message:status` — delivery/read receipt update (sent → delivered → read)
- `conversation:updated` — status, assignment changes
- `ai:suggestion` — AI draft suggestion ready
- `ai:auto-replied` — AI sent an auto-reply (clears draft)
- `ai:transfer-to-human` — AI escalated to human agent
- `booking:updated` — booking status change
- `ai:booking-state` — AI booking assistant state update
- `viewing:start` / `viewing:stop` — presence tracking (staff viewing conversation)
- `presence:update` — presence indicator refresh for collision detection

---

## 9. Current UI Characteristics (As-Is)

### Strengths
- **Minimalist Premium** aesthetic with custom brand palette (sage/lavender)
- **Custom typography** — Inter for UI, Playfair Display for headers
- Clean, minimal layout with clear information hierarchy and generous whitespace
- Consistent use of Tailwind utilities with `cn()` class merging
- Muted pastel status badges instead of generic traffic-light colors
- Soft diffused shadows (`shadow-soft`) instead of borders
- **Full dark mode** with system preference detection and manual override
- **CSS animations** on modals, command palette, and transitions (prefers-reduced-motion respected)
- **Onboarding tooltips** and contextual coaching nudges
- **Enhanced empty states** with icons, explanations, and action CTAs
- **Brand-themed charts** using sage/lavender Recharts theme
- Real-time updates in inbox via Socket.io
- Responsive grid layouts
- Comprehensive feature set across 46 pages

### Remaining Opportunities
- **No third-party component library** — all components hand-built, some inconsistency possible
- **Calendar is custom-built** — functional but could benefit from polish
- **Mobile responsiveness** — grid-based but not optimized for mobile-first
- **No illustrations** — empty states use icons only, no custom illustrations
- **Accessibility** — focus traps on modals, but full ARIA audit not yet done

---

## 10. File Structure Reference

```
apps/web/src/
├── app/
│   ├── globals.css
│   ├── layout.tsx
│   ├── page.tsx                          # Root/home
│   ├── login/page.tsx
│   ├── signup/page.tsx
│   ├── forgot-password/page.tsx
│   ├── reset-password/page.tsx
│   ├── verify-email/page.tsx
│   ├── accept-invite/page.tsx
│   ├── setup/page.tsx                    # 10-step onboarding wizard
│   ├── dashboard/
│   │   ├── page.tsx
│   │   └── components/        # KpiStrip, MyWork, AttentionCards (UX Phase 1)
│   ├── calendar/page.tsx
│   ├── bookings/page.tsx
│   ├── inbox/page.tsx                  # 4-pane messaging with deep linking
│   ├── customers/page.tsx
│   ├── customers/[id]/page.tsx         # Customer Hub (timeline, notes, vertical modules)
│   ├── search/page.tsx                 # Full search results with type filters
│   ├── services/page.tsx
│   ├── staff/page.tsx
│   ├── reports/page.tsx
│   ├── roi/page.tsx                      # ROI dashboard + weekly review
│   ├── waitlist/page.tsx                 # Waitlist management
│   ├── automations/page.tsx              # Playbooks + custom rules + log
│   ├── automations/new/page.tsx          # Rule builder wizard
│   ├── campaigns/page.tsx                # Campaign list
│   ├── campaigns/new/page.tsx            # Campaign builder wizard
│   ├── campaigns/[id]/page.tsx           # Campaign detail/stats
│   ├── book/[slug]/page.tsx              # Public booking portal
│   ├── manage/reschedule/[token]/page.tsx
│   ├── manage/cancel/[token]/page.tsx
│   ├── manage/claim/[token]/page.tsx     # Waitlist claim
│   ├── settings/page.tsx
│   ├── settings/ai/page.tsx
│   ├── settings/account/page.tsx
│   ├── settings/templates/page.tsx
│   ├── settings/translations/page.tsx
│   ├── settings/profile-fields/page.tsx
│   ├── settings/calendar/page.tsx        # Google Calendar sync
│   ├── settings/billing/page.tsx         # Stripe subscriptions
│   ├── settings/notifications/page.tsx
│   ├── settings/offers/page.tsx          # Promotions
│   ├── settings/policies/page.tsx        # Cancel/reschedule policies
│   ├── settings/waitlist/page.tsx        # Waitlist config
│   ├── settings/autonomy/page.tsx       # Autonomy level configuration (Milestone 1)
│   └── settings/agents/page.tsx        # Background agent configuration (Milestone 4)
├── components/
│   ├── shell.tsx              # App layout + mode-grouped sidebar nav + pinned views + Cmd+K
│   ├── skeleton.tsx           # Loading skeletons + empty states with CTAs
│   ├── error-boundary.tsx     # Error catching
│   ├── ai-summary.tsx         # AI conversation summary
│   ├── ai-suggestions.tsx     # AI draft response
│   ├── ai-booking-panel.tsx   # AI booking assistant UI
│   ├── booking-form-modal.tsx # Create/reschedule booking
│   ├── booking-detail-modal.tsx # View/manage booking + notification timeline
│   ├── clinic-intake-card.tsx # Aesthetics intake fields (Phase 1)
│   ├── command-palette.tsx    # Cmd+K global search with grouped results (Phase 2 + Bundle B)
│   ├── customer-timeline.tsx  # Unified timeline (6 event types, filters, pagination) (Bundle B)
│   ├── bulk-action-bar.tsx    # Multi-select action bar (Phase 2)
│   ├── tooltip-nudge.tsx      # Contextual coaching tooltips (Phase 2)
│   ├── mode-switcher.tsx      # Role-based mode pill/tab selector (UX Phase 1)
│   ├── saved-views/           # ViewPicker + SaveViewModal (UX Phase 1)
│   ├── action-card/           # ActionCardList, ActionCardItem, ActionCardDetail, ActionCardBadge, ActionCardFilters — contextual CTA labels per card type (Milestone 1)
│   ├── action-history/        # ActionHistoryList, ActionHistoryItem, ActionHistoryFilters (Milestone 1)
│   ├── autonomy/              # AutonomySettings, AutonomyLevelPicker (Milestone 1)
│   ├── outbound/              # OutboundCompose, OutboundDraftList (Milestone 1)
│   ├── recent-changes-panel.tsx # RecentChangesPanel for customer detail (Milestone 1)
│   ├── briefing/              # BriefingCard, OpportunityCard, BriefingFeed (Milestone 2)
│   ├── action-card-inline.tsx # Inline action card for conversation-level actions (Milestone 3)
│   ├── deposit-card.tsx       # Deposit-related action card with policy compliance (Milestone 3)
│   ├── human-takeover-banner.tsx # AI-to-human escalation banner with clarification (Milestone 3)
│   ├── agent-feedback/          # AgentFeedbackButtons, AgentPerformance (Milestone 4)
│   ├── retention-card.tsx       # Win-back action card for at-risk customers (Milestone 4)
│   ├── duplicate-merge-card.tsx # Duplicate customer merge/dismiss card (Milestone 4)
│   ├── waitlist-match-card.tsx  # Waitlist auto-match opportunity card (Milestone 5)
│   ├── quote-followup-card.tsx  # Quote follow-up action card (Milestone 5)
│   ├── skill-card.tsx           # Agent skill catalog display with enable/disable (Milestone 5)
│   ├── vertical-launch-checklist.tsx # Vertical-specific agent readiness checklist (Milestone 5)
│   ├── ai-state-indicator.tsx   # Real-time agent processing status indicator (Milestone 5)
│   ├── inbox/
│   │   ├── delivery-status.tsx  # Message delivery/read receipt indicators (UX Upgrade Pack R1)
│   │   ├── media-message.tsx    # Media attachment display in messages (UX Upgrade Pack R1)
│   │   └── media-composer.tsx   # Media file attachment composer (UX Upgrade Pack R1)
│   ├── recommended-slots.tsx    # Recommended reschedule slots component (UX Upgrade Pack R1)
│   ├── export-modal.tsx         # CSV export modal with date range + field selection (UX Upgrade Pack R2)
│   └── language-picker.tsx    # Locale selector
├── lib/
│   ├── api.ts                 # API client singleton
│   ├── auth.tsx               # Auth context + hooks
│   ├── cn.ts                  # Class merge utility
│   ├── i18n.tsx               # I18n context + hooks
│   ├── toast.tsx              # Toast notifications
│   ├── vertical-pack.tsx      # Pack configuration
│   ├── use-socket.ts          # WebSocket hook
│   ├── use-theme.ts           # Dark mode hook (Phase 2)
│   ├── use-mode.tsx           # Mode context + provider (UX Phase 1)
│   ├── mode-config.ts         # Mode definitions + helpers (UX Phase 1)
│   ├── use-focus-trap.ts      # Accessibility focus management
│   ├── chart-theme.ts         # Recharts brand theme (Phase 2)
│   ├── phase1.ts              # Phase 1 feature flags
│   └── public-api.ts          # Public booking portal API client
└── locales/
    ├── en.json                # English (600+ keys)
    └── es.json                # Spanish (600+ keys)
```
