# Booking OS — Complete Project Context

> **Purpose:** This document gives full context on the Booking OS platform — what it is, what's been built, how it's structured, and what's left to build. Share this with an AI assistant or new developer to get productive immediately.
>
> **Last updated:** March 9, 2026 (Phase C/D/E — Phase C ALL COMPLETE, Phase D ALL COMPLETE, E2 done — ~4,797 total tests across 307 test files, 60 Prisma models, 43 migrations)

---

## 1. What Is Booking OS?

Booking OS is a **multi-tenant SaaS platform** for service-based businesses to manage appointments, customer messaging, and operations — with AI-powered automation via Claude.

**Live production URL:** https://businesscommandcentre.com
**API URL:** https://api.businesscommandcentre.com/api/v1

### Demo Credentials

| Business | Email | Password | Vertical |
|----------|-------|----------|----------|
| Glow Aesthetic Clinic | sarah@glowclinic.com | password123 | Aesthetic |
| Metro Auto Group | mike@metroauto.com | password123 | Dealership |

### Supported Verticals
- **Aesthetic clinics** — consult → treatment → aftercare workflows, medical intake, before/after tracking
- **Car dealerships** — service kanban board (CHECKED_IN → DIAGNOSING → IN_PROGRESS → READY), quote approval, resource/bay scheduling
- **General** — base vertical with standard booking features
- **Extensible** — Vertical Pack system customizes fields, templates, automations, and workflows per industry

### Core Capabilities (All Built & Working)

- **Appointment scheduling** — Calendar views (day/week/month), conflict detection, recurring bookings, automated reminders, force-book with reason, drag-and-drop reschedule with recommended slots, calendar command center (sidebar summary, keyboard shortcuts, booking popover)
- **WhatsApp messaging inbox** — Real-time via Socket.io, AI auto-replies, conversation management (assign, snooze, tag, close), media attachments (images/docs/audio), delivery/read receipts, presence indicators
- **AI booking assistant** — Guides customers through booking/cancellation/rescheduling via chat (powered by Claude API)
- **AI features** — Intent detection, reply suggestions, conversation summaries, customer profile collection, per-customer AI chat
- **Customer management** — Profiles with custom fields, tags, CSV import, AI-powered profile extraction from conversations
- **Staff management** — Roles (Admin/Service Provider/Agent/Super Admin), working hours per day, time off, email invitations
- **Service catalog** — Categories, pricing, durations, buffer times, deposit requirements, service kinds (CONSULT/TREATMENT/OTHER), soft delete
- **Multi-location** — Multiple physical locations per business, staff-location assignments, per-location WhatsApp routing, location-based conversation filtering
- **Resource management** — Equipment/bays/rooms per location with metadata, resource-level booking
- **Service kanban** — Dealership workflow board (CHECKED_IN → DIAGNOSING → AWAITING_APPROVAL → IN_PROGRESS → READY_FOR_PICKUP)
- **Quotes** — Create quotes for bookings, customer self-serve approval via token link with IP audit
- **Analytics & reports** — Bookings over time, revenue, service breakdown, staff performance, no-show rates, peak hours, consult conversion, CSV/PDF export for all reports, automated scheduled report emails (daily/weekly/monthly via BullMQ)
- **ROI dashboard** — Baseline vs current metrics, recovered revenue estimate, weekly review with email
- **Multi-language** — English & Spanish (600+ translation keys), per-business overrides, language picker
- **Billing** — Stripe integration (Starter/Professional/Enterprise plans), checkout, customer portal, webhooks, deposit collection, dunning email flow, referral credits
- **Calendar sync** — Google Calendar + Outlook OAuth integration, iCal feed generation
- **Public booking portal** — Customer-facing booking page at `/book/{slug}` with service selection, availability, booking, waitlist join
- **Customer self-service portal** — Phone OTP (WhatsApp) and email magic link auth, customer dashboard with upcoming bookings, booking history with pagination/filters, profile management with notification preferences
- **Self-serve links** — Token-based reschedule, cancel, waitlist claim, and quote approval pages
- **Waitlist** — Auto-offers on cancellation, token-based 1-tap claim, configurable offer count/expiry/quiet hours
- **Campaigns** — Audience segmentation, template-based bulk messaging, throttled dispatch, delivery tracking, recurring schedules (daily/weekly/biweekly/monthly)
- **Automations** — 3 built-in playbooks with rich recipe cards + custom rule builder with plain-language summaries, real dry-run testing, searchable/filterable activity log, safety controls panel, visual drag-and-drop workflow builder
- **Offers** — Promotional offers with expiry, max redemptions, service linking
- **Vertical packs** — Pack builder with versioning, publish flow, business-level overrides
- **Setup wizard** — 10-step onboarding flow for new businesses
- **Dark mode** — System preference detection, manual toggle, full UI coverage
- **Global search** — Cmd+K command palette searching across customers, bookings, services, conversations
- **Interactive demo tour** — 9-step guided walkthrough with spotlight overlays, tooltips, keyboard navigation, localStorage persistence
- **Notifications** — Email via Resend, WhatsApp, SMS via Twilio, automated booking reminders, notification timeline, weekly digest email, NPS survey
- **Security** — Helmet CSP, rate limiting, JWT blacklisting, brute force protection, httpOnly cookies, automatic token refresh, tenant isolation
- **AI marketing system** — Content approval queue (9 endpoints), 12 autonomous marketing agents (6 content, 2 distribution, 4 analytics), email sequences (7 default drip campaigns with enrollment lifecycle), landing page with SEO/AEO (blog, sitemap, robots, JSON-LD), 12 blog posts across 5 content pillars

---

## 2. Completed Roadmap

### Phase 1: "Outcome Machine for Aesthetics" — COMPLETE (27/27 tasks)
- Consult vs Treatment booking types with full aftercare workflow
- Deposit enforcement with manager override and accountability
- Customer self-serve reschedule/cancel via token links
- ROI dashboard with baseline measurement and weekly reviews
- Go-live checklist and "First 10 Bookings" milestone tracker
- Template pack (10 templates) with variable detection and warnings
- E2E test pack (54 Playwright tests)

### Phase 2: "Automation & Growth Engine" — COMPLETE (13/13 batches)
- Waitlist system with auto-offers and 1-tap claim
- Bulk actions on bookings and customers
- Global search (Cmd+K) with command palette
- Campaign system with audience segmentation and throttled dispatch
- Offers & referral tracking
- Automation suite (3 playbooks + custom rules + activity log)
- Dark mode with system preference detection
- Contextual tooltips and enhanced empty states

### Phase 3: "Platformization + Second Vertical" — COMPLETE (11/11 batches)
- **Multi-location support** — Locations with staff assignments, WhatsApp routing, booking/conversation filtering
- **Resource management** — Equipment/bays per location, resource-level booking
- **Dealership vertical** — Service kanban board, quote system, vehicle-specific customer fields
- **Pack builder** — Internal tooling for pack definitions with versioning, publish flow, slug management
- **i18n infrastructure** — Translation overrides per locale per business
- **Customer CSV import** — RFC 4180 compliant, max 5000 rows, preview and error reporting
- **Email verification** — Token-based email verification workflow
- **Calendar sync enhancements** — Outlook support, iCal feed with token regeneration

### Test Coverage Push — COMPLETE
- Added ~425 tests across 9 batches
- **Final counts:** 2,206+ tests total (801 web + 1,405 API) (before UX Phase 1)
- **API:** 93.14% statements / 81.11% branches
- **Web:** 77.76% statements / 72.84% branches

### Demo Strategy — COMPLETE
- **Rich demo data** — Realistic seed data for both aesthetic clinic and dealership verticals
- **Interactive demo tour** — 9-step guided walkthrough with spotlight + tooltip overlays
- **Deployment docs** — Comprehensive DEPLOY.md with Railway, Docker, and troubleshooting

### UX Phase 1: "Role-based Modes + Mission Control + Saved Views" — COMPLETE (6/6 batches)
- **Role-based Modes** — Mode switcher (admin/agent/provider), mode-grouped sidebar nav with "More" toggle, role-appropriate landing pages, vertical-aware labels
- **Mission Control Dashboard** — KPI strip for agent/provider modes, "My Work" section (personal bookings + assigned conversations), AttentionCards component, mode-adaptive layout
- **Saved Views** — SavedView database model, full CRUD API (7 endpoints), ViewPicker + SaveViewModal on inbox/bookings/customers/waitlist, sidebar-pinned views, dashboard-pinned view cards
- **Staff preferences** — JSON column on Staff model for mode/landing path persistence
- **Final counts:** 2,533 tests total (972 web + 1,561 API)

### UX Phase 2: "Customer Hub + Unified Timeline + Global Search" (Bundle B) — COMPLETE (7/7 batches)
- **Customer Hub** — Redesigned `/customers/{id}` with sticky header, context row (last booking, last conversation, waitlist count), notes tab, message deep link, vertical modules
- **Customer Notes** — New `CustomerNote` model with full CRUD, staff ownership validation
- **Unified Timeline** — Timeline API endpoint (6 data sources: bookings, conversations, notes, waitlist, quotes, campaigns), `CustomerTimeline` component with type filtering, pagination, deep linking
- **Vertical Modules** — IntakeCard for aesthetic pack, quotes summary for dealership pack, collapsible sections
- **Enhanced Search** — Search API with offset, types filter, totals; Cmd+K fixed hrefs to detail pages, grouped results, vertical-aware labels, "View all results" link
- **Search Page** — New `/search` page with URL param sync, type filter chips with counts, grouped results, load more per section
- **Inbox Deep Linking** — `?conversationId=` URL param auto-selects conversation, customer name links to profile
- **Final counts:** 2,533 tests total (972 web + 1,561 API)

### Agentic-First Transformation — Milestone 1: "Agentic Foundations & Trust Rails" — COMPLETE (commit d8be527)
- **ActionCard model + API** — Full CRUD, approve/dismiss/snooze/execute actions, priority levels (LOW/MEDIUM/HIGH/URGENT), expiry cron job
- **ActionHistory model + API** — Unified audit trail with polymorphic entity references (entityType + entityId), performed-by tracking (STAFF/SYSTEM/AI)
- **AutonomyConfig model + API** — Per-action-type autonomy levels (OFF/SUGGEST/AUTO_WITH_REVIEW/FULL_AUTO), approval thresholds, cooldown, notification config
- **OutboundDraft model + API** — Staff-initiated outbound message drafts with scheduling, channel selection, queue/send lifecycle
- **Frontend components (14)** — ActionCard list/item/detail/badge/filters, ActionHistory list/item/filters, AutonomySettings/LevelPicker, OutboundCompose/DraftList, RecentChangesPanel
- **Integration points** — Inbox (ActionCardBadge + OutboundCompose), Customer detail (RecentChangesPanel), Mode config (/settings/autonomy)
- **Demo seed** — 7 action cards, 6 history entries, 3 autonomy configs, 2 outbound drafts
- **Final counts:** 2,703 tests total (1,637 API + 1,066 web), +170 new tests

