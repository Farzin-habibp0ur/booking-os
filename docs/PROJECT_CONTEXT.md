# Booking OS — Complete Project Context

> **Purpose:** This document gives full context on the Booking OS platform — what it is, what's been built, how it's structured, and what's left to build. Share this with an AI assistant or new developer to get productive immediately.
>
> **Last updated:** February 2026

---

## 1. What Is Booking OS?

Booking OS is a **multi-tenant SaaS platform** for service-based businesses (aesthetic clinics, salons, spas, tutoring centers) to manage appointments, customer messaging, and operations — with AI-powered automation via Claude.

**Live production URL:** https://businesscommandcentre.com
**Demo login:** sarah@glowclinic.com / password123

### Core Capabilities (All Built & Working)

- **Appointment scheduling** — Calendar views (day/week), conflict detection, recurring bookings, automated reminders
- **WhatsApp messaging inbox** — Real-time via Socket.io, AI auto-replies, conversation management (assign, snooze, tag, close)
- **AI booking assistant** — Guides customers through booking/cancellation/rescheduling via chat (powered by Claude API)
- **AI features** — Intent detection, reply suggestions, conversation summaries, customer profile collection, per-customer AI chat
- **Customer management** — Profiles with custom fields, tags, CSV import/export, AI-powered profile extraction from conversations
- **Staff management** — Roles (Admin/Service Provider/Agent), working hours per day, time off, email invitations
- **Service catalog** — Categories, pricing, durations, buffer times, deposit requirements, service kinds (CONSULT/TREATMENT/OTHER), soft delete
- **Analytics & reports** — Bookings over time, revenue, service breakdown, staff performance, no-show rates, peak hours, consult conversion
- **Multi-language** — English & Spanish (600+ translation keys), per-business overrides, language picker in sidebar
- **Billing** — Stripe integration (Basic/Pro plans), checkout, customer portal, webhooks, deposit collection
- **Calendar sync** — Google Calendar OAuth integration, iCal feed generation
- **Public booking portal** — Customer-facing booking page at `/book/{slug}` (service selection, availability, booking, waitlist join)
- **Vertical packs** — Industry-specific configs (aesthetic, salon, tutoring, general) that customize labels, required fields, and features
- **Setup wizard** — 10-step onboarding flow for new businesses with feature readiness checklist and test booking
- **Notifications** — Email via Resend, WhatsApp, automated booking reminders, notification timeline
- **Dark mode** — System preference detection, manual toggle (System/Light/Dark), full UI coverage
- **Global search** — Cmd+K command palette searching across customers, bookings, services, conversations

### Phase 1: "Outcome Machine for Aesthetics" (Complete — 27/27 tasks)

Phase 1 adds a full aesthetics clinic workflow on top of the core platform:

- **Consult vs Treatment booking types** — ServiceKind enum (CONSULT/TREATMENT/OTHER) with badges on calendar and booking detail
- **Aesthetics intake fields** — Clinic Intake card in inbox sidebar: concern area, desired treatment, budget, medical flags, preferred provider, contraindications, with amber dot indicators and edit mode
- **Consult → Treatment follow-up** — Automated follow-up if consult completed but no treatment booked within configurable days
- **Aftercare + 24h check-in** — Treatment completion triggers aftercare instructions and 24h check-in message
- **Deposit-required bookings** — Bookings start as PENDING_DEPOSIT until paid or manager override; "Send Deposit Request" action with timeline logging
- **Clinic policies** — Cancel/reschedule windows defined once in business settings, applied to staff and customer actions
- **Manager override with accountability** — Authorized roles can confirm without deposit but must provide reason, recorded in timeline
- **Customer self-serve reschedule/cancel** — Secure branded pages via token links; policy-aware slot picker; expired links show safe fallback
- **Staff send reschedule/cancel links** — 1-click from inbox or booking detail, logged to prevent resends
- **ROI dashboard** — Conversion, no-shows, response time, consult→treatment, utilization, deposit compliance; current vs baseline with deltas
- **Recovered revenue estimate** — Conservative ROI estimate with visible methodology
- **Attention needed panel** — Dashboard panels for deposit-pending bookings, overdue replies, tomorrow's schedule
- **Go-live checklist** — Auto-updating 8-item checklist with progress bar and "Fix →" links
- **First 10 bookings milestones** — Coaching nudges at 5 thresholds, dismissible
- **Complete template pack** — 10 templates including cancellation confirmation, reschedule link, cancel link
- **Template preview warnings** — Unresolved {{vars}} show amber warning + red highlight in preview
- **Notifications in timeline** — All send events logged and rendered in booking detail with Send icon
- **Permissions for money/policy actions** — Role boundaries for overrides, policy edits, go-live resets, link regeneration
- **Weekly ROI review** — Week-over-week metric comparison with email review functionality
- **E2E QA pack** — 7 Playwright workflow tests covering critical clinic journeys (54 total E2E tests)

