# Booking OS — Project Guidelines

## What This Project Is

Booking OS is a **multi-tenant SaaS platform** for service-based businesses (aesthetic clinics, car dealerships, wellness spas) to manage appointments, customer messaging, and operations — with AI-powered automation via Claude.

- **Live production:** https://businesscommandcentre.com
- **API:** https://api.businesscommandcentre.com/api/v1
- **Verticals:** Aesthetic, Dealership, Wellness, General (extensible via Vertical Pack system)
- **Target users:** Small to mid-size service businesses (1-20 staff) — owners, receptionists, service providers, and their end customers

### Demo Credentials

| Business              | Email                     | Password    | Vertical   |
| --------------------- | ------------------------- | ----------- | ---------- |
| Glow Aesthetic Clinic | sarah@glowclinic.com      | password123 | Aesthetic  |
| Metro Auto Group      | mike@metroauto.com        | password123 | Dealership |
| Serenity Wellness Spa | maya@serenitywellness.com | password123 | Wellness   |

---

## Monorepo Structure (Turborepo)

```
booking-os/
├── apps/
│   ├── api/                    # NestJS REST API (port 3001)
│   │   ├── src/
│   │   │   ├── modules/        # 80 feature modules (one dir per domain)
│   │   │   ├── common/         # Guards, decorators, filters, DTOs, PrismaService
│   │   │   └── main.ts         # Bootstrap, Swagger, CORS, cookies, validation
│   │   └── Dockerfile          # Multi-stage production build
│   ├── web/                    # Next.js 15 customer dashboard (port 3000)
│   │   ├── src/
│   │   │   ├── app/            # 83 pages (App Router) — customer-facing only, no admin/console
│   │   │   ├── components/     # Shared components (briefing/, aesthetic/, skeletons, modals)
│   │   │   ├── lib/            # API client, auth, i18n, socket, theme
│   │   │   ├── locales/        # en.json, es.json (600+ keys each)
│   │   │   └── middleware.ts   # Route protection (checks access_token + refresh_token cookies)
│   │   └── Dockerfile          # Multi-stage production build
│   ├── admin/                  # Next.js 15 admin console (port 3002) — SUPER_ADMIN only
│   │   ├── src/
│   │   │   ├── app/            # 20 admin pages (App Router) — 15 core + 5 marketing, migrated from apps/web/
│   │   │   ├── components/     # Admin shell, skeleton loaders, view-as banner, marketing/ (9 MCC components)
│   │   │   ├── lib/            # API client, auth (SUPER_ADMIN gate), cn utility
│   │   │   └── middleware.ts   # Strict route protection (redirects to customer app if unauthenticated)
│   │   └── next.config.js      # Stricter CSP (no analytics), X-Robots-Tag: noindex
│   └── whatsapp-simulator/     # WhatsApp testing tool (port 3002)
├── packages/
│   ├── db/                     # Prisma schema (91 models), migrations, seed scripts
│   │   ├── prisma/schema.prisma
│   │   ├── src/seed.ts         # Base seed (aesthetic + dealership + wellness, idempotent)
│   │   ├── src/seed-demo.ts    # Rich demo data (idempotent, dedup-safe)
│   │   ├── src/seed-agentic.ts # One-time agentic data fill
│   │   ├── src/seed-wellness.ts # Standalone wellness seed (also called from seed.ts)
│   │   ├── src/seed-console.ts # Platform console base data
│   │   ├── src/seed-console-showcase.ts # Console demo data
│   │   └── src/seed-content.ts # Content pillar seeding (12 blog posts → ContentDraft)
│   ├── messaging-provider/     # WhatsApp Cloud + Instagram DM API abstraction
│   └── shared/                 # Shared types, DTOs, enums, profile field definitions
├── agents/                     # 15 internal growth engine agent prompts (research → ops)
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
├── docs/                       # PROJECT_CONTEXT.md, cicd.md, user-stories.md, ux-brainstorm-brief.md
├── docker-compose.yml          # Local development
├── docker-compose.prod.yml     # Production (Nginx + SSL)
├── docker-compose.demo.yml     # Demo quick-start (auto-seeds)
├── DEPLOY.md                   # Deployment & operations guide (READ BEFORE INFRA CHANGES)
└── .github/workflows/ci.yml   # CI/CD pipeline
```

---

## Tech Stack

| Layer       | Technology                                    | Version       |
| ----------- | --------------------------------------------- | ------------- |
| Frontend    | Next.js (App Router), React, TypeScript       | 15.x, 19.x    |
| Styling     | Tailwind CSS                                  | 4.x           |
| Icons       | lucide-react                                  | 0.468         |
| Charts      | Recharts                                      | 2.15          |
| Real-time   | Socket.io                                     | 4.x           |
| Backend     | NestJS, TypeScript                            | 11.x          |
| ORM         | Prisma                                        | 6.x           |
| Database    | PostgreSQL                                    | 16            |
| AI          | Anthropic Claude API                          | claude-sonnet |
| Payments    | Stripe                                        | stripe-node   |
| Email       | Resend                                        | -             |
| Messaging   | WhatsApp Business Cloud API, Instagram DM API | -             |
| Cache/Queue | Redis 7 + BullMQ                              | -             |
| Monorepo    | Turborepo                                     | 2.x           |
| CI/CD       | GitHub Actions → Railway                      | -             |
| Monitoring  | Sentry                                        | -             |
| Analytics   | PostHog                                       | -             |
| Linting     | ESLint 9 + Prettier                           | -             |

---

## Vertical Pack System

Each vertical customizes fields, templates, automations, and workflows. The pack is set on `Business.verticalPack` and configured via `Business.packConfig` (JSON).

### Aesthetic Clinics

- Consult → Treatment → Aftercare workflows
- Medical intake fields, before/after tracking
- `ServiceKind: CONSULT | TREATMENT | OTHER`
- `IntakeCard` component for customer detail
- AI features: consult→treatment conversion tracking, aftercare follow-ups

### Car Dealerships

