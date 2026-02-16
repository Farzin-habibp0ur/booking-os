# Booking OS — Complete Product & UI Documentation

> **Purpose:** This document provides a comprehensive reference of the entire Booking OS application — its features, pages, components, data models, design system, and user flows. Use it as context for generating high-fidelity UI designs and exploring UX improvements.

---

## 1. Product Overview

**Booking OS** is a multi-tenant SaaS platform for service-based businesses (aesthetic clinics, salons, tutoring centers) to manage bookings, customer conversations, and operations — with AI-powered automation.

### Core Capabilities
- **Appointment scheduling** with calendar views, conflict detection, and reminders
- **WhatsApp messaging inbox** with real-time updates and AI auto-replies
- **AI booking assistant** that guides customers through booking via chat
- **Customer management** with profiles, tags, import/export, and AI chat
- **Staff management** with roles, working hours, time off, and invitations
- **Service catalog** with categories, pricing, durations, and deposit requirements
- **Analytics & reports** with charts for bookings, revenue, staff performance
- **Multi-language support** (English, Spanish) with customizable translations
- **Billing integration** via Stripe (basic/pro plans)
- **Vertical packs** — industry-specific configurations (aesthetic, salon, tutoring, general)

### Tech Stack
| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15, React 19, TypeScript |
| Styling | Tailwind CSS (utility-first, minimal custom config) |
| Icons | lucide-react v0.468 |
| Charts | Recharts v2.15 |
| Real-time | Socket.io |
| Backend | NestJS, TypeScript |
| Database | PostgreSQL + Prisma ORM |
| AI | Claude API (Anthropic) |
| Payments | Stripe |
| Monitoring | Sentry |

### Default Seed Data (Demo Account)
- **Business:** Glow Aesthetic Clinic
- **Login:** sarah@glowclinic.com / password123
- **Staff:** Dr. Sarah Chen (Admin), Maria Garcia (Agent), Dr. Emily Park (Service Provider)
- **Services:** Botox ($350/30min), Dermal Filler ($500/45min), Chemical Peel ($200/60min), Microneedling ($275/45min), Consultation (Free/20min)
- **Customers:** Emma Wilson (VIP), James Thompson (New, latex allergy), Sofia Rodriguez (Regular)

---

## 2. Design System

### 2.1 Color Palette

**Brand Colors (Blue)**
| Token | Hex | Usage |
|-------|-----|-------|
| brand-50 | #f0f7ff | Active nav background, light highlights |
| brand-100 | #e0effe | Hover states, selected items |
| brand-500 | #3b82f6 | Secondary buttons, links |
| brand-600 | #2563eb | Primary buttons, CTAs |
| brand-700 | #1d4ed8 | Active nav text, button hover |

**Status Colors**
| Status | Background | Text | Usage |
|--------|-----------|------|-------|
| PENDING | yellow-100 | yellow-800 | Awaiting confirmation |
| CONFIRMED | green-100 | green-800 | Confirmed bookings |
| IN_PROGRESS | blue-100 | blue-800 | Currently in session |
| COMPLETED | gray-100 | gray-800 | Finished |
| CANCELLED | red-100 | red-800 | Cancelled bookings |
| NO_SHOW | orange-100 | orange-800 | Customer didn't show |

**Conversation Status Colors**
| Status | Color |
|--------|-------|
| OPEN | green |
| WAITING | yellow |
| SNOOZED | purple |
| RESOLVED | gray |

**Semantic Colors**
| Purpose | Color |
|---------|-------|
| Success | green-600 |
| Error/Danger | red-600 |
| Warning | amber/orange |
| Info | blue-600 |
| AI/Sparkle | purple-500/600 |

**Surfaces**
| Surface | Color |
|---------|-------|
| Page background | gray-50 |
| Cards/Modals | white |
| Modal overlay | black/30 |
| Borders | gray-200 |
| Sidebar | white + border-r |

**Text**
| Level | Color |
|-------|-------|
| Primary | gray-900 |
| Secondary | gray-600 |
| Tertiary/Muted | gray-400–500 |
| Placeholder | gray-400 |

### 2.2 Typography
- **System default fonts** — no custom typefaces configured
- Relies on Tailwind's default font stack (Inter-like system fonts)
- Text sizes: text-xs, text-sm, text-base, text-lg, text-xl, text-2xl used throughout