### Phase 2: "Automation & Growth Engine" (Complete — 13/13 batches)

Phase 2 adds waitlists, bulk actions, campaigns, automations, and visual polish:

- **Waitlist system** — Customers join waitlist when no slots available; auto-offers sent on cancellation; token-based 1-tap claim flow; configurable offer count, expiry, and quiet hours; dashboard backfill metrics (fill rate, avg time)
- **Bulk actions** — Multi-select checkboxes on bookings table (status change, staff assign) and customers table (tag, untag) with reusable BulkActionBar component and confirmation for destructive actions
- **Global search (Cmd+K)** — Parallel search across customers, bookings, services, conversations; command palette with keyboard navigation (arrow keys + Enter); results grouped by type; recent searches remembered
- **Campaign system** — Campaign CRUD with audience segmentation (tags, lastBookingBefore, serviceKind, noUpcomingBooking, excludeDoNotMessage); audience preview with count + sample names; 4-step builder wizard (audience → template → schedule/throttle → review); throttled dispatch with cron; send tracking (PENDING → SENT → DELIVERED → READ → FAILED); campaign attribution in bookings
- **Offers & referrals** — Offers CRUD with settings page; referral source tracking on public bookings
- **Automation suite** — 3 built-in playbooks (No-Show Prevention, Consult Conversion, Re-engagement) with toggle and "what will happen" summaries; custom rule builder wizard (trigger → filters → actions → review); 6 triggers (BOOKING_CREATED, BOOKING_UPCOMING, STATUS_CHANGED, NO_RESPONSE, TAG_APPLIED, BOOKING_CANCELLED); executor runs every minute with quiet hours and frequency caps; searchable activity log
- **Contextual tooltips + empty states** — Dismissible tooltip-nudge component with localStorage persistence; onboarding tips on waitlist, campaigns, automations pages; enhanced empty states with icons, explanations, CTAs
- **Dark mode** — darkMode class strategy in Tailwind; use-theme hook with localStorage + system preference detection; Sun/Moon toggle in sidebar; Settings page with System/Light/Dark picker; dark: variants on all pages; prefers-reduced-motion support
- **Visual polish** — CSS keyframe animations (slideUp, fadeIn, scaleIn, slideInRight) on modals, command palette, step transitions; chart theme with sage/lavender brand palette; prefers-reduced-motion respected

---

## 2. Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend | Next.js, React, TypeScript | 15.x, 19.x |
| Styling | Tailwind CSS | 4.x |
| Icons | lucide-react | 0.468 |
| Charts | Recharts | 2.15 |
| Real-time | Socket.io | 4.x |
| Backend | NestJS, TypeScript | 11.x |
| ORM | Prisma | 6.x |
| Database | PostgreSQL | 16 |
| AI | Anthropic Claude API | claude-sonnet |
| Payments | Stripe | stripe-node |
| Email | Resend | - |
| Messaging | WhatsApp Business Cloud API | - |
| Monorepo | Turborepo | 2.x |
| CI/CD | GitHub Actions → Railway | - |
| Monitoring | Sentry | - |
| Linting | ESLint 9 + Prettier | - |

---

## 3. Monorepo Structure

```
booking-os/
├── apps/
│   ├── api/                    # NestJS REST API (port 3001)
│   │   └── src/
│   │       ├── modules/        # 30 feature modules (see §5)
│   │       ├── common/         # Guards, decorators, filters, DTOs, Prisma service
│   │       └── main.ts         # Bootstrap, Swagger, CORS, validation
│   ├── web/                    # Next.js admin dashboard (port 3000)
│   │   └── src/
│   │       ├── app/            # 40 pages (see §6)
│   │       ├── components/     # 13 shared components
│   │       ├── lib/            # 10 utility modules (API client, auth, i18n, socket, theme, etc.)
│   │       └── locales/        # en.json, es.json (600+ keys each)
│   └── whatsapp-simulator/     # WhatsApp testing tool (port 3002)
├── packages/
│   ├── db/                     # Prisma schema (26 models), migrations, seed data
│   ├── messaging-provider/     # WhatsApp Cloud API abstraction
│   └── shared/                 # Shared types, DTOs, enums, profile field definitions
├── docs/
│   ├── cicd.md                 # CI/CD pipeline documentation
│   └── PROJECT_CONTEXT.md      # This file
├── nginx/                      # Reverse proxy config
├── scripts/                    # Utility scripts
├── docker-compose.yml          # Development
├── docker-compose.prod.yml     # Production
├── Makefile                    # Production Docker commands
└── .github/workflows/ci.yml   # CI/CD pipeline
```

---

## 4. Database Schema (26 Models)