### Agentic-First Transformation — Milestone 2: "Daily Briefing Agent" — COMPLETE
- **OpportunityDetectorService** — Cron-based scanner detecting deposit pending bookings, overdue replies, and open time slots
- **BriefingService** — Grouped ActionCard feed aggregating detected opportunities into a prioritized briefing
- **BriefingController** — `GET /briefing` (grouped feed) and `GET /briefing/opportunities` (raw opportunity list)
- **BriefingModule** — NestJS module wiring detector, service, and controller
- **Frontend components (3)** — BriefingCard, OpportunityCard, BriefingFeed in `components/briefing/`
- **Dashboard integration** — BriefingFeed rendered above admin metric cards, cards navigate to inbox/bookings/customers based on entity data
- **Final counts:** 2,761 tests total (1,661 API + 1,100 web), +58 new tests

### Agentic-First Transformation — Milestone 3: "Inbox-as-OS" — COMPLETE (5/5 batches)
- **Agent Framework** (Batch 3a) — 4 new Prisma models (AgentConfig, AgentRun, AgentFeedback, DuplicateCandidate), agent module with AgentFrameworkService, AgentSchedulerService, AgentController, AGENT_PROCESSING BullMQ queue
- **Conversation Action Handler** (Batch 3b) — ConversationActionHandler (`ai/conversation-action-handler.ts`) for executing conversation-level actions from action cards, ActionCardInline frontend component (`action-card-inline.tsx`)
- **Policy Compliance & Deposits** (Batch 3c) — PolicyComplianceService for automated policy enforcement, DepositCardHandler for deposit-related action cards, deposit-card.tsx frontend component
- **Human Takeover** (Batch 3d) — HumanTakeoverService for AI-to-human escalation flow, ClarificationHandler for requesting clarification from staff, human-takeover-banner.tsx frontend component
- **Vertical Actions** (Batch 3e) — VerticalActionHandler (`ai/vertical-action-handler.ts`) for vertical-specific action execution (aesthetic, dealership workflows)
- **Final counts:** 2,919 tests total (1,787 API + 1,132 web), +158 new tests

### Agentic-First Transformation — Milestone 4: "Background Agents" — COMPLETE
- **5 Background Agents** — WaitlistAgent (auto-match waitlist entries to cancelled slots), RetentionAgent (detect at-risk customers, generate win-back action cards), DataHygieneAgent (duplicate detection, incomplete profile flagging), SchedulingOptimizerAgent (gap detection, optimal slot suggestions), QuoteFollowupAgent (expired quote reminders, follow-up action cards)
- **Agent Scheduler** — Cron-driven scheduler runs agents per their AgentConfig schedule, tracks AgentRun status/results/errors
- **Agent Feedback** — New AgentFeedback API module with staff feedback CRUD and aggregation stats for agent run outcomes
- **Frontend components** — agent-feedback-buttons (thumbs up/down + comment), agent-performance (run history, success rates, feedback summary)
- **Settings page** — `/settings/agents` page for enabling/disabling agents, configuring schedules and autonomy levels per agent type
- **Retention & duplicate cards** — retention-card.tsx (win-back recommendations), duplicate-merge-card.tsx (merge/dismiss duplicate customers)

### Agentic-First Transformation — Milestone 5: "Vertical Pack Agents" — COMPLETE
- **Agent Skills Catalog** — New AgentSkills API module providing per-pack skill definitions with business-level overrides
- **Pack-specific agent behaviors** — Agents adapt skills and action card types based on business vertical pack (aesthetic: aftercare follow-ups, consult conversion; dealership: quote follow-up, service bay optimization)
- **Frontend components** — skill-card.tsx (skill catalog display with enable/disable), vertical-launch-checklist.tsx (vertical-specific agent readiness checklist)
- **Waitlist match cards** — waitlist-match-card.tsx for surfacing waitlist auto-match opportunities from WaitlistAgent
- **Quote followup cards** — quote-followup-card.tsx for surfacing expired/pending quote follow-up actions
- **AI state indicator** — ai-state-indicator.tsx showing real-time agent processing status
- **Final counts (all 5 milestones):** 3,158 tests total (1,937 API + 1,221 web)

### UX Upgrade Pack — Release 1 (Batches 1a–1h) — COMPLETE
- **Media Attachments** (Batch 1a) — New `MessageAttachment` model (id, messageId, businessId, fileName, fileType, fileSize, storageKey, thumbnailKey), new Attachment API module (`attachment.service.ts`, `attachment.controller.ts`, `attachment.module.ts`), endpoints: `POST /conversations/:id/messages/media`, `GET /attachments/:id/download`. 18 tests.
- **Delivery/Read Receipts** (Batch 1b) — New fields on Message model (`deliveryStatus`, `deliveredAt`, `readAt`, `failureReason`), `updateDeliveryStatus()` in MessageService, WebSocket `message:status` event, `POST /webhook/whatsapp/status` endpoint. 7 tests.
- **Inbox Media UI + Receipt Indicators** (Batch 1c) — New components: `delivery-status.tsx`, `media-message.tsx`, `media-composer.tsx` integrated into inbox page. 14 tests.
- **Outbound Initiation + Collision Detection** (Batch 1d) — `POST /outbound/send-direct` endpoint, presence tracking in InboxGateway (`viewing:start`/`viewing:stop`/`presence:update`), "Send Message" button on customer detail page, presence pills in inbox. 4 tests.
- **Calendar Month View** (Batch 1e) — `GET /bookings/calendar/month-summary` endpoint, month view with 6x7 CSS grid, colored dots (sage=confirmed, lavender=pending, red=cancelled), click-to-drill (day), prev/next month navigation. 13 tests.
- **Working Hours + Time-Off Visualization** (Batch 1f) — `GET /availability/calendar-context` endpoint, non-working hours shading (gray), time-off shading (red with "Time Off" badge). 6 tests.
- **Drag-and-Drop Reschedule + Recommended Slots** (Batch 1g) — `GET /availability/recommended-slots` endpoint (top 5 scored by proximity + staff balance), `RecommendedSlots` component, HTML5 DnD on calendar (draggable cards, drop targets, 30-min snap, conflict detection, confirmation popover). 7 tests.
- **Integration + Documentation** (Batch 1h) — Code formatting and documentation updates.
- **Final counts:** 3,227 tests total (1,982 API + 1,245 web), +69 new tests

### UX Upgrade Pack — Release 2 (Batches 2a–2g) — COMPLETE
- **CSV Export API** (Batch 2a) — New Export module (`export.service.ts`, `export.controller.ts`), endpoints: `GET /customers/export`, `GET /bookings/export` with streaming CSV response (RFC 4180), field selection, date range filters, 10k row cap. 20 tests.
- **Export UI + Duplicate Review Page** (Batch 2b) — `ExportModal` component with date range + field selection, `ExportButton` on customers/bookings pages, `/customers/duplicates` page with DuplicateMergeCard, status tabs (Pending/Snoozed/Resolved), merge/dismiss/snooze actions. 14 tests.
- **Audit Export + Timeline Polish** (Batch 2c) — `GET /action-history/export` CSV endpoint with date/entity/actor filters, customer timeline count badges per event type. 13 tests.
- **Today Timeline Component** (Batch 2d) — `TodayTimeline` component replacing flat appointments list on dashboard, vertical timeline with time markers (8AM–7PM), current time red indicator, gap indicators, quick action buttons (Start/Complete/No-Show/Open Chat). 14 tests.
- **Enhanced Attention Cards + Actionable KPIs** (Batch 2e) — Primary action buttons on attention cards (Send Reminders/Open Queue/Confirm Schedule), "Resolve next" button, expand/collapse for >3 items, clickable KPI cards linking to relevant pages with action subtitles. 16 tests.
- **Briefing Card Snooze + Expandable Details** (Batch 2f) — Snooze dropdown (1h/4h/tomorrow/next week) on briefing cards, expandable detail section (booking info, staff, suggested action), category border colors (red=urgent, lavender=approval, sage=opportunity), auto-refresh every 5 minutes. 11 tests.
- **Integration + Documentation** (Batch 2g) — ActionHistory logging for CSV exports, i18n keys for new Release 2 features, documentation updates.
- **Final counts:** 3,309 tests total (2,003 API + 1,306 web), +82 new tests

### UX Upgrade Pack — Release 3 (Batches 3a–3f) — COMPLETE
- **Add-to-Calendar** (Batch 3a) — Client-side calendar add buttons on all self-serve success screens (Google Calendar URL, Outlook URL, iCal .ics download), `AddToCalendar` component. 12 tests.
- **Branded Error Pages + Confirmation Polish** (Batch 3b) — `SelfServeError` component with auto-variant detection (expired/used/invalid/policy/generic), "Book Again" link, branded error pages on all 4 manage pages. "What happens next" bullet points on all 5 success screens (booking, reschedule, cancel, quote, claim). 22 tests.
- **Automation Playbook UX Overhaul** (Batch 3c) — Rich `PlaybookCard` component with expandable recipe details (what/when/who/examples/sample message), impact stats from AutomationLog (`getPlaybookStats` API), color-coded borders per playbook. 15 tests.
- **Custom Rule Builder Enhancement** (Batch 3d) — Example scenarios per trigger, `getFilterPreview()` plain-language filter preview, `getActionPreview()` action preview, `getPlainLanguageSummary()` full summary on review step, persistent safety bar. 11 tests.
- **Real Dry-Run + Searchable Activity Log** (Batch 3e) — Enhanced `testRule()` returning real matched/skipped bookings by trigger type, `DryRunModal` component, activity log filters (search input, outcome chips, date range), clear filters. Enhanced `getLogs()` with search/outcome/dateFrom/dateTo params. 25 tests.
- **Safety Controls + Integration** (Batch 3f) — Safety controls summary panel (quiet hours, frequency cap badges) on playbooks/rules tabs, Safety column in custom rules table showing per-rule quiet hours and frequency caps, documentation updates. 6 tests.
- **Final counts:** 3,402 tests total (2,010 API + 1,392 web), +93 new tests