### 2.3 Component Library
- **No third-party component library** (no shadcn, Radix, Material UI)
- All components are hand-built with Tailwind utility classes
- Class merging via `clsx` + `tailwind-merge` (cn() utility)

### 2.4 Layout Patterns
- **Sidebar navigation:** Fixed 224px (w-56) left sidebar, flex-1 main content
- **Grid layouts:** Responsive grid-cols-1 → md:grid-cols-2 → lg:grid-cols-4
- **Card pattern:** White background, rounded-lg, border border-gray-200, p-4/p-6
- **Page headers:** Title (text-2xl font-bold) + optional subtitle + action buttons

### 2.5 Interactive Patterns

**Buttons**
- Primary: bg-blue-600 text-white hover:bg-blue-700 rounded-lg px-4 py-2
- Secondary: border border-gray-300 text-gray-700 hover:bg-gray-50
- Danger: bg-red-600 text-white hover:bg-red-700
- AI/Purple: bg-purple-600 text-white hover:bg-purple-700
- Disabled: opacity-50 cursor-not-allowed

**Form Inputs**
- border rounded-md px-3 py-2 text-sm, focus:ring-2 focus:ring-blue-500
- Controlled components with useState
- Required fields marked with `*`
- Error display: AlertCircle icon + red-50 bg + red-700 text

**Badges/Pills**
- Status: px-2 py-0.5 rounded-full text-xs font-medium
- Tags: px-2 py-0.5 rounded bg-blue-100 text-blue-700 text-xs
- Role: ADMIN=lavender, SERVICE_PROVIDER=sage, AGENT=slate

**Modals**
- Right drawer: fixed right-0 top-0 h-full w-[480px] z-50, slide from right
- Center modal: fixed inset centered, max-w-lg/xl, max-h-[80vh], z-50
- Overlay: bg-black/30, click to dismiss
- Confirmation dialog: nested absolute overlay within modal

**Toast Notifications**
- Fixed bottom-right, z-[100]
- 3-second auto-dismiss
- Types: success (green), error (red), info (blue)
- Icons: CheckCircle2, AlertCircle, Info
- Slide-in animation from right

### 2.6 Icons
- **Library:** lucide-react
- **Navigation icons:** LayoutDashboard, MessageSquare, Calendar, Users, BookOpen, Scissors, UserCog, BarChart3, Settings, LogOut
- **Action icons:** X, Plus, Pencil, Trash2, Send, RefreshCw, Search, Filter
- **Status icons:** AlertCircle, CheckCircle2, AlertTriangle, Clock, Info
- **AI icons:** Sparkles, Loader2 (spinning)
- **Standard size:** 16-18px in navigation, 14-16px inline, 48px for empty states

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

### 3.2 Setup Wizard (`/setup`) — 9 Steps

A linear onboarding wizard with progress bar. Each step has a title, subtitle, and navigation (Back/Next/Finish).

| Step | Name | What It Contains |
|------|------|-----------------|
| 0 | Business Info | Business name input, timezone dropdown (11 options), currency dropdown (7 options) |
| 1 | Connect WhatsApp | Green info box, Connect WhatsApp button, Skip for now option |
| 2 | Add Staff | Staff list with status/role badges, invite form (name, email, role dropdown), resend invite button |
| 3 | Define Services | Service list (editable/deletable), add service form (name, duration, price), edit mode with inline inputs |
| 4 | Working Hours | Staff member tabs, per-day schedule (Sunday–Saturday), Working/Off toggle + time pickers |
| 5 | Templates | Template list showing name, category badge, body in code box, variable badges |
| 6 | Profile Requirements | Two categories (Basic/Medical), checkbox per field to mark as required, fields: firstName, lastName, email, dateOfBirth, address, allergies, medicalNotes, emergencyContact |
| 7 | Import Customers | Three cards: CSV import (drag-drop + preview table), Conversation import (with AI profile generation), Manual import (link to customers page) |
| 8 | Test & Finish | 4 stat cards (staff/services/templates/ready), Open Simulator button, Go to Dashboard button |

---

### 3.3 Dashboard (`/dashboard`)

**Top: Metric Cards (4-column grid)**
1. **Bookings This Week** — calendar icon (blue), count, "vs last week" with % change arrow
2. **Revenue (30 days)** — dollar icon (green), formatted currency
3. **Total Customers** — users icon (purple), count, "X new this week"
4. **Open Conversations** — message icon (orange), count, "Avg response X mins"