```
Business (1) ──┬── (*) Staff ──── (*) WorkingHours
               │                  ├── (*) TimeOff
               │                  └── (*) CalendarConnection
               ├── (*) Customer
               ├── (*) Service
               ├── (*) Booking ──── (*) Reminder
               │                    └── (*) Payment
               ├── (*) RecurringSeries
               ├── (*) Conversation ──── (*) Message
               │                        └── (*) ConversationNote
               ├── (*) MessageTemplate
               ├── (*) Translation
               ├── (1) Subscription
               ├── (*) AiUsage
               ├── (*) Token
               ├── (*) RoiBaseline
               ├── (*) WaitlistEntry
               ├── (*) AutomationRule ──── (*) AutomationLog
               ├── (*) Campaign ──── (*) CampaignSend
               └── (*) Offer
```

### Key Models

| Model | Key Fields | Notes |
|-------|-----------|-------|
| **Business** | name, slug (unique), timezone, verticalPack, aiSettings (JSON), packConfig (JSON), notificationSettings (JSON), policySettings (JSON), defaultLocale | Multi-tenant root entity |
| **Staff** | name, email (unique), role (ADMIN/SERVICE_PROVIDER/AGENT), passwordHash, locale, isActive, emailVerified | Auth + assignment |
| **Customer** | name, phone (unique per biz), email, tags[], customFields (JSON) | Flexible profiles (allergies, medical flags, intake fields) |
| **Service** | name, durationMins, price, category, kind (CONSULT/TREATMENT/OTHER), bufferBefore/After, depositRequired, depositAmount, isActive | Catalog items with service type classification |
| **Booking** | customerId, serviceId, staffId, status (7 states), startTime, endTime, recurringSeriesId, externalCalendarEventId, customFields (JSON for notification log) | Core scheduling entity |
| **RecurringSeries** | customerId, serviceId, staffId, timeOfDay, daysOfWeek[], intervalWeeks, totalCount, endsAt | Recurring booking pattern |
| **Conversation** | customerId, assignedToId, channel (WHATSAPP/WEB), status (4 states), tags[], metadata (JSON for AI state), snoozedUntil | AI state stored in metadata |
| **Message** | conversationId, direction (INBOUND/OUTBOUND), content, contentType (TEXT/IMAGE/DOCUMENT/AUDIO), externalId, senderStaffId, metadata | Chat messages with WhatsApp ID tracking |
| **Reminder** | bookingId, templateId, scheduledAt, sentAt, status (PENDING/SENT/FAILED/CANCELLED), type (REMINDER/CONSULT_FOLLOW_UP/AFTERCARE/TREATMENT_CHECK_IN) | Multi-type notification scheduling |
| **MessageTemplate** | name, category (CONFIRMATION/REMINDER/FOLLOW_UP/CANCELLATION/CONSULT_FOLLOW_UP/AFTERCARE/TREATMENT_CHECK_IN/DEPOSIT_REQUIRED/RESCHEDULE_LINK/CANCEL_LINK/CUSTOM), body (with {{variables}}), variables[] | 10 built-in template types |
| **Token** | token (unique), type (PASSWORD_RESET/STAFF_INVITE/RESCHEDULE_LINK/CANCEL_LINK/EMAIL_VERIFY), email, businessId, staffId, bookingId, expiresAt, usedAt | Multi-purpose secure tokens |
| **Subscription** | stripeCustomerId, stripeSubscriptionId, plan (basic/pro), status (active/past_due/canceled/trialing) | Billing state |
| **Payment** | bookingId, stripePaymentIntentId, amount, currency, status (pending/succeeded/failed/refunded) | Deposit/payment tracking |
| **WaitlistEntry** | customerId, serviceId, staffId, timeWindowStart/End, dateFrom/dateTo, status (ACTIVE/OFFERED/BOOKED/EXPIRED/CANCELLED), offeredSlot (JSON), offerExpiresAt, claimedAt | Smart waitlist with auto-offer flow |
| **AutomationRule** | name, trigger (6 types), filters (JSON), actions (JSON), isActive, playbook, quietStart/End, maxPerCustomerPerDay | Configurable automation engine |
| **AutomationLog** | automationRuleId, bookingId, customerId, action, outcome (SENT/SKIPPED/FAILED), reason, metadata | Audit trail for automations |
| **Campaign** | name, status (DRAFT/SCHEDULED/SENDING/SENT/CANCELLED), templateId, filters (JSON), scheduledAt, throttlePerMinute, stats (JSON) | Outreach campaigns with throttling |
| **CampaignSend** | campaignId, customerId, status (PENDING/SENT/DELIVERED/READ/FAILED), sentAt, bookingId | Per-recipient send tracking with attribution |
| **Offer** | name, description, terms, serviceIds[], validFrom/Until, isActive, maxRedemptions, currentRedemptions | Promotions and offers |
| **CalendarConnection** | staffId, provider (google/outlook), accessToken (encrypted), refreshToken (encrypted), icalFeedToken, syncEnabled, lastSyncedAt | External calendar integration |
| **RoiBaseline** | goLiveDate, baselineStart/End, metrics (JSON: noShowRate, consultConversion, avgResponseMinutes, totalRevenue, etc.) | Before/after ROI measurement |