- Service kanban board: `CHECKED_IN → DIAGNOSING → AWAITING_APPROVAL → IN_PROGRESS → READY_FOR_PICKUP`
- Vehicle inventory: VIN tracking, stock numbers, test drives (`VehicleStatus`, `VehicleCondition`, `TestDriveStatus`)
- Sales pipeline: 7-stage deal tracking (`DealStage: INQUIRY → QUALIFIED → TEST_DRIVE → NEGOTIATION → FINANCE → CLOSED_WON → CLOSED_LOST`)
- Quote approval via token link with IP audit
- Resource/bay scheduling

### Wellness & Spa

- 7-field wellness intake (health goals, fitness level, injuries, medications, allergies, modality, membership)
- Session packages: `ServicePackage` + `PackagePurchase` + `PackageRedemption` models
- Auto-unredeem on booking cancel
- Membership tiers: Drop-in, Monthly, Annual, VIP
- Components: `WellnessIntakeCard`, `PackageTracker`, `MembershipBadge`, `PackagePurchaseModal`, `PackageRedeemSelector`

### General

- Base vertical with standard booking features, no vertical-specific customizations

---

## Backend Conventions (NestJS API)

### Module Structure

Every feature is a NestJS module in `apps/api/src/modules/` (80 modules). Each module follows this pattern:

```
modules/
  feature-name/
    feature-name.module.ts      # NestJS module definition
    feature-name.controller.ts  # REST endpoints
    feature-name.service.ts     # Business logic
    feature-name.controller.spec.ts  # Controller tests
    feature-name.service.spec.ts     # Service tests
    dto/
      create-feature.dto.ts     # Input validation (class-validator)
      update-feature.dto.ts
```

### Auth & Multi-Tenancy

- JWT in httpOnly cookies (access: 15 min, refresh: 7 days)
- Cookie domain auto-derived from `CORS_ORIGINS` for subdomain sharing
- **Every endpoint** uses `TenantGuard` + `@BusinessId()` param decorator for tenant isolation
- Role-based access via `@Roles()` + `RolesGuard`
- Staff roles: `OWNER`, `ADMIN`, `AGENT`, `SERVICE_PROVIDER`, `SUPER_ADMIN`
- Brute force protection: 5 failed attempts = 15-min lockout
- Token blacklisting on logout and password change
- Rate limiting per endpoint (signup: 3/min, login: 10/min, etc.)

### API Patterns

- All endpoints prefixed with `/api/v1`
- Swagger docs at `/api/docs` (dev only)
- DTOs use `class-validator` decorators (`@IsString()`, `@MaxLength()`, `@IsOptional()`, etc.)
- Pagination: offset-based with `?skip=0&take=20` pattern, capped at reasonable limits
- Errors: throw NestJS exceptions (`NotFoundException`, `ForbiddenException`, `BadRequestException`)
- **Never** return raw Prisma errors to the client
- REST naming: plural nouns for collections (`/bookings`, `/customers`), nested resources where parent context matters (`/conversations/:id/messages`), query params for filtering/pagination

### Error Handling & Logging

- All errors logged to **Sentry** via `@sentry/node` (API) and `@sentry/nextjs` (web)
- NestJS exception filters catch unhandled errors and return standardized error responses
- Services should throw specific NestJS exceptions (`NotFoundException`, `ForbiddenException`, etc.) — never let raw Prisma/DB errors reach the client
- BullMQ job failures are logged with full context (queue name, job data, error)
- External service errors (Claude API, WhatsApp, Stripe, Resend) should be caught, logged, and gracefully degraded — never crash the request
- `ClaudeClient` has built-in graceful degradation (returns null on failure, caller handles)

### Database (Prisma)

- Schema at `packages/db/prisma/schema.prisma` — **91 models**, 61 migrations
- Generate client: `npx prisma generate --schema=packages/db/prisma/schema.prisma`
- Create migration: `npx prisma migrate dev --name your_name --schema=packages/db/prisma/schema.prisma`
- `PrismaService` is a global NestJS provider — inject it in constructors
- All queries **must filter by `businessId`** for tenant isolation
- JSON fields (customFields, metadata, aiSettings, packConfig, etc.) — use `Prisma.JsonValue` type
- Key JSON fields to be aware of: `Business.packConfig` (vertical config), `Business.aiSettings` (AI behavior), `Business.policySettings` (cancellation/reschedule), `Conversation.metadata` (AI state for multi-turn flows), `ActionCard.preview` (diff data), `ActionCard.ctaConfig` (button config), `AutomationRule.filters`/`.actions` (rule definitions)

### Key Enums

```
StaffRole:          OWNER, ADMIN, AGENT, SERVICE_PROVIDER, SUPER_ADMIN
BookingStatus:      PENDING, PENDING_DEPOSIT, CONFIRMED, IN_PROGRESS, COMPLETED, CANCELLED, NO_SHOW
BookingSource:      MANUAL, PORTAL, WHATSAPP, AI, REFERRAL, WALK_IN
KanbanStatus:       CHECKED_IN, DIAGNOSING, AWAITING_APPROVAL, IN_PROGRESS, READY_FOR_PICKUP
ConversationStatus: OPEN, WAITING, RESOLVED, SNOOZED
ServiceKind:        CONSULT, TREATMENT, OTHER
VerticalPack:       AESTHETIC, SALON, TUTORING, GENERAL, DEALERSHIP, WELLNESS
VehicleStatus:      IN_STOCK, RESERVED, SOLD, IN_TRANSIT, TRADE_IN, ARCHIVED
VehicleCondition:   NEW, USED, CERTIFIED_PRE_OWNED
TestDriveStatus:    SCHEDULED, COMPLETED, NO_SHOW, CANCELLED
DealStage:          INQUIRY, QUALIFIED, TEST_DRIVE, NEGOTIATION, FINANCE, CLOSED_WON, CLOSED_LOST
DealActivityType:   NOTE, CALL, EMAIL, MEETING, TEST_DRIVE, FOLLOW_UP
DealSource:         WALK_IN, PHONE, WEBSITE, WHATSAPP, REFERRAL
DealType:           NEW_PURCHASE, USED_PURCHASE, TRADE_IN, LEASE
ActionCardCategory: URGENT_TODAY, NEEDS_APPROVAL, OPPORTUNITY, HYGIENE
AutonomyLevel:      OFF, SUGGEST, AUTO_WITH_REVIEW, FULL_AUTO
AgentType:          WAITLIST, RETENTION, DATA_HYGIENE, SCHEDULING_OPTIMIZER, QUOTE_FOLLOWUP (+ 12 marketing agents)
```

