# Booking OS — Complete Project Context

> **Purpose:** This document gives full context on the Booking OS platform — what it is, what's been built, how it's structured, and what's left to build. Share this with an AI assistant or new developer to get productive immediately.
>
> **Last updated:** February 18, 2026

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

- **Appointment scheduling** — Calendar views (day/week), conflict detection, recurring bookings, automated reminders, force-book with reason
- **WhatsApp messaging inbox** — Real-time via Socket.io, AI auto-replies, conversation management (assign, snooze, tag, close)
- **AI booking assistant** — Guides customers through booking/cancellation/rescheduling via chat (powered by Claude API)
- **AI features** — Intent detection, reply suggestions, conversation summaries, customer profile collection, per-customer AI chat
- **Customer management** — Profiles with custom fields, tags, CSV import, AI-powered profile extraction from conversations
- **Staff management** — Roles (Admin/Service Provider/Agent/Super Admin), working hours per day, time off, email invitations
- **Service catalog** — Categories, pricing, durations, buffer times, deposit requirements, service kinds (CONSULT/TREATMENT/OTHER), soft delete
- **Multi-location** — Multiple physical locations per business, staff-location assignments, per-location WhatsApp routing, location-based conversation filtering
- **Resource management** — Equipment/bays/rooms per location with metadata, resource-level booking
- **Service kanban** — Dealership workflow board (CHECKED_IN → DIAGNOSING → AWAITING_APPROVAL → IN_PROGRESS → READY_FOR_PICKUP)
- **Quotes** — Create quotes for bookings, customer self-serve approval via token link with IP audit
- **Analytics & reports** — Bookings over time, revenue, service breakdown, staff performance, no-show rates, peak hours, consult conversion
- **ROI dashboard** — Baseline vs current metrics, recovered revenue estimate, weekly review with email
- **Multi-language** — English & Spanish (600+ translation keys), per-business overrides, language picker
- **Billing** — Stripe integration (Basic/Pro plans), checkout, customer portal, webhooks, deposit collection
- **Calendar sync** — Google Calendar + Outlook OAuth integration, iCal feed generation
- **Public booking portal** — Customer-facing booking page at `/book/{slug}` with service selection, availability, booking, waitlist join
- **Self-serve links** — Token-based reschedule, cancel, waitlist claim, and quote approval pages
- **Waitlist** — Auto-offers on cancellation, token-based 1-tap claim, configurable offer count/expiry/quiet hours
- **Campaigns** — Audience segmentation, template-based bulk messaging, throttled dispatch, delivery tracking
- **Automations** — 3 built-in playbooks + custom rule builder with 6 triggers, quiet hours, frequency caps, activity log
- **Offers** — Promotional offers with expiry, max redemptions, service linking
- **Vertical packs** — Pack builder with versioning, publish flow, business-level overrides
- **Setup wizard** — 10-step onboarding flow for new businesses
- **Dark mode** — System preference detection, manual toggle, full UI coverage
- **Global search** — Cmd+K command palette searching across customers, bookings, services, conversations
- **Interactive demo tour** — 9-step guided walkthrough with spotlight overlays, tooltips, keyboard navigation, localStorage persistence
- **Notifications** — Email via Resend, WhatsApp, automated booking reminders, notification timeline
- **Security** — Helmet CSP, rate limiting, JWT blacklisting, brute force protection, httpOnly cookies, tenant isolation

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
- **Final counts:** 2,360+ tests total (895 web + 1,465 API)

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
│   │   │   ├── modules/        # 31 feature modules
│   │   │   ├── common/         # Guards, decorators, filters, DTOs, Prisma service
│   │   │   └── main.ts         # Bootstrap, Swagger, CORS, cookies, validation
│   │   └── Dockerfile          # Multi-stage production build
│   ├── web/                    # Next.js admin dashboard (port 3000)
│   │   ├── src/
│   │   │   ├── app/            # 40+ pages
│   │   │   ├── components/     # Shared components (shell, modals, tour, etc.)
│   │   │   ├── lib/            # Utility modules (API client, auth, i18n, socket, theme)
│   │   │   ├── locales/        # en.json, es.json (600+ keys each)
│   │   │   └── middleware.ts   # Route protection (checks access_token cookie)
│   │   └── Dockerfile          # Multi-stage production build
│   └── whatsapp-simulator/     # WhatsApp testing tool (port 3002)
├── packages/
│   ├── db/                     # Prisma schema (30 models), migrations, seed scripts
│   │   ├── prisma/schema.prisma
│   │   ├── src/seed.ts         # Base seed (idempotent)
│   │   └── src/seed-demo.ts    # Rich demo data (idempotent)
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