**Booking statuses:** PENDING → CONFIRMED → IN_PROGRESS → COMPLETED (also: CANCELLED, NO_SHOW, PENDING_DEPOSIT)
**Conversation statuses:** OPEN, WAITING, SNOOZED, RESOLVED

---

## 5. API Modules (30 Controllers)

All endpoints prefixed with `/api/v1`. Swagger docs at `/api/docs` (dev only).

| Module | Route Prefix | Key Endpoints |
|--------|-------------|---------------|
| **Auth** | `/auth` | POST signup, login, refresh, logout, forgot-password, reset-password, change-password, accept-invite, verify-email, resend-verification; GET me |
| **Bookings** | `/bookings` | GET list (filtered, paginated), GET calendar view, GET/:id, POST create, PATCH/:id update, PATCH/:id/status, PATCH bulk, POST/:id/send-deposit-request, POST/:id/send-reschedule-link, POST/:id/send-cancel-link, GET/:id/policy-check |
| **Recurring** | `/bookings/recurring` | POST create series, GET/:seriesId, POST/:seriesId/cancel |
| **Customers** | `/customers` | GET list (search, paginated), GET/:id, POST create, PATCH/:id, GET/:id/bookings, PATCH bulk, POST import-csv, POST import-from-conversations |
| **Services** | `/services` | GET list, POST create, PATCH/:id, DELETE/:id (soft) |
| **Staff** | `/staff` | GET list, POST create, POST invite, POST/:id/resend-invite, DELETE/:id/invite, PATCH/:id, DELETE/:id, GET/PATCH working-hours, GET/POST/DELETE time-off |
| **Conversations** | `/conversations` | GET list (filtered), GET counts, GET/:id, PATCH assign/status/snooze/tags, GET/:id/messages, POST/:id/booking, notes CRUD |
| **Messages** | `/conversations` | POST/:id/messages (send) |
| **Dashboard** | `/dashboard` | GET stats, GET ai-usage, PATCH dismiss-nudge |
| **Reports** | `/reports` | GET bookings-over-time, no-show-rate, response-times, service-breakdown, staff-performance, revenue-over-time, status-breakdown, peak-hours, consult-to-treatment-conversion |
| **ROI** | `/roi` | GET dashboard, GET baseline, POST go-live, GET weekly-review, POST email-review |
| **AI** | `/ai` | GET/PATCH settings, POST conversations/:id/summary, POST booking-confirm/cancel/reschedule flows, POST resume-auto-reply, POST customers/:id/chat |
| **Billing** | `/billing` | POST checkout, POST portal, GET subscription, POST webhook, POST deposit |
| **Templates** | `/templates` | Full CRUD (get, list, create, update, delete) |
| **Translations** | `/translations` | GET (by locale), GET keys, POST upsert, DELETE |
| **Availability** | `/availability` | GET available slots (by date, service, staff) |
| **Business** | `/business` | GET settings, PATCH update, GET/PATCH notification-settings, GET/PATCH policy-settings, GET/PATCH waitlist-settings, POST install-pack, POST create-test-booking |
| **Vertical Packs** | `/vertical-packs` | GET/:name config |
| **Automation** | `/automations` | GET playbooks, POST playbooks/:id/toggle, GET/POST/PATCH/DELETE rules, GET logs, POST rules/:id/test |
| **Campaign** | `/campaigns` | GET list, POST create, PATCH/:id, DELETE/:id, POST/:id/send, POST/:id/preview |
| **Offer** | `/offers` | Full CRUD for offers/promotions |
| **Waitlist** | `/waitlist` | GET list, PATCH/:id, DELETE/:id, PATCH/:id/resolve |
| **Search** | `/search` | GET global search (customers, bookings, services, conversations) |
| **Self-Serve** | `/manage` | GET/POST reschedule/:token, GET/POST cancel/:token |
| **Public Booking** | `/public` | GET/:slug business info, GET/:slug/services, GET/:slug/availability, POST/:slug/book, POST/:slug/waitlist |
| **Calendar Sync** | `/calendar-sync` | GET connections, GET providers, POST connect/:provider, GET callback/:provider, DELETE connections/:provider, GET ical-feed-url, POST regenerate-ical-token |
| **iCal Feed** | `/ical` | GET/:token.ics |
| **Webhooks** | `/webhook` | GET whatsapp (verify), POST whatsapp (inbound), POST inbound (generic HMAC), GET simulator/outbox |
| **Email** | `/email` | Email notification endpoints |
| **Health** | `/health` | GET health check |