### BullMQ Queues (8)

- `AI_PROCESSING` — AI task processing
- `MESSAGING` — WhatsApp/SMS message dispatch
- `REMINDERS` — Booking reminders
- `NOTIFICATIONS` — Notification delivery (including scheduled report emails)
- `CALENDAR_SYNC` — Calendar sync jobs
- `AGENT_PROCESSING` — Background agent job processing
- `ONBOARDING_DRIP` — 13-email onboarding sequence
- `DUNNING` — 3-email payment failure sequence with auto-downgrade after 14 days
- Queue processors are in `apps/api/src/common/queue/`
- Redis connection via `REDIS_URL` environment variable
- **Do not add new queues without discussing consolidation first** — 8 queues is already a lot for Redis to manage

### Real-Time (Socket.io)

Key events: `message:new`, `conversation:updated`, `ai:suggestion`, `ai:auto-replied`, `ai:transfer-to-human`, `booking:updated`, `ai:booking-state`, `action-card:created`, `action-card:updated`, `message:status`, `viewing:start`/`viewing:stop`, `presence:update`

---

## Frontend Conventions (Next.js 15)

### App Router

- Pages are in `apps/web/src/app/` using Next.js App Router (not Pages Router)
- Protected pages check `access_token` + `refresh_token` cookies in `middleware.ts` (redirects to /login only when both are missing)
- **83 pages** in `apps/web/` (~17 public, ~50 protected, ~16 portal/marketing site) + **20 admin pages** in `apps/admin/` (15 core + 5 marketing)
- Client components use `'use client'` directive

### Page Categories

**Public pages:** `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/verify-email`, `/accept-invite`, `/book/[slug]` (booking portal), `/manage/*` (self-serve links), `/portal/[slug]/*` (customer portal with OTP auth)

**Marketing pages:** `/` (landing page with hero, features, pricing), `/blog`, `/blog/[slug]` (JSON-LD, OpenGraph), `/pricing`, `/faq`

**Protected pages (tenant):** `/dashboard`, `/bookings`, `/calendar`, `/inbox`, `/customers`, `/customers/[id]`, `/services`, `/staff`, `/waitlist`, `/campaigns`, `/automations`, `/reports`, `/roi`, `/service-board` (dealership kanban), `/settings/*` (13 sub-pages), `/packages` (wellness), `/testimonials`, `/marketing/*` (internal only — no sidebar nav), `/ai/*` (command center: overview, actions, agents, performance), `/search`, `/notifications`, `/help`

**Console pages (Super Admin):** These pages live in the **separate `apps/admin/` app** (port 3002), not in `apps/web/`. Routes: `/` (overview), `/businesses` (directory), `/businesses/[id]` (Business 360), `/audit`, `/health`, `/support`, `/billing`, `/billing/past-due`, `/billing/subscriptions`, `/packs`, `/packs/[slug]`, `/packs/skills`, `/agents`, `/messaging`, `/settings`, `/marketing` (landing), `/marketing/queue` (content approval), `/marketing/agents` (12 marketing agents), `/marketing/sequences` (email sequences), `/marketing/rejection-analytics`

### API Client

- Central API client at `apps/web/src/lib/api.ts`
- Has **automatic token refresh** — on 401, calls `POST /auth/refresh` before redirecting to /login
- Concurrent refresh calls are deduplicated
- `fetchWithRetry()` auto-retries once on network errors (handles deployment rollovers)
- **Never remove the token refresh logic** — it keeps sessions alive for 7 days

### State & Data Fetching

- No external state library — uses React hooks (`useState`, `useEffect`, `useCallback`)
- Data fetching via the API client in `useEffect` or event handlers
- Real-time updates via Socket.io client at `apps/web/src/lib/socket.ts`
- i18n via custom `useTranslation` hook reading from `locales/en.json` and `locales/es.json`

### Component Patterns

- **No external component libraries** — strictly Tailwind CSS utility classes
- Shared components in `apps/web/src/components/`
- Marketing Command Center components in `apps/admin/src/components/marketing/` — 9 reusable components (TierBadge, ContentDraftCard, ActionCardComponent, AgentStatusCard, PipelineVisualization, PillarBalanceChart, RejectionCodePicker, AutonomyLevelSelector, MarketingSkeleton) with barrel export via `index.ts`
- Briefing components in `apps/web/src/components/briefing/` — BriefingCard, OpportunityCard, BriefingFeed
- Feature-specific components co-located with their page or in named subdirectories
- Modals use a consistent pattern: `XxxModal` with `isOpen` + `onClose` props
- Loading states: `Skeleton` component + compositions (`PageSkeleton`, `DetailSkeleton`, `FormSkeleton`, `ListSkeleton`, `InboxSkeleton`, `CalendarSkeleton`) — always use these instead of raw `animate-pulse` divs or "Loading..." text
- Empty states: `EmptyState` component
- Bulk actions: `BulkActionBar` component
- Keyboard shortcuts: Use hooks from `apps/web/src/lib/use-keyboard-shortcut.ts`:
  - `useKeyboardShortcut(key, handler, opts)` — single key with `meta`/`shift`/`allowInInputs`/`preventDefault` options
  - `useChordShortcut(firstKey, chords, timeout)` — chord sequences (e.g., G then B) with configurable timeout
  - `useListNavigation(count, onSelect)` — J/K/Arrow list navigation with wrapping
  - Search inputs should include `data-search-input` attribute for `/` key focus

### Design Tokens

