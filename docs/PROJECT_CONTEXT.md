# Booking OS — Complete Project Context

> **Purpose:** This document gives full context on the Booking OS platform — what it is, what's been built, how it's structured, and what's left to build. Share this with an AI assistant or new developer to get productive immediately.
>
> **Last updated:** March 23, 2026 (All phases COMPLETE — A through E + Phases 1-4 & 6 polish + QA Fixes + Sprints 1-4 + Prompts 4A-4C + Prompt 1C + Prompt 1A + Prompt 1B + Prompt 1D + Prompt 2A + Prompt 2B + Prompt 2C + Prompt 3A + Prompt 3C + QA Bug Fix Sprint (10 bugs) + Growth Engine Agents (15 prompts) + Marketing Command Center Phases 1-6 (14 prompts) COMPLETE + Admin Console Extraction (4 phases — scaffold, migrate, remove from web, infrastructure) + Internal/External Separation (3 phases — marketing tools removed from customer app, migrated to admin app, API endpoints gated behind SUPER_ADMIN) + Launch QA fixes (SUPER_ADMIN guards, AutonomyConfig scope constraint, test timeouts) + Omnichannel Phases 0-5 COMPLETE + Omnichannel Gap Fix (16 issues) + Inbox UX v3 (13 prompts) + **AI Agent Integration Fix (10 prompts)** + **Phase 2 Go-Live Configuration (Sessions 4-6)** — 6 channels fully implemented (WhatsApp, Instagram, Facebook, SMS, Email, Web Chat) — 92 Prisma models, 66 migrations, 4150 tests)

---

## 1. What Is Booking OS?

Booking OS is a **multi-tenant SaaS platform** for service-based businesses to manage appointments, customer messaging, and operations — with AI-powered automation via Claude.

**Live production URL:** https://businesscommandcentre.com
**API URL:** https://api.businesscommandcentre.com/api/v1

### Demo Credentials

| Business              | Email                     | Password    | Vertical   |
| --------------------- | ------------------------- | ----------- | ---------- |
| Glow Aesthetic Clinic | sarah@glowclinic.com      | password123 | Aesthetic  |
| Metro Auto Group      | mike@metroauto.com        | password123 | Dealership |
| Serenity Wellness Spa | maya@serenitywellness.com | password123 | Wellness   |

### Supported Verticals

- **Aesthetic clinics** — consult → treatment → aftercare workflows, medical intake, before/after tracking
- **Car dealerships** — service kanban board (CHECKED_IN → DIAGNOSING → IN_PROGRESS → READY), vehicle inventory management (VIN tracking, stock numbers, test drives), sales pipeline & deal tracking (7-stage Kanban: INQUIRY → QUALIFIED → TEST_DRIVE → NEGOTIATION → FINANCE → WON/LOST), customer journey board (unified deal/test drive/vehicle timeline with engagement scoring), AI deal intelligence (stalled deal detection, deal-aware action cards), quote approval, resource/bay scheduling
- **Wellness & spa** — 7-field wellness intake (health goals, fitness level, injuries, medications, allergies, modality, membership), DB-backed session packages with purchase/redeem/expiry tracking (ServicePackage + PackagePurchase + PackageRedemption models), auto-unredeem on booking cancel, membership tiers (Drop-in/Monthly/Annual/VIP), 6 default services (massage, yoga, training, coaching)
- **General** — base vertical with standard booking features
- **Extensible** — Vertical Pack system customizes fields, templates, automations, and workflows per industry

### Core Capabilities (All Built & Working)

- **Appointment scheduling** — Calendar views (day/week/month), conflict detection, recurring bookings, automated reminders, force-book with reason, drag-and-drop reschedule with recommended slots, calendar command center (sidebar summary, keyboard shortcuts, booking popover)
- **Omnichannel messaging inbox** — 6-channel support (WhatsApp, Instagram DM, Facebook Messenger, Email, SMS, Web Chat), real-time via Socket.io, AI auto-replies, conversation management (assign, snooze, tag, close), media attachments (images/docs/audio), delivery/read receipts for all 6 channels, presence indicators, scheduled messages (BullMQ delayed jobs with cancel), bulk actions (close/assign/tag/mark-read up to 50 at once), channel badge + reply channel switcher (with disabled channels + default selection) + channel filter bar (with unread badges) + conversation context bar (messaging window countdown, email subject, SMS opt-in), circuit breaker protection on all outbound sends, usage tracking with Stripe metered billing, customer merge across channels, inline add-email/phone with format validation
- **AI booking assistant** — Guides customers through booking/cancellation/rescheduling via chat (powered by Claude API)
- **AI features** — Intent detection, reply suggestions, conversation summaries, customer profile collection, per-customer AI chat
- **Customer management** — Profiles with custom fields, tags, CSV import, AI-powered profile extraction from conversations
- **Staff management** — Roles (Admin/Service Provider/Agent/Super Admin), working hours per day, time off, email invitations
- **Service catalog** — Categories, pricing, durations, buffer times, deposit requirements, service kinds (CONSULT/TREATMENT/OTHER), soft delete
- **Multi-location** — Multiple physical locations per business, staff-location assignments, per-location channel configs (WhatsApp, Instagram, Facebook, SMS, Email, Web Chat), location-based conversation filtering
- **Resource management** — Equipment/bays/rooms per location with metadata, resource-level booking
- **Service kanban** — Dealership workflow board (CHECKED_IN → DIAGNOSING → AWAITING_APPROVAL → IN_PROGRESS → READY_FOR_PICKUP)
- **Quotes** — Create quotes for bookings, customer self-serve approval via token link with IP audit
- **Analytics & reports** — Bookings over time, revenue, service breakdown, staff performance, no-show rates, peak hours, consult conversion, CSV/PDF export for all reports, automated scheduled report emails (daily/weekly/monthly via BullMQ)
- **ROI dashboard** — Baseline vs current metrics, recovered revenue estimate, weekly review with email
- **Multi-language** — English & Spanish (650+ translation keys), per-business overrides, language picker
- **Billing** — Stripe integration (Starter/Professional/Enterprise plans), checkout, customer portal, webhooks, deposit collection, dunning email flow, referral credits
- **Calendar sync** — Google Calendar + Outlook OAuth integration, iCal feed generation
- **Public booking portal** — Customer-facing booking page at `/book/{slug}` with service selection, availability, Stripe payment (PaymentElement), pay-at-visit option, booking, waitlist join
- **Customer self-service portal** — Portal landing page (`/portal`) with code + email login, phone OTP (WhatsApp) and email magic link auth, customer dashboard with upcoming bookings, booking history with pagination/filters, profile management with notification preferences, self-service cancel & reschedule with policy enforcement
- **Self-serve links** — Token-based reschedule, cancel, waitlist claim, and quote approval pages
- **Waitlist** — Auto-offers on cancellation, token-based 1-tap claim, configurable offer count/expiry/quiet hours
- **Campaigns** — Audience segmentation, template-based bulk messaging, throttled dispatch, delivery tracking, recurring schedules (daily/weekly/biweekly/monthly)
- **Automations** — 3 built-in playbooks with rich recipe cards + custom rule builder with plain-language summaries, real dry-run testing, searchable/filterable activity log, safety controls panel, visual drag-and-drop workflow builder
- **Offers** — Promotional offers with expiry, max redemptions, service linking
- **Vertical packs** — Pack builder with versioning, publish flow, business-level overrides
- **Setup wizard** — 10-step onboarding flow for new businesses
- **Dark mode** — System preference detection, manual toggle, full UI coverage
- **Global search** — Cmd+K command palette searching across customers, bookings, services, staff, conversations with quick actions (New Booking, New Customer)
- **Interactive demo tour** — 9-step guided walkthrough with spotlight overlays, tooltips, keyboard navigation, localStorage persistence
- **Notifications** — Email via Resend, WhatsApp, SMS via Twilio, automated booking reminders, notification timeline, weekly digest email, NPS survey
- **Notification center** — Real-time notification bell with unread count, socket-driven events (bookings, messages, AI actions), localStorage persistence, full notifications page with filter tabs
- **Help center** — Floating help button with keyboard shortcuts modal (`?` key), `/help` FAQ page with accordion sections
- **PWA support** — Web app manifest with PNG icons (192x192 + 512x512, maskable), service worker with cache-first static assets + network-first navigation, install prompt with iOS instructions
- **Accessibility** — WCAG 2.1 AA compliance, skip-to-content link, aria-live regions, focus-visible outlines, modal ARIA attributes, icon button labels, proper heading hierarchy, header landmark, labeled form controls
- **E2E testing** — Playwright test suites for auth, booking, customer, portal, and settings flows; axe-core accessibility scanning for 11 pages
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

- **Multi-location support** — Locations with staff assignments, per-location channel configs (WhatsApp, Instagram, Facebook, SMS, Email, Web Chat), booking/conversation filtering
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

- **Rich demo data** — Realistic seed data for aesthetic clinic, dealership, and wellness verticals
- **Interactive demo tour** — 9-step guided walkthrough with spotlight + tooltip overlays
- **Deployment docs** — Comprehensive DEPLOY.md with Railway, Docker, and troubleshooting

### UX Phase 1: "Role-based Modes + Mission Control + Saved Views" — COMPLETE (6/6 batches)

- **Role-based Modes** — Mode switcher (admin/agent/provider), mode-grouped sidebar nav with primary + overflow split, role-appropriate landing pages, vertical-aware labels. See **Navigation UX** section below for full details
- **Mission Control Dashboard** — KPI strip for agent/provider modes, "My Work" section (personal bookings + assigned conversations), AttentionCards component, mode-adaptive layout
- **Saved Views** — SavedView database model, full CRUD API (7 endpoints), ViewPicker + SaveViewModal on inbox/bookings/customers/waitlist, sidebar-pinned views, dashboard-pinned view cards. All view lists are deduplicated by `id` on both client (shell pinned views, ViewPicker pills) and API (`findByPage`, `findPinned`). Inbox conversation lists are also deduplicated by `id` on both client and API (`findAll`).
- **Staff preferences** — JSON column on Staff model for mode/landing path persistence
- **Final counts:** 2,533 tests total (972 web + 1,561 API)

### UX Phase 2: "Customer Hub + Unified Timeline + Global Search" (Bundle B) — COMPLETE (7/7 batches)

- **Customer Hub** — Redesigned `/customers/{id}` with sticky header, context row (last booking, last conversation, waitlist count), notes tab, message deep link, vertical modules
- **Customer Notes** — New `CustomerNote` model with full CRUD, staff ownership validation
- **Unified Timeline** — Timeline API endpoint (6 data sources: bookings, conversations, notes, waitlist, quotes, campaigns), `CustomerTimeline` component with type filtering, pagination, deep linking
- **Vertical Modules** — IntakeCard for aesthetic pack, WellnessIntakeCard/PackageTracker/MembershipBadge/PackagePurchaseModal/PackageRedeemSelector/PractitionerProfile/ClassSchedule/CertificationManager for wellness pack, quotes summary for dealership pack, collapsible sections
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

### Inbox UX v3 — 13-Prompt Overhaul — COMPLETE

Comprehensive inbox redesign covering adaptive composer, smart suggestions, draft persistence, media validation, channel pinning, canned responses, read receipts, and full WCAG accessibility. 75-item QA checklist, all PASS.

- **Conversation list** — Channel badges on cards, multi-channel "+N" badges, urgency dots for IG/FB windows, LIVE badge for Web Chat, LIVE+urgency sort-to-top
- **Message thread** — Per-message channel icons (40%/100% opacity), channel transition dividers with `role="separator"`
- **Adaptive composer** — Email subject, SMS char/segment counter, IG 1000-char limit, WA template mode, Web Chat online/offline, channel pills (`role="tablist"`) with ring/grayscale/keyboard nav/health dots/draft dots/pin icon, compact mode (<800px), dropdown collapse (<640px)
- **Draft persistence** — Per-channel drafts, blue dot indicators, discard confirmation (`role="alertdialog"`), debounced auto-save to backend OutboundDraft (1.5s), restored on conversation select
- **Media validation** — Per-channel type/size limits in MediaComposer, "Switch to Email" fallback, channel-colored drag-drop
- **Backend** — `notifyMessageStatus()` on InboxGateway, channel-aware send payload
- **Smart suggestions** — Opted-out/window/no-reply nudges (per-conversation dismissal persists across conversation switches), failed send recovery with "Send via alt channel"
- **Channels on File** — Wired into sidebar with inline add-contact
- **Channel pinning** — localStorage persistence, auto-select priority override
- **Accessibility** — Full ARIA: tablist/tab/separator/alert/alertdialog, aria-live announcements, keyboard navigation
- **i18n** — 28 new keys in en.json + es.json
- **Final counts:** 6,800+ tests total, build 8/8 tasks successful

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

| Layer       | Technology                                                                                                               | Version               |
| ----------- | ------------------------------------------------------------------------------------------------------------------------ | --------------------- |
| Frontend    | Next.js, React, TypeScript                                                                                               | 15.x, 19.x            |
| Styling     | Tailwind CSS                                                                                                             | 4.x                   |
| Icons       | lucide-react                                                                                                             | 0.468                 |
| Charts      | Recharts                                                                                                                 | 2.15                  |
| Real-time   | Socket.io                                                                                                                | 4.x                   |
| Backend     | NestJS, TypeScript                                                                                                       | 11.x                  |
| ORM         | Prisma                                                                                                                   | 6.x                   |
| Database    | PostgreSQL                                                                                                               | 16                    |
| AI          | Anthropic Claude API                                                                                                     | claude-sonnet         |
| Payments    | Stripe                                                                                                                   | stripe-node           |
| Email       | Resend                                                                                                                   | -                     |
| Messaging   | WhatsApp Cloud, Instagram DM, Facebook Messenger, Email (Resend/SendGrid), SMS (Twilio + MMS), Live Web Chat (Socket.IO) | 6-channel omnichannel |
| Cache/Queue | Redis 7 + BullMQ                                                                                                         | -                     |
| Monorepo    | Turborepo                                                                                                                | 2.x                   |
| CI/CD       | GitHub Actions → Railway                                                                                                 | -                     |
| Monitoring  | Sentry                                                                                                                   | -                     |
| Linting     | ESLint 9 + Prettier                                                                                                      | -                     |