---

## 3. Tech Stack

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
| Cache/Queue | Redis 7 + BullMQ | - |
| Monorepo | Turborepo | 2.x |
| CI/CD | GitHub Actions → Railway | - |
| Monitoring | Sentry | - |
| Linting | ESLint 9 + Prettier | - |

---

## 4. Monorepo Structure

```
booking-os/
├── apps/
│   ├── api/                    # NestJS REST API (port 3001)
│   │   ├── src/
│   │   │   ├── modules/        # 57 feature modules
│   │   │   ├── common/         # Guards, decorators, filters, DTOs, Prisma service
│   │   │   └── main.ts         # Bootstrap, Swagger, CORS, cookies, validation
│   │   └── Dockerfile          # Multi-stage production build
│   ├── web/                    # Next.js admin dashboard (port 3000)
│   │   ├── src/
│   │   │   ├── app/            # 77 pages
│   │   │   ├── components/     # Shared components (shell, modals, tour, etc.)
│   │   │   ├── lib/            # Utility modules (API client, auth, i18n, socket, theme)
│   │   │   ├── locales/        # en.json, es.json (600+ keys each)
│   │   │   └── middleware.ts   # Route protection (checks access_token cookie)
│   │   └── Dockerfile          # Multi-stage production build
│   └── whatsapp-simulator/     # WhatsApp testing tool (port 3002)
├── packages/
│   ├── db/                     # Prisma schema (57 models), migrations, seed scripts
│   │   ├── prisma/schema.prisma
│   │   ├── src/seed.ts         # Base seed (idempotent)
│   │   ├── src/seed-demo.ts    # Rich demo data (idempotent)
│   │   ├── src/seed-agentic.ts # One-time agentic data fill (production)
│   │   └── src/seed-content.ts # Content pillar seeding (12 blog posts → ContentDraft)
│   ├── messaging-provider/     # WhatsApp Cloud API abstraction
│   └── shared/                 # Shared types, DTOs, enums, profile field definitions
├── docs/
│   ├── PROJECT_CONTEXT.md      # This file
│   ├── cicd.md                 # CI/CD pipeline documentation
│   ├── user-stories.md         # Complete user stories (280 can-do, 215 gaps)
│   └── ux-brainstorm-brief.md  # UX improvement brainstorm brief
├── nginx/                      # Reverse proxy config for self-hosted
├── scripts/
│   └── docker-entrypoint.sh    # API startup: migrations → server
├── docker-compose.yml          # Local development
├── docker-compose.prod.yml     # Production (Nginx + SSL)
├── docker-compose.demo.yml     # Demo quick-start (auto-seeds)
├── DEPLOY.md                   # Comprehensive deployment & operations guide
├── CLAUDE.md                   # Design system + deployment rules for AI assistants
└── .github/workflows/ci.yml   # CI/CD pipeline
```

---

## 5. Database Schema (53 Models)

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
               ├── (1) Subscription ──── (*) BillingCredit
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
               ├── (*) DuplicateCandidate
               ├── (*) Referral (referrer ↔ referred businesses)
               ├── (*) StaffServicePrice (per-staff pricing overrides)
               └── (*) SupportCase ──── (*) SupportCaseNote