## 5. Database Schema (31 Models)

```
Business (1) ──┬── (*) Staff ──── (*) WorkingHours
               │                  ├── (*) TimeOff
               │                  ├── (*) CalendarConnection
               │                  └── (*) StaffLocation ──── Location
               ├── (*) Customer
               ├── (*) Service
               ├── (*) Booking ──── (*) Reminder
               │    │               ├── (*) Payment
               │    │               └── (*) Quote
               │    ├── Location (optional)
               │    └── Resource (optional)
               ├── (*) RecurringSeries
               ├── (*) Conversation ──── (*) Message
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
               ├── (*) Offer
               ├── (*) SavedView
               └── (*) VerticalPackVersion
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
| **Customer** | phone (unique per biz), tags[], customFields (JSON) | Vertical-specific fields |
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

---

## 6. API Modules (32 Controllers)

All endpoints prefixed with `/api/v1`. Swagger docs at `/api/docs` (dev only).

| Module | Route Prefix | Key Operations |
|--------|-------------|----------------|
| **Auth** | `/auth` | signup, login, refresh, logout, forgot/reset/change password, accept-invite, verify-email |
| **Bookings** | `/bookings` | CRUD, status change, kanban status, calendar view, kanban board, bulk ops, deposit/reschedule/cancel links, policy check |
| **Recurring** | `/bookings/recurring` | Create series, cancel (single/future/all) |
| **Customers** | `/customers` | CRUD, search, bulk tag, CSV import, conversation import |
| **Services** | `/services` | CRUD with soft delete |
| **Staff** | `/staff` | CRUD, invite, working hours, time off |
| **Business** | `/business` | Profile, policies, notifications, waitlist settings, install pack |
| **Locations** | `/locations` | CRUD locations, resources, staff assignments |
| **Conversations** | `/conversations` | List, assign, status, snooze, tags, messages, notes, booking creation |
| **Messages** | `/conversations/:id/messages` | Send message |
| **Templates** | `/templates` | Full CRUD |
| **Dashboard** | `/dashboard` | Stats, AI usage, dismiss nudge |
| **Reports** | `/reports` | 9 report types (bookings, revenue, no-shows, staff perf, peak hours, etc.) |
| **ROI** | `/roi` | Go-live, baseline, dashboard, weekly review |
| **AI** | `/ai` | Settings, conversation summary, booking/cancel/reschedule confirm, customer chat |
| **Availability** | `/availability` | Available slots (by date, service, staff, location, resource) |
| **Search** | `/search` | Global search (customers, bookings, conversations) |
| **Automations** | `/automations` | Playbooks toggle, rules CRUD, test, activity log |
| **Campaigns** | `/campaigns` | CRUD, audience preview, send |
| **Offers** | `/offers` | CRUD, redeem |
| **Quotes** | `/quotes` | Create, view, per-booking |
| **Waitlist** | `/waitlist` | List, update, cancel, resolve |
| **Billing** | `/billing` | Checkout, portal, subscription, webhook, deposit |
| **Calendar Sync** | `/calendar-sync` | OAuth connect/disconnect (Google/Outlook), iCal feed, manual sync |
| **iCal Feed** | `/ical` | Token-based iCal feed |
| **Translations** | `/translations` | Get/upsert/delete per locale |
| **Pack Builder** | `/admin/packs` | CRUD packs, versioning, publish (SUPER_ADMIN only) |
| **Vertical Packs** | `/vertical-packs` | Get pack config (public) |
| **Public Booking** | `/public` | Business info, services, availability, book, join waitlist |
| **Self-Serve** | `/self-serve` | Reschedule, cancel, waitlist claim, quote approval (token-based) |
| **Saved Views** | `/saved-views` | CRUD, list by page, pinned views, dashboard views, share/unshare |
| **Health** | `/health` | DB + Redis health check with latency |

### Auth & Multi-tenancy
- JWT in httpOnly cookies (access: 15 min, refresh: 7 days)
- Cookie domain auto-derived from `CORS_ORIGINS` for subdomain sharing (`.businesscommandcentre.com`)
- `sameSite: lax`, `secure: true` in production — see DEPLOY.md section 6 for critical rules
- Token blacklisting on logout and password change
- `TenantGuard` + `@BusinessId()` for tenant isolation
- `@Roles()` + `RolesGuard` for role-based access
- Brute force protection: 5 failed attempts = 15-min lockout
- Rate limiting per endpoint (signup: 3/min, login: 10/min, etc.)

---

## 7. Frontend Pages (40+ Pages)

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

### Protected Pages
| Page | Route | Description |
|------|-------|-------------|
| Setup Wizard | `/setup` | 10-step onboarding |
| Dashboard | `/dashboard` | KPI metrics, attention items, checklist, milestones |
| Bookings | `/bookings` | Filterable list, bulk actions, detail modal |
| Calendar | `/calendar` | Day/week view, staff columns, click-to-book |
| Inbox | `/inbox` | 3-pane messaging with AI suggestions |
| Customers | `/customers` | Search, import, bulk tag |
| Customer Detail | `/customers/[id]` | Profile, AI chat, booking history |
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
| Settings | `/settings/*` | 11 settings sub-pages (account, AI, templates, translations, calendar, billing, notifications, offers, policies, waitlist, profile fields) |

### Key Components
- `Shell` — Sidebar nav with mode-grouped items + "More" toggle, pinned saved views, i18n, pack provider, dark mode, tour trigger
- `BookingFormModal` / `BookingDetailModal` — Create/view/reschedule bookings
- `AiSuggestions` / `AiBookingPanel` / `AiSummary` — AI features in inbox
- `CommandPalette` — Cmd+K global search
- `BulkActionBar` — Multi-select action bar
- `DemoTourProvider` / `TourSpotlight` / `TourTooltip` — Interactive demo tour
- `LanguagePicker` — Locale selector
- `TooltipNudge` — Dismissible coaching tooltips
- `Skeleton` / `EmptyState` — Loading and empty states
- `ModeSwitcher` — Role-based mode pill/tab selector (admin/agent/provider)
- `ViewPicker` / `SaveViewModal` — Saved filter views on list pages
- `KpiStrip` / `MyWork` / `AttentionCards` — Mission Control dashboard components

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
- Clinic: 20 customers, 36 bookings, 8 conversations, 6 waitlist entries, 3 campaigns, 3 automation rules, 5 payments
- Dealership: 15 customers, 25 bookings with kanban statuses, 3 quotes, 4 conversations, 2 automation rules

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

### Phase 4: Engagement OS + Benchmarking + Marketplace (NOT STARTED)

| Item | Description |
|------|-------------|
| **Benchmarking & Coaching** | Anonymized peer benchmarks by vertical + region, "what top performers do" recommendations |
| **Omnichannel Inbox** | IG DM, Messenger, web chat — unified timeline and automations |
| **Vertical Packs Marketplace** | Partner portal, revenue share, certification program |
| **Customer Mini-Portal** | Booking management, receipts, memberships, referrals |

### UX Improvements
- **UX Phase 1** (Role-based Modes + Mission Control + Saved Views) — COMPLETE
- See `docs/user-stories.md` for complete inventory (280 current capabilities, 215 identified gaps) and `docs/ux-brainstorm-brief.md` for brainstorm prompts.

### Code Quality
- **Error Handling Remediation** — COMPLETE (commit 1cf6f99). Replaced ~20 silent `.catch(() => {})` with logged warnings, queue processors throw on failure, NestJS proper exceptions, frontend toast wiring, waitlist loop resilience, WebSocket disconnect logging. +58 tests.

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
| `npm test` | Run all tests (~2,360 tests) |
| `npm run test:coverage` | Tests with coverage thresholds |
| `npm run db:generate` | Generate Prisma client |
| `npm run db:migrate` | Run migrations |
| `npm run db:seed` | Seed demo data (idempotent) |
| `npm run db:studio` | Prisma Studio GUI |
| `npm run format` | Format with Prettier |
| `npm run format:check` | Check formatting |