- **Centralized in `apps/web/src/lib/design-tokens.ts`** — all status colors, elevation constants, and shared style maps
- `BOOKING_STATUS_STYLES` — map of all 7 booking statuses to `{ bg, text, border, dot, label, hex }`
- `BOOKING_SOURCE_STYLES` — map of 6 booking sources (MANUAL, PORTAL, WHATSAPP, AI, REFERRAL, WALK_IN) to `{ bg, text, label, hex }`
- `CONVERSATION_STATUS_STYLES` — map of 4 conversation statuses (OPEN, WAITING, RESOLVED, SNOOZED)
- `ELEVATION` — shadow + radius tokens: `card`, `modal`, `dropdown`, `cardSm`, `fab`
- Marketing tokens: `CONTENT_TYPE_STYLES` (6 types), `TIER_STYLES` (GREEN/YELLOW/RED), `ACTION_CARD_PRIORITY_STYLES` (4 priorities), `AGENT_CATEGORY_STYLES` (3 categories), `AUTONOMY_LEVEL_STYLES` (4 levels), `PIPELINE_STAGE_STYLES` (6 stages)
- Helper functions: `statusBadgeClasses(status)`, `statusCalendarClasses(status)`, `statusHex(status)`, `contentTypeBadgeClasses(type)`, `tierBadgeClasses(tier)`, `priorityBadgeClasses(priority)`, `agentCategoryBadgeClasses(category)`, `autonomyBadgeClasses(level)`
- **Always import from design-tokens.ts** — never define inline status color objects

### Navigation Structure

- Sidebar uses 4 sections: **Workspace** / **Tools** / **Insights** / **AI & Agents** (defined per mode in `apps/web/src/lib/mode-config.ts`)
- Admin workspace includes: Inbox, Calendar, Customers, Bookings, Waitlist
- Admin tools includes: Services, Staff, Invoices, Packages (wellness), Campaigns, Automations, Testimonials
- AI & Agents section (admin only): AI & Agents, Action Triage, Agent Status, Performance — shows only the 5 core operational agents, not marketing agents
- Section labels use `.nav-section-label` CSS class from `globals.css`
- Settings link is in the sidebar footer area, not in the main nav
- **Marketing pages** (`/marketing/*`) exist but have no sidebar nav — they are internal BookingOS tools, not customer-facing
- **SUPER_ADMIN login** redirects to the admin app (`NEXT_PUBLIC_ADMIN_URL`) via `window.location.href` — no admin/console nav items in the customer app sidebar
- Mobile uses bottom tab bar (Calendar, Inbox, Clients, Home) + "More" sheet for overflow items
- Mobile swipe gestures: `useSwipeGesture` hook in `apps/web/src/lib/use-swipe-gesture.ts` for touch swipe detection with threshold, vertical rejection, and `onSwiping` callback
- Mobile calendar: `DateScroller` component (`apps/web/src/components/date-scroller.tsx`) for horizontal scrollable date picker, forced day view on mobile, stacked booking cards, FAB for new booking

---

## Design System & UI Guidelines

### Aesthetic

**"Minimalist Premium"** — Apple Health meets Stripe. Lots of whitespace, subtle shadows, highly legible typography, deliberate use of color.

### Typography

- **UI / Data font:** `Inter` (Google Fonts) — set as Tailwind's default `font-sans`
- **Display / Header font:** `Playfair Display` (Google Fonts) — set as Tailwind's `font-serif`
- Use `font-serif` for large metrics, page titles, and high-impact headers
- Use `font-sans` (Inter) for body text, labels, buttons, and data

### Color Palette

**Sage (primary actions, confirmations, success):**

- 50: `#F4F7F5`, 100: `#E4EBE6`, 500: `#8AA694`, 600: `#71907C`, 900: `#3A4D41`

**Lavender (AI features, highlights, pending states):**

- 50: `#F5F3FA`, 100: `#EBE7F5`, 500: `#9F8ECB`, 600: `#8A75BD`, 900: `#4A3B69`

**Backgrounds:** Warm off-white `#FCFCFD` instead of `gray-50`
**Default text:** `slate-800` for body, `slate-500` for secondary

### Component Style Rules

1. **Border radii:** `rounded-2xl` (or `rounded-3xl` for auth cards). Avoid sharp corners
2. **Borders:** Remove where possible. Prefer soft, diffused drop shadows
3. **Shadows:** Custom `shadow-soft` (`0 12px 40px -12px rgba(0, 0, 0, 0.05)`)
4. **Buttons:** `rounded-xl` with hover transitions. Primary = `bg-sage-600 hover:bg-sage-700 text-white`. Dark = `bg-slate-900 hover:bg-slate-800 text-white`
5. **Inputs:** `bg-slate-50 border-transparent focus:bg-white focus:ring-2 focus:ring-sage-500 rounded-xl`
6. **No external component libraries.** Strictly Tailwind CSS utility classes

### Status Badge Colors (use `BOOKING_STATUS_STYLES` from `design-tokens.ts`)

- Confirmed / Completed → `bg-sage-50 text-sage-900`
- Pending → `bg-lavender-50 text-lavender-900`
- Cancelled / No-show → `bg-red-50 text-red-700`
- In Progress → `bg-amber-50 text-amber-700`

### CSS Utilities (`globals.css`)

- `.status-dot` — small colored dot indicator (1.5×1.5 rounded-full)
- `.btn-press` — subtle press feedback (scale 0.98 on :active)
- `.nav-section-label` — sidebar nav section headings (10px uppercase tracking-wider)
- `.celebration-confetti` — CSS-only confetti animation for setup wizard completion (respects `prefers-reduced-motion`)

### Micro-Animation Utilities (`globals.css` — DS V2 §10)

- `.animate-slide-up`, `.animate-fade-in`, `.animate-scale-in`, `.animate-slide-in-right`, `.animate-slide-in-from-bottom` — entrance animations (200–300ms)
- `.animate-badge-flash` — brief white pulse on status badge change (400ms, use with `key={status}` to re-trigger)
- `.animate-card-hover` — translateY(-2px) + shadow lift on hover (200ms)
- `.animate-dropdown-open` — scaleY from top origin (150ms)
- `.animate-page-fade` — content fadeIn on page transition (150ms)
- `.animate-toast-enter` — slideUp entrance for toasts (200ms)
- `.animate-modal-enter` — scale+opacity entrance for modal content (200ms)
- `.animate-backdrop` — fade entrance for modal overlays (150ms)
- `.animate-sidebar-active` — border scaleY slide-in for active nav (200ms)
- All animations respect `prefers-reduced-motion` via blanket media query rule

### AI Feature Styling