### Auth & Multi-tenancy
- JWT-based auth (access + refresh tokens in httpOnly cookies)
- 15-minute access token, 7-day refresh token
- Cookie settings: httpOnly, secure (production), sameSite: strict
- Token rotation on refresh; logout blacklists current access token
- `TenantGuard` extracts businessId from JWT and injects into every request
- `@BusinessId()` decorator provides tenant isolation on all queries
- Role-based access: `@Roles('ADMIN')` decorator + `RolesGuard` (three roles: ADMIN, SERVICE_PROVIDER, AGENT)
- Helmet.js with CSP, CORS, 1MB body limit

---

## 6. Frontend Pages (40 Pages)

| Page | Route | Description |
|------|-------|-------------|
| Home | `/` | Root redirect |
| Login | `/login` | Email + password auth |
| Sign Up | `/signup` | New business registration |
| Forgot Password | `/forgot-password` | Password reset email |
| Reset Password | `/reset-password?token=` | Set new password |
| Verify Email | `/verify-email` | Email verification page |
| Accept Invite | `/accept-invite?token=` | Staff invitation acceptance |
| Setup Wizard | `/setup` | 10-step onboarding (clinic type → business info → WhatsApp → staff → services → hours → templates → profile fields → import → finish with readiness checklist + test booking) |
| Dashboard | `/dashboard` | KPI cards, today's appointments, unassigned conversations, attention needed panel, go-live checklist, first-10-bookings milestones |
| Calendar | `/calendar` | Day/week view, staff columns, click-to-book |
| Bookings | `/bookings` | Filterable booking list with detail modal, bulk actions (multi-select for status change, staff assign), deposit request, reschedule/cancel link actions |
| Inbox | `/inbox` | 4-panel messaging: filters, conversation list, message thread + AI suggestions, customer info sidebar with Clinic Intake card |
| Customers | `/customers` | Searchable list with import/export, bulk actions (multi-select for tag/untag) |
| Customer Detail | `/customers/[id]` | Contact info, tags, stats, AI chat, booking history, custom fields |
| Services | `/services` | Grouped by category, full CRUD, service kind badges (CONSULT/TREATMENT/OTHER) |
| Staff | `/staff` | Expandable table with working hours + time off |
| Reports | `/reports` | Charts: bookings, revenue, service breakdown, staff performance, peak hours, consult conversion |
| ROI Dashboard | `/roi` | ROI metrics (conversion, no-shows, response time, consult→treatment, utilization, deposit compliance), baseline comparison, recovered revenue estimate, weekly review tab |
| Waitlist | `/waitlist` | Waitlist management — entries, offers, claims, backfill metrics |
| Automations | `/automations` | Built-in playbooks (toggle on/off), custom automation rules, activity log |
| New Automation | `/automations/new` | Custom rule builder wizard (trigger → filters → actions → review) |
| Campaigns | `/campaigns` | Campaign list with status badges and stats grid |
| New Campaign | `/campaigns/new` | 4-step campaign builder wizard (audience → template → schedule/throttle → review) |
| Campaign Detail | `/campaigns/[id]` | Campaign detail/editor with send stats |
| Public Booking | `/book/[slug]` | Customer-facing booking portal with waitlist join when no slots available |
| Self-Serve Reschedule | `/manage/reschedule/[token]` | Clinic-branded reschedule page with policy-aware slot picker |
| Self-Serve Cancel | `/manage/cancel/[token]` | Clinic-branded cancel confirmation page with optional reason |
| Waitlist Claim | `/manage/claim/[token]` | Token-based 1-tap waitlist slot claim page |
| Settings | `/settings` | Business info, password change, links to sub-pages |
| AI Settings | `/settings/ai` | Toggle AI features, auto-reply config (all/selected intents), personality |
| Templates | `/settings/templates` | 10 message templates with variable detection, unresolved var warnings |
| Translations | `/settings/translations` | Per-locale translation overrides |
| Profile Fields | `/settings/profile-fields` | Required field configuration |
| Account & Import | `/settings/account` | CSV import/export, conversation import |
| Calendar Sync | `/settings/calendar` | Google Calendar connection management |
| Billing | `/settings/billing` | Stripe subscription management |
| Notifications | `/settings/notifications` | Notification preferences (channels, follow-up delays, check-in hours) |
| Offers | `/settings/offers` | Promotion/offer management |
| Policies | `/settings/policies` | Business policies (cancellation/reschedule windows, policy copy) |
| Waitlist Settings | `/settings/waitlist` | Waitlist config (offer count, expiry time, quiet hours) |

