<!-- Version: 2.0 | Last optimized: 2026-04-03 | Target: <800 lines -->

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
| Glow Aesthetic Clinic | sarah@glowclinic.com      | Bk0s!DemoSecure#2026 | Aesthetic  |
| Metro Auto Group      | mike@metroauto.com        | Bk0s!DemoSecure#2026 | Dealership |
| Serenity Wellness Spa | maya@serenitywellness.com | Bk0s!DemoSecure#2026 | Wellness   |

---

## Monorepo Structure (Turborepo)

```
booking-os/
├── apps/
│   ├── api/                    # NestJS REST API (port 3001)
│   │   ├── src/
│   │   │   ├── modules/        # 85 feature modules (one dir per domain)
│   │   │   ├── common/         # Guards, decorators, filters, DTOs, PrismaService
│   │   │   └── main.ts         # Bootstrap, Swagger, CORS, cookies, validation
│   │   └── Dockerfile          # Multi-stage production build
│   ├── web/                    # Next.js 15 customer dashboard (port 3000)
│   │   ├── src/
│   │   │   ├── app/            # 83 pages (App Router) — customer-facing only, no admin/console
│   │   │   ├── components/     # Shared components (briefing/, aesthetic/, skeletons, modals)
│   │   │   ├── lib/            # API client, auth, i18n, socket, theme
│   │   │   ├── locales/        # en.json, es.json (650+ keys each)
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
│   ├── db/                     # Prisma schema (96 models), 70 migrations, seed scripts
│   │   ├── prisma/schema.prisma
│   │   ├── src/seed.ts         # Base seed (aesthetic + dealership + wellness, idempotent)
│   │   ├── src/seed-demo.ts    # Rich demo data (idempotent, dedup-safe)
│   │   ├── src/seed-agentic.ts # One-time agentic data fill
│   │   ├── src/seed-wellness.ts # Standalone wellness seed (also called from seed.ts)
│   │   ├── src/seed-console.ts # Platform console base data
│   │   ├── src/seed-console-showcase.ts # Console demo data
│   │   └── src/seed-content.ts # Content pillar seeding (12 blog posts → ContentDraft)
│   ├── messaging-provider/     # WhatsApp Cloud, Instagram DM, Facebook Messenger, Email (Resend/SendGrid), SMS (Twilio) provider abstraction
│   ├── web-chat-widget/        # Embeddable live chat widget (shadow DOM, Socket.IO, esbuild IIFE bundle)
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
├── docs/                       # PROJECT_CONTEXT.md, cicd.md, user-stories.md, STRIPE-SETUP.md, CHANNEL-SETUP.md
├── docker-compose.yml          # Local development
├── docker-compose.prod.yml     # Production (Nginx + SSL)
├── docker-compose.demo.yml     # Demo quick-start (auto-seeds)
├── archive/                    # Superseded/completed docs (prompts, old audits, brainstorms)
├── DEPLOY.md                   # Deployment & operations guide (READ BEFORE INFRA CHANGES)
├── .github/workflows/ci.yml   # CI/CD pipeline
└── .github/workflows/mobile.yml # Mobile build pipeline (iOS + Android)
```

---

## Tech Stack

| Layer       | Technology                                                                                                                      | Version       |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| Frontend    | Next.js (App Router), React, TypeScript                                                                                         | 15.x, 19.x    |
| Styling     | Tailwind CSS                                                                                                                    | 4.x           |
| Icons       | lucide-react                                                                                                                    | 0.468         |
| Charts      | Recharts                                                                                                                        | 2.15          |
| Real-time   | Socket.io                                                                                                                       | 4.x           |
| Backend     | NestJS, TypeScript                                                                                                              | 11.x          |
| ORM         | Prisma                                                                                                                          | 6.x           |
| Database    | PostgreSQL                                                                                                                      | 17            |
| AI          | Anthropic Claude API                                                                                                            | claude-sonnet |
| Payments    | Stripe                                                                                                                          | stripe-node   |
| Email       | Resend                                                                                                                          | -             |
| Messaging   | WhatsApp Cloud, Instagram DM, SMS (Twilio + MMS), Facebook Messenger, Email (Resend/SendGrid), Live Web Chat (Socket.IO widget) | -             |
| Cache/Queue | Redis 7 + BullMQ                                                                                                                | -             |
| Mobile      | Capacitor (server-mode, loads live web app)                                                                                     | 8.x           |
| Push        | Firebase Cloud Messaging (FCM HTTP v1)                                                                                          | -             |
| Monorepo    | Turborepo                                                                                                                       | 2.x           |
| CI/CD       | GitHub Actions → Railway (+ mobile.yml for iOS/Android builds)                                                                  | -             |
| Monitoring  | Sentry                                                                                                                          | -             |
| Analytics   | PostHog                                                                                                                         | -             |
| Linting     | ESLint 9 + Prettier                                                                                                             | -             |

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