---

## 4. Monorepo Structure

```
booking-os/
├── apps/
│   ├── api/                    # NestJS REST API (port 3001)
│   │   ├── src/
│   │   │   ├── modules/        # 83 feature modules
│   │   │   ├── common/         # Guards, decorators, filters, DTOs, Prisma service
│   │   │   └── main.ts         # Bootstrap, Swagger, CORS, cookies, validation
│   │   └── Dockerfile          # Multi-stage production build
│   ├── web/                    # Next.js admin dashboard (port 3000)
│   │   ├── src/
│   │   │   ├── app/            # 96 pages
│   │   │   ├── components/     # Shared components (shell, modals, tour, marketing/, etc.)
│   │   │   ├── lib/            # Utility modules (API client, auth, i18n, socket, theme)
│   │   │   ├── locales/        # en.json, es.json (650+ keys each)
│   │   │   └── middleware.ts   # Route protection (checks access_token + refresh_token cookies)
│   │   └── Dockerfile          # Multi-stage production build
│   └── whatsapp-simulator/     # WhatsApp testing tool (port 3002)
├── packages/
│   ├── db/                     # Prisma schema (92 models), 66 migrations, seed scripts
│   │   ├── prisma/schema.prisma
│   │   ├── src/seed.ts         # Base seed (aesthetic + dealership + wellness, idempotent)
│   │   ├── src/seed-demo.ts    # Rich demo data (idempotent, dedup-safe)
│   │   ├── src/seed-agentic.ts # One-time agentic data fill (production)
│   │   ├── src/seed-wellness.ts # Standalone wellness seed (also called from seed.ts)
│   │   ├── src/seed-console.ts # Platform console base data (super admin user)
│   │   ├── src/seed-console-showcase.ts # Console demo data (6 diverse businesses)
│   │   ├── src/seed-content.ts # Content pillar seeding (12 blog posts → ContentDraft)
│   │   ├── src/seed-instagram.ts # Instagram DM test conversations
│   │   ├── src/seed-omnichannel.ts # Multi-channel customers + messages + usage
│   │   └── src/seed-production.ts # Production-only: PlatformSettings + PlatformAgentDefaults
│   ├── messaging-provider/     # 6-channel messaging provider abstraction (WhatsApp, Instagram, Facebook, Email, SMS)
│   ├── web-chat-widget/        # Embeddable live chat widget (shadow DOM, Socket.IO, esbuild IIFE bundle)
│   └── shared/                 # Shared types, DTOs, enums, profile field definitions
├── docs/
│   ├── PROJECT_CONTEXT.md      # This file
│   ├── STRIPE-SETUP.md         # Stripe dashboard configuration guide (products, prices, webhooks)
│   ├── CHANNEL-SETUP.md        # Channel configuration guide (all 6 channels, env vars, webhooks)
│   ├── URLS.md                 # All domains, services, DNS, third-party dashboards
│   ├── DEPLOY.md               # Deployment operations guide
│   ├── cicd.md                 # CI/CD pipeline documentation
│   ├── user-stories.md         # Complete user stories (386 capabilities, 196 gaps)
│   ├── ux-brainstorm-brief.md  # UX improvement brainstorm brief
│   └── runbooks/
│       └── MESSAGING-FAILURE.md # Messaging failure troubleshooting runbook
├── agents/                     # 15 internal growth engine agent prompts (P9-P23: research → ops)
├── system/                     # Growth engine config (launch, gates, budget, testing, escalation, MCP fallback)
├── data/                       # Founder-maintained inputs (customer signals, evergreen trends, daily metrics)
├── reports/                    # Generated reports (customer validation, performance, keywords, optimization)
├── queue/                      # Content approval pipeline (pending/approved/rejected/published/archive/ready-to-publish)
├── briefings/                  # Daily trend briefings from Trend Scout agent
├── briefs/                     # Content briefs (blog/, social/) from Content Strategist
├── calendar/                   # Weekly content calendars from Content Strategist
├── design-specs/               # Visual design specifications + template library
├── engagement/                 # Daily engagement reports from Community Manager
├── logs/                       # Publishing log and operational logs
├── assets/recordings/          # Screen recordings for video content
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

## 5. Database Schema (92 Models, 64 Migrations)

```
Business (1) ──┬── (*) Staff ──── (*) WorkingHours
               │                  ├── (*) TimeOff
               │                  ├── (*) CalendarConnection
               │                  └── (*) StaffLocation ──── Location
               ├── (*) Customer ──── (*) CustomerNote
               │                    └── (*) MedicalRecord
               ├── (*) Service
               ├── (*) Booking ──── (*) Reminder
               │    │               ├── (*) Payment
               │    │               └── (*) Quote
               │    ├── Location (optional)
               │    └── Resource (optional)
               ├── (*) Invoice ──── (*) InvoiceLineItem
               │    └── (*) Payment ──── (*) Refund
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
               └── (*) MessageUsage (per-channel message counts with segments + cost, Stripe metered billing)