### Key Frontend Components (13)
- `Shell` — App layout with sidebar navigation, i18n provider, vertical pack provider, dark mode toggle, Cmd+K shortcut
- `BookingFormModal` — Create/reschedule booking with service, staff, date, time slot selection
- `BookingDetailModal` — View booking details, update status, send deposit/reschedule/cancel links, notification timeline
- `AiSuggestions` — AI draft reply display with edit/send/dismiss
- `AiBookingPanel` — Multi-step AI booking/cancel/reschedule flow in sidebar
- `AiSummary` — AI conversation summary with refresh
- `ClinicIntakeCard` — Aesthetics intake form (concern area, budget, medical flags, etc.) with completion indicators
- `CommandPalette` — Cmd+K global search with keyboard navigation, grouped results, recent searches
- `BulkActionBar` — Multi-select action bar for bookings and customers with confirmation dialogs
- `TooltipNudge` — Dismissible contextual coaching tooltips with localStorage persistence
- `LanguagePicker` — Locale selector (English/Spanish)
- `ErrorBoundary` — React error boundary with fallback UI
- `Skeleton` — Loading skeletons and empty state components with CTAs

### Key Lib Modules (10)
- `api.ts` — HTTP client wrapper with auth token injection and error handling
- `auth.tsx` — Auth context provider, useAuth hook, login/signup/logout flows
- `i18n.tsx` — i18n context provider with locale switching and variable interpolation
- `socket.ts` / `use-socket.ts` — Socket.io real-time client and React hook
- `use-theme.ts` — Dark mode hook with localStorage + system preference detection
- `vertical-pack.tsx` — Vertical pack provider (industry-specific labels, fields, features)
- `toast.tsx` — Toast notification system (success/error/info with auto-dismiss)
- `chart-theme.ts` — Recharts theme with sage/lavender brand palette
- `use-focus-trap.ts` — Accessibility focus management for modals
- `phase1.ts` — Phase 1 feature flags
- `public-api.ts` — Public booking portal API client (unauthenticated)
- `cn.ts` — Tailwind class merging utility (clsx + tailwind-merge)

---

## 7. AI Architecture

The AI system uses Claude (Anthropic API) through a modular pipeline:

| Component | File | Purpose |
|-----------|------|---------|
| `ClaudeClient` | `claude.client.ts` | API client wrapper with error handling, graceful degradation when key missing |
| `IntentDetector` | `intent-detector.ts` | Classifies messages into intents: GENERAL_INQUIRY, BOOK_APPOINTMENT, CANCEL_APPOINTMENT, RESCHEDULE_APPOINTMENT, TRANSFER_TO_HUMAN |
| `ReplyGenerator` | `reply-generator.ts` | Generates contextual reply drafts using conversation history + business context |
| `BookingAssistant` | `booking-assistant.ts` | Multi-step booking flow: service → date → time → confirm |
| `CancelAssistant` | `cancel-assistant.ts` | Identifies and cancels bookings from conversation |
| `RescheduleAssistant` | `reschedule-assistant.ts` | Identifies and reschedules bookings |
| `ProfileCollector` | `profile-collector.ts` | Conversationally collects missing required profile fields |
| `AiService` | `ai.service.ts` | Orchestrator: routes intents, manages conversation metadata state, handles auto-reply |

**AI state** is persisted in `conversation.metadata` JSON field, enabling stateful multi-turn flows.

**Auto-reply modes:**
- **Draft mode** (default): AI generates suggestions for staff to review, edit, and send
- **Auto-reply all**: AI responds automatically to all intents
- **Selective auto-reply**: AI auto-responds to selected intents only (e.g., general inquiries but not bookings)
- **Transfer to human**: AI detects when customer wants a real person, sends handoff message, assigns to staff

---

## 8. Real-Time Architecture (Socket.io)

Events emitted from the API gateway (`InboxGateway`):

| Event | Payload | Trigger |
|-------|---------|---------|
| `message:new` | message + conversationId | New inbound/outbound message |
| `conversation:updated` | conversation object | Status, assignment, tag changes |
| `ai:suggestion` | intent, draft, confidence | AI generates reply suggestion |
| `ai:auto-replied` | conversationId | AI sent auto-reply |
| `ai:transfer-to-human` | conversationId, reason | AI escalated to human |
| `booking:updated` | booking object | Booking created/updated |
| `ai:booking-state` | state object | AI booking assistant progress |

---

## 9. Automation Engine

### Built-in Playbooks (Toggle On/Off)
1. **No-Show Prevention** — Deposit reminder + confirmation request before appointment (trigger: BOOKING_UPCOMING)
2. **Consult Conversion** — Follow-up + testimonial request after consult (trigger: STATUS_CHANGED, filter: serviceKind=CONSULT)
3. **Re-engagement** — Message dormant customers (trigger: NO_RESPONSE, filter: 30+ days inactive)