All AI-related UI elements use the **lavender** palette: `bg-lavender-50 border border-lavender-100 text-lavender-900 rounded-xl`

---

## Platform Console (Super Admin)

The Console is a **standalone Next.js app** at `apps/admin/` for platform-wide administration, accessible only to `SUPER_ADMIN` users. It runs on port 3002 and will be deployed to `admin.businesscommandcentre.com`. All console API calls use `/admin` prefixes.

### Admin App Architecture

- **Separate app:** `apps/admin/` — independent from `apps/web/`, with its own auth, middleware, and layout
- **20 routes** across 11 sections: `/`, `/businesses`, `/businesses/[id]`, `/billing`, `/billing/past-due`, `/billing/subscriptions`, `/agents`, `/messaging`, `/health`, `/packs`, `/packs/[slug]`, `/packs/skills`, `/support`, `/settings`, `/audit`, `/marketing`, `/marketing/queue`, `/marketing/agents`, `/marketing/sequences`, `/marketing/rejection-analytics`
- **Dark sidebar theme:** `bg-slate-900` with red "ADMIN" badge — visually distinct from the customer app's sage/lavender theme
- **Auth flow:** Users authenticate via the customer app; the admin app checks for auth cookies and validates `SUPER_ADMIN` role. Non-admin users are redirected to `businesscommandcentre.com`
- **No analytics:** No PostHog, no service worker, `X-Robots-Tag: noindex, nofollow`
- **API client:** Same `ApiClient` class as the web app (auto token refresh, retry logic) — on 401, redirects to customer app login instead of local `/login`
- **View-As:** `ViewAsBanner` component shows a sticky amber bar when impersonating a business, with countdown timer and exit button. Triggered from the Business 360 page (`/businesses/[id]`)

### Console Features

- **Overview** (`/`) — Platform KPIs (businesses, bookings, staff, agents, support, security), billing breakdown, audit feed
- **Business Directory** (`/businesses`) — Search, filter by plan/billing/health, paginated table
- **Business 360** (`/businesses/[id]`) — Summary, People, and Billing tabs (subscription info, plan changes, credits, cancel/reactivate, invoices)
- **View-as** — `ViewAsSession` model for time-limited tenant impersonation with reason and action logging
- **Security & Audit** (`/audit`) — Platform-level `PlatformAuditLog` (separate from per-tenant `ActionHistory`)
- **System Health** (`/health`) — DB, business activity, agents, calendar, messaging health checks
- **Support Cases** (`/support`) — Full CRUD with `SupportCase` + `SupportCaseNote` models
- **Billing Dashboard** (`/billing`) — MRR, churn rate, plan distribution, past-due businesses, `BillingCredit` management
- **Pack Registry** (`/packs`) — Vertical pack management with version history and install counts
- **AI & Agents Governance** (`/agents`) — Agent performance dashboard, action card funnel, `PlatformAgentDefault` model for platform-wide governance defaults
- **Messaging Ops** (`/messaging`) — Delivery rates, webhook health, failure analysis, per-tenant fix checklists
- **Platform Settings** (`/settings`) — `PlatformSetting` model (security, notifications, regional, platform categories) with bulk save

### Console-Specific Models

- `ViewAsSession` — Super Admin tenant impersonation with expiry and action logging
- `PlatformAuditLog` — Platform-level audit trail (separate from per-tenant ActionHistory)
- `PlatformAgentDefault` — Platform-wide agent governance defaults per agent type
- `PlatformSetting` — Key-value platform settings by category
- `SupportCase` / `SupportCaseNote` — Support ticket tracking
- `BillingCredit` — Platform-issued billing credits

---

## Testing Conventions

### Running Tests

```bash
# All tests (via Turborepo)
npm test

# API tests only
cd apps/api && npm test

# Web tests only
cd apps/web && npm test

# Admin tests only
cd apps/admin && npm test

# Single test file
npx jest path/to/file.spec.ts

# With coverage
npm test -- --coverage

# E2E tests (Playwright)
cd apps/web && npm run test:e2e
```

### API Test Patterns (Jest)

- Test files are co-located: `feature.service.spec.ts` next to `feature.service.ts`
- Use `Test.createTestingModule()` to set up the NestJS testing module
- Mock `PrismaService` — never hit a real database in unit tests
- Integration tests in CI use a real PostgreSQL 16 service container
- Mock external services (Claude API, WhatsApp, Stripe, Resend)
- Test both success paths and error paths (403, 404, 400)
- Test tenant isolation — verify queries filter by businessId

### Web Test Patterns (Jest + React Testing Library)

- Test files: `component-name.test.tsx` co-located with components
- Use `@testing-library/react` for rendering and assertions
- Mock the API client (`lib/api.ts`) for all network calls
- Mock `next/navigation` for router-dependent components
- Test user interactions, loading states, error states, and empty states

### E2E Tests (Playwright)

- Test files in `apps/web/e2e/`
- Config at `apps/web/playwright.config.ts` (Chromium only, starts API + web dev servers)
- Shared auth fixture at `apps/web/e2e/fixtures.ts` (reuses `helpers/auth.ts`)
- Accessibility scanning via `@axe-core/playwright` for WCAG 2.1 AA
- Run: `cd apps/web && npm run test:e2e`
- CI: runs on pull requests only (not on push to main)

### Every deploy must include tests for new/changed features. Never push code without tests.

---

## How to Add a New Feature (Checklist)

When building a new feature end-to-end, follow this order:

1. **Prisma model** — Add to `packages/db/prisma/schema.prisma`, include `businessId` for tenant isolation
2. **Migration** — `npx prisma migrate dev --name your_name --schema=packages/db/prisma/schema.prisma`
3. **Generate client** — `npx prisma generate --schema=packages/db/prisma/schema.prisma`
4. **NestJS module** — Create `modules/feature-name/` with module, controller, service, DTOs
5. **Register module** — Add to `app.module.ts` imports
6. **Guards & decorators** — Add `TenantGuard`, `@BusinessId()`, `@Roles()` as needed
7. **API tests** — `feature-name.service.spec.ts` and `feature-name.controller.spec.ts`
8. **Frontend page/component** — Add to `apps/web/src/app/` or `components/`
9. **Translation keys** — Add to both `locales/en.json` and `locales/es.json`
10. **Design tokens** — If new statuses/types are introduced, add to `design-tokens.ts`
11. **Web tests** — `component-name.test.tsx` co-located with components
12. **Navigation** — Update `mode-config.ts` if adding a new nav item
13. **Seed data** — Update relevant seed script if the feature needs demo data