Every feature is a NestJS module in `apps/api/src/modules/` (85 modules). Each module follows this pattern:

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
- Rate limiting via `@Throttle()` decorator — 34+ controllers have explicit limits. Key limits: auth (signup: 3/min, login: 10/min), AI (20/min), billing (20/min), webhooks (200/min), messaging (60/min). Global default: 100/60s for undecorated endpoints

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

- Schema at `packages/db/prisma/schema.prisma` — **96 models**, 70 migrations
- Generate client: `npx prisma generate --schema=packages/db/prisma/schema.prisma`
- Create migration: `npx prisma migrate dev --name your_name --schema=packages/db/prisma/schema.prisma`
- `PrismaService` is a global NestJS provider — inject it in constructors
- All queries **must filter by `businessId`** for tenant isolation
- JSON fields (customFields, metadata, aiSettings, packConfig, etc.) — use `Prisma.JsonValue` type
- Key JSON fields to be aware of: `Business.packConfig` (vertical config), `Business.aiSettings` (AI behavior, includes `autoReply.channelOverrides` for per-channel auto-reply control), `Business.policySettings` (cancellation/reschedule), `Business.channelSettings` (omnichannel config), `Conversation.metadata` (AI state for multi-turn flows), `ActionCard.preview` (diff data), `ActionCard.ctaConfig` (button config), `ActionCard.metadata` (agent context, `suggestedMessages` for pre-generated follow-ups, `recommendedChannel`), `OutboundDraft.metadata` (AI generation context, intent, entities), `AutomationRule.filters`/`.actions` (rule definitions), `Campaign.variants` (A/B test variant content with merge variables), `Campaign.stats`/`.filters` (audience filters and delivery stats), `Business.packConfig.testimonials` (testimonial settings: auto-approve, reminders, display prefs), `Location.facebookConfig`/`.smsConfig`/`.emailConfig`/`.webChatConfig` (per-location channel configs)

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
Channel:            WHATSAPP, INSTAGRAM, FACEBOOK, SMS, EMAIL, WEB_CHAT
CampaignStatus:     DRAFT, SCHEDULED, SENDING, SENT, CANCELLED
CampaignChannel:    WHATSAPP, SMS, EMAIL, MULTI
AutomationTrigger:  BOOKING_CREATED, BOOKING_UPCOMING, STATUS_CHANGED, BOOKING_CANCELLED, MESSAGE_RECEIVED, CUSTOMER_CREATED, PAYMENT_RECEIVED, TESTIMONIAL_SUBMITTED, CAMPAIGN_SENT
AutomationAction:   SEND_TEMPLATE, SEND_MESSAGE, SEND_EMAIL, UPDATE_STATUS, ADD_TAG, ASSIGN_STAFF, SEND_NOTIFICATION, REQUEST_TESTIMONIAL, UPDATE_CUSTOMER_FIELD, WEBHOOK
TestimonialStatus:  PENDING, APPROVED, FEATURED, REJECTED
TestimonialSource:  MANUAL, REQUESTED
```

### BullMQ Queues (8)

- `AI_PROCESSING` — AI task processing (3 retries, exponential backoff 1s/4s/16s, creates ActionCard on final failure)
- `MESSAGING` — WhatsApp/SMS message dispatch
- `REMINDERS` — Booking reminders
- `NOTIFICATIONS` — Notification delivery (including scheduled report emails)
- `CALENDAR_SYNC` — Calendar sync jobs (syncs bookings to/from Google Calendar and Outlook via CalendarSyncService)
- `AGENT_PROCESSING` — Background agent job processing (runs operational agents via AgentFrameworkService.triggerAgent)
- `ONBOARDING_DRIP` — 13-email onboarding sequence
- `DUNNING` — 3-email payment failure sequence with auto-downgrade after 14 days
- Queue processors are in `apps/api/src/common/queue/`
- Dead letter queue (DLQ) uses Redis hash keys `dlq:msg:{id}` with 7-day TTL — no separate BullMQ queue. Admin API at `GET/POST/DELETE /admin/dlq/*`
- Redis connection via `REDIS_URL` environment variable
- **Do not add new queues without discussing consolidation first** — 8 queues is already a lot for Redis to manage

### Real-Time (Socket.io)

Key events: `message:new`, `conversation:updated`, `ai:suggestions`, `ai:auto-replied`, `ai:transfer-to-human`, `booking:updated`, `ai:booking-state`, `action-card:created`, `action-card:updated`, `message:status`, `viewing:start`/`viewing:stop`, `presence:update`, `circuit:state-change`, `draft:created`, `draft:review-requested`, `conversation:focus`, `ai:processing`, `ai:draft-ready`, `ai:processing-failed`

- `InboxGateway.emitToAll()` for system-wide broadcasts (circuit breaker state changes)
- **Push notification fallback:** `PushNotificationService` sends FCM push to staff with active device tokens but no active WebSocket connection. Graceful degradation when FCM is unconfigured (logs only). Device tokens registered via `POST /device-tokens` and managed by `DeviceTokenService`.

### Omnichannel Messaging

BookingOS supports 6 channels: WhatsApp, Instagram DM, Facebook Messenger, SMS, Email, Web Chat. All fully implemented.
- Customer identity resolution: `CustomerIdentityService` (phone → email → social IDs)
- Circuit breaker on all outbound calls: `CircuitBreakerService`
- All webhooks verify provider signatures (HMAC-SHA256/SHA1, timing-safe comparison)
> For service architecture, UI components, and inbox UX patterns: see `docs/CHANNEL-SETUP.md` § Messaging Architecture.

---

## Frontend Conventions (Next.js 15)

### App Router

- Pages are in `apps/web/src/app/` using Next.js App Router (not Pages Router)
- Protected pages check `access_token` + `refresh_token` cookies in `middleware.ts` (redirects to /login only when both are missing)
- **91 pages** in `apps/web/` (~19 public, ~56 protected, ~16 portal/marketing site) + **20 admin pages** in `apps/admin/` (15 core + 5 marketing)
- Client components use `'use client'` directive

### Page Categories

> 91+ pages across public, protected, and console. See `docs/REFERENCE.md` for the full listing.

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
- Feature hooks in `apps/web/src/hooks/` — `useDraftAutosave` (debounced draft save/load/clear via backend API), `useCapacitor` (platform detection: isNative, platform), `usePushNotifications` (Capacitor push registration + FCM token sync)

### Mobile App (Capacitor)

- **Capacitor config:** `apps/web/capacitor.config.ts` — server-mode loading from `https://businesscommandcentre.com` (zero code duplication, web updates deploy instantly)
- **Platforms:** iOS (`@capacitor/ios`) and Android (`@capacitor/android`) — native directories in `apps/web/ios/` and `apps/web/android/` (gitignored, generated via `npx cap add`)
- **Platform detection:** `useCapacitor()` hook returns `{ isNative, platform }` — use for conditional native-only behavior
- **Push notifications:** `usePushNotifications()` hook registers device tokens on native platforms, handles foreground/background notification routing
- **Safe area CSS:** `.mobile-safe-top`, `.mobile-safe-bottom`, `.mobile-safe-left`, `.mobile-safe-right` classes in `globals.css` for notched devices
- **Build scripts:** `npm run build:mobile` (static export), `npm run cap:sync`, `npm run cap:ios`, `npm run cap:android`
- **Output mode:** `next.config.js` supports `NEXT_OUTPUT=export` for Capacitor static builds; defaults to `standalone` for production

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
- **Always import from design-tokens.ts** — never define inline status color objects

### Navigation Structure

Single source of truth at `nav-config.ts` + `mode-config.ts`. 4 sidebar sections: Workspace / Tools / Insights / AI & Agents. Command palette (⌘K) searches all pages.
> For detailed nav implementation (mode splits, overflow, chord shortcuts, mobile): see `docs/REFERENCE.md`.

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

### Micro-Animations

> For all CSS animation utility classes, see `DESIGN_DOCUMENTATION.md`. All animations respect `prefers-reduced-motion`.

### AI Feature Styling

All AI-related UI elements use the **lavender** palette: `bg-lavender-50 border border-lavender-100 text-lavender-900 rounded-xl`

---

## Platform Console (Super Admin)

The Console is a standalone Next.js app at `apps/admin/` (port 3002) for SUPER_ADMIN users. Dark sidebar theme, 20 routes across 11 sections. Auth flows through the customer app.
> For full console documentation (architecture, features, models): see `docs/REFERENCE.md`.

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
- Integration tests in CI use a real PostgreSQL 17 service container
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
14. **Documentation** — Consult the Documentation Dependency Map and update all affected docs

---

## Documentation Maintenance (MANDATORY)

When you modify code, you MUST update the corresponding documentation. This is not optional.

### Dependency Map — What to Update When

| When you change...                     | Update these                                                                                      |
|----------------------------------------|---------------------------------------------------------------------------------------------------|
| New Prisma model                       | CLAUDE.md model count, seed script if demo data needed                                            |
| New/changed enum value                 | CLAUDE.md Key Enums section (this is the primary reference — not in Prisma schema)                |
| New API module                         | Register in `app.module.ts`, CLAUDE.md module count if stated                                     |
| New page or route                      | `docs/REFERENCE.md` page categories, `nav-config.ts`, `mode-config.ts`, `locales/*.json`          |
| New environment variable               | CLAUDE.md env vars table, `.env.example` with comment                                             |
| Design system change (colors/tokens)   | `design-tokens.ts`, CLAUDE.md Design System section, `DESIGN_DOCUMENTATION.md`                    |
| New BullMQ queue                       | CLAUDE.md BullMQ section (and discuss consolidation — 8 is already a lot)                         |
| New messaging channel or provider      | `docs/CHANNEL-SETUP.md`, CLAUDE.md omnichannel summary                                           |
| New agent type                         | CLAUDE.md Key Enums (AgentType), `docs/PROJECT_CONTEXT.md`                                        |
| New seed script                        | `docs/REFERENCE.md` seed table                                                                    |
| Auth, cookie, or CORS change           | `DEPLOY.md`, then verify with the curl command in CLAUDE.md § Deployment Rules                    |
| New Socket.IO event                    | CLAUDE.md Real-Time event list                                                                    |
| Deployment or infrastructure change    | `DEPLOY.md` (read it first — it documents hard-won lessons)                                       |
| New vertical pack                      | CLAUDE.md Vertical Pack System, `docs/PROJECT_CONTEXT.md`, seed scripts                           |

### Rules
- **What belongs in CLAUDE.md:** Rules, conventions, guardrails, frequently-referenced data (enums, env vars), and short pointers to other docs. If a coding assistant needs it almost every session, it belongs here.
- **What belongs in reference docs:** Lookup tables, implementation details, per-feature specs, and anything longer than ~10 lines that's only needed occasionally. Use `docs/REFERENCE.md` for general lookups, extend the relevant existing doc (CHANNEL-SETUP.md, PROJECT_CONTEXT.md, cicd.md, DEPLOY.md) for domain-specific content.
- If you're unsure whether a doc needs updating, check. It's faster to verify than to fix stale docs later.
- Never update CLAUDE.md model/module/page counts with approximate numbers — count the actual items.
- When extracting content to a reference doc, always leave a pointer in CLAUDE.md.
- After updating any doc, re-read the section you changed to confirm it's consistent with surrounding content.

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
| SMS        | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`, `TWILIO_WEBHOOK_URL`  | Twilio SMS/MMS — signature validation uses auth token + webhook URL                                                           |
| Facebook   | `FACEBOOK_VERIFY_TOKEN`, `FACEBOOK_APP_SECRET`                                          | Facebook Messenger webhook verification + HMAC signature validation                                                           |
| Messaging  | `MESSAGING_PROVIDER`                                                                    | `mock` (default dev) or `whatsapp-cloud` (production)                                                                         |
| Email      | `EMAIL_PROVIDER`, `EMAIL_API_KEY`, `EMAIL_FROM`, `SENDGRID_INBOUND_WEBHOOK_SECRET`      | Provider: `resend`, `sendgrid`, or `none` (default, logs only). Webhook secret for email inbound signature verification       |
| Stripe     | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID_*`                       | 3-tier pricing (Starter/Professional/Enterprise) × monthly/annual                                                             |
| Calendar   | `GOOGLE_CLIENT_ID/SECRET`, `MICROSOFT_CLIENT_ID/SECRET`, `CALENDAR_ENCRYPTION_KEY`      | OAuth for Google Calendar + Outlook                                                                                           |
| Push       | `FCM_PROJECT_ID`, `FCM_SERVICE_ACCOUNT_KEY`                                             | Firebase Cloud Messaging for mobile push notifications (graceful degradation if unset)                                        |
| Redis      | `REDIS_URL`                                                                             | Required for BullMQ queues, WebSocket, caching                                                                                |
| Monitoring | `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`                                                  | Error tracking for API + web                                                                                                  |
| Analytics  | `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`                                   | Product analytics (web only)                                                                                                  |

**Critical:** `NEXT_PUBLIC_*` variables are baked at build time — changing them requires a Docker rebuild, not just an env var update.

---

## Seed Data

All seed scripts in `packages/db/src/`. Idempotent (safe to re-run).
> For the full seed script table with commands: see `docs/REFERENCE.md`.

---

## Common Commands

```bash
npm install                          # Install dependencies
npm run dev                          # Start local dev (API + Web + Admin)
npm run format && npm run format:check  # Format + verify
npm run lint                         # ESLint + type-check
npm test                             # All tests
npx prisma generate --schema=packages/db/prisma/schema.prisma   # Generate client
npx prisma migrate dev --name your_name --schema=packages/db/prisma/schema.prisma  # New migration
npx tsx packages/db/src/seed.ts      # Seed database
```

---

## CI/CD Pipeline

```
Push to main → lint-and-test → docker-build → deploy (staged) → smoke-test
                              ↘ bundle-check (parallel, 60MB limit)
Pull request → lint-and-test → docker-build + e2e-test (Playwright)
```

> For full job details (lint-and-test, docker-build, e2e, mobile CI): see `docs/cicd.md`.

### Railway Production

| Property     | Value                                  |
| ------------ | -------------------------------------- |
| Project ID   | `37eeca20-7dfe-45d9-8d29-e902a545f475` |
| API domain   | `api.businesscommandcentre.com`        |
| Web domain   | `businesscommandcentre.com`            |
| Admin domain | `admin.businesscommandcentre.com`      |
| Services     | api, web, admin, postgres              |

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
  -d '{"email":"sarah@glowclinic.com","password":"Bk0s!DemoSecure#2026"}' 2>&1 | grep -i set-cookie
```

Confirm: `Domain=.businesscommandcentre.com`, `SameSite=Lax`, `Secure`, `Path=/`.

---

## AI Architecture

| Component                   | Purpose                                                                                                      |
| --------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `ClaudeClient`              | API wrapper with error handling, graceful degradation                                                        |
| `IntentDetector`            | Classifies: GENERAL_INQUIRY, BOOK_APPOINTMENT, CANCEL_APPOINTMENT, RESCHEDULE_APPOINTMENT, TRANSFER_TO_HUMAN |
| `ReplyGenerator`            | Channel-aware reply drafts using conversation history + business context + channel-specific LLM guidance     |
| `BookingAssistant`          | Multi-step booking: service → date → time → confirm                                                          |
| `CancelAssistant`           | Identifies and cancels bookings from conversation                                                            |
| `RescheduleAssistant`       | Identifies and reschedules bookings                                                                          |
| `ProfileCollector`          | Conversationally collects missing required profile fields                                                    |
| `AiService`                 | Orchestrator: routes intents, manages state, channel validation, auto-reply, OutboundDraft creation          |
| `OutboundService`           | Creates/manages OutboundDraft records (DRAFT→APPROVED→SENT/REJECTED), emits `draft:created` Socket.IO        |
| `ActionCardExecutorService` | Bridges Action Card CTAs to messaging: send_followup, offer_slot, retry_ai, reply_manually                   |

AI state persisted in `conversation.metadata` JSON for stateful multi-turn flows.

### 5 Operational Agents (customer-facing)

Code in `apps/api/src/modules/agent-framework/`:

- `WaitlistAgent` — Auto-match waitlist entries to cancelled slots. Cards expire **48 hours**
- `RetentionAgent` — Detect at-risk customers, generate win-back cards. Cards expire **14 days**
- `DataHygieneAgent` — Duplicate detection, incomplete profiles. Cards expire **30 days**
- `SchedulingOptimizerAgent` — Gap detection, optimal slots. Cards expire **1 day after gap date**
- `QuoteFollowupAgent` — Expired quote reminders. Cards expire **7 days**

All agents set `expiresAt` on `ActionCard` records. Agents store `suggestedMessages`, `customerChannels`, and `recommendedChannel` in card metadata for channel-appropriate follow-ups.

**Autonomy levels** (per-action-type via `AutonomyConfig`): OFF → SUGGEST → AUTO_WITH_REVIEW → FULL_AUTO. Start conservative, increase as trust builds.

### AI Draft Pipeline & Agents

> For the full auto-reply flow, key endpoints, marketing agents, and internal/external boundary: see `docs/PROJECT_CONTEXT.md`.

**Three AI systems exist and are completely separate:** operational agents (NestJS, customer-facing), marketing agents (NestJS, admin-only via SUPER_ADMIN), growth engine (file-based prompts in `agents/`). Do not confuse them.

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
| REFERENCE.md                          | `docs/REFERENCE.md`                          | Lookup tables: page categories, navigation, console, seed data            |
| CHANNEL-SETUP.md                      | `docs/CHANNEL-SETUP.md`                      | 6-channel messaging setup + messaging architecture                        |
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

---

## Pre-Commit Checklist (MANDATORY)

Before creating any git commit, you MUST run these checks in order and fix ALL failures before committing:

1. `npm run format` — auto-fix formatting
2. `npm run format:check` — verify no formatting issues remain
3. `npm run lint` — ESLint + type-check (catches missing imports, unused variables, type errors)
4. `npm test` — all tests must pass

**Rules:**
- Do NOT commit until all four pass
- If a test fails because of your changes, fix it before committing — add missing mocks, update test assertions, remove unused imports
- Get it right in ONE commit — do not push broken code and fix it in follow-up commits
- If you add a new lucide-react icon to a component, add it to the mock in the corresponding `.test.tsx` file
- If you remove a feature from the UI, check if tests reference it and update them
- If you change a service method signature, update the corresponding `.spec.ts` file

> **Note:** These checks are part of the Self-Validation Protocol below. They run after the self-review loop passes clean.

---

## Self-Validation Protocol (MANDATORY)

After completing ANY task (feature, bugfix, refactor, doc update, plan, analysis, report), run the **self-review-loop** skill (`.claude/skills/self-review-loop/SKILL.md`). This is non-negotiable — no work is considered complete until it passes.

The self-review loop requires you to: review your output against source material using tools (Read, Grep — not memory), fix all issues found, then re-review from scratch. Repeat until a full pass finds **zero issues**. Report the pass count and issues found per pass to the user.

After the self-review loop passes with zero issues, run the **security-review** skill (`.claude/skills/security-review/SKILL.md`). This is mandatory for ANY code change — it checks for multi-tenancy violations, missing transaction wrappers, auth guard gaps, webhook verification, AI safety, and 6 other production risk categories. Work is not complete until it reports zero findings. See `references/checklist.md` inside the skill for detailed code patterns.

After both the self-review loop and security review pass clean, run the project-specific checks:

### Cross-Cutting Concerns
- New component? → tests exist, translations added, design tokens used (not inline colors)
- Changed API endpoint? → DTOs have validators, controller has guards, tests cover success AND error paths
- Modified schema? → migration created, Prisma client regenerated, seed scripts still valid
- Changed auth or cookies? → Run the curl verification command from Deployment Rules

### Documentation Check
- Consult the Documentation Dependency Map above. Update every doc that your change affects.
- If you changed CLAUDE.md, verify it's under the target line count (see version header).

### Pre-Commit Checks
- `npm run format` → `npm run format:check` → `npm run lint` → `npm test`
- If ANY step fails, fix it and restart the self-review loop from the beginning (not just this step).

Do NOT consider work complete until the self-review loop passes clean AND all project checks pass.