### Custom Rules
- **6 Triggers:** BOOKING_CREATED, BOOKING_UPCOMING, STATUS_CHANGED, NO_RESPONSE, TAG_APPLIED, BOOKING_CANCELLED
- **Filters:** Service kind, booking status, customer tags, time windows
- **Actions:** SEND_TEMPLATE (extensible)
- **Safety:** Quiet hours (configurable start/end), frequency caps (maxPerCustomerPerDay)
- **Execution:** Cron runs every minute, respects all safety guards
- **Audit:** Full activity log searchable by rule, customer, or outcome (SENT/SKIPPED/FAILED)

---

## 10. Campaign System

### Campaign Flow
1. **Build audience** — Segment by tags, last booking date, service kind, no upcoming booking, exclude do-not-message
2. **Preview audience** — See count + sample customer names before sending
3. **Select template** — Choose from message templates with variable interpolation
4. **Configure send** — Set schedule time, throttle rate (messages per minute)
5. **Send** — Throttled dispatch via cron with per-recipient tracking
6. **Track results** — Per-send status (PENDING → SENT → DELIVERED → READ → FAILED), campaign-level stats, booking attribution

---

## 11. Testing

### Current Coverage
- **API unit tests:** ~1,029 tests across 40+ suites
- **Web tests:** 465 tests across 16 suites
- **Shared tests:** 40 tests
- **E2E tests:** 54 Playwright tests
- **Total: ~1,534 tests, all passing**

### Coverage Thresholds (Enforced)
- **API:** 70% lines/statements, 50% functions/branches
- **Web:** 75% lines/statements, 60% functions/branches
- Actual coverage: API 83.8% lines, Web 93.23% lines

### What's Tested
- All AI components (intent detection, reply generation, booking/cancel/reschedule assistants, profile collector)
- Auth service + integration tests
- Booking, customer, staff, conversation, service, message, template services
- Billing service (Stripe integration)
- Webhook controller (WhatsApp inbound, HMAC verification)
- Calendar sync service
- Guards (tenant isolation, roles)
- Token service, dashboard service, reminder service, notification service
- ROI service (dashboard, weekly review, email review)
- Business service (install pack, create test booking)
- Vertical pack service (aesthetic, general packs)
- Automation, campaign, waitlist, search, offer, availability services
- Email notification service
- Web components, lib utilities, page-level tests
- E2E: auth flows, navigation, booking lifecycle, deposit flow, consult completion, self-serve pages, ROI dashboard, template settings

---

## 12. CI/CD Pipeline

```
Push to main → lint-and-test → docker-build → deploy (Railway)
Pull request → lint-and-test → docker-build (no deploy)
```

- **lint-and-test:** PostgreSQL 16 service container, runs `npm run lint` + `npm run test`
- **docker-build:** Multi-stage Docker builds for API and web (non-root users)
- **deploy:** Railway deployment (API + web services)
- **Migrations:** Run via docker-entrypoint.sh on each container startup
- **Seed script:** Idempotent — checks if business exists before seeding, safe to re-run
- **Full docs:** `docs/cicd.md`

---

## 13. Environment Configuration

Key variable groups (full list in `.env.example`):