ViewAsSession ──── Staff (superAdmin) + Business (target)
PlatformAuditLog (standalone)
PlatformAgentDefault (standalone — platform-wide agent governance)
PlatformSetting (standalone — platform-wide configuration)
```

### Key Enums

```
StaffRole:          OWNER, ADMIN, AGENT, SERVICE_PROVIDER, SUPER_ADMIN
BookingStatus:      PENDING, PENDING_DEPOSIT, CONFIRMED, IN_PROGRESS, COMPLETED, CANCELLED, NO_SHOW
KanbanStatus:       CHECKED_IN, DIAGNOSING, AWAITING_APPROVAL, IN_PROGRESS, READY_FOR_PICKUP
ConversationStatus: OPEN, WAITING, RESOLVED, SNOOZED
ServiceKind:        CONSULT, TREATMENT, OTHER
VerticalPack:       AESTHETIC, SALON, TUTORING, GENERAL, DEALERSHIP
```

### Key Models

| Model | Key Fields | Notes |
|-------|-----------|-------|
| **Business** | name, slug (unique), timezone, verticalPack, packConfig (JSON), aiSettings (JSON), policySettings (JSON), defaultLocale | Multi-tenant root |
| **Staff** | email (unique), role, passwordHash, isActive, emailVerified, locale, preferences (JSON) | Auth + assignment + mode prefs |
| **Customer** | phone (unique per biz), tags[], customFields (JSON) | Vertical-specific fields, has CustomerNotes |
| **CustomerNote** | customerId (FK), staffId (FK), businessId (FK), content | Staff ownership validation for edit/delete |
| **Service** | kind (CONSULT/TREATMENT/OTHER), depositRequired, bufferBefore/After, isActive | Catalog item |
| **Booking** | status (7 states), kanbanStatus, locationId, resourceId, recurringSeriesId, customFields (JSON) | Core scheduling |
| **Location** | name, address, isBookable, whatsappConfig (JSON), isActive | Multi-location |
| **Resource** | locationId, type, metadata (JSON), isActive | Equipment/bays |
| **Quote** | bookingId, totalAmount, status (PENDING/APPROVED/REJECTED), approverIp | Service quotes |
| **Conversation** | channel (WHATSAPP/WEB), status, tags[], metadata (JSON for AI state), locationId | Messaging |
| **WaitlistEntry** | status (ACTIVE/OFFERED/BOOKED/EXPIRED/CANCELLED), offeredSlot (JSON) | Smart waitlist |
| **AutomationRule** | trigger (6 types), filters (JSON), actions (JSON), quietStart/End | Automation engine |
| **Campaign** | filters (JSON), throttlePerMinute, stats (JSON) | Bulk messaging |
| **SavedView** | businessId, staffId, page, name, filters (JSON), icon, color, isPinned, isDashboard, isShared, sortOrder | Named filter presets |
| **ActionCard** | businessId, type (DEPOSIT_PENDING/OVERDUE_REPLY/OPEN_SLOT/etc.), category (URGENT_TODAY/NEEDS_APPROVAL/OPPORTUNITY/HYGIENE), priority (0-100 int), title, description ("Because..." text), suggestedAction, preview (JSON diff), ctaConfig (JSON buttons), status (PENDING/APPROVED/DISMISSED/SNOOZED/EXECUTED/EXPIRED), autonomyLevel (OFF/ASSISTED/AUTO), snoozedUntil, expiresAt, bookingId?, customerId?, conversationId?, staffId?, resolvedById?, metadata | Agentic action recommendations with approve/dismiss/snooze/execute |
| **ActionHistory** | businessId, actorType (STAFF/AI/SYSTEM/CUSTOMER), actorId?, actorName?, action (BOOKING_CREATED/CARD_APPROVED/etc.), entityType (BOOKING/CONVERSATION/CUSTOMER/ACTION_CARD/SETTING), entityId, description?, diff (JSON before/after), metadata | Unified polymorphic audit trail |
| **AutonomyConfig** | businessId, actionType (unique per biz), autonomyLevel (OFF/ASSISTED/AUTO), requiredRole?, constraints (JSON {maxPerDay, maxAmount, etc.}) | Per-action-type autonomy level configuration |
| **OutboundDraft** | businessId, customerId (FK), staffId (FK), channel (WHATSAPP), content, status (DRAFT/APPROVED/SENT/REJECTED), approvedById?, sentAt?, conversationId? | Staff-initiated outbound message drafts |
| **AgentConfig** | businessId, agentType (WAITLIST/RETENTION/DATA_HYGIENE/SCHEDULING_OPTIMIZER/QUOTE_FOLLOWUP), isEnabled, autonomyLevel (AUTO/SUGGEST/REQUIRE_APPROVAL), config (JSON), roleVisibility (String[]) | Per-business agent configuration |
| **AgentRun** | businessId, agentType, status (RUNNING/COMPLETED/FAILED), cardsCreated (Int), error?, startedAt, completedAt | Agent execution run tracking |
| **AgentFeedback** | businessId, actionCardId (FK), staffId (FK), rating (HELPFUL/NOT_HELPFUL), comment? | Staff feedback on agent suggestions |
| **DuplicateCandidate** | businessId, customerId1 (FK), customerId2 (FK), confidence (Float), matchFields (String[]), status (PENDING/MERGED/NOT_DUPLICATE/SNOOZED), resolvedBy?, resolvedAt | Duplicate customer detection candidates |
| **MessageAttachment** | id, messageId (FK), businessId (FK), fileName, fileType, fileSize (Int), storageKey, thumbnailKey?, createdAt | Media attachments on messages (images, docs, audio) |
| **ViewAsSession** | superAdminId (FK), targetBusinessId (FK), reason, startedAt, endedAt?, expiresAt, actionsLog (JSON) | Time-limited view-as session for Super Admin tenant impersonation |
| **PlatformAuditLog** | actorId, actorEmail, action, targetType?, targetId?, reason?, metadata (JSON), createdAt | Platform-level audit trail for Super Admin actions |
| **SupportCase** | businessId (FK), businessName, subject, description, status (open/in_progress/resolved/closed), priority (low/normal/high/urgent), category?, resolution?, resolvedAt?, closedAt?, createdById | Support case tracking for platform console |
| **SupportCaseNote** | caseId (FK), authorId, authorName, content, createdAt | Notes on support cases with cascade delete |
| **BillingCredit** | businessId (FK), amount (Decimal), reason, appliedById, appliedByEmail, createdAt | Platform-issued billing credits for businesses |
| **PlatformAgentDefault** | agentType (unique), maxAutonomyLevel, defaultEnabled, confidenceThreshold (Float), requiresReview, updatedById? | Platform-wide agent governance defaults per agent type |
| **PlatformSetting** | key (unique), value (JSON), category, description?, isDefault, updatedById?, updatedAt | Platform-wide configuration settings (security, notifications, regional, platform) |
| **Referral** | referrerBusinessId (FK), referredBusinessId (FK), referralCode, status (PENDING/CONVERTED/CREDITED), creditAmount (default $50), convertedAt?, creditedAt? | Referral program tracking with Stripe credit application |
| **StaffServicePrice** | staffId (FK), serviceId (FK), businessId (FK), price (Float), unique(staffId, serviceId) | Per-staff pricing overrides for services |

### Subscription Model — Updated Fields
The Subscription model now includes additional billing management fields:
- `canceledAt` — Timestamp when subscription was canceled
- `cancelReason` — Reason provided for cancellation
- `planChangedAt` — Timestamp of last plan change

### Message Model — Updated Fields
The Message model now includes delivery receipt fields:
- `deliveryStatus` — SENT/DELIVERED/READ/FAILED
- `deliveredAt` — Timestamp when message was delivered
- `readAt` — Timestamp when message was read
- `failureReason` — Error description if delivery failed

---

## 6. API Modules (51 Modules)

All endpoints prefixed with `/api/v1`. Swagger docs at `/api/docs` (dev only).

| Module | Route Prefix | Key Operations |
|--------|-------------|----------------|
| **Auth** | `/auth` | signup, login, refresh, logout, forgot/reset/change password, accept-invite, verify-email |
| **Bookings** | `/bookings` | CRUD, status change, kanban status, calendar view (day/week/month), month summary, kanban board, bulk ops, deposit/reschedule/cancel links, policy check |
| **Recurring** | `/bookings/recurring` | Create series, cancel (single/future/all) |
| **Customers** | `/customers` | CRUD, search, bulk tag, CSV import, conversation import, notes CRUD, timeline |
| **Services** | `/services` | CRUD with soft delete |
| **Staff** | `/staff` | CRUD, invite, working hours, time off, per-staff service pricing |
| **Business** | `/business` | Profile, policies, notifications, waitlist settings, install pack, activation status, NPS submission |
| **Locations** | `/locations` | CRUD locations, resources, staff assignments |
| **Conversations** | `/conversations` | List, assign, status, snooze, tags, messages, notes, booking creation |
| **Messages** | `/conversations/:id/messages` | Send message |
| **Templates** | `/templates` | Full CRUD |
| **Dashboard** | `/dashboard` | Stats, AI usage, dismiss nudge |
| **Reports** | `/reports` | 9 report types (bookings, revenue, no-shows, staff perf, peak hours, etc.), CSV/PDF export, automated scheduled report emails (ReportSchedule CRUD, @Cron hourly, BullMQ NOTIFICATIONS queue) |
| **ROI** | `/roi` | Go-live, baseline, dashboard, weekly review |
| **AI** | `/ai` | Settings, conversation summary, booking/cancel/reschedule confirm, customer chat |
| **Availability** | `/availability` | Available slots (by date, service, staff, location, resource), calendar context (working hours + time off), recommended slots (top 5 scored) |
| **Search** | `/search` | Global search with offset, types filter, totals |
| **Automations** | `/automations` | Playbooks toggle, rules CRUD, test, activity log |
| **Campaigns** | `/campaigns` | CRUD, audience preview, send, recurring schedules, stop recurrence |
| **Offers** | `/offers` | CRUD, redeem |
| **Quotes** | `/quotes` | Create, view, per-booking |
| **Waitlist** | `/waitlist` | List, update, cancel, resolve |
| **Billing** | `/billing` | Checkout, portal, subscription, webhook, deposit, dunning trigger |
| **Calendar Sync** | `/calendar-sync` | OAuth connect/disconnect (Google/Outlook), iCal feed, manual sync |
| **iCal Feed** | `/ical` | Token-based iCal feed |
| **Translations** | `/translations` | Get/upsert/delete per locale |
| **Pack Builder** | `/admin/packs` | CRUD packs, versioning, publish (SUPER_ADMIN only) |
| **Vertical Packs** | `/vertical-packs` | Get pack config (public) |
| **Public Booking** | `/public` | Business info, services, availability, book, join waitlist |
| **Self-Serve** | `/self-serve` | Reschedule, cancel, waitlist claim, quote approval (token-based) |
| **Saved Views** | `/saved-views` | CRUD, list by page, pinned views, dashboard views, share/unshare |
| **Health** | `/health` | DB + Redis health check with latency |
| **Action Card** | `/action-cards` | Action card CRUD, approve/dismiss/snooze/execute, expiry cron |
| **Action History** | `/action-history` | Unified audit trail, polymorphic entity references |
| **Autonomy** | `/autonomy` | Per-action-type autonomy configs, level checking |
| **Outbound** | `/outbound` | Staff-initiated outbound message drafts |
| **Briefing** | `/briefing` | Daily briefing feed (grouped action cards) and opportunity detection (deposit pending, overdue replies, open slots) |
| **Agent** | `/agent` | Agent framework CRUD, agent runs, scheduling, AGENT_PROCESSING queue, 5 background agents (waitlist, retention, data-hygiene, scheduling-optimizer, quote-followup) |
| **Agent Feedback** | `/agent-feedback` | Staff feedback CRUD on agent run outcomes, aggregation stats |
| **Agent Skills** | `/agent-skills` | Skills catalog per vertical pack, business-level overrides |
| **Attachment** | `/attachments` | Media attachment upload (`POST /conversations/:id/messages/media`) and download (`GET /attachments/:id/download`) |
| **Console Overview** | `/admin/overview` | Platform KPIs (businesses, bookings, staff, agents, support, security) |
| **Console Audit** | `/admin/audit-logs` | Searchable/filterable platform audit log, action types |
| **Console Health** | `/admin/health` | System health checks (DB, business activity, agents, calendar, messaging) + business health distribution |
| **Console Support** | `/admin/support-cases` | Support case CRUD, notes, status management (open/in_progress/resolved/closed) |
| **Console Billing** | `/admin/billing`, `/admin/businesses/:id/billing` | Platform-wide billing dashboard (subscription stats, plan distribution, MRR, past-due list), per-business billing operations (subscription details, plan change, credits, cancel/reactivate, invoices) |
| **Console Packs** | `/admin/packs-console` | Pack registry with version history, install counts, business list per pack (Phase 4) |
| **Console Skills** | `/admin/skills-console` | Skills catalog with per-pack filtering, skill detail (Phase 4) |
| **Console Agents** | `/admin/agents-console` | Agent performance dashboard, action card funnel, top failures, abnormal tenants, tenant agent status, pause/resume, platform defaults (Phase 5) |
| **Console Messaging** | `/admin/messaging-console` | Messaging dashboard (sent/delivered/failed, delivery rate), webhook health, failure reasons, impacted tenants, tenant messaging status, fix checklist (Phase 5) |
| **Console Settings** | `/admin/settings` | Platform settings CRUD (security, notifications, regional, platform categories), bulk update (Phase 6) |
| **Referral** | `/referral` | Referral link, referral stats, code generation (ADMIN only) |
| **Dunning** | — (internal) | 3-email dunning sequence via BullMQ, auto-downgrade after 14 days |
| **Weekly Digest** | — (cron) | Weekly digest email (Monday 9am), opt-out via packConfig |
| **Onboarding Drip** | — (internal) | 13-email onboarding sequence via BullMQ delayed jobs |
| **Content Queue** | `/content-queue` | Content draft approval queue: create, list, get, update, approve, reject, bulk-approve, bulk-reject, stats (9 endpoints) |
| **Marketing Agent** | — (internal) | 12 autonomous marketing agents (6 content, 2 distribution, 4 analytics) registered with AgentFrameworkService |
| **Email Sequences** | `/email-sequences` | Email drip campaigns: CRUD, stats, enroll, enrollments, cancel/pause/resume, seed (12 endpoints). 7 default sequences |
| **Portal** | `/portal` | Customer self-service portal: OTP auth (WhatsApp), magic link auth (email), profile, bookings (paginated), upcoming. PortalGuard with portal JWT (24h, type: 'portal') |
| **Export** | `/customers/export`, `/bookings/export`, `/reports/:type/export` | CSV/PDF export for customers, bookings, and all 10 report types |

### Auth & Multi-tenancy
- JWT in httpOnly cookies (access: 15 min, refresh: 7 days), automatic client-side refresh on 401
- Cookie domain auto-derived from `CORS_ORIGINS` for subdomain sharing (`.businesscommandcentre.com`)
- `sameSite: lax`, `secure: true` in production — see DEPLOY.md section 6 for critical rules
- Token blacklisting on logout and password change
- `TenantGuard` + `@BusinessId()` for tenant isolation
- `@Roles()` + `RolesGuard` for role-based access
- Brute force protection: 5 failed attempts = 15-min lockout
- Rate limiting per endpoint (signup: 3/min, login: 10/min, etc.)

---

## 7. Frontend Pages (66 Pages)

### Public Pages
| Page | Route | Description |
|------|-------|-------------|
| Login | `/login` | Email + password auth |
| Sign Up | `/signup` | New business registration |
| Forgot Password | `/forgot-password` | Password reset email |
| Reset Password | `/reset-password?token=` | Set new password |
| Verify Email | `/verify-email?token=` | Email verification |
| Accept Invite | `/accept-invite?token=` | Staff invitation acceptance |
| Public Booking | `/book/[slug]` | Customer booking portal (5-step wizard) |
| Reschedule | `/manage/reschedule/[token]` | Customer reschedule page |
| Cancel | `/manage/cancel/[token]` | Customer cancel page |
| Claim | `/manage/claim/[token]` | Waitlist claim page |
| Quote | `/manage/quote/[token]` | Quote approval page |
| Portal Login | `/portal/[slug]` | Customer portal login (phone OTP + email magic link) |
| Portal Dashboard | `/portal/[slug]/dashboard` | Customer welcome page, upcoming bookings, quick actions |
| Portal Bookings | `/portal/[slug]/bookings` | Customer booking history with status filters, pagination |
| Portal Profile | `/portal/[slug]/profile` | Customer profile editor with stats and notification prefs |

### Protected Pages
| Page | Route | Description |
|------|-------|-------------|
| Setup Wizard | `/setup` | 10-step onboarding |
| Dashboard | `/dashboard` | KPI metrics, attention items, checklist, milestones |
| Bookings | `/bookings` | Filterable list, bulk actions, detail modal |
| Calendar | `/calendar` | Day/week/month view, staff columns, click-to-book, drag-and-drop reschedule, working hours/time-off visualization, recommended slots |
| Inbox | `/inbox` | 3-pane messaging with AI suggestions, media attachments, delivery/read receipts, presence indicators |
| Customers | `/customers` | Search, import, bulk tag |
| Customer Detail | `/customers/[id]` | Profile hub: AI chat, timeline, notes, bookings, info, vertical modules |
| Search | `/search` | Full search results page with type filters, grouped results, load more |
| Services | `/services` | Category-grouped CRUD |
| Staff | `/staff` | Expandable table with hours + time off |
| Waitlist | `/waitlist` | Entry management with filters |
| Campaigns | `/campaigns` | Campaign list |
| Campaign New/Edit | `/campaigns/new`, `/campaigns/[id]` | 4-step builder wizard |
| Automations | `/automations` | Playbooks, custom rules, activity log |
| Automation New | `/automations/new` | Rule builder wizard |
| Reports | `/reports` | 9 chart types |
| ROI Dashboard | `/roi` | Baseline vs current metrics |
| Service Board | `/service-board` | Kanban board (dealership) |
| Settings | `/settings/*` | 13 settings sub-pages (account, AI, AI Autonomy, Agent Skills, agents, templates, translations, calendar, billing, notifications, offers, policies, waitlist, profile fields); hub page links to all sub-pages |
| Marketing Queue | `/marketing/queue` | Content approval queue with card-based review, filter tabs, stats strip |
| Marketing Agents | `/marketing/agents` | 12 marketing agents dashboard with tab filters (Content/Distribution/Analytics), toggle, Run Now |
| Marketing Sequences | `/marketing/sequences` | Email sequence management with stats, toggle, expand timeline |

### Public Marketing Pages
| Page | Route | Description |
|------|-------|-------------|
| Landing Page | `/` | Hero, features, pricing, CTA sections |
| Blog | `/blog` | Blog index with category badges, 12 posts across 5 pillars |
| Blog Post | `/blog/[slug]` | Individual post with JSON-LD, OpenGraph, markdown rendering |
| Pricing | `/pricing` | Detailed plan comparison |
| FAQ | `/faq` | Frequently asked questions |

### Console Pages (Super Admin Only)
| Page | Route | Description |
|------|-------|-------------|
| Console Overview | `/console` | Platform KPIs, billing breakdown, support cases, security summary, audit feed |
| Business Directory | `/console/businesses` | Search, filter by plan/billing/health, paginated table |
| Business 360 | `/console/businesses/[id]` | Summary, People, and Billing tabs (subscription info, plan change, credits, cancel/reactivate, invoices) |
| Security & Audit | `/console/audit` | Audit log explorer with search, action type filter, paginated table |
| System Health | `/console/health` | Overall status, 5 service checks, business health distribution |
| Support Cases | `/console/support` | Full CRUD with search, status/priority filters, case detail drawer, notes |
| Billing Dashboard | `/console/billing` | Subscription stats, plan distribution, MRR, churn rate, past-due businesses |
| Past-Due | `/console/billing/past-due` | Filtered list of past-due businesses with quick actions |
| Subscriptions | `/console/billing/subscriptions` | All subscriptions with search, plan/status filters, sortable table |
| Pack Registry | `/console/packs` | Vertical pack registry with search, version history, install counts (Phase 4) |
| Pack Detail | `/console/packs/[slug]` | Pack detail with version timeline, installed businesses, skills list (Phase 4) |
| Skills Catalog | `/console/packs/skills` | Skills catalog with per-pack filtering (Phase 4) |
| AI & Agents | `/console/agents` | 3-tab interface: Performance (KPIs, agent breakdown, funnel, failures, abnormal tenants), Tenant Controls (search, pause/resume, agent config), Platform Defaults (governance table) (Phase 5) |
| Messaging Ops | `/console/messaging` | 2-tab interface: Dashboard (KPIs, webhook health, failure reasons, impacted tenants), Tenant Status (WhatsApp config, delivery rate, expandable fix checklist) (Phase 5) |
| Platform Settings | `/console/settings` | 4-category settings (Security, Notifications, Regional, Platform) with bulk save, maintenance mode confirmation modal (Phase 6) |

### Key Components
- `Shell` — Sidebar nav with mode-grouped items + "More" toggle, pinned saved views, i18n, pack provider, dark mode, tour trigger
- `BookingFormModal` / `BookingDetailModal` — Create/view/reschedule bookings
- `AiSuggestions` / `AiBookingPanel` / `AiSummary` — AI features in inbox
- `CommandPalette` — Cmd+K global search with grouped results, vertical-aware labels, deep links
- `CustomerTimeline` — Unified activity timeline (6 event types) with filters, pagination, deep links
- `IntakeCard` — Vertical-specific customer fields card (aesthetic clinic intake)
- `BulkActionBar` — Multi-select action bar
- `DemoTourProvider` / `TourSpotlight` / `TourTooltip` — Interactive demo tour
- `LanguagePicker` — Locale selector
- `TooltipNudge` — Dismissible coaching tooltips
- `Skeleton` / `EmptyState` — Loading and empty states
- `ModeSwitcher` — Role-based mode pill/tab selector (admin/agent/provider)
- `ViewPicker` / `SaveViewModal` — Saved filter views on list pages
- `KpiStrip` / `MyWork` / `AttentionCards` — Mission Control dashboard components
- `ActionCardList` / `ActionCardItem` / `ActionCardDetail` / `ActionCardBadge` / `ActionCardFilters` — Agentic action card components (approve, dismiss, snooze, execute) with contextual CTA labels per card type (e.g., "Send Reminder", "Nudge Staff", "Follow Up" instead of generic "Approve")
- `ActionHistoryList` / `ActionHistoryItem` / `ActionHistoryFilters` — Unified audit trail components
- `AutonomySettings` / `AutonomyLevelPicker` — Autonomy configuration UI
- `OutboundCompose` / `OutboundDraftList` — Staff-initiated outbound message drafts
- `RecentChangesPanel` — Customer detail panel showing recent action history
- `BriefingFeed` / `BriefingCard` / `OpportunityCard` — Daily briefing components (grouped action cards, opportunity detection results, dashboard integration); briefing cards use dedicated approve/dismiss API routes (`PATCH /action-cards/:id/approve`, `PATCH /action-cards/:id/dismiss`) with contextual CTA labels per card type
- `ActionCardInline` — Inline action card component for conversation-level actions (Milestone 3)
- `DepositCard` — Deposit-related action card component with policy compliance (Milestone 3)
- `HumanTakeoverBanner` — AI-to-human escalation banner with clarification flow (Milestone 3)
- `AgentFeedbackButtons` / `AgentPerformance` — Staff feedback on agent runs (thumbs up/down, comments), agent run history and success rate stats (Milestone 4)
- `RetentionCard` — Win-back action card for at-risk customers detected by RetentionAgent (Milestone 4)
- `DuplicateMergeCard` — Duplicate customer merge/dismiss card from DataHygieneAgent (Milestone 4)
- `WaitlistMatchCard` — Waitlist auto-match opportunity card from WaitlistAgent (Milestone 5)
- `QuoteFollowupCard` — Expired/pending quote follow-up card from QuoteFollowupAgent (Milestone 5)
- `SkillCard` — Agent skill catalog display with enable/disable per business (Milestone 5)
- `VerticalLaunchChecklist` — Vertical-specific agent readiness checklist (Milestone 5)
- `AiStateIndicator` — Real-time agent processing status indicator (Milestone 5)
- `DeliveryStatus` — Message delivery/read receipt indicator (UX Upgrade Pack R1)
- `MediaMessage` — Media attachment display (images, docs, audio) in inbox messages (UX Upgrade Pack R1)
- `MediaComposer` — Media file attachment composer for outbound messages (UX Upgrade Pack R1)
- `RecommendedSlots` — Top 5 recommended reschedule slots scored by proximity + staff balance (UX Upgrade Pack R1)
- `ExportModal` — CSV export modal with date range + field selection (UX Upgrade Pack R2)
- `TodayTimeline` — Vertical chronological timeline of today's bookings with quick actions (UX Upgrade Pack R2)
- `AttentionCard` — Enhanced attention card with primary action buttons, expand/collapse, resolve-next navigation (UX Upgrade Pack R2)
- `KpiStrip` — Clickable KPI cards with action subtitles and role-based metrics (UX Upgrade Pack R2)

---

## 8. AI Architecture

| Component | Purpose |
|-----------|---------|
| `ClaudeClient` | API wrapper with error handling, graceful degradation |
| `IntentDetector` | Classifies: GENERAL_INQUIRY, BOOK_APPOINTMENT, CANCEL_APPOINTMENT, RESCHEDULE_APPOINTMENT, TRANSFER_TO_HUMAN |
| `ReplyGenerator` | Contextual reply drafts using conversation history + business context |
| `BookingAssistant` | Multi-step booking: service → date → time → confirm |
| `CancelAssistant` | Identifies and cancels bookings from conversation |
| `RescheduleAssistant` | Identifies and reschedules bookings |
| `ProfileCollector` | Conversationally collects missing required profile fields |
| `AiService` | Orchestrator: routes intents, manages state, handles auto-reply |

AI state persisted in `conversation.metadata` JSON for stateful multi-turn flows.

**Auto-reply modes:** Draft (default), auto-reply all, selective auto-reply, transfer to human.

---

## 9. Real-Time Architecture (Socket.io)

| Event | Trigger |
|-------|---------|
| `message:new` | New inbound/outbound message |
| `conversation:updated` | Status, assignment, tag changes |
| `ai:suggestion` | AI generates reply suggestion |
| `ai:auto-replied` | AI sent auto-reply |
| `ai:transfer-to-human` | AI escalated to human |
| `booking:updated` | Booking created/updated |
| `ai:booking-state` | AI booking assistant progress |
| `action-card:created` | New action card created by agent or system |
| `action-card:updated` | Action card status change (approve/dismiss/snooze/execute) |
| `message:status` | Message delivery/read receipt update (UX Upgrade Pack R1) |
| `viewing:start` / `viewing:stop` | Presence tracking — staff viewing a conversation (UX Upgrade Pack R1) |
| `presence:update` | Presence indicator update for inbox collision detection (UX Upgrade Pack R1) |

---

## 10. CI/CD Pipeline

```
Push to main → lint-and-test → docker-build → deploy (Railway)
Pull request → lint-and-test → docker-build (no deploy)
```

- **lint-and-test:** PostgreSQL 16 service, Prisma generate + migrate, format check, lint, test
- **docker-build:** Multi-stage Docker builds for API and web
- **deploy:** `railway up --service api/web --detach` (async — takes 2-5 min after CI)
- **Migrations:** Auto-run via `scripts/docker-entrypoint.sh` on container startup
- **Full docs:** `docs/cicd.md` and `DEPLOY.md`

### Railway Production

| Property | Value |
|----------|-------|
| Project ID | `37eeca20-7dfe-45d9-8d29-e902a545f475` |
| API domain | `api.businesscommandcentre.com` |
| Web domain | `businesscommandcentre.com` |
| Services | api, web, postgres, redis |

---

## 11. Seed Data

Two scripts, both idempotent:

**`packages/db/src/seed.ts`** — Base data:
- Glow Aesthetic Clinic (aesthetic pack): 3 staff, 5 services, 4 customers, 7 templates, conversations, bookings, reminders, ROI baseline
- Metro Auto Group (dealership pack): 7 staff, 5 services, 4 locations, 10 resources, 2 customers, 5 templates

**`packages/db/src/seed-demo.ts`** — Rich demo data:
- Clinic: 20 customers, 36 bookings, 8 conversations, 6 waitlist entries, 3 campaigns, 3 automation rules, 5 payments, 7 action cards, 6 action history, 3 autonomy configs, 2 outbound drafts
- Dealership: 15 customers, 25 bookings with kanban statuses, 3 quotes, 4 conversations, 2 automation rules

**`packages/db/src/seed-agentic.ts`** — One-time agentic data fill (used for production):
- 6 autonomy configs, 7 action history entries, 2 outbound drafts, 9 agent configs (across both businesses)
- Cleans up duplicate business entries if present

**`packages/db/src/seed-console.ts`** — Platform Console base data:
- Creates "Booking OS Platform" business (slug: `platform`, verticalPack: `general`)
- Creates Super Admin staff: `admin@businesscommandcentre.com` / `superadmin123`
- Idempotent (checks before inserting)

**`packages/db/src/seed-console-showcase.ts`** — Console showcase data:
- Creates 6 diverse businesses with varied health states (green/yellow/red), plans (basic/pro), billing statuses (active/past_due/canceled), verticals, and timezones
- Each business gets staff, customers, services, bookings, conversations, subscriptions
- Used to populate the Business Directory with realistic data for demos

**`packages/db/src/seed-content.ts`** — Content pillar seed data:
- Creates 12 APPROVED ContentDraft records per business (one per blog post)
- Covers 5 pillars: Industry Insights, Product Education, Customer Success, Thought Leadership, Technical
- Idempotent (checks title+businessId before inserting)
- Run: `npx tsx packages/db/src/seed-content.ts`

---

## 12. Environment Variables

Key groups (full list in `.env.example`):

| Group | Variables | Required |
|-------|----------|----------|
| Database | `DATABASE_URL` | Always |
| JWT | `JWT_SECRET`, `JWT_REFRESH_SECRET` | Always |
| URLs | `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_WS_URL` | Always |
| CORS | `CORS_ORIGINS` | Production (also determines cookie domain) |
| AI | `ANTHROPIC_API_KEY` | AI features |
| WhatsApp | `WHATSAPP_*` | Production messaging |
| Stripe | `STRIPE_*` | Billing |
| Calendar | `GOOGLE_*`, `MICROSOFT_*`, `CALENDAR_ENCRYPTION_KEY` | Calendar sync |
| Redis | `REDIS_URL` | Job queues, WebSocket scaling |
| Sentry | `SENTRY_DSN` | Error tracking |

**Critical:** `NEXT_PUBLIC_*` vars are baked at build time. `CORS_ORIGINS` drives cookie domain. See `DEPLOY.md` section 6.

---

## 13. Design System

### "Minimalist Premium" — Apple Health meets Stripe
- **Fonts:** Inter (body/UI), Playfair Display (headers/display)
- **Colors:** Sage (primary/success), Lavender (AI/pending), warm off-white backgrounds
- **Style:** `rounded-2xl`, `shadow-soft`, no borders, no external component libraries
- **Status badges:** Sage=confirmed, Lavender=pending, Red-50=cancelled, Amber-50=in-progress
- **AI elements:** Lavender palette
- **Dark mode:** Full coverage, system preference detection
- **Animations:** slideUp, fadeIn, scaleIn (respects prefers-reduced-motion)

---

## 14. Roadmap — What's Next

### Agentic-First Transformation (5 Milestones) — ALL COMPLETE & DEPLOYED TO PRODUCTION
- **Milestone 1: Agentic Foundations & Trust Rails** — COMPLETE (commit d8be527). 4 new models (ActionCard, ActionHistory, AutonomyConfig, OutboundDraft), 4 new API modules, 14 new frontend components, /settings/autonomy page. +170 tests.
- **Milestone 2: Daily Briefing Agent** — COMPLETE. OpportunityDetectorService (cron-based scanner), BriefingService (grouped ActionCard feed), BriefingController (GET /briefing, GET /briefing/opportunities), 3 frontend components (BriefingCard, OpportunityCard, BriefingFeed), dashboard integration. +58 tests.
- **Milestone 3: Inbox-as-OS** — COMPLETE. Agent framework (AgentConfig, AgentRun, AgentFeedback, DuplicateCandidate models), AgentFrameworkService + AgentSchedulerService + AGENT_PROCESSING queue, ConversationActionHandler, PolicyComplianceService, DepositCardHandler, HumanTakeoverService, ClarificationHandler, VerticalActionHandler, 3 frontend components (ActionCardInline, DepositCard, HumanTakeoverBanner). +158 tests.
- **Milestone 4: Background Agents** — COMPLETE. 5 background agents (WaitlistAgent, RetentionAgent, DataHygieneAgent, SchedulingOptimizerAgent, QuoteFollowupAgent), AgentFeedback API module, /settings/agents page, retention-card + duplicate-merge-card + agent-feedback-buttons + agent-performance frontend components.
- **Milestone 5: Vertical Pack Agents** — COMPLETE. AgentSkills API module (per-pack skill catalog with business overrides), pack-specific agent behaviors, skill-card + vertical-launch-checklist + waitlist-match-card + quote-followup-card + ai-state-indicator frontend components.
- **Final counts:** 3,158 tests total (1,937 API + 1,221 web)

### Phase 5: Engagement OS + Benchmarking + Marketplace (NOT STARTED)

| Item | Description |
|------|-------------|
| **Benchmarking & Coaching** | Anonymized peer benchmarks by vertical + region, "what top performers do" recommendations |
| **Omnichannel Inbox** | IG DM, Messenger, web chat — unified timeline and automations |
| **Vertical Packs Marketplace** | Partner portal, revenue share, certification program |
| **Customer Mini-Portal** | Booking management, receipts, memberships, referrals |

### UX Improvements
- **UX Phase 1** (Role-based Modes + Mission Control + Saved Views) — COMPLETE
- **UX Upgrade Pack Release 1** (Media Attachments, Delivery Receipts, Month View, DnD Reschedule, Recommended Slots, Working Hours Viz, Presence Detection) — COMPLETE (Batches 1a–1h, 69 new tests)
- **UX Upgrade Pack Release 2** (CSV Exports, Duplicate Review, Today Timeline, Enhanced Attention Cards, Briefing Snooze + Expandable Details) — COMPLETE (Batches 2a–2g, 82 new tests)
- **UX Upgrade Pack Release 3** (Add-to-Calendar, Branded Errors, Automation Playbook UX, Rule Builder, Dry-Run, Safety Controls) — COMPLETE (Batches 3a–3f, 93 new tests)
- **UX Upgrade Pack COMPLETE** — All 3 releases, 21 batches, **3,402 total tests** (2,010 API + 1,392 web)
- See `docs/user-stories.md` for complete inventory (280 current capabilities, 215 identified gaps) and `docs/ux-brainstorm-brief.md` for brainstorm prompts.

### Platform Console — ALL 6 PHASES COMPLETE
- **Phase 1** (4 batches): Console Shell, Business Directory (search/filter/paginate), Business 360 (Summary + People tabs), View-as Tenant (time-limited JWT, audit-logged). Models: ViewAsSession, PlatformAuditLog. Seed scripts: `seed-console.ts`, `seed-console-showcase.ts`. 28 migrations.
- **Phase 2**: Overview KPI dashboard (businesses, bookings, staff, agents, support, security), Security & Audit log explorer (search, filters, pagination), System Health checks (DB, business activity, agents, calendar, messaging) with business health distribution, Support Cases CRUD with notes. Models: SupportCase, SupportCaseNote.
- **Phase 3** (Billing & Revenue Operations): Extended Subscription model (canceledAt, cancelReason, planChangedAt), new BillingCredit model. 10 new API endpoints under `/admin/billing` and `/admin/businesses/:id/billing`. 4 new DTOs. New console-billing.controller.ts + console-billing.service.ts. 3 new frontend pages (billing dashboard, past-due, subscriptions). Business 360 Billing tab. 76 new tests (39 API + 37 web). Migration #30.
- **Phase 4** (Packs & Skills Release Management): Pack registry API (`/admin/packs-console`) with version history, install counts, installed businesses. Skills catalog API (`/admin/skills-console`) with per-pack filtering. New console-packs.controller.ts + console-packs.service.ts + console-skills.controller.ts + console-skills.service.ts. 3 new frontend pages (pack registry, pack detail, skills catalog). New PackTenantPin model (53 Prisma models total). Migration #31.
- **Phase 5** (AI & Agents Governance + Messaging Ops): Agent performance dashboard API (`/admin/agents-console`) with performance metrics, action card funnel, top failures, abnormal tenants, tenant agent status, pause/resume, platform defaults governance. Messaging ops API (`/admin/messaging-console`) with dashboard KPIs, webhook health, failure analysis, tenant messaging status, fix checklist. New PlatformAgentDefault model. console-agents.controller.ts + console-agents.service.ts + console-messaging.controller.ts + console-messaging.service.ts. 2 new frontend pages (agents with 3 tabs, messaging with 2 tabs). Migration #32.
- **Phase 6** (Platform Settings + Mission Control): Platform settings API (`/admin/settings`) with CRUD and bulk update across 4 categories (security, notifications, regional, platform). Enhanced overview with attention items (past-due subs, urgent support cases, active view-as, high agent failure rate, dormant businesses) and accounts-at-risk scoring (billing × activity × support × AI health). New PlatformSetting model. console-settings.controller.ts + console-settings.service.ts. 1 new frontend page (settings with maintenance mode confirmation). Migration #33.
- **Final counts:** 3,944 tests total (2,360 API + 1,584 web), 51 Prisma models, 33 migrations (before PLG phases)

### PLG Phase 2: Signup & Onboarding — COMPLETE
- Stripe 3-tier plans (Starter/Professional/Enterprise) with trial support
- Plan-gated features via `@RequiresFeature()` decorator and `PlanLimits` interface
- 13-email onboarding drip via BullMQ delayed jobs
- Upgrade modal with plan comparison and Stripe checkout
- Trial banner with countdown and upgrade CTA
- Migration #34 (trial fields and 3-tier plans)

### PLG Phase 3: Outreach & Growth — COMPLETE (Tasks 3.1-3.6)
- SMS notifications via Twilio provider (implements existing MessagingProvider interface)
- Google Review auto-prompt (REVIEW_REQUEST reminder type, 2h after booking completion)
- Activation widget (5-step progress tracker in sidebar)
- PLG footer on public booking pages with PostHog tracking
- Empty state CTAs across bookings, inbox, campaigns, reports pages
- Mobile polish on public booking pages (responsive padding, touch targets)

### PLG Phase 4: Retention & Growth — COMPLETE (Tasks 4.1-4.8)
- **Referral program** — Give $50, Get $50 via Stripe balance credits. New Referral model, signup `?ref=CODE` handling, referral stats on settings page. Migration #35.
- **CSV/PDF export** — Extended ExportService for all 10 report types. HTML-based PDF generation, download buttons on reports page.
- **Recurring campaigns** — DAILY/WEEKLY/BIWEEKLY/MONTHLY recurrence rules. Auto-schedules next occurrence after SENT. Migration #35.
- **Booking search + date range** — Server-side search (customer name/phone/email), date presets (Today/This Week/This Month/Custom), URL-persisted filters.
- **Per-staff pricing** — New StaffServicePrice model. Staff pricing tab, booking creation uses override price. Migration #37.
- **Dunning email flow** — 3-email BullMQ sequence (immediate/3-day/7-day), auto-downgrade after 14 days, cancellation on payment recovery. New DUNNING queue.
- **NPS survey** — In-app modal at day 30, 0-10 scale + feedback, PostHog tracking, stored in packConfig.
- **Weekly digest email** — Monday 9am cron, bookings/revenue week-over-week deltas, top services, opt-out via packConfig.
- **Final counts (at end of PLG Phase 4):** ~4,600+ tests across 242 test files, 53 Prisma models, 37 migrations, 50 API modules, 66 pages

### Phase A: Product Polish — COMPLETE
- **A1: Design Tokens & Visual Consistency** — COMPLETE. Centralized `design-tokens.ts` with `BOOKING_STATUS_STYLES` (7 statuses), `CONVERSATION_STATUS_STYLES` (4 statuses), `ELEVATION` constants, helper functions (`statusBadgeClasses`, `statusCalendarClasses`, `statusHex`). CSS utilities (`.status-dot`, `.btn-press`, `.nav-section-label`). Booking form modal inputs updated to design system pattern. 17 tests.
- **A2: Navigation Simplification** — COMPLETE. 3-section sidebar nav (Workspace/Tools/Insights) per role mode via `mode-config.ts` sections. Settings in footer area. Mobile bottom tab bar + "More" sheet for overflow. 8 new section tests in mode-config, 4 new shell tests. 55 total tests across design-tokens, mode-config, and shell.
- **A3: Onboarding Overhaul** — COMPLETE. Setup wizard consolidated to 6 steps with skip options and time estimates. Celebration UI with CSS confetti animation on final step. First-week checklist (5 items: send message, create booking, invite team, customize template, enable AI). Persistent sidebar onboarding checklist widget with "Complete Setup" CTA and server-side dismiss via API. 18 tests (8 setup wizard + 10 checklist widget).
- **A4: Payment Recording & POS** — COMPLETE. Extended Payment model with manual payment fields (method, reference, notes, recordedById, businessId, customerId). New `payments` API module (51st module) with 5 endpoints: record, list, get, summary, update. RecordPaymentModal component with amount/method/reference/notes. Booking detail modal shows payment history and "Record Payment" button. Dashboard KPI strip shows "Revenue Today" with monthly subtitle. Migration `20260309004612_add_manual_payment_fields`. 40 tests (26 API + 14 web).
- **A5: In-App Refunds** — COMPLETE. New Refund model with Stripe integration. Refunds API module (52nd module) with 3 endpoints: create refund, list refunds by payment, get refund. Stripe refund processing when payment has stripePaymentIntentId, graceful fallback for manual payments. Validates refund amount against remaining refundable balance. Updates payment status to REFUNDED or PARTIAL_REFUND. ActionHistory audit logging. RefundModal component with two-step confirmation flow (form → red-themed warning). Booking detail shows refund status badges and per-payment "Refund" button for admins. Migration `20260309_add_refund_model`. 30 tests (18 API + 12 web).

### Phase B: AI Marketing System — COMPLETE
- **B1: Content Approval Queue & Infrastructure** — COMPLETE. New ContentDraft model with 6 content types, 6 channels, 5 pillars, 4 statuses. ContentQueue API module (53rd module) with 9 endpoints: create, list, get, update, approve, reject, bulk-approve, bulk-reject, stats. Marketing queue dashboard (`/marketing/queue`) with card-based review UI, filter tabs, stats strip. Migration `20260309_add_content_draft`. 42 tests (30 API + 12 web).
- **B2: Deploy 12 Autonomous Marketing Agents** — COMPLETE. New MarketingAgent module (54th module) with MarketingAgentService (shared utilities: getBusinessContext, pickNextPillar, parseAIResponse, getContentGaps). 12 agent services following BackgroundAgent pattern: 6 content agents (BlogWriter, SocialCreator, EmailComposer, CaseStudy, VideoScript, Newsletter), 2 distribution agents (ContentScheduler, ContentPublisher), 4 analytics agents (PerformanceTracker, TrendAnalyzer, ContentCalendar, ContentROI). 9 prompt templates. Per-agent `runIntervalMinutes` in AgentSchedulerService. Marketing agents dashboard (`/marketing/agents`) with tab filters, toggle, Run Now. ClaudeClient exported from AiModule. 84 tests (70 API + 14 web).
- **B3: Email Sequences & Drip Campaigns** — COMPLETE. New EmailSequence and EmailSequenceEnrollment models (56 Prisma models). EmailSequences API module (55th module) with 12 endpoints: CRUD, stats, enroll, enrollments list, cancel/pause/resume enrollment, seed. 7 default sequences (Welcome, FeatureEducation, SocialProof, TrialExpiry, WinBack, Upgrade, Referral). BullMQ ONBOARDING_DRIP processor extended for `seq-step-*` jobs. Trigger/stop event handling for auto-enrollment. Marketing sequences dashboard (`/marketing/sequences`) with stats, toggle, expand timeline. Migration `20260309_add_email_sequences`. 55 tests (44 API + 11 web).
- **B4: Landing Page & SEO/AEO Foundation** — COMPLETE. `(marketing)` route group with public layout, MarketingNav, MarketingFooter. Landing page with hero/features/pricing/CTA sections. Blog infrastructure: `blog.ts` library (getAllPosts, getPostBySlug, getAllSlugs), blog index page, `[slug]` detail page with remark markdown rendering. JSON-LD BlogPosting schema, OpenGraph metadata, `generateStaticParams()`. Sitemap with dynamic blog slugs, robots.txt. Pricing page, FAQ page. 10 tests.
- **B5: Content Pillar Seeding** — COMPLETE. 12 markdown blog posts across 5 pillars: Industry Insights (3), Product Education (3), Customer Success (2), Thought Leadership (2), Technical (2). `seed-content.ts` script creates APPROVED ContentDraft records per business (idempotent).

### Phase C: Growth & Self-Service — ALL COMPLETE
- **D5: Bookings Search, Sort & Filters** — COMPLETE. Server-side sorting on 6 fields (startTime, createdAt, customerName, serviceName, status, amount) with nested Prisma orderBy for relations. BookingQueryDto with @IsIn validators. Frontend: status chip bar (7 chips), inline staff filter dropdown, sortable column headers with server-side sort, Amount column, print button + print styles, Last 30 Days date preset. 20 new tests (8 service + 2 controller + 10 web).
- **C5: Settings Consolidation** — COMPLETE. Settings hub promoted to primary position on settings page (above business info). 7 categorized cards (Account & Security, Operations, Communication, AI & Automation, Growth, Billing, Appearance) with role-based filtering. All 13 sub-pages already had back navigation. Page widened to max-w-4xl for grid. 22 new tests (14 config + 8 hub).
- **C1: Testimonial Collection System** — COMPLETE. New Prisma model `Testimonial` (58th model) with status (PENDING/APPROVED/REJECTED/FEATURED), source (MANUAL/REQUESTED/IMPORTED). API module: CRUD + approve/reject/feature (max 6 with auto-demotion), sendRequest (NOTIFICATIONS queue email), findPublic (no auth, by slug). Frontend: `/testimonials` admin page with status tabs, grid cards, request modal with customer search + email preview. Reusable `TestimonialCard` component with star ratings, quote marks, action buttons, showActions prop. Public booking page `book/[slug]` "What Our Clients Say" section (up to 3 featured). Added to admin tools nav. 49 new tests (27 API + 22 web).
- **C4: Annual Plan & Discount Engine** — COMPLETE. Added switchToAnnual/switchToMonthly (Stripe proration), calculateAnnualSavings (20% discount per plan), getCurrentBillingInterval to billing service. 4 new controller endpoints (switch-annual, switch-monthly, annual-savings, billing-interval). Frontend: savings banner for monthly subscribers, annual savings card for annual subscribers, switch confirmation modal with proration warning. BillingLifecycleService with @Cron daily jobs: annual renewal reminders (30 days before) and account anniversary celebration emails. 21 new tests (15 API + 6 web).
- **C3: Upgrade Campaign System** — COMPLETE. `plan-limits.ts` with per-tier limits (FREE/STARTER/PROFESSIONAL/ENTERPRISE) for bookings, staff, automations, sequences, services. `getPlanLimits()`, `getUpgradePlan()`, `isNearLimit()`, `isAtLimit()`, `getUsagePercent()`. `upgrade-nudge.tsx` (lavender at 80%, amber at limit, session-dismissable). `feature-discovery.tsx` (one-time localStorage tips, sage bg, Lightbulb icon). Nudges on bookings/staff/automations/services pages. Discovery tips on bookings/inbox/dashboard. Extended email-sequences: `checkUpgradeSignals()` weekly cron for 80%+ usage. 38 new tests (21 plan-limits + 8 nudge + 5 discovery + 4 email-sequences).
- **C2: Customer Self-Service Portal** — COMPLETE. New portal API module (57th module) with 8 endpoints: request-otp, verify-otp, magic-link, verify-magic-link (auth), me GET/PATCH, bookings, upcoming (data). PortalAuthService with in-memory OTP store (5-min TTL, max 5 attempts), WhatsApp OTP via MESSAGING queue, email magic links via EmailService. PortalGuard validates portal JWT (type: 'portal', 24h expiry). PortalService: getProfile (with stats), updateProfile, getBookings (paginated), getUpcoming. Frontend: portal layout, login page (phone/email tabs, 6-digit OTP auto-advance), dashboard (upcoming, quick actions, testimonial CTA), bookings (status filters, pagination, Book Again), profile (editable fields, read-only stats, notification prefs). 51 new tests (36 API + 15 web).

### Phase D: Intelligence & Insights — ALL COMPLETE
- **D3: Monthly Business Reviews** — COMPLETE. New `BusinessReview` Prisma model (60th model, migration 43) with businessId, month (YYYY-MM @@unique), metrics (JSON), aiSummary (Text). `BusinessReviewService` with `aggregateMetrics()` (bookings/revenue with % change vs prev month, customers/retention, top 5 services, top 3 staff, busiest days/hours, AI action card stats, content stats), `generateReview()` (calls Claude sonnet for 3-4 paragraph AI summary with RECOMMENDATIONS_JSON), `getReview()` (cached or generate), `listReviews()`, `@Cron('0 8 2 * *')` monthly auto-generation for businesses with ACTIVE/TRIALING subscriptions. Controller: GET `/business-review` (list), GET `/business-review/:month` (get/generate). 58th API module registered in app.module.ts. Frontend: `/reports/monthly-review` page with month selector arrows, 4 KPI cards (Revenue/Bookings/New Customers/No-Show Rate with % change and trend arrows), AI Executive Summary card (lavender-50 with Sparkles icon), 3 Recharts (revenue trend AreaChart, top services horizontal BarChart, bookings by day BarChart), 3 recommendation cards with numbered circles and "Take Action →" links, print button, extra stat cards (avg booking value, retention rate, returning customers). Monthly Review link card added to reports page (lavender). Added `/reports/monthly-review` to admin insights nav in mode-config.ts. 19 new tests (9 API + 10 web).
- **D2: Automated Report Emails** — COMPLETE. New `ReportSchedule` Prisma model (59th model, migration 42) with reportType, frequency (DAILY/WEEKLY/MONTHLY), recipients, dayOfWeek/dayOfMonth, hour, timezone, isActive, lastSentAt. `ReportScheduleService` with CRUD, `findDueSchedules()` (filters by hour, frequency, dayOfWeek/dayOfMonth, skips recently sent), `@Cron(EVERY_HOUR)` enqueues due schedules to NOTIFICATIONS BullMQ queue, `sendReportEmail()` generates report data via ReportsService and sends branded HTML emails via EmailService. 4 new controller endpoints (POST/GET/PATCH/DELETE `/reports/schedules`). DTOs with class-validator. Frontend: "Schedule Email" button + ScheduleModal (report type, frequency, day picker, hour, recipients), ScheduleManager (list/toggle/delete), "N Scheduled" badge. 25 new tests (16 API + 9 web).
- **D4: Calendar Command Center** — COMPLETE. Enhanced existing calendar-sidebar.tsx (responsive w-72 lg:w-80) and booking-popover.tsx (customer phone display, onComplete handler for IN_PROGRESS bookings). Calendar page enhancements: localStorage-backed sidebar toggle with SSR-safe init, booking clicks open popover with anchor positioning (not full modal), keyboard shortcuts (T=today, N=new booking, S=sidebar, 1/2/3=views, ?=help, Esc=cascading close, ←/→=navigate), keyboard shortcuts help modal with `?` button, mobile slide-over overlay for sidebar (<lg breakpoint), onComplete handler patches booking status via API. 37 new tests (11 popover + 7 sidebar + 19 calendar page).
- **D1: Workflow Automation Builder** — COMPLETE. Frontend-only visual drag-and-drop builder that serializes to existing AutomationRule JSON format — no backend changes. 5 new components in `components/workflow/`: `workflow-canvas.tsx` (CSS grid dotted bg, ctrl+scroll zoom 50-200%, click+drag pan, HTML5 DnD drop zone, SVG connector layer), `workflow-node.tsx` (4 types: TRIGGER sage, CONDITION amber, ACTION blue, DELAY slate — each with icon, label, config summary, connection points, delete/configure), `workflow-sidebar.tsx` (draggable block palette: 6 triggers, 6 conditions, 7 actions, 3 delays), `workflow-connector.tsx` (SVG cubic bezier paths with arrowheads, animated drag connector), `node-config-modal.tsx` (dynamic forms per node type: status dropdowns, text inputs, time pickers, channel selectors). Builder page (`/automations/builder`) with useReducer state, toolbar (name, Save, Test, Back), serialization (trigger→rule.trigger+filters, conditions→rule.filters AND, actions→rule.actions[], delays→delayHours), deserialization (?ruleId= loads existing rule into visual nodes), validation (1 trigger, 1+ action, name required). "Visual Builder" button + "Edit in Builder" pencil icon on automations page. 38 new tests (7 canvas + 13 node + 7 sidebar + 11 builder page).

### Phase E: Polish & Expansion — IN PROGRESS
- **E2: PostHog Analytics Funnels** — COMPLETE. Enhanced `posthog.tsx` with `initPostHog()`, `isEnabled()`, `resetUser()`, `captureEvent()`. Created `PostHogIdentityProvider` component (identifies user on session with userId, email, businessId, role, verticalPack). Integrated `identifyUser`/`resetUser` in auth.tsx (login, signup, session restore, logout). Added milestone events across 5 funnels: Signup (`signup_started`, `signup_completed`, `onboarding_completed`), Booking (`calendar_viewed`, `new_booking_clicked`, `booking_confirmed`), Messaging (`inbox_opened`, `conversation_selected`, `message_sent`), AI Adoption (`ai_settings_viewed`, `ai_enabled`), Upgrade (`billing_page_viewed`, `plans_compared`, `upgrade_clicked`). 12 tests (8 posthog lib + 4 provider).

### Code Quality
- **Error Handling Remediation** — COMPLETE (commit 1cf6f99). Replaced ~20 silent `.catch(() => {})` with logged warnings, queue processors throw on failure, NestJS proper exceptions, frontend toast wiring, waitlist loop resilience, WebSocket disconnect logging. +58 tests.
- **Security Remediation Round 1** — COMPLETE (5 batches, 22 fixes). CSP/HSTS/security headers, cross-tenant CampaignSend fix, DTO input validation with MaxLength, pagination caps, booking status state machine, per-customer offer redemption with OfferRedemption model, refresh token blacklisting on logout, JWT_REFRESH_SECRET production enforcement, Stripe redirect URL validation, LoginDto for empty body handling. ~80 tests added.
- **Security Audit Round 2** — COMPLETE (Feb 19, 2026). Full re-audit with 5 parallel agents covering auth, input validation, infrastructure, tenant isolation, and business logic. 10 additional fixes:
  - 3 CRITICAL: Atomic `TokenService.validateAndConsume()` prevents race conditions in resetPassword, acceptInvite, verifyEmail (token reuse via concurrent requests)
  - 4 HIGH: `@MaxLength(128)` on all password fields (bcrypt DoS), `@IsIn` enum on automation trigger, `@MaxLength(5000)` on CustomerNote, typed `AutomationActionDto` replaces `any[]`
  - 3 MEDIUM: Content-Disposition filename sanitization, `@MaxLength` on ~20 DTO fields, `@IsShallowJson` on 8 filter/config fields
  - 1 HIGH (business logic): `forceBook` flag restricted to ADMIN role only (was accessible to all staff)
  - Tenant isolation: verified STRONG (zero critical vulns, all 40+ services filter by businessId)
- **Deployment Resilience** — COMPLETE (Feb 19, 2026). Zero-downtime deploys via `railway.toml` health checks, NestJS `enableShutdownHooks()` for graceful shutdown, frontend `fetchWithRetry()` auto-retries once on network errors during deployment rollovers.
- **Manual End-to-End Testing** — COMPLETE (Feb 19, 2026). 72 tests across 7 sessions (Security, Agentic, Inbox/Calendar, Exports/Dashboard, Automations, Self-Serve, Cross-Cutting) + 26 frontend verifications. **72/72 pass rate.** 4 defects found and fixed during testing:
  - D1 (Critical): Circular dependency in MessageModule ↔ MessagingModule preventing API startup — fixed with `forwardRef()`
  - D2 (Critical): Missing database migration for `deliveryStatus`/`deliveredAt`/`readAt` columns and `message_attachments` table — migration created and applied
  - D3-D4 (Medium): Availability endpoints returned 500 without required params — added `BadRequestException` validation guards + 7 new tests
  - Full report: `test-results/manual-testing-report.md`

### Do Not Build (Yet)
- Don't chase 5 verticals before aesthetics ROI is repeatable
- Don't overinvest in generic AI chatbot; keep AI tied to structured flows
- Don't build deep enterprise features before pack-led implementation is nailed

---

## 15. Key Documentation

| Document | Path | Purpose |
|----------|------|---------|
| Design system + deployment rules | `CLAUDE.md` | Active project guidelines for AI assistants |
| Deployment & operations | `DEPLOY.md` | Railway, Docker, cookies, troubleshooting |
| CI/CD pipeline | `docs/cicd.md` | Pipeline details and Railway config |
| User stories | `docs/user-stories.md` | 280 can-do + 215 gaps by feature area |
| UX brainstorm brief | `docs/ux-brainstorm-brief.md` | Self-contained brief for LLM brainstorming |
| This file | `docs/PROJECT_CONTEXT.md` | Full project context |
| Env template | `.env.example` | All environment variables |
| Production env | `.env.production` | Production env template |

---

## 16. How to Run Locally

```bash
git clone <repo-url>
cd booking-os
npm install
cp .env.example .env          # Edit with your DB credentials
npm run db:generate
npm run db:migrate
npm run db:seed               # Idempotent — safe to re-run
npm run dev                    # Starts all apps via Turborepo
```

- Dashboard: http://localhost:3000
- API: http://localhost:3001/api/v1
- Swagger: http://localhost:3001/api/docs
- Login: sarah@glowclinic.com / password123

### Key Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start all apps |
| `npm run build` | Build all |
| `npm run lint` | Lint all (ESLint + TypeScript) |
| `npm test` | Run all tests (~4,797+ tests) |
| `npm run test:coverage` | Tests with coverage thresholds |
| `npm run db:generate` | Generate Prisma client |
| `npm run db:migrate` | Run migrations |
| `npm run db:seed` | Seed demo data (idempotent) |
| `npm run db:studio` | Prisma Studio GUI |
| `npm run format` | Format with Prettier |
| `npm run format:check` | Check formatting |