---

## Environment Variables

Full reference at `.env.example` in the repo root. Key groups:

| Category   | Variables                                                                               | Notes                                                                                                                         |
| ---------- | --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Database   | `DATABASE_URL`                                                                          | PostgreSQL connection string                                                                                                  |
| Auth       | `JWT_SECRET`, `JWT_REFRESH_SECRET`                                                      | Must be strong random values in production                                                                                    |
| CORS       | `CORS_ORIGINS`                                                                          | **Source of truth for cookie domain** — comma-separated origins                                                               |
| API URLs   | `API_URL`, `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_WS_URL`                                  | `NEXT_PUBLIC_*` baked at build time                                                                                           |
| Admin      | `NEXT_PUBLIC_ADMIN_URL`, `NEXT_PUBLIC_CUSTOMER_APP_URL`, `NEXT_PUBLIC_SENTRY_DSN_ADMIN` | Admin app URL (used by web for SUPER_ADMIN login redirect), customer app URL (used by admin for logout/unauthorized redirect) |
| AI         | `ANTHROPIC_API_KEY`                                                                     | Claude API for intent detection, replies, booking assistant                                                                   |
| WhatsApp   | `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_VERIFY_TOKEN`            | Required for production messaging                                                                                             |
| Instagram  | `INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET`, `INSTAGRAM_VERIFY_TOKEN`                    | Required for Instagram DM integration                                                                                         |
| Messaging  | `MESSAGING_PROVIDER`                                                                    | `mock` (default dev) or `whatsapp-cloud` (production)                                                                         |
| Email      | `EMAIL_PROVIDER`, `EMAIL_API_KEY`, `EMAIL_FROM`                                         | Provider: `resend`, `sendgrid`, or `none` (default, logs only)                                                                |
| Stripe     | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID_*`                       | 3-tier pricing (Starter/Professional/Enterprise) × monthly/annual                                                             |
| Calendar   | `GOOGLE_CLIENT_ID/SECRET`, `MICROSOFT_CLIENT_ID/SECRET`, `CALENDAR_ENCRYPTION_KEY`      | OAuth for Google Calendar + Outlook                                                                                           |
| Redis      | `REDIS_URL`                                                                             | Required for BullMQ queues, WebSocket, caching                                                                                |
| Monitoring | `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`                                                  | Error tracking for API + web                                                                                                  |
| Analytics  | `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`                                   | Product analytics (web only)                                                                                                  |

**Critical:** `NEXT_PUBLIC_*` variables are baked at build time — changing them requires a Docker rebuild, not just an env var update.

---

## Seed Data

All seed scripts are in `packages/db/src/`. They are **idempotent** (safe to re-run) and use dedup checks.

| Script                     | Command                                            | Purpose                                                                                     | When to Use                |
| -------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------- | -------------------------- |
| `seed.ts`                  | `npx tsx packages/db/src/seed.ts`                  | Base data: 3 businesses (aesthetic + dealership + wellness), staff, services, working hours | Fresh database setup, CI   |
| `seed-demo.ts`             | `npx tsx packages/db/src/seed-demo.ts`             | Rich demo data: bookings, customers, conversations, action cards                            | Demo environments, testing |
| `seed-agentic.ts`          | `npx tsx packages/db/src/seed-agentic.ts`          | Agentic framework data: agent configs, agent runs, action cards, autonomy configs           | One-time production fill   |
| `seed-wellness.ts`         | `npx tsx packages/db/src/seed-wellness.ts`         | Wellness vertical: packages, memberships, intake data                                       | Also called from seed.ts   |
| `seed-console.ts`          | `npx tsx packages/db/src/seed-console.ts`          | Console base data: platform settings, agent defaults                                        | Super Admin setup          |
| `seed-console-showcase.ts` | `npx tsx packages/db/src/seed-console-showcase.ts` | Console demo data: support cases, audit logs                                                | Console demos              |
| `seed-content.ts`          | `npx tsx packages/db/src/seed-content.ts`          | 12 blog posts across 5 content pillars → ContentDraft records                               | Marketing content setup    |
| `seed-instagram.ts`        | `npx tsx packages/db/src/seed-instagram.ts`        | 4 Instagram DM conversations (story reply, ad referral, ice breaker, expiring window)       | Instagram integration testing |

---

## Common Commands

```bash
# Install dependencies
npm install

# Start local development (API + Web + Admin)
npm run dev

# Format check (Prettier)
npm run format:check

# Auto-fix formatting
npm run format

# Lint + type-check (ESLint via Turborepo)
npm run lint

# Run all tests
npm test

# Generate Prisma client
npx prisma generate --schema=packages/db/prisma/schema.prisma

# Create new migration
npx prisma migrate dev --name your_name --schema=packages/db/prisma/schema.prisma

# Apply migrations (production)
npx prisma migrate deploy --schema=packages/db/prisma/schema.prisma

# Open Prisma Studio
npx prisma studio --schema=packages/db/prisma/schema.prisma

# Seed database
npx tsx packages/db/src/seed.ts
npx tsx packages/db/src/seed-demo.ts

# Docker build (validates production images)
docker compose -f docker-compose.prod.yml build

# Manual CI trigger
gh workflow run ci.yml