ViewAsSession ──── Staff (superAdmin) + Business (target)
PlatformAuditLog (standalone)
PlatformAgentDefault (standalone — platform-wide agent governance)
PlatformSetting (standalone — platform-wide configuration)
```

### Key Enums

```
StaffRole:          OWNER, ADMIN, AGENT, SERVICE_PROVIDER, SUPER_ADMIN
BookingStatus:      PENDING, PENDING_DEPOSIT, CONFIRMED, IN_PROGRESS, COMPLETED, CANCELLED, NO_SHOW
BookingSource:      MANUAL, PORTAL, WHATSAPP, AI, REFERRAL, WALK_IN
KanbanStatus:       CHECKED_IN, DIAGNOSING, AWAITING_APPROVAL, IN_PROGRESS, READY_FOR_PICKUP
ConversationStatus: OPEN, WAITING, RESOLVED, SNOOZED
ServiceKind:        CONSULT, TREATMENT, OTHER
VerticalPack:       AESTHETIC, SALON, TUTORING, GENERAL, DEALERSHIP, WELLNESS
```

### Key Models

| Model                    | Key Fields                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Notes                                                                              |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| **Business**             | name, slug (unique), timezone, verticalPack, packConfig (JSON), aiSettings (JSON), policySettings (JSON), defaultLocale                                                                                                                                                                                                                                                                                                                                          | Multi-tenant root                                                                  |
| **Staff**                | email (unique), role, passwordHash, isActive, emailVerified, locale, preferences (JSON)                                                                                                                                                                                                                                                                                                                                                                          | Auth + assignment + mode prefs                                                     |
| **Customer**             | phone (unique per biz), tags[], customFields (JSON)                                                                                                                                                                                                                                                                                                                                                                                                              | Vertical-specific fields, has CustomerNotes                                        |
| **CustomerNote**         | customerId (FK), staffId (FK), businessId (FK), content                                                                                                                                                                                                                                                                                                                                                                                                          | Staff ownership validation for edit/delete                                         |
| **Service**              | kind (CONSULT/TREATMENT/OTHER), depositRequired, bufferBefore/After, isActive                                                                                                                                                                                                                                                                                                                                                                                    | Catalog item                                                                       |
| **Booking**              | status (7 states), kanbanStatus, locationId, resourceId, recurringSeriesId, customFields (JSON)                                                                                                                                                                                                                                                                                                                                                                  | Core scheduling                                                                    |
| **Location**             | name, address, isBookable, whatsappConfig (JSON), instagramConfig (JSON), facebookConfig (JSON), smsConfig (JSON), emailConfig (JSON), webChatConfig (JSON), isActive                                                                                                                                                                                                                                                                                            | Multi-location (per-channel configs)                                               |
| **Resource**             | locationId, type, metadata (JSON), isActive                                                                                                                                                                                                                                                                                                                                                                                                                      | Equipment/bays                                                                     |
| **Quote**                | bookingId, totalAmount, status (PENDING/APPROVED/REJECTED), approverIp                                                                                                                                                                                                                                                                                                                                                                                           | Service quotes                                                                     |
| **Conversation**         | channel (WHATSAPP/INSTAGRAM/FACEBOOK/SMS/EMAIL/WEB_CHAT), status, lastInboundChannel?, tags[], metadata (JSON for AI state), locationId                                                                                                                                                                                                                                                                                                                          | Messaging (6-channel omnichannel)                                                  |
| **WaitlistEntry**        | status (ACTIVE/OFFERED/BOOKED/EXPIRED/CANCELLED), offeredSlot (JSON)                                                                                                                                                                                                                                                                                                                                                                                             | Smart waitlist                                                                     |
| **AutomationRule**       | trigger (6 types), filters (JSON), actions (JSON), quietStart/End                                                                                                                                                                                                                                                                                                                                                                                                | Automation engine                                                                  |
| **Campaign**             | filters (JSON), throttlePerMinute, stats (JSON)                                                                                                                                                                                                                                                                                                                                                                                                                  | Bulk messaging                                                                     |
| **SavedView**            | businessId, staffId, page, name, filters (JSON), icon, color, isPinned, isDashboard, isShared, sortOrder                                                                                                                                                                                                                                                                                                                                                         | Named filter presets                                                               |
| **ActionCard**           | businessId, type (DEPOSIT_PENDING/OVERDUE_REPLY/OPEN_SLOT/etc.), category (URGENT_TODAY/NEEDS_APPROVAL/OPPORTUNITY/HYGIENE), priority (0-100 int), title, description ("Because..." text), suggestedAction, preview (JSON diff), ctaConfig (JSON buttons), status (PENDING/APPROVED/DISMISSED/SNOOZED/EXECUTED/EXPIRED), autonomyLevel (OFF/ASSISTED/AUTO), snoozedUntil, expiresAt, bookingId?, customerId?, conversationId?, staffId?, resolvedById?, metadata | Agentic action recommendations with approve/dismiss/snooze/execute                 |
| **ActionHistory**        | businessId, actorType (STAFF/AI/SYSTEM/CUSTOMER), actorId?, actorName?, action (BOOKING_CREATED/CARD_APPROVED/etc.), entityType (BOOKING/CONVERSATION/CUSTOMER/ACTION_CARD/SETTING), entityId, description?, diff (JSON before/after), metadata                                                                                                                                                                                                                  | Unified polymorphic audit trail                                                    |
| **AutonomyConfig**       | businessId, actionType (unique per biz), autonomyLevel (OFF/ASSISTED/AUTO), requiredRole?, constraints (JSON {maxPerDay, maxAmount, etc.})                                                                                                                                                                                                                                                                                                                       | Per-action-type autonomy level configuration                                       |
| **OutboundDraft**        | businessId, customerId (FK), staffId (FK), channel (WHATSAPP), content, subject?, status (DRAFT/APPROVED/SENT/REJECTED), approvedById?, sentAt?, conversationId?, @@unique(conversationId+channel+staffId)                                                                                                                                                                                                                                                       | Staff-initiated outbound message drafts                                            |
| **AgentConfig**          | businessId, agentType (WAITLIST/RETENTION/DATA_HYGIENE/SCHEDULING_OPTIMIZER/QUOTE_FOLLOWUP), isEnabled, autonomyLevel (AUTO/SUGGEST/REQUIRE_APPROVAL), config (JSON), roleVisibility (String[])                                                                                                                                                                                                                                                                  | Per-business agent configuration                                                   |
| **AgentRun**             | businessId, agentType, status (RUNNING/COMPLETED/FAILED), cardsCreated (Int), error?, startedAt, completedAt                                                                                                                                                                                                                                                                                                                                                     | Agent execution run tracking                                                       |
| **AgentFeedback**        | businessId, actionCardId (FK), staffId (FK), rating (HELPFUL/NOT_HELPFUL), comment?                                                                                                                                                                                                                                                                                                                                                                              | Staff feedback on agent suggestions                                                |
| **DuplicateCandidate**   | businessId, customerId1 (FK), customerId2 (FK), confidence (Float), matchFields (String[]), status (PENDING/MERGED/NOT_DUPLICATE/SNOOZED), resolvedBy?, resolvedAt                                                                                                                                                                                                                                                                                               | Duplicate customer detection candidates                                            |
| **MessageAttachment**    | id, messageId (FK), businessId (FK), fileName, fileType, fileSize (Int), storageKey, thumbnailKey?, createdAt                                                                                                                                                                                                                                                                                                                                                    | Media attachments on messages (images, docs, audio)                                |
| **ViewAsSession**        | superAdminId (FK), targetBusinessId (FK), reason, startedAt, endedAt?, expiresAt, actionsLog (JSON)                                                                                                                                                                                                                                                                                                                                                              | Time-limited view-as session for Super Admin tenant impersonation                  |
| **PlatformAuditLog**     | actorId, actorEmail, action, targetType?, targetId?, reason?, metadata (JSON), createdAt                                                                                                                                                                                                                                                                                                                                                                         | Platform-level audit trail for Super Admin actions                                 |
| **SupportCase**          | businessId (FK), businessName, subject, description, status (open/in_progress/resolved/closed), priority (low/normal/high/urgent), category?, resolution?, resolvedAt?, closedAt?, createdById                                                                                                                                                                                                                                                                   | Support case tracking for platform console                                         |
| **SupportCaseNote**      | caseId (FK), authorId, authorName, content, createdAt                                                                                                                                                                                                                                                                                                                                                                                                            | Notes on support cases with cascade delete                                         |
| **BillingCredit**        | businessId (FK), amount (Decimal), reason, appliedById, appliedByEmail, createdAt                                                                                                                                                                                                                                                                                                                                                                                | Platform-issued billing credits for businesses                                     |
| **PlatformAgentDefault** | agentType (unique), maxAutonomyLevel, defaultEnabled, confidenceThreshold (Float), requiresReview, updatedById?                                                                                                                                                                                                                                                                                                                                                  | Platform-wide agent governance defaults per agent type                             |
| **PlatformSetting**      | key (unique), value (JSON), category, description?, isDefault, updatedById?, updatedAt                                                                                                                                                                                                                                                                                                                                                                           | Platform-wide configuration settings (security, notifications, regional, platform) |
| **Referral**             | referrerBusinessId (FK), referredBusinessId (FK), referralCode, status (PENDING/CONVERTED/CREDITED), creditAmount (default $50), convertedAt?, creditedAt?                                                                                                                                                                                                                                                                                                       | Referral program tracking with Stripe credit application                           |
| **StaffServicePrice**    | staffId (FK), serviceId (FK), businessId (FK), price (Float), unique(staffId, serviceId)                                                                                                                                                                                                                                                                                                                                                                         | Per-staff pricing overrides for services                                           |

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

## 6. API Modules (83 Modules)

All endpoints prefixed with `/api/v1`. Swagger docs at `/api/docs` (dev only).

| Module                | Route Prefix                                                                      | Key Operations                                                                                                                                                                                                                                                        |
| --------------------- | --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Auth**              | `/auth`                                                                           | signup, login, refresh, logout, forgot/reset/change password, accept-invite, verify-email                                                                                                                                                                             |
| **Bookings**          | `/bookings`                                                                       | CRUD, status change, kanban status, calendar view (day/week/month), month summary, kanban board, bulk ops, deposit/reschedule/cancel links, policy check                                                                                                              |
| **Recurring**         | `/bookings/recurring`                                                             | Create series, cancel (single/future/all)                                                                                                                                                                                                                             |
| **Customers**         | `/customers`                                                                      | CRUD, search, bulk tag, CSV import, conversation import, notes CRUD, timeline                                                                                                                                                                                         |
| **Services**          | `/services`                                                                       | CRUD with soft delete                                                                                                                                                                                                                                                 |
| **Staff**             | `/staff`                                                                          | CRUD, invite, working hours, time off, per-staff service pricing                                                                                                                                                                                                      |
| **Business**          | `/business`                                                                       | Profile, policies, notifications, waitlist settings, install pack, activation status, NPS submission                                                                                                                                                                  |
| **Locations**         | `/locations`                                                                      | CRUD locations, resources, staff assignments                                                                                                                                                                                                                          |
| **Conversations**     | `/conversations`                                                                  | List, assign, status, snooze, tags, messages, notes, booking creation                                                                                                                                                                                                 |
| **Messages**          | `/conversations/:id/messages`                                                     | Send message                                                                                                                                                                                                                                                          |
| **Templates**         | `/templates`                                                                      | Full CRUD                                                                                                                                                                                                                                                             |
| **Dashboard**         | `/dashboard`                                                                      | Stats, AI usage, dismiss nudge                                                                                                                                                                                                                                        |
| **Reports**           | `/reports`                                                                        | 9 report types (bookings, revenue, no-shows, staff perf, peak hours, etc.), CSV/PDF export, automated scheduled report emails (ReportSchedule CRUD, @Cron hourly, BullMQ NOTIFICATIONS queue)                                                                         |
| **ROI**               | `/roi`                                                                            | Go-live, baseline, dashboard, weekly review                                                                                                                                                                                                                           |
| **AI**                | `/ai`                                                                             | Settings, conversation summary, booking/cancel/reschedule confirm, customer chat                                                                                                                                                                                      |
| **Availability**      | `/availability`                                                                   | Available slots (by date, service, staff, location, resource), calendar context (working hours + time off), recommended slots (top 5 scored)                                                                                                                          |
| **Search**            | `/search`                                                                         | Global search with offset, types filter, totals                                                                                                                                                                                                                       |
| **Automations**       | `/automations`                                                                    | Playbooks toggle, rules CRUD, test, activity log                                                                                                                                                                                                                      |
| **Campaigns**         | `/campaigns`                                                                      | CRUD, audience preview, send, recurring schedules, stop recurrence                                                                                                                                                                                                    |
| **Offers**            | `/offers`                                                                         | CRUD, redeem                                                                                                                                                                                                                                                          |
| **Quotes**            | `/quotes`                                                                         | Create, view, per-booking                                                                                                                                                                                                                                             |
| **Waitlist**          | `/waitlist`                                                                       | List, update, cancel, resolve, bulk (remove/resolve)                                                                                                                                                                                                                  |
| **Billing**           | `/billing`                                                                        | Checkout, portal, subscription, webhook, deposit, dunning trigger                                                                                                                                                                                                     |
| **Calendar Sync**     | `/calendar-sync`                                                                  | OAuth connect/disconnect (Google/Outlook), iCal feed, manual sync                                                                                                                                                                                                     |
| **iCal Feed**         | `/ical`                                                                           | Token-based iCal feed                                                                                                                                                                                                                                                 |
| **Translations**      | `/translations`                                                                   | Get/upsert/delete per locale                                                                                                                                                                                                                                          |
| **Pack Builder**      | `/admin/packs`                                                                    | CRUD packs, versioning, publish (SUPER_ADMIN only)                                                                                                                                                                                                                    |
| **Vertical Packs**    | `/vertical-packs`                                                                 | Get pack config (public)                                                                                                                                                                                                                                              |
| **Public Booking**    | `/public`                                                                         | Business info, services, availability, book, join waitlist                                                                                                                                                                                                            |
| **Self-Serve**        | `/self-serve`                                                                     | Reschedule, cancel, waitlist claim, quote approval (token-based)                                                                                                                                                                                                      |
| **Saved Views**       | `/saved-views`                                                                    | CRUD, list by page, pinned views, dashboard views, share/unshare                                                                                                                                                                                                      |
| **Health**            | `/health`                                                                         | DB + Redis health check with latency                                                                                                                                                                                                                                  |
| **Action Card**       | `/action-cards`                                                                   | Action card CRUD, approve/dismiss/snooze/execute, expiry cron                                                                                                                                                                                                         |
| **Action History**    | `/action-history`                                                                 | Unified audit trail, polymorphic entity references                                                                                                                                                                                                                    |
| **Autonomy**          | `/autonomy`                                                                       | Per-action-type autonomy configs, level checking                                                                                                                                                                                                                      |
| **Outbound**          | `/outbound`                                                                       | Staff-initiated outbound message drafts                                                                                                                                                                                                                               |
| **Briefing**          | `/briefing`                                                                       | Daily briefing feed (grouped action cards) and opportunity detection (deposit pending, overdue replies, open slots)                                                                                                                                                   |
| **Agent**             | `/agent`                                                                          | Agent framework CRUD, agent runs, scheduling, AGENT_PROCESSING queue, 5 background agents (waitlist, retention, data-hygiene, scheduling-optimizer, quote-followup)                                                                                                   |
| **Agent Feedback**    | `/agent-feedback`                                                                 | Staff feedback CRUD on agent run outcomes, aggregation stats                                                                                                                                                                                                          |
| **Agent Skills**      | `/agent-skills`                                                                   | Skills catalog per vertical pack, business-level overrides                                                                                                                                                                                                            |
| **Attachment**        | `/attachments`                                                                    | Media attachment upload (`POST /conversations/:id/messages/media`) and download (`GET /attachments/:id/download`)                                                                                                                                                     |
| **Console Overview**  | `/admin/overview`                                                                 | Platform KPIs (businesses, bookings, staff, agents, support, security)                                                                                                                                                                                                |
| **Console Audit**     | `/admin/audit-logs`                                                               | Searchable/filterable platform audit log, action types                                                                                                                                                                                                                |
| **Console Health**    | `/admin/health`                                                                   | System health checks (DB, business activity, agents, calendar, messaging) + business health distribution                                                                                                                                                              |
| **Console Support**   | `/admin/support-cases`                                                            | Support case CRUD, notes, status management (open/in_progress/resolved/closed)                                                                                                                                                                                        |
| **Console Billing**   | `/admin/billing`, `/admin/businesses/:id/billing`                                 | Platform-wide billing dashboard (subscription stats, plan distribution, MRR, past-due list), per-business billing operations (subscription details, plan change, credits, cancel/reactivate, invoices)                                                                |
| **Console Packs**     | `/admin/packs-console`                                                            | Pack registry with version history, install counts, business list per pack (Phase 4)                                                                                                                                                                                  |
| **Console Skills**    | `/admin/skills-console`                                                           | Skills catalog with per-pack filtering, skill detail (Phase 4)                                                                                                                                                                                                        |
| **Console Agents**    | `/admin/agents-console`                                                           | Agent performance dashboard, action card funnel, top failures, abnormal tenants, tenant agent status, pause/resume, platform defaults (Phase 5)                                                                                                                       |
| **Console Messaging** | `/admin/messaging-console`                                                        | Messaging dashboard (sent/delivered/failed, delivery rate), webhook health, failure reasons, impacted tenants, tenant messaging status, fix checklist (Phase 5)                                                                                                       |
| **Console Settings**  | `/admin/settings`                                                                 | Platform settings CRUD (security, notifications, regional, platform categories), bulk update (Phase 6)                                                                                                                                                                |
| **Referral**          | `/referral`                                                                       | Referral link, referral stats, code generation (ADMIN only)                                                                                                                                                                                                           |
| **Dunning**           | — (internal)                                                                      | 3-email dunning sequence via BullMQ, auto-downgrade after 14 days                                                                                                                                                                                                     |
| **Weekly Digest**     | — (cron)                                                                          | Weekly digest email (Monday 9am), opt-out via packConfig                                                                                                                                                                                                              |
| **Onboarding Drip**   | — (internal)                                                                      | 13-email onboarding sequence via BullMQ delayed jobs                                                                                                                                                                                                                  |
| **Content Queue**     | `/content-queue`                                                                  | Content draft approval queue: create, list, get, update, approve, reject, bulk-approve, bulk-reject, stats (9 endpoints)                                                                                                                                              |
| **Marketing Agent**   | — (internal)                                                                      | 12 autonomous marketing agents (6 content, 2 distribution, 4 analytics) registered with AgentFrameworkService                                                                                                                                                         |
| **Email Sequences**   | `/email-sequences`                                                                | Email drip campaigns: CRUD, stats, enroll, enrollments, cancel/pause/resume, seed (12 endpoints). 7 default sequences                                                                                                                                                 |
| **Portal**            | `/portal`                                                                         | Customer self-service portal: OTP auth (WhatsApp), magic link auth (email), profile, bookings (paginated), upcoming, cancel & reschedule with policy checks. OTP/blacklist backed by Redis with in-memory fallback. PortalGuard with portal JWT (24h, type: 'portal') |
| **Export**            | `/customers/export`, `/bookings/export`, `/staff/export`, `/reports/:type/export` | CSV/PDF export for customers, bookings, staff, and all 10 report types                                                                                                                                                                                                |

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

## 7. Frontend Pages (81+ Pages)

### Public Pages

| Page             | Route                        | Description                                                                                             |
| ---------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------- |
| Login            | `/login`                     | Email + password auth                                                                                   |
| Sign Up          | `/signup`                    | New business registration                                                                               |
| Forgot Password  | `/forgot-password`           | Password reset email                                                                                    |
| Reset Password   | `/reset-password?token=`     | Set new password                                                                                        |
| Verify Email     | `/verify-email?token=`       | Email verification                                                                                      |
| Accept Invite    | `/accept-invite?token=`      | Staff invitation acceptance                                                                             |
| Public Booking   | `/book/[slug]`               | Customer booking portal (5-step wizard), fuzzy slug resolution (startsWith + suffix-stripping fallback) |
| Reschedule       | `/manage/reschedule/[token]` | Customer reschedule page                                                                                |
| Cancel           | `/manage/cancel/[token]`     | Customer cancel page                                                                                    |
| Claim            | `/manage/claim/[token]`      | Waitlist claim page                                                                                     |
| Quote            | `/manage/quote/[token]`      | Quote approval page                                                                                     |
| Portal Login     | `/portal/[slug]`             | Customer portal login (phone OTP + email magic link)                                                    |
| Portal Dashboard | `/portal/[slug]/dashboard`   | Customer welcome page, upcoming bookings, quick actions                                                 |
| Portal Bookings  | `/portal/[slug]/bookings`    | Customer booking history with status filters, pagination, cancel & reschedule modals                    |
| Portal Profile   | `/portal/[slug]/profile`     | Customer profile editor with stats and notification prefs                                               |
| Portal Intake    | `/portal/[slug]/intake`      | Digital intake form with 4 sections (personal, medical, consent, emergency)                             |

### Protected Pages

| Page                | Route                               | Description                                                                                                                                                                                                                                  |
| ------------------- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Setup Wizard        | `/setup`                            | 10-step onboarding                                                                                                                                                                                                                           |
| Dashboard           | `/dashboard`                        | KPI metrics, attention items, checklist, milestones                                                                                                                                                                                          |
| Bookings            | `/bookings`                         | Filterable list, bulk actions, detail modal                                                                                                                                                                                                  |
| Calendar            | `/calendar`                         | Day/week/month view, staff columns, click-to-book, drag-and-drop reschedule, working hours/time-off visualization, recommended slots                                                                                                         |
| Inbox               | `/inbox`                            | 3-pane messaging with AI suggestions, media attachments, delivery/read receipts, presence indicators                                                                                                                                         |
| Customers           | `/customers`                        | Search, import, bulk tag                                                                                                                                                                                                                     |
| Customer Detail     | `/customers/[id]`                   | Profile hub: AI chat, timeline, notes, bookings, info, vertical modules                                                                                                                                                                      |
| Search              | `/search`                           | Full search results page with type filters, grouped results, load more                                                                                                                                                                       |
| Services            | `/services`                         | Category-grouped CRUD                                                                                                                                                                                                                        |
| Staff               | `/staff`                            | Expandable table with hours + time off                                                                                                                                                                                                       |
| Waitlist            | `/waitlist`                         | Entry management with filters                                                                                                                                                                                                                |
| Campaigns           | `/campaigns`                        | Campaign list                                                                                                                                                                                                                                |
| Campaign New/Edit   | `/campaigns/new`, `/campaigns/[id]` | 4-step builder wizard                                                                                                                                                                                                                        |
| Automations         | `/automations`                      | Playbooks, custom rules, activity log                                                                                                                                                                                                        |
| Automation New      | `/automations/new`                  | Rule builder wizard                                                                                                                                                                                                                          |
| Reports             | `/reports`                          | 9 chart types                                                                                                                                                                                                                                |
| ROI Dashboard       | `/roi`                              | Baseline vs current metrics                                                                                                                                                                                                                  |
| Service Board       | `/service-board`                    | Kanban board (dealership)                                                                                                                                                                                                                    |
| Settings            | `/settings/*`                       | 16 settings sub-pages (account, AI, AI Autonomy, Agent Skills, agents, templates, translations, calendar, billing, notifications, offers, policies, waitlist, profile fields, sms, facebook, email-channel); hub page links to all sub-pages |
| Marketing Queue     | `/marketing/queue`                  | Content approval queue with card-based review, filter tabs, stats strip. **Internal only — no sidebar nav, not shown to customers**                                                                                                          |
| Marketing Agents    | `/marketing/agents`                 | 12 marketing agents dashboard with tab filters (Content/Distribution/Analytics), toggle, Run Now. **Internal only — not in sidebar, agents filtered from customer API**                                                                      |
| Marketing Sequences | `/marketing/sequences`              | Email sequence management with stats, toggle, expand timeline. **Internal only — no sidebar nav**                                                                                                                                            |
| Rejection Analytics | `/marketing/rejection-analytics`    | 4 Recharts visualizations (by code, by agent, trend, agent detail), weekly summary panel, filterable rejection log table. **Internal only — no sidebar nav**                                                                                 |
| Notifications       | `/notifications`                    | Notification list with filter tabs (All/Unread/Bookings/Messages/AI)                                                                                                                                                                         |
| Help                | `/help`                             | FAQ page with 6 accordion sections                                                                                                                                                                                                           |
| Audit Log           | `/settings/audit-log`               | Paginated audit table with filters, expandable diff viewer, CSV export                                                                                                                                                                       |
| Integrations        | `/settings/integrations`            | Grid of 9 integration cards (Google Calendar, Stripe, WhatsApp, etc.)                                                                                                                                                                        |

### Public Marketing Pages

| Page         | Route          | Description                                                 |
| ------------ | -------------- | ----------------------------------------------------------- |
| Landing Page | `/`            | Hero, features, pricing, CTA sections                       |
| Blog         | `/blog`        | Blog index with category badges, 12 posts across 5 pillars  |
| Blog Post    | `/blog/[slug]` | Individual post with JSON-LD, OpenGraph, markdown rendering |
| Pricing      | `/pricing`     | Detailed plan comparison                                    |
| FAQ          | `/faq`         | Frequently asked questions                                  |

### Console Pages (Super Admin Only — `apps/admin/` at `admin.businesscommandcentre.com`)

| Page                | Route                            | Description                                                                                              |
| ------------------- | -------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Overview            | `/`                              | Platform KPIs (businesses, bookings, staff, agents, support, security), billing breakdown, audit feed    |
| Business Directory  | `/businesses`                    | Search, filter by plan/billing/health, paginated table                                                   |
| Business 360        | `/businesses/[id]`               | Summary, People, and Billing tabs (subscription info, plan change, credits, cancel/reactivate, invoices) |
| Security & Audit    | `/audit`                         | Audit log explorer with search, action type filter, paginated table                                      |
| System Health       | `/health`                        | Overall status, 5 service checks, business health distribution                                           |
| Support Cases       | `/support`                       | Full CRUD with search, status/priority filters, case detail drawer, notes                                |
| Billing Dashboard   | `/billing`                       | MRR, churn rate, plan distribution, past-due businesses                                                  |
| Past-Due            | `/billing/past-due`              | Filtered list of past-due businesses with quick actions                                                  |
| Subscriptions       | `/billing/subscriptions`         | All subscriptions with search, plan/status filters, sortable table                                       |
| Pack Registry       | `/packs`                         | Vertical pack registry with search, version history, install counts                                      |
| Pack Detail         | `/packs/[slug]`                  | Pack detail with version timeline, installed businesses, skills list                                     |
| Skills Catalog      | `/packs/skills`                  | Skills catalog with per-pack filtering                                                                   |
| AI & Agents         | `/agents`                        | Agent performance dashboard, tenant controls, platform defaults                                          |
| Messaging Ops       | `/messaging`                     | Delivery rates, webhook health, failure analysis, per-tenant status                                      |
| Platform Settings   | `/settings`                      | 4-category settings (Security, Notifications, Regional, Platform) with bulk save                         |
| Marketing Landing   | `/marketing`                     | Marketing autonomy settings, agent overview                                                              |
| Content Queue       | `/marketing/queue`               | Content approval workflow (approve/reject/schedule drafts)                                               |
| Marketing Agents    | `/marketing/agents`              | 12 marketing agent dashboard (status, runs, performance)                                                 |
| Email Sequences     | `/marketing/sequences`           | Email sequence management                                                                                |
| Rejection Analytics | `/marketing/rejection-analytics` | Content rejection patterns and analytics                                                                 |

### Key Components

- `Shell` — Sidebar nav with mode-grouped items + "More" toggle, pinned saved views, i18n, pack provider, dark mode, tour trigger
- `BookingFormModal` / `BookingDetailModal` — Create/view/reschedule bookings
- `AiSuggestions` / `AiBookingPanel` / `AiSummary` — AI features in inbox
- `CommandPalette` — Cmd+K global search with grouped results, vertical-aware labels, deep links, page navigation (all routes including overflow items searchable, grouped by Workspace/Tools/Insights/AI sections). Nav items shared via `lib/nav-config.ts` (single source of truth for shell + command palette)
- `CustomerTimeline` — Unified activity timeline (6 event types) with filters, pagination, deep links
- `IntakeCard` — Vertical-specific customer fields card (aesthetic clinic intake)
- `BulkActionBar` — Multi-select action bar
- `DemoTourProvider` / `TourSpotlight` / `TourTooltip` — Interactive demo tour
- `LanguagePicker` — Locale selector
- `TooltipNudge` — Dismissible coaching tooltips
- `Skeleton` / `CardSkeleton` / `TableRowSkeleton` / `PageSkeleton` / `DetailSkeleton` / `FormSkeleton` / `ListSkeleton` / `InboxSkeleton` / `CalendarSkeleton` — Layout-matching skeleton loaders
- `EmptyState` — Empty states with icon, title, description, and CTA
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
- `ExportModal` — CSV export modal with date range + field selection, supports customers/bookings/staff entities (UX Upgrade Pack R2)
- `NotificationBell` — Bell icon with unread count badge, socket event listeners, localStorage persistence
- `HelpButton` — Floating help button with categorized keyboard shortcuts modal (General/Navigation/Lists), `?` key handler, chord sequence display
- `InstallPrompt` — PWA install banner with beforeinstallprompt + iOS instructions
- `OnboardingWizard` — 5-step overlay wizard with progress bar
- `TodayTimeline` — Vertical chronological timeline of today's bookings with quick actions (UX Upgrade Pack R2)
- `AttentionCard` — Enhanced attention card with primary action buttons, expand/collapse, resolve-next navigation (UX Upgrade Pack R2)
- `KpiStrip` — Clickable KPI cards with action subtitles and role-based metrics (UX Upgrade Pack R2)
- `MedicalHistoryForm` — Structured medical intake form with tag inputs for arrays, Fitzpatrick scale, safety toggles, consent (Prompt 1C)
- `MedicalAlertBanner` — Red alert banner for flagged medical records with flag reason, allergy/contraindication tags, full/compact modes (Prompt 1C)
- `MedicalHistoryDiff` — Side-by-side version comparison for medical record changes (Prompt 1C)
- `PhotoUploadCard` — Drag-drop clinical photo upload with type/body area selectors (Prompt 1A)
- `PhotoGallery` — Filterable photo grid with lightbox viewer and delete action (Prompt 1A)
- `PhotoComparisonViewer` — Split-screen before/after slider comparison (Prompt 1A)
- `PhotoTimeline` — Chronological photo display grouped by body area (Prompt 1A)
- `TreatmentPlanBuilder` — Form for creating treatment plans with dynamic session list and service selectors (Prompt 1B)
- `TreatmentPlanCard` — Summary card with status badge, progress bar, and portal accept/decline actions (Prompt 1B)
- `TreatmentPlanTimeline` — Visual session timeline with status icons and booking links (Prompt 1B)
- `AftercareProtocolEditor` — Form for creating/editing aftercare protocols with step management (Prompt 1D)
- `AftercareEnrollmentCard` — Enrollment summary with progress bar and message timeline (Prompt 1D)
- `AftercarePortalView` — Customer-facing aftercare timeline with step progress (Prompt 1D)
- `CustomerJourneyBoard` — Horizontal journey visualization with stage timeline, stats, vehicles, active deals (Prompt 2C)

---

## 7b. Navigation UX

All nav route definitions live in `apps/web/src/lib/nav-config.ts` (single source of truth for shell sidebar, mobile tab bar, and command palette).

**Desktop sidebar** — 4 sections (Workspace / Tools / Insights / AI & Agents) per mode via `mode-config.ts`. Admin mode splits each section into **primary** (always visible) and **overflow** (under a collapsible "More" toggle, `aria-expanded`, collapsed by default, persisted in `localStorage`). Agent and provider modes show all paths as primary (no overflow toggle). Only routes defined in the active mode's sections are rendered — items outside the mode's allowlist are hidden (not dumped into an unsectioned block). The only exception is `/admin/*` paths for SUPER_ADMIN users.

| Mode | Primary Tools | Overflow Tools | Primary Insights | Overflow Insights | Primary AI | Overflow AI |
|------|--------------|---------------|-----------------|-------------------|-----------|------------|
| Admin | services, staff, invoices | packages, campaigns, automations, testimonials | dashboard, reports | monthly-review, roi | /ai | actions, agents, performance |
| Agent | services | — | dashboard, reports | — | — | — |
| Provider | services, service-board | — | dashboard | — | — | — |

**Mobile tab bar** — mode + role aware, max 4 link tabs + "More" button:
- Admin/Agent: Inbox, Calendar, Customers, Home
- Provider: Calendar, Bookings, Home (no Inbox/Customers)
- Labels are i18n/pack-aware (e.g. "Clients" for aesthetic, "Customers" for general)

**Command palette** (⌘K) — searches all navigable pages (including overflow routes) grouped by sidebar section, plus API search for customers/bookings/services/staff/conversations. Footer hint: "All pages searchable".

**Post-login redirect** — On login, shell redirects once to `modeDef.defaultLandingPath` (admin→`/dashboard`, agent→`/inbox`, provider→`/calendar`) via `sessionStorage` flag handshake. Uses `router.replace()` to avoid back-button loop.

**Mode route guard** — If the current URL is not in the active mode's section paths (e.g. `/inbox` while in provider mode), the shell redirects to `modeDef.defaultLandingPath`. Exempt: `/settings/*`, `/admin/*`, `/` root.

**Keyboard shortcuts** — `⌘K` command palette, `N` new booking, `G then B/C/I/D/S/A/Q/R/J/W` chord navigation to bookings/customers/inbox/dashboard/services/automations/actions/reports/ai/waitlist.

---

## 8. AI Architecture

| Component             | Purpose                                                                                                      |
| --------------------- | ------------------------------------------------------------------------------------------------------------ |
| `ClaudeClient`        | API wrapper with error handling, graceful degradation                                                        |
| `IntentDetector`      | Classifies: GENERAL_INQUIRY, BOOK_APPOINTMENT, CANCEL_APPOINTMENT, RESCHEDULE_APPOINTMENT, TRANSFER_TO_HUMAN |
| `ReplyGenerator`      | Contextual reply drafts using conversation history + business context                                        |
| `BookingAssistant`    | Multi-step booking: service → date → time → confirm                                                          |
| `CancelAssistant`     | Identifies and cancels bookings from conversation                                                            |
| `RescheduleAssistant` | Identifies and reschedules bookings                                                                          |
| `ProfileCollector`    | Conversationally collects missing required profile fields                                                    |
| `AiService`           | Orchestrator: routes intents, manages state, handles auto-reply                                              |

AI state persisted in `conversation.metadata` JSON for stateful multi-turn flows.

**Auto-reply modes:** Draft (default), auto-reply all, selective auto-reply, transfer to human.

---

## 9. Real-Time Architecture (Socket.io)

| Event                            | Trigger                                                                      |
| -------------------------------- | ---------------------------------------------------------------------------- |
| `message:new`                    | New inbound/outbound message                                                 |
| `conversation:updated`           | Status, assignment, tag changes                                              |
| `ai:suggestion`                  | AI generates reply suggestion                                                |
| `ai:auto-replied`                | AI sent auto-reply                                                           |
| `ai:transfer-to-human`           | AI escalated to human                                                        |
| `booking:updated`                | Booking created/updated                                                      |
| `ai:booking-state`               | AI booking assistant progress                                                |
| `action-card:created`            | New action card created by agent or system                                   |
| `action-card:updated`            | Action card status change (approve/dismiss/snooze/execute)                   |
| `message:status`                 | Message delivery/read receipt update (UX Upgrade Pack R1)                    |
| `viewing:start` / `viewing:stop` | Presence tracking — staff viewing a conversation (UX Upgrade Pack R1)        |
| `presence:update`                | Presence indicator update for inbox collision detection (UX Upgrade Pack R1) |

---

## 10. CI/CD Pipeline

```
Push to main → lint-and-test → docker-build → deploy (staged) → smoke-test
                              ↘ bundle-check (parallel, 60MB limit)
Pull request → lint-and-test → docker-build + e2e-test (no deploy, no smoke test)
```

- **lint-and-test:** PostgreSQL 16 service, Prisma generate + migrate, format check, lint, test
- **docker-build:** Multi-stage Docker builds for API, web, and admin + Trivy security scanning
- **bundle-check:** Builds web app, reports `.next/` size to GitHub step summary, fails if >60MB
- **deploy:** Staged sequential deployment: API → health check → Web → health check → Admin → health check. Each stage polls the health endpoint every 5s with a 5-minute timeout. Failure at any stage stops the pipeline.
- **smoke-test:** Post-deploy production verification (24 checks across 9 categories: health, DB, web, auth, API, public endpoints, security headers, cookies, CORS, admin console)
- **Migrations:** Auto-run via `scripts/docker-entrypoint.sh` on container startup
- **Full docs:** `docs/cicd.md` and `DEPLOY.md`

### Railway Production

| Property   | Value                                  |
| ---------- | -------------------------------------- |
| Project ID   | `37eeca20-7dfe-45d9-8d29-e902a545f475` |
| API domain   | `api.businesscommandcentre.com`        |
| Web domain   | `businesscommandcentre.com`            |
| Admin domain | `admin.businesscommandcentre.com`      |
| Services     | api, web, admin, postgres, redis       |

---

## 11. Seed Data

Multiple scripts, all idempotent:

**`packages/db/src/seed.ts`** — Base data (seeds all three verticals):

- Glow Aesthetic Clinic (aesthetic pack): 3 staff, 5 services, 4 customers, 7 templates, conversations, bookings, reminders, ROI baseline
- Metro Auto Group (dealership pack): 7 staff, 5 services, 4 locations, 10 resources, 2 customers, 5 templates
- Serenity Wellness Spa (wellness pack): 3 staff, 6 services (called from seedWellness())

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

- Creates 6 diverse businesses with varied health states (green/yellow/red), plans (basic/pro), billing statuses (active/past_due/canceled), verticals (general/aesthetic/wellness), and timezones
- Each business gets staff, customers, services, bookings, conversations, subscriptions
- Zen Wellness Spa uses `wellness` vertical pack
- Used to populate the Business Directory with realistic data for demos

**`packages/db/src/seed-wellness.ts`** — Wellness pack showcase data (also called from `seed.ts`):

- Serenity Wellness Spa (verticalPack: `wellness`, plan: `pro`)
- 3 staff (Maya Chen ADMIN, Jordan Rivera + Aisha Patel SERVICE_PROVIDER)
- 6 services matching wellness pack defaults
- 5 customers with full wellness intake data (health goals, fitness levels, injuries, allergies, memberships)
- 15 bookings spread across recent weeks
- Automatically seeded via `seed.ts`, or run standalone: `npx tsx packages/db/src/seed-wellness.ts`

**`packages/db/src/seed-content.ts`** — Content pillar seed data:

- Creates 12 APPROVED ContentDraft records per business (one per blog post)
- Covers 5 pillars: Industry Insights, Product Education, Customer Success, Thought Leadership, Technical
- Idempotent (checks title+businessId before inserting)
- Run: `npx tsx packages/db/src/seed-content.ts`

**`packages/db/src/seed-instagram.ts`** — Instagram DM test data:

- 4 Instagram DM conversations (story reply, ad referral, ice breaker, expiring window)
- Run: `npx tsx packages/db/src/seed-instagram.ts`

**`packages/db/src/seed-omnichannel.ts`** — Multi-channel foundation data:

- Multi-channel customers (Alex: WA+IG, Jordan: email threaded, Taylor: web chat offline)
- MessageUsage records with segments/cost (7 days), channelSettings
- Run: `npx tsx packages/db/src/seed-omnichannel.ts`

**`packages/db/src/seed-production.ts`** — Production-only seed (no demo data):

- 10 PlatformSetting records (platform, security, notifications, regional categories)
- 5 PlatformAgentDefault records (WAITLIST, RETENTION, DATA_HYGIENE, SCHEDULING_OPTIMIZER, QUOTE_FOLLOWUP) with conservative defaults
- Idempotent (upsert by key/agentType). Safe for production re-runs.
- Run: `npx tsx packages/db/src/seed-production.ts`

---

## 12. Environment Variables

Key groups (full list in `.env.example`):

| Group    | Variables                                            | Required                                   |
| -------- | ---------------------------------------------------- | ------------------------------------------ |
| Database | `DATABASE_URL`                                       | Always                                     |
| JWT      | `JWT_SECRET`, `JWT_REFRESH_SECRET`                   | Always                                     |
| URLs     | `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_WS_URL`          | Always                                     |
| CORS     | `CORS_ORIGINS`                                       | Production (also determines cookie domain) |
| AI       | `ANTHROPIC_API_KEY`                                  | AI features                                |
| WhatsApp | `WHATSAPP_*`                                         | Production messaging                       |
| Stripe   | `STRIPE_*`                                           | Billing                                    |
| Calendar | `GOOGLE_*`, `MICROSOFT_*`, `CALENDAR_ENCRYPTION_KEY` | Calendar sync                              |
| Redis    | `REDIS_URL`                                          | Job queues, WebSocket scaling              |
| Sentry   | `SENTRY_DSN`                                         | Error tracking                             |

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
- **Animations:** 13 utility classes (slideUp, fadeIn, scaleIn, slideInRight, slideInFromBottom, badgeFlash, cardHover, dropdownOpen, pageFade, toastEnter, modalEnter, backdrop, sidebarActive) — all respect prefers-reduced-motion

---

## 14. Roadmap — What's Next

### Agentic-First Transformation (5 Milestones) — ALL COMPLETE & DEPLOYED TO PRODUCTION

- **Milestone 1: Agentic Foundations & Trust Rails** — COMPLETE (commit d8be527). 4 new models (ActionCard, ActionHistory, AutonomyConfig, OutboundDraft), 4 new API modules, 14 new frontend components, /settings/autonomy page. +170 tests.
- **Milestone 2: Daily Briefing Agent** — COMPLETE. OpportunityDetectorService (cron-based scanner), BriefingService (grouped ActionCard feed), BriefingController (GET /briefing, GET /briefing/opportunities), 3 frontend components (BriefingCard, OpportunityCard, BriefingFeed), dashboard integration. +58 tests.
- **Milestone 3: Inbox-as-OS** — COMPLETE. Agent framework (AgentConfig, AgentRun, AgentFeedback, DuplicateCandidate models), AgentFrameworkService + AgentSchedulerService + AGENT_PROCESSING queue, ConversationActionHandler, PolicyComplianceService, DepositCardHandler, HumanTakeoverService, ClarificationHandler, VerticalActionHandler, 3 frontend components (ActionCardInline, DepositCard, HumanTakeoverBanner). +158 tests.
- **Milestone 4: Background Agents** — COMPLETE. 5 background agents (WaitlistAgent, RetentionAgent, DataHygieneAgent, SchedulingOptimizerAgent, QuoteFollowupAgent), AgentFeedback API module, /settings/agents page, retention-card + duplicate-merge-card + agent-feedback-buttons + agent-performance frontend components.
- **Milestone 5: Vertical Pack Agents** — COMPLETE. AgentSkills API module (per-pack skill catalog with business overrides), pack-specific agent behaviors, skill-card + vertical-launch-checklist + waitlist-match-card + quote-followup-card + ai-state-indicator frontend components.
- **Final counts:** 3,158 tests total (1,937 API + 1,221 web)

### AI Agent Integration Fix (10 Prompts) — COMPLETE

Fixed 7 critical integration gaps between the AI pipeline, messaging infrastructure, and background agents:

- **Prompt 1:** Draft Pipeline — AI creates OutboundDraft records (source/intent/confidence/metadata) + Socket.IO `draft:created`
- **Prompt 2:** Channel-Aware AI — 24h window validation (IG/FB/WA), SMS opt-out/length check, channel-specific LLM context, per-channel auto-reply toggles (`channelOverrides`)
- **Prompt 3:** BullMQ Reliable Processing — Replaced fire-and-forget with 3-retry exponential backoff, DLQ + ActionCard on failure, `ai:processing`/`ai:draft-ready`/`ai:processing-failed` Socket.IO events
- **Prompt 4:** Action Card CTA Execution — `ActionCardExecutorService` bridges send_followup/offer_slot/retry_ai/reply_manually to messaging pipeline
- **Prompt 5:** Pre-Generated Messages — Retention, Quote, Waitlist agents generate channel-specific `suggestedMessages` in card metadata
- **Prompt 6:** Inbox AI Draft UX — Processing indicator, draft bubbles with approve/edit/reject/regenerate, `POST /outbound/:id/send`, `POST /ai/conversations/:id/regenerate-draft`
- **Prompt 7:** Card Dashboard → Inbox Flow — Message preview in ActionCardPreview, channel tabs, bulk follow-up (`POST /action-cards/bulk-followup`)
- **Prompt 8:** AI Settings + Stats — Per-channel toggles, `GET /ai/stats` endpoint, processing dashboard with 7-day chart
- **Prompt 9:** AI × Inbox UX — Draft-to-composer integration, channel-switch regenerate prompt, AI draft in quick replies, confidence indicators
- **Prompt 10:** QA (55-item checklist PASS) — 229 test suites, 4104 tests passing (now 4150 with admin + billing health tests)
- **Files changed:** 26 files, ~1940 insertions. New files: `action-card-executor.service.ts`, migration `20260321000000_add_ai_fields_to_outbound_draft`

### Phase 5: Engagement OS + Benchmarking + Marketplace (NOT STARTED)

| Item                           | Description                                                                                |
| ------------------------------ | ------------------------------------------------------------------------------------------ |
| **Benchmarking & Coaching**    | Anonymized peer benchmarks by vertical + region, "what top performers do" recommendations  |
| **Omnichannel Inbox**          | WhatsApp, Instagram DM, Facebook Messenger, SMS, Email, Web Chat — ALL 6 CHANNELS COMPLETE |
| **Vertical Packs Marketplace** | Partner portal, revenue share, certification program                                       |
| **Customer Mini-Portal**       | Booking management, receipts, memberships, referrals                                       |

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
- **A2: Navigation Simplification** — COMPLETE. 3-section sidebar nav (Workspace/Tools/Insights) per role mode via `mode-config.ts` sections. Settings in footer area. **Primary vs overflow per mode:** Admin mode declares overflow paths per section (tools: packages/campaigns/automations/testimonials; insights: monthly-review/roi; aiAgents: actions/agents/performance). Desktop sidebar renders primary items in each section; overflow items appear under a collapsible "More" toggle (`aria-expanded`, ChevronDown icon) with subheaded groups per section. Collapsed by default, state persisted in `localStorage('bookingos-nav-more-open')`. Agent and provider modes have no overflow (all paths primary, no toggle). `splitSectionPaths()` helper splits any `NavSections` into `{primary, overflow}` per section. **Mobile tab bar is mode + role aware:** admin/agent → Inbox, Calendar, Customers, Home + More; provider → Calendar, Bookings, Home + More (no Inbox/Customers). Tab labels are i18n/pack-aware (`pack.labels.customer`). Dashboard relabeled "Home" on mobile. **Icon + label polish:** Every nav item has a distinct lucide-react icon (Waitlist=ListChecks, Action Triage=ListFilter, Agent Status=Bot, Performance=Gauge, Pack Builder=Blocks). All nav labels use i18n keys (13 new keys in en.json/es.json). Chord shortcuts expanded: G then R=reports, J=AI hub, W=waitlist. **Post-login landing redirect:** After login, shell checks `sessionStorage('booking-os-login-redirect')` flag (set by login page) and redirects once to `modeDef.defaultLandingPath` if user landed on `/dashboard` or `/` — agent→`/inbox`, provider→`/calendar`, admin stays on `/dashboard`. Uses `router.replace()` to avoid back-button loop. 41 tests in mode-config, 25 shell tests, 4 provider mobile nav tests, 3 redirect tests.
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
- **C5: Settings Consolidation** — COMPLETE. Settings hub promoted to primary position on settings page (above business info). 7 categorized cards (Account & Security, Operations, Communication, AI & Automation, Growth, Billing, Appearance) with role-based filtering. All sub-pages already had back navigation (now 16 sub-pages with sms, facebook, email-channel additions). Page widened to max-w-4xl for grid. 22 new tests (14 config + 8 hub).
- **C1: Testimonial Collection System** — COMPLETE. New Prisma model `Testimonial` (58th model) with status (PENDING/APPROVED/REJECTED/FEATURED), source (MANUAL/REQUESTED/IMPORTED). API module: CRUD + approve/reject/feature (max 6 with auto-demotion), sendRequest (NOTIFICATIONS queue email), findPublic (no auth, by slug). Frontend: `/testimonials` admin page with status tabs, grid cards, request modal with customer search + email preview. Reusable `TestimonialCard` component with star ratings, quote marks, action buttons, showActions prop. Public booking page `book/[slug]` "What Our Clients Say" section (up to 3 featured). Added to admin tools nav. 49 new tests (27 API + 22 web).
- **C4: Annual Plan & Discount Engine** — COMPLETE. Added switchToAnnual/switchToMonthly (Stripe proration), calculateAnnualSavings (20% discount per plan), getCurrentBillingInterval to billing service. 4 new controller endpoints (switch-annual, switch-monthly, annual-savings, billing-interval). Frontend: savings banner for monthly subscribers, annual savings card for annual subscribers, switch confirmation modal with proration warning. BillingLifecycleService with @Cron daily jobs: annual renewal reminders (30 days before) and account anniversary celebration emails. 21 new tests (15 API + 6 web).
- **C3: Upgrade Campaign System** — COMPLETE. `plan-limits.ts` with per-tier limits (FREE/STARTER/PROFESSIONAL/ENTERPRISE) for bookings, staff, automations, sequences, services. `getPlanLimits()`, `getUpgradePlan()`, `isNearLimit()`, `isAtLimit()`, `getUsagePercent()`. `upgrade-nudge.tsx` (lavender at 80%, amber at limit, session-dismissable). `feature-discovery.tsx` (one-time localStorage tips, sage bg, Lightbulb icon). Nudges on bookings/staff/automations/services pages. Discovery tips on bookings/inbox/dashboard. Extended email-sequences: `checkUpgradeSignals()` weekly cron for 80%+ usage. 38 new tests (21 plan-limits + 8 nudge + 5 discovery + 4 email-sequences).
- **C2: Customer Self-Service Portal** — COMPLETE. New portal API module (57th module) with 8 endpoints: request-otp, verify-otp, magic-link, verify-magic-link (auth), me GET/PATCH, bookings, upcoming (data). PortalAuthService with in-memory OTP store (5-min TTL, max 5 attempts), WhatsApp OTP via MESSAGING queue, email magic links via EmailService. PortalGuard validates portal JWT (type: 'portal', 24h expiry). PortalService: getProfile (with stats), updateProfile, getBookings (paginated), getUpcoming. Frontend: portal layout, login page (phone/email tabs, 6-digit OTP auto-advance), dashboard (upcoming, quick actions, testimonial CTA), bookings (status filters, pagination, Book Again), profile (editable fields, read-only stats, notification prefs). 51 new tests (36 API + 15 web).

### Phase D: Intelligence & Insights — ALL COMPLETE

- **D3: Monthly Business Reviews** — COMPLETE. New `BusinessReview` Prisma model (60th model, migration 43) with businessId, month (YYYY-MM @@unique), metrics (JSON), aiSummary (Text). `BusinessReviewService` with `aggregateMetrics()` (bookings/revenue with % change vs prev month, customers/retention, top 5 services, top 3 staff, busiest days/hours, AI action card stats, content stats), `generateReview()` (calls Claude sonnet for 3-4 paragraph AI summary with RECOMMENDATIONS_JSON), `getReview()` (cached or generate), `listReviews()`, `@Cron('0 8 2 * *')` monthly auto-generation for businesses with ACTIVE/TRIALING subscriptions. Controller: GET `/business-review` (list), GET `/business-review/:month` (get/generate). 58th API module registered in app.module.ts. Frontend: `/reports/monthly-review` page with month selector arrows, 4 KPI cards (Revenue/Bookings/New Customers/No-Show Rate with % change and trend arrows), AI Executive Summary card (lavender-50 with Sparkles icon), 3 Recharts (revenue trend AreaChart, top services horizontal BarChart, bookings by day BarChart), 3 recommendation cards with numbered circles and "Take Action →" links, print button, extra stat cards (avg booking value, retention rate, returning customers). Monthly Review link card added to reports page (lavender). Added `/reports/monthly-review` to admin insights nav in mode-config.ts. 19 new tests (9 API + 10 web).
- **D2: Automated Report Emails** — COMPLETE. New `ReportSchedule` Prisma model (59th model, migration 42) with reportType, frequency (DAILY/WEEKLY/MONTHLY), recipients, dayOfWeek/dayOfMonth, hour, timezone, isActive, lastSentAt. `ReportScheduleService` with CRUD, `findDueSchedules()` (filters by hour, frequency, dayOfWeek/dayOfMonth, skips recently sent), `@Cron(EVERY_HOUR)` enqueues due schedules to NOTIFICATIONS BullMQ queue, `sendReportEmail()` generates report data via ReportsService and sends branded HTML emails via EmailService. 4 new controller endpoints (POST/GET/PATCH/DELETE `/reports/schedules`). DTOs with class-validator. Frontend: "Schedule Email" button + ScheduleModal (report type, frequency, day picker, hour, recipients), ScheduleManager (list/toggle/delete), "N Scheduled" badge. 25 new tests (16 API + 9 web).
- **D4: Calendar Command Center** — COMPLETE. Enhanced existing calendar-sidebar.tsx (responsive w-72 lg:w-80) and booking-popover.tsx (customer phone display, onComplete handler for IN_PROGRESS bookings). Calendar page enhancements: localStorage-backed sidebar toggle with SSR-safe init, booking clicks open popover with anchor positioning (not full modal), keyboard shortcuts (T=today, N=new booking, S=sidebar, 1/2/3=views, ?=help, Esc=cascading close, ←/→=navigate), keyboard shortcuts help modal with `?` button, mobile slide-over overlay for sidebar (<lg breakpoint), onComplete handler patches booking status via API. 37 new tests (11 popover + 7 sidebar + 19 calendar page).
- **D1: Workflow Automation Builder** — COMPLETE. Frontend-only visual drag-and-drop builder that serializes to existing AutomationRule JSON format — no backend changes. 5 new components in `components/workflow/`: `workflow-canvas.tsx` (CSS grid dotted bg, ctrl+scroll zoom 50-200%, click+drag pan, HTML5 DnD drop zone, SVG connector layer), `workflow-node.tsx` (4 types: TRIGGER sage, CONDITION amber, ACTION blue, DELAY slate — each with icon, label, config summary, connection points, delete/configure), `workflow-sidebar.tsx` (draggable block palette: 6 triggers, 6 conditions, 7 actions, 3 delays), `workflow-connector.tsx` (SVG cubic bezier paths with arrowheads, animated drag connector), `node-config-modal.tsx` (dynamic forms per node type: status dropdowns, text inputs, time pickers, channel selectors). Builder page (`/automations/builder`) with useReducer state, toolbar (name, Save, Test, Back), serialization (trigger→rule.trigger+filters, conditions→rule.filters AND, actions→rule.actions[], delays→delayHours), deserialization (?ruleId= loads existing rule into visual nodes), validation (1 trigger, 1+ action, name required). "Visual Builder" button + "Edit in Builder" pencil icon on automations page. 38 new tests (7 canvas + 13 node + 7 sidebar + 11 builder page).

### Phase E: Polish & Expansion — ALL COMPLETE

- **E2: PostHog Analytics Funnels** — COMPLETE. Enhanced `posthog.tsx` with `initPostHog()`, `isEnabled()`, `resetUser()`, `captureEvent()`. Created `PostHogIdentityProvider` component (identifies user on session with userId, email, businessId, role, verticalPack). Integrated `identifyUser`/`resetUser` in auth.tsx (login, signup, session restore, logout). Added milestone events across 5 funnels: Signup (`signup_started`, `signup_completed`, `onboarding_completed`), Booking (`calendar_viewed`, `new_booking_clicked`, `booking_confirmed`), Messaging (`inbox_opened`, `conversation_selected`, `message_sent`), AI Adoption (`ai_settings_viewed`, `ai_enabled`), Upgrade (`billing_page_viewed`, `plans_compared`, `upgrade_clicked`). 12 tests (8 posthog lib + 4 provider).
- **E3: AI Command Center** — COMPLETE. Expanded existing AI page into full command center with 4 route-based tab sub-pages. Layout (`layout.tsx`): horizontal tab navigation (Overview/Agents/Actions/Performance) using Next.js `Link` + `usePathname` for active state. Overview (`/ai`): core agent dashboard, AI activity feed, autonomy levels, marketing agents summary grid (12 agents with status indicators). Agents page (`/ai/agents`): core agents grid with status toggles (calls `/agents/config/:type`), "Run Now" trigger, expandable run history (last 10 runs with status/duration/cards); marketing agents grid with status badges and schedule info. Actions page (`/ai/actions`): pending action cards from `/action-cards` API grouped by 4 categories (Urgent/red, Needs Approval/amber, Opportunity/sage, Hygiene/slate), each with approve/dismiss/snooze buttons, confidence scores, checkbox selection, bulk action bar ("Approve All"/"Dismiss All"), empty state with lavender Sparkles, pagination. Performance page (`/ai/performance`): Recharts visualizations — success rate LineChart (30 days, sage line), cards created/approved/dismissed stacked AreaChart, agent comparison horizontal BarChart; staff feedback summary table (helpful/not helpful/percent); KPI cards (total runs, successful, failed, success rate); date range selector (7/30/90 days); graceful mock data fallback. 31 tests (6 layout + 8 agents + 11 actions + 7 performance). Navigation already configured in mode-config.ts and shell.tsx.
- **E4: UX Polish Batches** — COMPLETE. Three UX improvement batches: Batch 5 (Client Profile Redesign): enlarged avatar (w-16 h-16), unified activity feed interleaving bookings/conversations/notes chronologically with typed icons (Calendar/MessageSquare/StickyNote), "Add Note" quick action button, narrowed layout to max-w-3xl, inline note input card, removed tab-based layout. Batch 6 (Inbox Simplification): restyled filter chips (active: sage-100/sage-800, inactive: white border), chip bar with gap-2 px-4 py-3 border-slate-100, info sidebar collapse toggle with `infoSidebarOpen` state. Batch 8 (Mobile): modal-content bottom sheet CSS for mobile modals. Customer list: search input restyled (bg-slate-50 border-0), ChevronUp/ChevronDown sort icons replacing text arrows, 3 new sortable columns (Last Visit, Total Spent, Bookings), improved empty state with "Import CSV" + "Add Manually" dual CTAs. 207 tests pass across 11 suites.
- **E5: Scheduled Messages & Bulk Inbox Actions** — COMPLETE. Prisma schema: `scheduledFor DateTime?` and `scheduledJobId String?` on Message model (migration 44). Message scheduling via BullMQ delayed jobs: `message.service.ts` creates message with `deliveryStatus: 'SCHEDULED'`, adds delayed job to MESSAGING queue, stores jobId for cancellation. 3 message endpoints: POST (send with optional `scheduledFor`), GET scheduled, DELETE cancel (removes BullMQ job + sets CANCELLED). 4 bulk conversation endpoints: POST `bulk-close` (updateMany to RESOLVED), POST `bulk-assign` (validates staff, updateMany assignedToId), POST `bulk-tag` (appends tag if not present), POST `bulk-read` (marks inbound messages readAt). All bulk ops validate max 50 items. Frontend: enhanced `scheduled-message.tsx` with 5 quick presets (1h, 3h, tomorrow 9AM/12PM, Monday 9AM) and 15-min interval time picker (96 options). Inbox page: ScheduledMessage component integrated in composer area, `scheduledFor` state flows through sendMessage API call, amber scheduled messages indicator panel with cancel buttons, bulk action bar updated to use efficient single-request API endpoints, inline tag input for bulk tagging. 113 tests (25 message service + 52 conversation service + 10 scheduled-message component + 15 inbox page + 11 inbox integration).
- **E1: Wellness Vertical Pack** — COMPLETE. New `wellness.pack.ts` definition with 7 customer intake fields (healthGoals [required], fitnessLevel [select/4], injuries, medications, allergies, preferredModality [select/6], membershipType [select/4]), 2 booking fields (sessionNotes, pressureLevel), 6 default services (Initial Wellness Consultation [free CONSULT], Swedish Massage [$90], Deep Tissue Massage [$110], Yoga Private Session [$75], Personal Training [$80], Nutrition Coaching [$65 CONSULT]), 9 default templates (24h Reminder, Session Confirmation, Post-Session Follow-up, Progress Check-in, Wellness Tip, Membership Renewal, Cancellation, Reschedule Link, Cancel Link), packConfig (trackProgress, membershipEnabled, intakeFormRequired). `WELLNESS` added to VerticalPack enum. 3 frontend components: `WellnessIntakeCard` (7-field intake form with medical alert indicator, edit/save mode, completion badge), `PackageTracker` (session package progress bar with expiry warning, percentage display), `MembershipBadge` (4 tier styles: VIP/amber Crown, Annual/sage Star, Monthly/lavender Zap, Drop-in/slate User). Setup page updated with "Wellness & Spa" option (Stethoscope icon). Mode-config labels added (Studio Manager/Front Desk/Practitioner). Seed data: `seed-wellness.ts` (Serenity Wellness Spa with 3 staff, 6 services, 5 customers with intake data, 15 bookings), console showcase Zen Wellness Spa updated to wellness pack. en.json + es.json locale strings. 62 new tests (34 backend pack + 13 intake card + 8 package tracker + 7 membership badge).

### Polish Sprint: Critical Bug Fixes, Feature Activation, Missing Pages, New Features — ALL COMPLETE

- **Phase 1: Critical Bug Fixes** — Forgot-password redirect (PUBLIC_PATHS fix), referral link localhost bug (CORS_ORIGINS fallback chain), content queue navigation (/content-queue → /marketing/queue redirect), API health endpoint enhancement (frontend flag + timestamp)
- **Phase 2: Activate Existing Features** — Global search wired up with staff search + quick actions (New Booking/Customer), notification center (bell icon + socket events + /notifications page), staff CSV export (export service + modal + button), onboarding wizard overlay (5-step dismissible wizard)
- **Phase 3: Missing UI Pages** — Audit log page (paginated table, DiffViewer, CSV export), portal intake forms (4-section digital form, customFields merge), integrations hub (9 integration cards, settings category)
- **Phase 4: New Features** — Waitlist bulk actions (remove/resolve API + selection UI), empty states (services/staff/reports with EmptyState + secondaryAction), help center (floating button + keyboard shortcuts + FAQ), PWA support (manifest + service worker + install prompt)
- **Phase 6: Testing & Polish** — 5 Playwright E2E test suites (auth, booking-flow, customer-flow, portal-booking, settings) with shared auth fixture, axe-core accessibility E2E test (WCAG 2.1 AA on 11 pages), skip-to-content link, modal ARIA attributes (role="dialog", aria-modal, aria-label), aria-live regions on search results, icon button aria-labels, focus-visible CSS utility, CI e2e-test job on pull requests

### QA Fixes Sprint — ALL COMPLETE (5 fixes)

- **Fix 1: Dashboard Hydration** — Fixed SSR/client mismatch errors on dashboard page
- **Fix 2: Client Portal Landing Page** — New `/portal` page with portal code + email input, magic link auth via POST /portal/auth/magic-link, confirmation UI, slug normalization (9 tests)
- **Fix 3: Stripe Checkout in Booking Flow** — Public payment endpoint `POST /public/:slug/create-payment-intent`, Stripe PaymentElement integration on `/book/[slug]`, dynamic payment step (skip when Stripe not configured or pay-at-visit selected), Payment record creation on booking with paymentIntentId, order summary UI (15 new tests)
- **Fix 4: PWA Support Completion** — Proper PNG icons (192x192 + 512x512) with `any maskable` purpose, enhanced manifest.json with scope/orientation, rewritten service worker with cache-first for static assets + network-first for navigation, apple-touch-icon linked to PNG
- **Fix 5: Accessibility Fixes (WCAG 2.1 AA)** — Resolved duplicate `<h1>` (sidebar brand h1→p), added `aria-label` to language picker select, added `<header role="banner">` landmark to sidebar branding section; verified html lang="en" and all icon-only buttons already compliant

### Sprint 1: Critical Blockers — COMPLETE

- P-01: Business Branding (logoUrl, brandPrimaryColor, brandTagline, brandFaviconUrl, /settings/branding, portal rendering)
- P-02: Booking Search (serviceId filter, compound index)
- P-03: CSV Export (UTF-8 BOM, rate limiting)
- P-04: Portal Payments (webhook handlers for payment_intent.succeeded/failed)

### Sprint 2: High Priority — COMPLETE

- P-05: Staff-Service Mapping, P-07: Customer Merge & Delete, P-08: Inbox Media, P-09: Column Sorting, P-10: Calendar Hours, P-11: Deposit Config
- P-06 & P-12 skipped (already implemented)

### Sprint 3: Usability Improvements — COMPLETE

- P-13: Multi-Step Automation Sequences (AutomationStep/AutomationExecution models, ACTION/DELAY/BRANCH types, cron executor)
- P-14: Visual Automation Builder (WorkflowCanvas/Node/Connector/Sidebar, 22 drag-drop blocks, serialize/deserialize)
- P-15: Campaign A/B Testing (isABTest + variants, Fisher-Yates split, variant-stats, winner selection)
- P-16: Advanced Campaign Audience Filters (10+ filter fields, audience-preview, SavedSegment CRUD, filter builder)
- P-17: Two-Factor Authentication (TOTP HMAC-SHA1, temp token login, bcrypt backup codes, settings/security page)
- P-18: Drag-and-Drop Calendar (HTML5 DnD, conflict detection, 5s undo toast)
- P-19: Booking Color Labels (colorLabel field, 5 colors, selector, calendar borders)
- P-20: Booking Audit Log (BookingAuditLog model, timeline component, 5 action types)

### Sprint 4: UX Polish & Platform Depth — COMPLETE

- P-21: Illustrated Empty States — COMPLETE (all 8 target pages verified)
- P-22: Skeleton Loading States — COMPLETE (5 new compositions, 37 pages standardized)
- P-25: Micro-Animations — COMPLETE (8 new keyframes, applied to cards/toasts/modals/dropdowns/shell)
- P-23: Keyboard Navigation — COMPLETE (useKeyboardShortcut/useChordShortcut/useListNavigation hooks, global shortcuts in shell, J/K list nav on bookings+customers, categorized shortcuts modal, 19 tests)
- P-24: Mobile Layouts (Inbox & Calendar) — COMPLETE (useSwipeGesture hook, inbox swipe-to-resolve/snooze with reveal UI, DateScroller component, forced day view on mobile, stacked booking cards, FAB for new booking, 14 new tests)
- P-26: Source Attribution — COMPLETE (Booking.source field with 6 values: MANUAL/PORTAL/WHATSAPP/AI/REFERRAL/WALK_IN, auto-populate across 4 entry points, BOOKING_SOURCE_STYLES design tokens, source badge in booking detail modal, dashboard source breakdown card, sourceBreakdown analytics in ReportsService, source filter on bookings list, 12 new tests)

### Code Quality

- **Error Handling Remediation** — COMPLETE (commit 1cf6f99). Replaced ~20 silent `.catch(() => {})` with logged warnings, queue processors throw on failure, NestJS proper exceptions, frontend toast wiring, waitlist loop resilience, WebSocket disconnect logging. +58 tests.
- **Security Remediation Round 1** — COMPLETE (5 batches, 22 fixes). CSP/HSTS/security headers, cross-tenant CampaignSend fix, DTO input validation with MaxLength, pagination caps, booking status state machine, per-customer offer redemption with OfferRedemption model, refresh token blacklisting on logout, JWT_REFRESH_SECRET production enforcement, Stripe redirect URL validation, LoginDto for empty body handling. ~80 tests added.
- **Security Audit Round 2** — COMPLETE (Feb 19, 2026). Full re-audit with 5 parallel agents covering auth, input validation, infrastructure, tenant isolation, and business logic. 10 additional fixes:
  - 3 CRITICAL: Atomic `TokenService.validateAndConsume()` prevents race conditions in resetPassword, acceptInvite, verifyEmail (token reuse via concurrent requests)
  - 4 HIGH: `@MaxLength(128)` on all password fields (bcrypt DoS), `@IsIn` enum on automation trigger, `@MaxLength(5000)` on CustomerNote, typed `AutomationActionDto` replaces `any[]`
  - 3 MEDIUM: Content-Disposition filename sanitization, `@MaxLength` on ~20 DTO fields, `@IsShallowJson` on 8 filter/config fields
  - 1 HIGH (business logic): `forceBook` flag restricted to ADMIN role only (was accessible to all staff)
  - Tenant isolation: verified STRONG (zero critical vulns, all 40+ services filter by businessId)
- **BUG-001: P2010 Raw Query Fix** — COMPLETE (March 2026). Raw SQL `FOR UPDATE` lock queries used Prisma model names instead of `@@map` PostgreSQL table names, causing P2010 on every public portal booking. Fixed 4 raw queries across booking/billing/self-serve services. Hardened global exception filter to never expose Prisma error codes to users.
- **BUG-002: /patients → /customers Redirect** — COMPLETE (March 2026). Added permanent 301 redirects in next.config.js for `/patients` and `/patients/:path*` to `/customers` equivalents. Preserves bookmarked/external links after the rename.
- **QA Bug Fix Sprint (10 bugs)** — COMPLETE (March 2026). 10 bugs fixed across seed data, auth, dashboard, inbox, settings, services, routing, and integrations:
  - BUG-010 (Critical): Wellness seed integrated into main seed.ts (was standalone-only)
  - BUG-001 (Critical): Booking dedup in API findAll() + idempotent seed-demo.ts book() function
  - BUG-003 (Critical): Middleware checks both access_token AND refresh_token before redirecting to /login
  - BUG-007 (High): Dashboard "Consult → Treatment" metric now vertical-aware (dealership: "Quote → Service", wellness: "Booking → Session")
  - BUG-009 (High): Intake card heading now vertical-aware via usePack() (aesthetic: "CLINIC INTAKE", dealership: "VEHICLE INTAKE", wellness: "CLIENT INTAKE")
  - BUG-006 (Medium): Settings account card title aligned with page content
  - BUG-002 (Medium): Service category normalization ("Injectable" → "Injectables")
  - BUG-005 (Medium): Settings hub card labels updated (Account & Import, Calendar & Templates, Notifications, Branding)
  - BUG-008 (Low): /appointments → /bookings permanent redirect in next.config.js
  - BUG-004 (Low): WhatsApp integration button shows "Connect" (not "Configure") when not connected
- **Deployment Resilience** — COMPLETE (Feb 19, 2026). Zero-downtime deploys via `railway.toml` health checks, NestJS `enableShutdownHooks()` for graceful shutdown, frontend `fetchWithRetry()` auto-retries once on network errors during deployment rollovers.
- **Manual End-to-End Testing** — COMPLETE (Feb 19, 2026). 72 tests across 7 sessions (Security, Agentic, Inbox/Calendar, Exports/Dashboard, Automations, Self-Serve, Cross-Cutting) + 26 frontend verifications. **72/72 pass rate.** 4 defects found and fixed during testing:
  - D1 (Critical): Circular dependency in MessageModule ↔ MessagingModule preventing API startup — fixed with `forwardRef()`
  - D2 (Critical): Missing database migration for `deliveryStatus`/`deliveredAt`/`readAt` columns and `message_attachments` table — migration created and applied
  - D3-D4 (Medium): Availability endpoints returned 500 without required params — added `BadRequestException` validation guards + 7 new tests
  - Full report: `test-results/manual-testing-report.md`

### Prompt 4A: Invoice System — COMPLETE

- Invoice + InvoiceLineItem Prisma models (@@map: "invoices", "invoice_line_items"), Payment.invoiceId relation
- InvoiceModule (59th API module): 8 endpoints (CRUD, send, cancel, record-payment, stats)
- Auto-invoice number: INV-{YYYY}-{0001} per business, createFromBooking/createFromQuote convenience methods
- Status flow: DRAFT → SENT → VIEWED → PAID/PARTIALLY_PAID/OVERDUE → CANCELLED/REFUNDED
- Daily @Cron overdue check, auto-generate draft invoice on booking COMPLETED
- 3 web pages: /invoices (list+stats), /invoices/[id] (detail+payment modal), /invoices/new (form)
- Portal: /portal/[slug]/invoices + GET /portal/invoices endpoint
- Design tokens: INVOICE_STATUS_STYLES + invoiceBadgeClasses()
- 58 tests (35 API + 23 web)

### Prompt 4B: Enhanced Reporting Dashboard — COMPLETE

- Date range picker with presets (Today/7D/30D/90D/Custom) + staff filter dropdown
- 5 tabbed report sections: Overview, Services, Staff, Revenue, Customers
- 4 new API endpoints: /reports/services, /reports/staff, /reports/revenue, /reports/customers
- Recharts visualizations: revenue AreaChart, services BarChart, staff comparison, customer PieChart
- 34 tests (20 API + 14 web)

### Prompt 4C: Client Portal Polish — COMPLETE

- Self-service booking flow: 3-step (service selection → date/time via public availability API → confirm with notes)
- Enhanced invoices: "Pay Now" button (Stripe checkout via POST /portal/invoices/:id/pay) + "Download PDF" (printable HTML)
- Documents page: intake form data (from customFields) + visit notes (from completed bookings)
- Portal navigation layout: Dashboard/Book/Invoices/Documents/Profile tab navigation, hidden on login page
- 4 new portal API endpoints: GET /portal/services, POST /portal/bookings, GET /portal/documents, POST /portal/invoices/:id/pay
- 41 tests (15 book + 10 documents + 16 invoices)

### Prompt 1C: Structured Medical History (Aesthetic Vertical) — COMPLETE

- MedicalRecord Prisma model (67th model, migration 52): versioned (isCurrent + version @@unique), 22 fields including allergies/contraindications/medications/conditions arrays, fitzpatrickScale (I-VI), safety booleans (bloodThinners, pregnant, breastfeeding), consent tracking (consentGiven, consentDate), recordedById staff relation
- medical-record API module (60th module): create (versioned with auto-flag), getCurrent, getHistory, checkMedicalClearance
- Auto-flag detection: triggers on allergies, contraindications, bloodThinners, pregnant, breastfeeding → flagged=true + human-readable flagReason
- Treatment booking gating: updateStatus checks for MedicalRecord before allowing CONFIRMED on TREATMENT services (inside existing $transaction)
- 3 aesthetic components: MedicalHistoryForm (structured form with tag inputs, Fitzpatrick select, toggle switches, consent checkbox), MedicalAlertBanner (full/compact modes with flag reason + allergy/contraindication tags), MedicalHistoryDiff (side-by-side version comparison)
- Integration: MedicalAlertBanner in booking detail modal + customer page, AlertTriangle icon on kanban cards for flagged customers
- Portal intake enhanced with bloodThinners/pregnant/breastfeeding checkboxes
- 20 tests (14 API + 6 web)

### Prompt 1A: Before/After Clinical Photo Tracking — COMPLETE

- ClinicalPhoto + PhotoComparison Prisma models (68th-69th models, migration 53): soft delete, bodyArea, type (BEFORE/AFTER/PROGRESS), file upload validation (JPEG/PNG/GIF/WebP, 5MB max)
- clinical-photo API module (61st module): 7 endpoints (upload, list, get, delete, compare, list-comparisons, file-serve)
- 4 web components: PhotoUploadCard (drag-drop), PhotoGallery (filterable grid + lightbox), PhotoComparisonViewer (split-screen slider), PhotoTimeline (chronological by bodyArea)
- Photos tab on customer detail page (aesthetic only) with gallery/timeline/comparisons sub-tabs
- Design tokens: PHOTO_TYPE_STYLES + photoTypeBadgeClasses()
- 57 tests (29 API + 28 web)

### Prompt 1B: Treatment Plan & Consultation-to-Treatment Pipeline — COMPLETE

- TreatmentPlan + TreatmentSession Prisma models (70th-71st models, migration 54): status flow DRAFT → PROPOSED → ACCEPTED → IN_PROGRESS → COMPLETED | CANCELLED, session sequencing with optional booking links
- treatment-plan API module (62nd module): 8 endpoints (create, list, get, update, add-session, update-session, propose, accept)
- Validates aesthetic vertical only, consult booking kind, status transition rules
- sendTreatmentPlanProposal notification on propose, auto-complete plan when all sessions done
- Portal: GET /portal/treatment-plans, POST /portal/treatment-plans/:id/accept
- 3 web components: TreatmentPlanBuilder (form with sessions), TreatmentPlanCard (summary with progress bar), TreatmentPlanTimeline (visual session timeline)
- Design tokens: TREATMENT_PLAN_STATUS_STYLES + treatmentPlanBadgeClasses()
- Integration: booking detail "Create Treatment Plan" button on completed consults, customer detail treatment plans section, portal dashboard proposals
- TREATMENT_PLAN_PROPOSED notification template added to aesthetic pack
- 56 tests (32 API + 24 web)

### Prompt 1D: Aftercare Protocol System — COMPLETE

- AftercareProtocol + AftercareStep + AftercareEnrollment + AftercareMessage Prisma models (72nd-75th models, migration 55): multi-step protocol system with scheduled message delivery
- aftercare API module (63rd module): 7 endpoints (protocol CRUD, enrollment list, enrollment cancel) + @Cron every 15 minutes for message processing
- Replaces single-shot AFTERCARE + TREATMENT_CHECK_IN reminders with protocol-based enrollment for aesthetic businesses
- sendAftercareStepMessage notification method (WHATSAPP/EMAIL/SMS/BOTH channels)
- Template variables: {{customerName}}, {{serviceName}}, {{businessName}}, {{bookingDate}}
- Portal: GET /portal/aftercare endpoint, Active Aftercare section on portal dashboard
- 3 web components: AftercareProtocolEditor (step editor), AftercareEnrollmentCard (progress + timeline), AftercarePortalView (customer-facing timeline)
- Design tokens: AFTERCARE_STATUS_STYLES + aftercareBadgeClasses()
- Default "General Aesthetic Aftercare" protocol seeded in aesthetic pack (4 steps: 0h, 24h, 72h, 168h)
- Integration: customer detail aftercare section, portal dashboard active aftercare
- 53 tests (31 API + 22 web)

### Prompt 2A: Vehicle Inventory Management — COMPLETE

- Vehicle + TestDrive + TestDriveBooking Prisma models (76th-78th models, migration 56): VIN tracking, stock numbers, 6 vehicle statuses, test drive scheduling
- vehicle API module (64th module): full CRUD + search/filter, test-drive scheduling (book, complete, cancel, no-show), stats endpoint
- 4 web pages: /inventory (searchable grid with filters), /inventory/[id] (detail with photo gallery + test drives), /inventory/new (form), /inventory/[id]/edit (form)
- TestDriveCard component, VehicleStatusBadge, design tokens: VEHICLE_STATUS_STYLES + VEHICLE_CONDITION_STYLES
- Customer detail integration: vehicles of interest section for dealership vertical
- 48 tests (26 API + 22 web)

### Prompt 2B: Sales Pipeline & Deal Tracking — COMPLETE

- Deal + DealActivity + DealStageHistory Prisma models (79th-80th models, migration 57): 7-stage pipeline (INQUIRY→QUALIFIED→TEST_DRIVE→NEGOTIATION→FINANCE→CLOSED_WON→CLOSED_LOST), activity logging, stage change tracking
- deal API module (65th module): CRUD, stage transitions with history, activities, pipeline stats, assignment
- 2 web pages: /pipeline (Kanban board with drag-drop, staff filter, stats), /pipeline/[id] (deal detail with stage progress, activities, stage history, sidebar)
- PipelineStats component (weighted value, win rate, cycle time, active deals)
- Design tokens: DEAL_STAGE_STYLES + dealStageBadgeClasses()
- 72 tests (41 API + 31 web)

### Prompt 2C: Customer Journey Enhancement — COMPLETE

- Enhanced customer.service.ts getTimeline() with testDrive events (type: 'testDrive', vehicle label, status, feedback)
- New GET /customers/:id/journey endpoint: structured journey data with deals (stageHistory + activities), testDrives, vehiclesOfInterest (deduplicated), firstContact, engagement score stats
- CustomerJourneyBoard component: horizontal stage timeline, stats row (engagement/visits/test drives/active deals), vehicles of interest chips, active deals list with stage badges
- Customer detail page enhanced: journey board for dealership vertical, replaced quotes section with active deals + vehicles of interest
- AI vertical-action-handler enhanced: deal-aware SALES_INQUIRY (DEAL_UPDATE for open deals, TEST_DRIVE_FOLLOWUP for test drives without deals, SALES_LEAD fallback), checkStalledDeals (7+ day detection)
- 34 tests (28 API + 6 web)

### Prompt 3A: Treatment Package & Session Tracking System — COMPLETE

- ServicePackage + PackagePurchase + PackageRedemption Prisma models (@@map: "service_packages", "package_purchases", "package_redemptions"), migration 58
- PackageModule (67th API module): 11 endpoints (CRUD, purchase, list-purchases, purchase-detail, redeem, customer-active, stats)
- Wellness vertical gating: all operations validate business.verticalPack === 'wellness'
- Purchase flow: creates PackagePurchase with copied totalSessions, computed expiresAt (now + validityDays), optional Payment record
- Redeem flow: transactional with row locking, validates status=ACTIVE + not expired + sessions available + service compatibility, auto-transitions to EXHAUSTED
- Unredeeem on cancel: BookingService calls packageService.unredeemOnCancel() when booking is CANCELLED, restores session and reactivates EXHAUSTED packages
- Daily @Cron: checkExpiredPackages marks ACTIVE purchases past expiresAt as EXPIRED
- Portal: GET /portal/packages endpoint, portal dashboard "Your Session Packages" section with progress bars
- Admin page: /packages with stats cards, packages/purchases tabs, create/edit/delete modals, sell-to-customer flow
- Updated PackageTracker: fetches real data from API via customerId prop, falls back to static props
- New components: PackagePurchaseModal (sell package to customer), PackageRedeemSelector (shown during booking, select session vs full price)
- Design tokens: PACKAGE_STATUS_STYLES + packageBadgeClasses()
- Sidebar nav: /packages under Tools section
- 66 tests (38 API + 28 web)

### Prompt 3C: Enhanced Practitioner Scheduling — COMPLETE

- StaffCertification + RecurringClass Prisma models (@@map: "staff_certifications", "recurring_classes"), migration 59
- Service model additions: requiredResourceType, maxParticipants (@default(1)), requiresCertification
- RecurringClassModule (68th API module): CRUD, GET /recurring-classes/schedule?week=YYYY-WNN, POST /:id/enroll, daily @Cron generation
- Availability service enhancements:
  - Certification filtering: if service.requiresCertification set, only shows staff with valid (non-expired) certification
  - Resource auto-filtering: if service.requiredResourceType set, auto-finds matching resource, returns resourceId/resourceName in slot
  - Group class support: services with maxParticipants > 1 return spotsRemaining instead of boolean availability
- Staff controller: GET/POST/DELETE /:id/certifications endpoints
- Dashboard: GET /dashboard/certification-alerts (30-day expiring + expired certs for wellness businesses)
- Portal: GET /portal/class-schedule, GET /portal/practitioners, dashboard "Upcoming Classes" section
- Web components: PractitionerProfile (staff card with services, certs, weekly availability), ClassSchedule (weekly timetable with enrollment counts + Book buttons), CertificationManager (add/edit/remove with expiry tracking)
- Wellness component barrel export updated
- 48 new tests (25 API + 23 web)

### Omnichannel Messaging — Phases 0-5 + Gap Fix — COMPLETE

- **Phase 0: Foundation** — Channel enum (WHATSAPP/INSTAGRAM/FACEBOOK/SMS/EMAIL/WEB_CHAT), Message.channel denormalized field, Business.channelSettings JSON, CustomerIdentityService (cross-channel customer resolution by phone/email/facebookPsid/instagramUserId), CircuitBreakerService (CLOSED→OPEN→HALF_OPEN with Redis backing), DeadLetterQueueService (Redis hash with 7-day TTL), CHANNEL_STYLES design tokens, ChannelBadge/ReplyChannelSwitcher/ChannelsOnFile/ChannelFilterBar inbox components
- **Phase 1: Instagram DM** — Instagram messaging provider, webhook controller with HMAC validation, story reply/ad referral support, 24h messaging window tracking, seed-instagram.ts demo data
- **Phase 2: SMS (Twilio)** — Full two-way SMS + MMS via Twilio, signature validation, segment-based billing tracking in MessageUsage model, /settings/sms config page, Location.smsConfig JSON
- **Phase 3: Facebook Messenger + Email Channel** — Facebook Messenger via Meta Graph API with webhook verification + HMAC signature validation, /settings/facebook config page, Location.facebookConfig JSON. Email as messaging channel (Resend/SendGrid), /settings/email-channel config page, Location.emailConfig JSON. UsageService for per-channel billing rates. seed-omnichannel.ts for multi-channel demo data
- **Gap Fix (16 issues)** — Security: timing-safe Twilio signature + email webhook verification. Wiring: UsageService + CircuitBreakerService wired into actual message flow (inbound in webhook controller, outbound in MessageService). Missing methods: mergeCustomers() + findConversation() on CustomerIdentityService. Infrastructure: Stripe metered billing via Meter Events API, Redis-backed webchat sessions (24h TTL), per-provider circuit breaker config (twilio-sms: 3/30s/20s, default: 5/60s/30s). Schema: MessageUsage segments + cost fields, Customer email index. UI: ConversationContextBar (FB/IG window countdown, email subject, SMS opt-in), unread count badges, disabled channels with tooltips, inline add-email/phone with validation, getDefaultReplyChannel() helper. Providers: Facebook verifyWebhookSignature() + quick_reply parsing, email delivery status endpoint, SMS location routing fix, identifier format validation (E.164/email). 4100+ tests passing.
- **All omnichannel phases + gap fix complete** — 6 channels fully implemented with production-grade security, billing, and reliability

### Phase 2: Go-Live Configuration (Sessions 4-6) — COMPLETE

- **Session 4 (Stripe Configuration):** Created `docs/STRIPE-SETUP.md` (products, prices, webhooks, go-live checklist). Verified raw body handling (`rawBody: true` in main.ts) and checkout flow end-to-end. Added `GET /billing/health` endpoint (SUPER_ADMIN) that verifies Stripe key + checks all 6 price env vars. 5 new tests.
- **Session 5 (Channel Configuration):** Created `docs/CHANNEL-SETUP.md` (all 6 channels with exact webhook URLs, env vars, prerequisites, signature verification, priority order). Verified web chat widget build (28.7KB IIFE bundle). Documented MESSAGING_PROVIDER switching mechanism.
- **Session 6 (Admin Tests + Production Seed):** Set up Jest test infrastructure for `apps/admin` (jest.config.ts, jest.setup.ts, shared test helpers). Created tests for all 20 admin routes (41 tests). Created `seed-production.ts` (10 PlatformSettings + 5 PlatformAgentDefaults, idempotent upserts).

### Do Not Build (Yet)

- Don't chase additional verticals beyond the current 4 (aesthetic, dealership, wellness, general) before ROI is repeatable
- Don't overinvest in generic AI chatbot; keep AI tied to structured flows
- Don't build deep enterprise features before pack-led implementation is nailed

---

## 15. Key Documentation

| Document                         | Path                               | Purpose                                                    |
| -------------------------------- | ---------------------------------- | ---------------------------------------------------------- |
| Design system + deployment rules | `CLAUDE.md`                        | Active project guidelines for AI assistants                |
| Deployment & operations          | `DEPLOY.md`                        | Railway, Docker, cookies, troubleshooting                  |
| Stripe setup guide               | `docs/STRIPE-SETUP.md`            | Stripe dashboard config, products, prices, webhooks        |
| Channel setup guide              | `docs/CHANNEL-SETUP.md`           | All 6 channels: env vars, webhook URLs, priority order     |
| URLs & services                  | `docs/URLS.md`                     | All domains, services, DNS, third-party dashboards         |
| CI/CD pipeline                   | `docs/cicd.md`                     | Pipeline details and Railway config                        |
| User stories                     | `docs/user-stories.md`             | 280 can-do + 215 gaps by feature area                      |
| UX brainstorm brief              | `docs/ux-brainstorm-brief.md`      | Self-contained brief for LLM brainstorming                 |
| Messaging failure runbook        | `docs/runbooks/MESSAGING-FAILURE.md` | Troubleshooting messaging issues                         |
| This file                        | `docs/PROJECT_CONTEXT.md`          | Full project context                                       |
| Env template                     | `.env.example`                     | All environment variables                                  |
| Production env                   | `.env.production`                  | Production env template                                    |

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

| Command                 | Description                      |
| ----------------------- | -------------------------------- |
| `npm run dev`           | Start all apps                   |
| `npm run build`         | Build all                        |
| `npm run lint`          | Lint all (ESLint + TypeScript)   |
| `npm test`              | Run all tests (4,100+ API tests) |
| `npm run test:coverage` | Tests with coverage thresholds   |
| `npm run db:generate`   | Generate Prisma client           |
| `npm run db:migrate`    | Run migrations                   |
| `npm run db:seed`       | Seed demo data (idempotent)      |
| `npm run db:studio`     | Prisma Studio GUI                |
| `npm run format`        | Format with Prettier             |
| `npm run format:check`  | Check formatting                 |