| Group | Variables | Required for |
|-------|----------|-------------|
| Database | `DATABASE_URL` | Always |
| JWT | `JWT_SECRET`, `JWT_REFRESH_SECRET` | Always |
| API/Web URLs | `API_PORT`, `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_WS_URL` | Always |
| AI | `ANTHROPIC_API_KEY` | AI features |
| WhatsApp | `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_VERIFY_TOKEN` | Production messaging |
| Stripe | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID_*` | Billing |
| Calendar | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `CALENDAR_ENCRYPTION_KEY` | Calendar sync |
| Email | `RESEND_API_KEY` | Email notifications |
| Redis | `REDIS_URL` | Job queues, multi-instance WebSocket |
| Sentry | `SENTRY_DSN` | Error tracking |
| Security | `WEBHOOK_SECRET`, `CORS_ORIGINS` | Production |

---

## 14. Seed Data (Demo Account)

The seed script (`packages/db/src/seed.ts`) is **idempotent** — it checks if the business exists before seeding, so it's safe to run on every deployment.

It creates:
- **Business:** Glow Aesthetic Clinic (aesthetic vertical pack, slug: `glow-aesthetic`, setupComplete: true)
- **Staff:** Dr. Sarah Chen (Admin), Maria Garcia (Agent), Dr. Emily Park (Service Provider) — all with password `password123`
- **Services:** Consultation (Free/20min, CONSULT), Botox ($350/30min, TREATMENT, deposit required $100), Dermal Filler ($500/45min, TREATMENT), Chemical Peel ($200/60min, TREATMENT), Microneedling ($275/45min, TREATMENT)
- **Customers:** Emma Wilson (VIP, Regular), James Thompson (New, latex allergy, medical flagged), Sofia Rodriguez (Regular), Liam Parker (New, deposit demo)
- **Working hours:** Mon-Fri 9am-5pm (owner), Mon-Sat 8am-6pm (agent), Mon-Fri 10am-6pm (provider)
- **Message templates:** 7 templates (Confirmation, Reminder, Follow-up, Consult Follow-up, Aftercare, Treatment Check-in, Deposit Request)
- **Sample conversations and messages** for Emma Wilson and James Thompson
- **Sample bookings:** Confirmed (Chemical Peel tomorrow), Completed Consult (with CONSULT_FOLLOW_UP reminder), Completed Treatment (with AFTERCARE and TREATMENT_CHECK_IN reminders), PENDING_DEPOSIT (Botox for Liam Parker)
- **ROI baseline** with sample metrics (18% no-show rate, 45% consult conversion, 12min avg response)
- **Notification settings** with follow-up delays and check-in hours

---

## 15. Design System

### Active System: "Minimalist Premium" (CLAUDE.md)
- **Fonts:** Inter (body/UI), Playfair Display (headers/display)
- **Colors:** Sage palette (primary/success), Lavender palette (AI/highlights), warm off-white backgrounds
- **Style:** `rounded-2xl`, soft diffused shadows (`shadow-soft`), no borders, no component libraries
- **Buttons:** `bg-sage-600` primary, `bg-slate-900` dark
- **Inputs:** `bg-slate-50 border-transparent focus:bg-white focus:ring-sage-500 rounded-xl`
- **AI elements:** Lavender palette (`bg-lavender-50 border-lavender-100 text-lavender-900`)
- **Status badges:** Sage for confirmed/completed, Lavender for pending, Red-50 for cancelled, Amber-50 for in-progress
- **Dark mode:** Full coverage with `dark:` variants, system preference detection, manual override
- **Animations:** slideUp, fadeIn, scaleIn, slideInRight on modals/transitions, prefers-reduced-motion respected

### Legacy Reference: DESIGN_DOCUMENTATION.md
- Complete page-by-page UI documentation (746 lines)
- All data models, user flows, component inventory
- Note: Design system colors in this file reflect an older blue-based scheme; the active design system is in CLAUDE.md

---

## 16. Roadmap — What's Next

Phase 1 ("Outcome Machine for Aesthetics") and Phase 2 ("Automation & Growth Engine") are **complete**.

### Phase 3: Platformization + Second Vertical (6-12 months) — NOT STARTED
| Item | Description |
|------|-------------|
| **Pack Builder** | Internal tooling for vertical pack definitions — schema, versioning, upgrade flow, per-business overrides without forking |
| **Vertical Pack #2 — Home Services** | Address + job type + on-site notes, quote→booked job pipeline, on-the-way + arrival messages, technician utilization reporting |
| **Multi-location + Resources** | Support for larger clinics/chains, room/equipment resource management, premium tier |

### Phase 4: Engagement OS + Benchmarking + Marketplace (12-24 months) — NOT STARTED
| Item | Description |
|------|-------------|
| **Benchmarking & Coaching** | Anonymized peer benchmarks by vertical + region, "what top performers do" recommendations, benchmark deltas over time |
| **Omnichannel Inbox** | IG DM, Messenger, web chat — unified timeline, reporting, and automations across all channels |
| **Vertical Packs Marketplace** | Partner portal: publish pack components, revenue share + distribution, certification program |
| **Customer Mini-Portal** | Booking management, receipts, membership/packages, referrals — customer-facing account |

### Do Not Build (Yet)
- Don't chase 5 verticals before aesthetics ROI is repeatable
- Don't overinvest in generic AI chatbot; keep AI tied to structured flows + agent assist
- Don't build deep enterprise features before "pack-led implementation machine" is nailed

---

## 17. How to Run Locally

```bash
git clone <repo-url>
cd booking-os
npm install
cp .env.example .env          # Edit with your DB credentials
npm run db:generate
npm run db:migrate
npm run db:seed               # Idempotent — safe to re-run
npm run dev                    # Starts all apps
```

- Dashboard: http://localhost:3000
- API: http://localhost:3001/api/v1
- Swagger: http://localhost:3001/api/docs
- Login: sarah@glowclinic.com / password123

---

## 18. Key Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start all apps |
| `npm run build` | Build all |
| `npm run lint` | Lint all |
| `npm run test` | Run all unit tests (~1,534 tests) |
| `npm run test:coverage` | Run tests with coverage thresholds |
| `npm run test:e2e` | Playwright E2E tests |
| `npm run db:generate` | Generate Prisma client |
| `npm run db:migrate` | Run migrations |
| `npm run db:seed` | Seed demo data (idempotent) |
| `npm run db:studio` | Prisma Studio GUI |
| `npm run format` | Format with Prettier |
| `npm run format:check` | Check formatting |