# Production smoke test
./scripts/smoke-test.sh [BASE_URL]
```

---

## CI/CD Pipeline

```
Push to main → lint-and-test → docker-build → deploy (Railway) → smoke-test
Pull request → lint-and-test → docker-build + e2e-test (Playwright)
```

- **lint-and-test:** PostgreSQL 16 service container, `npm ci`, Prisma generate + migrate, format check, lint, test
- **docker-build:** Multi-stage Docker builds for API, web, and admin images
- **deploy:** `railway up --service api/web/admin --detach` (async — Railway build takes 2-5 min after CI passes)
- **smoke-test:** Runs `scripts/smoke-test.sh` against production + curl check on `admin.businesscommandcentre.com`
- **e2e-test:** Playwright tests (auth, booking, customer, portal, settings, accessibility) — PR only
- **Migrations:** Auto-run via `scripts/docker-entrypoint.sh` on container startup

### Railway Production

| Property     | Value                                  |
| ------------ | -------------------------------------- |
| Project ID   | `37eeca20-7dfe-45d9-8d29-e902a545f475` |
| API domain   | `api.businesscommandcentre.com`        |
| Web domain   | `businesscommandcentre.com`            |
| Admin domain | `admin.businesscommandcentre.com`      |
| Services     | api, web, admin, postgres, redis       |

---

## Deployment & Infrastructure Rules

**Read `DEPLOY.md` before making any infrastructure, auth, or deployment changes.** It documents hard-won lessons from production incidents.

### Critical Rules (Do Not Break)

1. **Cookie domain must cover both API and Web subdomains.** Cookies are set by the API (`api.X.com`) but read by Next.js middleware on the web app (`X.com`). The cookie `Domain` is auto-derived from `CORS_ORIGINS`. If you change domains, update `CORS_ORIGINS` first.

2. **`CORS_ORIGINS` is the source of truth for cookie domain.** The API parses the first origin to extract the root domain (e.g., `https://example.com` → `.example.com`). Must include both web and admin URLs (e.g., `https://businesscommandcentre.com,https://admin.businesscommandcentre.com`).

3. **`NEXT_PUBLIC_API_URL` is baked at build time.** Changing it requires rebuilding the web Docker image — a runtime env var change won't work.

4. **`railway up --detach` does NOT mean the deploy is live.** CI passing only means Railway received the code. The actual build takes 2-5 more minutes. Always verify with curl or Railway logs.

5. **Deploy ALL affected services when code changes span API, Web, and Admin.** Run `railway up` for api, web, and admin separately. The `railway.toml` health check path (`/api/v1/health`) must exist in both web and API — do NOT remove `apps/web/src/app/api/v1/health/route.ts`.

6. **Never set `sameSite: 'strict'` on auth cookies.** It must be `lax` for cross-subdomain auth to work.

7. **Every deploy must include tests.** Never push code without associated tests for new/changed features.

8. **CSP `connect-src` must use origin only — never include a URL path.** Always use just the origin: `https://api.example.com`. Extraction is done in `apps/web/next.config.js` via `new URL(apiUrl).origin`.

9. **The frontend API client has automatic token refresh — do not remove it.** When a request gets 401, `apps/web/src/lib/api.ts` calls `POST /auth/refresh` before redirecting to /login. Concurrent refresh calls are deduplicated. Auth endpoints (`/auth/*`) skip refresh to avoid loops.

10. **Never use `document.referrer` or `performance.getEntriesByType('navigation')` to detect SPA navigation state.** Use `sessionStorage` flags instead.

11. **Token-based flows must use `TokenService.validateAndConsume()` — never separate validate+markUsed.** The atomic method prevents race conditions in reset-password, accept-invite, and verify-email.

12. **`forceBook` on booking creation is ADMIN-only.** The controller throws `ForbiddenException` if a non-ADMIN user sets `forceBook: true`. Never remove this check.

13. **Graceful shutdown is enabled — do not remove `enableShutdownHooks()` from `main.ts`.** Combined with `railway.toml` health checks, this provides zero-downtime deploys.

14. **Raw SQL queries must use `@@map` table names, not Prisma model names.** Prisma's `$queryRaw` bypasses the ORM layer and talks directly to PostgreSQL. Use the actual table names from `@@map()` directives (e.g., `"staff"`, `"bookings"`, `"waitlist_entries"`), NOT the Prisma model names (`"Staff"`, `"Booking"`, `"WaitlistEntry"`). Getting this wrong causes P2010 errors.

### Application-Level Gotchas

15. **`conversation.metadata` JSON stores AI state for multi-turn booking flows.** Do not overwrite the entire field — read, merge, and write back. Breaking this field breaks the AI booking assistant mid-conversation.

16. **Vertical Pack `packConfig` JSON is read by multiple systems.** Changes to the shape of this JSON affect pack builder, seed scripts, and frontend vertical module components. Always check all three.

17. **`AutomationRule.filters` and `.actions` are JSON fields with specific shapes.** The automation engine parses these — changing the schema without updating the parser will silently break automations.

18. **Don't create new Prisma JSON fields when a proper relation would work.** JSON fields are harder to query, index, and validate. Use them only for truly dynamic/schema-less data.

### After Any Auth or Cookie Change

Verify with:

```bash
curl -s -D - -o /dev/null -X POST https://api.businesscommandcentre.com/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"sarah@glowclinic.com","password":"password123"}' 2>&1 | grep -i set-cookie
```

Confirm: `Domain=.businesscommandcentre.com`, `SameSite=Lax`, `Secure`, `Path=/`.

---

## AI Architecture

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

### In-App Agents — Customer-Facing (5 operational + 12 marketing)

These run inside the NestJS API for each customer's business. Code in `apps/api/src/modules/agent-framework/`.

**5 Operational Agents:**

- `WaitlistAgent` — Auto-match waitlist entries to cancelled slots
- `RetentionAgent` — Detect at-risk customers, generate win-back action cards
- `DataHygieneAgent` — Duplicate detection, incomplete profile flagging
- `SchedulingOptimizerAgent` — Gap detection, optimal slot suggestions
- `QuoteFollowupAgent` — Expired quote reminders, follow-up action cards

**12 Marketing Agents** (6 content, 2 distribution, 4 analytics) — **internal BookingOS growth engine only, NOT shown to customers:**

- Content: BlogWriter, SocialCreator, EmailComposer, CaseStudy, VideoScript, Newsletter
- Distribution: ContentScheduler, ContentPublisher
- Analytics: PerformanceTracker, TrendAnalyzer, ContentCalendar, ContentROI

Marketing agents are filtered out of the customer-facing `GET /agent-config` API response. The `/ai/agents` page shows only the 5 core operational agents. Marketing agent DB records may still exist from prior seeds but are excluded via `agentType: { notIn: MARKETING_AGENT_TYPES }`.