**Middle: Secondary Metrics (3-column grid)**
1. **No-Show Rate** — percentage with progress bar (color: red >15%, amber >5%, green ≤5%)
2. **Avg Response Time** — minutes with status text ("Excellent" ≤5m / "Good" ≤15m / "Needs improvement")
3. **This Week by Status** — color dots + status name + count for each booking status

**Bottom: Two-Column Section**
- **Left: Today's Appointments** — time-ordered list with customer name, service, staff, status badge. Empty state: "No appointments today"
- **Right: Unassigned Conversations** — customer name, last message preview, "Unassigned" orange badge, time ago. Empty state: green checkmark + "All caught up"

---

### 3.4 Calendar (`/calendar`)

**Header:** Date navigation (< Today >), date display, staff filter chips (toggle), Day/Week view toggle, "+ New Booking" button

**Day View:**
- Time gutter (8am–7pm, hourly slots)
- Multiple columns (one per selected staff member)
- Staff column header: name + role
- Booking cards positioned by time, color-coded by status:
  - PENDING=yellow border, CONFIRMED=blue, IN_PROGRESS=green, COMPLETED=gray, CANCELLED=red+strikethrough, NO_SHOW=orange
- Card content: time range, customer name, service name

**Week View:**
- 7 day columns with abbreviated day names
- Today highlighted in blue
- Compact booking cards with customer name + time

**Interactions:**
- Click time slot → BookingFormModal (create)
- Click booking card → BookingDetailModal (view/edit)
- Click "+ New Booking" → BookingFormModal

---

### 3.5 Bookings List (`/bookings`)

**Header:** Title + status filter dropdown (All / each status)

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
- **Header:** Customer name + phone, snooze button, "Resume auto-reply" (purple), close conversation, "+ New Booking"
- **Messages:** Inbound (left, white/border), Outbound (right, blue bg/white text), timestamps, staff name labels
- **AI Suggestions section:** Purple-to-blue gradient bg, intent badge (color-coded), editable textarea, Send/Dismiss buttons
- **Composer:** Template menu (Files icon), quick replies toggle (Zap icon), auto-expanding textarea, Send button

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

### 3.8 Customer Detail (`/customers/{id}`)

**Header:** Back button, customer name (large), "Since {date}" subtitle, "+ New Booking" button

**3-Column Layout:**

**Left Column (1/3):**
1. Contact Info card (name, phone, email, address) with edit button
2. Tags card (removable tags + add input)
3. Quick Stats card: total bookings, total spent, upcoming, no-shows (red if >0)
4. Next Appointment card (if exists): date, time, service, staff

**Right Column (2/3) — Tabbed card:**

**AI Chat tab:**
- Chat interface with user messages (right/blue) and AI responses (left/gray)
- 4 prompt chips: "Summarize customer...", "What treatments...", "Upcoming appointments...", "Any allergies..."
- Chat input with send button

**Bookings tab:**
- Upcoming section + History section
- Each booking: date+time, service, staff+price, status badge

**Details tab:**
- Grid: full name, phone, email, customer since, tags, custom fields
- Edit modal: name, email, tags (comma-separated), custom fields (boolean=checkbox, select=dropdown, text=input)

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
- Quick Links grid (6 cards with icons):
  1. Message Templates (blue FileText icon) → /settings/templates
  2. Translations (purple Languages icon) → /settings/translations
  3. Profile Fields (teal ClipboardCheck icon) → /settings/profile-fields
  4. AI Settings (purple Sparkles icon) → /settings/ai
  5. Account & Import (green Upload icon) → /settings/account
  6. Setup Wizard (orange Settings2 icon) → /setup

#### AI Settings (`/settings/ai`)
- Master toggle: Enable AI Assistance
- Auto Reply Suggestions toggle
- Booking Assistant toggle
- Auto-Reply section: enable toggle → mode radio (all / selected intents) → intent checkboxes (GENERAL_INQUIRY, BOOK_APPOINTMENT, CANCEL_APPOINTMENT, RESCHEDULE_APPOINTMENT)
- AI Personality textarea

#### Templates (`/settings/templates`)
- Category filter buttons with counts: ALL | CONFIRMATION | REMINDER | FOLLOW_UP | CANCELLATION | CUSTOM
- Template cards: name, category badge, body in code box, variable badges
- Preview toggle: shows resolved template with sample data
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

---

## 4. Data Models

### 4.1 Entity Relationship Overview