Agents run via `AgentSchedulerService` cron → `AGENT_PROCESSING` BullMQ queue → `AgentFrameworkService`. Per-agent `runIntervalMinutes` configurable via `AgentConfig.config` JSON. The customer-facing AI Command Center (`/ai`) shows only core agents. Marketing pages (`/marketing/*`) still exist but have no sidebar navigation.

**Autonomy levels** (per-action-type via `AutonomyConfig`): OFF → SUGGEST → AUTO_WITH_REVIEW → FULL_AUTO. Start conservative, increase as trust builds.

### Internal Growth Engine — BookingOS's Own Marketing

These are **prompt files** in `agents/` that define how BookingOS markets itself. They are NOT NestJS code — they are operational AI prompts run by Claude to generate content for BookingOS's own social media, blog, and outreach.

15 agent prompts covering: research (Trend Scout, Keyword Strategist), planning (Content Strategist), creation (Blog Writer, Social Creator, Visual Designer, Video Producer), distribution (Publisher, Community Manager), analytics (Performance Analyst, Learning Engine), expansion (Spanish Localization, Outbound Prospecting), and ops (Master Orchestrator, Weekly Maintenance).

Output goes to file-based folders (`queue/pending/`, `briefings/`, `reports/`, etc.). Reviewed by founder manually. Config in `system/` directory. See `docs/AI_MARKETING_AGENTS_DAILY_WORKFLOW.md` for the daily operator workflow.

**These three systems are completely separate.** Operational agents serve customers in the web app; in-app marketing agents are managed via the admin app; internal growth engine agents operate in the file system.

### Internal vs External Boundary

The platform enforces a strict separation between customer-facing and internal tools:

| Layer             | Customer App (`businesscommandcentre.com`)                                      | Admin App (`admin.businesscommandcentre.com`)        |
| ----------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------- |
| **Agents**        | 5 core: Waitlist, Retention, Data Hygiene, Scheduling Optimizer, Quote Followup | All 17 agents (5 core + 12 marketing)                |
| **AI pages**      | `/ai` overview, agents, actions, performance — core agents only                 | `/marketing/agents` — full marketing agent dashboard |
| **Content**       | No content queue or pipeline UI                                                 | `/marketing/queue` — content approval workflow       |
| **Autonomy**      | No autonomy settings visible                                                    | `/marketing` autonomy settings (SUPER_ADMIN)         |
| **API filtering** | `GET /agent-config` excludes marketing types via `notIn`                        | `GET /agent-config/admin/all` returns everything     |
| **API auth**      | Marketing API endpoints return 403 for non-SUPER_ADMIN                          | Full access for SUPER_ADMIN users                    |
| **Navigation**    | No `/marketing/*` sidebar links; routes redirect to `/ai`                       | Marketing section in admin sidebar                   |

**Key constants:**

- `MARKETING_AGENT_TYPES` in `agent-config.service.ts` — 12 marketing agent type strings filtered from customer queries
- `MARKETING_AGENT_TYPES` in `ai/actions/page.tsx` — same list for frontend action card filtering
- E2E boundary tests in `apps/web/e2e/internal-external-boundary.spec.ts`

---

## Public Marketing Site

The app includes a public-facing marketing site at the root domain:

- **Landing page** (`/`) — Hero, features grid, pricing section, CTA
- **Blog** (`/blog`) — Index with category badges, 12 posts across 5 content pillars (Industry Insights, Product Education, Customer Success, Thought Leadership, Technical)
- **Blog posts** (`/blog/[slug]`) — Individual posts with JSON-LD structured data, OpenGraph meta tags, markdown rendering
- **Pricing** (`/pricing`) — Detailed plan comparison (Starter/Professional/Enterprise)
- **FAQ** (`/faq`) — Frequently asked questions
- **SEO/AEO** — Sitemap, robots.txt, JSON-LD, meta tags
- **PWA** — Web app manifest with icons, service worker with cache-first assets

---

## Key Documentation

| Document                              | Location                                     | Purpose                                                       |
| ------------------------------------- | -------------------------------------------- | ------------------------------------------------------------- |
| PROJECT_CONTEXT.md                    | `docs/PROJECT_CONTEXT.md`                    | Full project context — what's built, schema, modules, roadmap |
| DEPLOY.md                             | `DEPLOY.md`                                  | Deployment operations guide with critical rules               |
| cicd.md                               | `docs/cicd.md`                               | CI/CD pipeline details                                        |
| user-stories.md                       | `docs/user-stories.md`                       | Complete user stories (386 capabilities, 196 gaps)            |
| ux-brainstorm-brief.md                | `docs/ux-brainstorm-brief.md`                | UX improvement brainstorm                                     |
| URLS.md                               | `docs/URLS.md`                               | All domains, services, DNS, third-party dashboards            |
| AI_MARKETING_AGENTS_DAILY_WORKFLOW.md | `docs/AI_MARKETING_AGENTS_DAILY_WORKFLOW.md` | In-app marketing agent operator guide                         |
| DESIGN_DOCUMENTATION.md               | `DESIGN_DOCUMENTATION.md`                    | Comprehensive design system documentation                     |
| .env.example                          | `.env.example`                               | Full environment variable reference with comments             |

### Growth Engine Docs (in `system/`)

Platform launch config, quality gates, budget tracker, rejection tracker, A/B testing framework, auto-escalation rules, agent platform filter, MCP fallback config, product-content map, platform gate checker.

---

## Do Not Build (Yet)

- Don't chase additional verticals beyond the current 4 (aesthetic, dealership, wellness, general) before ROI is repeatable
- Don't overinvest in generic AI chatbot; keep AI tied to structured flows
- Don't build deep enterprise features before pack-led implementation is nailed
- Don't add new BullMQ queues without discussing queue consolidation — 8 is already a lot
- Don't create new Prisma JSON fields when a proper relation would work — JSON fields are hard to query and validate
- Don't add dependencies to `packages/shared` without checking bundle size impact on both API and web
- Don't build features that only work for one vertical unless explicitly vertical-specific — the core should be vertical-agnostic