```
Business (1) ──┬── (*) Staff ──── (*) WorkingHours
               │                  └── (*) TimeOff
               ├── (*) Customer
               ├── (*) Service
               ├── (*) Booking ──── (*) Reminder
               │                    └── (*) Payment
               ├── (*) Conversation ──── (*) Message
               │                        └── (*) ConversationNote
               ├── (*) MessageTemplate
               ├── (*) Translation
               ├── (1) Subscription
               └── (*) AiUsage
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

#### Other Models
- **Reminder:** bookingId, scheduledAt, status (PENDING/SENT/FAILED/CANCELLED)
- **MessageTemplate:** name, category, body (with {{variables}}), variables[]
- **WorkingHours:** staffId, dayOfWeek (0-6), startTime/endTime ("HH:mm"), isOff
- **TimeOff:** staffId, startDate, endDate, reason
- **Translation:** locale, key, value (per business overrides)
- **Subscription:** stripeCustomerId, plan (basic/pro), status
- **Payment:** bookingId, stripePaymentIntentId, amount, status
- **AiUsage:** date, count (daily tracking)

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
- `conversation:updated` — status, assignment changes
- `ai:suggestion` — AI draft suggestion ready
- `ai:auto-replied` — AI sent an auto-reply (clears draft)
- `ai:transfer-to-human` — AI escalated to human agent
- `booking:updated` — booking status change
- `ai:booking-state` — AI booking assistant state update

---

## 9. Current UI Characteristics (As-Is)

### Strengths
- Clean, minimal layout with clear information hierarchy
- Consistent use of Tailwind utilities
- Good use of color-coding for statuses
- Real-time updates in inbox
- Responsive grid layouts
- Comprehensive feature set

### Areas for Potential Improvement
- **No custom typeface** — uses system fonts only
- **Minimal brand identity** — only blue brand colors defined, limited visual personality
- **No component library** — all components hand-built, inconsistent styling possible
- **Basic form inputs** — standard HTML inputs with minimal styling
- **No animations/transitions** — except toast slide-in and skeleton pulse
- **No dark mode**
- **Basic empty states** — simple icon + text, no illustrations
- **Modals are functional but plain** — no transitions, basic layout
- **Calendar is custom-built** — functional but not visually polished
- **Charts use defaults** — Recharts with minimal customization
- **No onboarding tooltips** or feature discovery hints
- **Mobile responsiveness** — grid-based but not optimized for mobile-first

---

## 10. File Structure Reference

```
apps/web/src/
├── app/
│   ├── globals.css
│   ├── layout.tsx
│   ├── login/page.tsx
│   ├── signup/page.tsx
│   ├── forgot-password/page.tsx
│   ├── reset-password/page.tsx
│   ├── accept-invite/page.tsx
│   ├── setup/page.tsx
│   ├── dashboard/page.tsx
│   ├── calendar/page.tsx
│   ├── bookings/page.tsx
│   ├── customers/page.tsx
│   ├── customers/[id]/page.tsx
│   ├── inbox/page.tsx
│   ├── services/page.tsx
│   ├── staff/page.tsx
│   ├── reports/page.tsx
│   ├── settings/page.tsx
│   ├── settings/account/page.tsx
│   ├── settings/ai/page.tsx
│   ├── settings/templates/page.tsx
│   ├── settings/translations/page.tsx
│   └── settings/profile-fields/page.tsx
├── components/
│   ├── shell.tsx              # App layout + sidebar nav
│   ├── skeleton.tsx           # Loading skeletons + empty states
│   ├── error-boundary.tsx     # Error catching
│   ├── ai-summary.tsx         # AI conversation summary
│   ├── ai-suggestions.tsx     # AI draft response
│   ├── ai-booking-panel.tsx   # AI booking assistant UI
│   ├── booking-form-modal.tsx # Create/reschedule booking
│   ├── booking-detail-modal.tsx # View/manage booking
│   └── language-picker.tsx    # Locale selector
├── lib/
│   ├── api.ts                 # API client singleton
│   ├── auth.tsx               # Auth context + hooks
│   ├── cn.ts                  # Class merge utility
│   ├── i18n.tsx               # I18n context + hooks
│   ├── toast.tsx              # Toast notifications
│   ├── vertical-pack.tsx      # Pack configuration
│   └── use-socket.ts          # WebSocket hook
└── locales/
    ├── en.json                # English (589 keys)
    └── es.json                # Spanish (589 keys)
```
