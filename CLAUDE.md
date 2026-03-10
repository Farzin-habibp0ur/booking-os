# Booking OS — Project Guidelines

## What This Project Is

Booking OS is a **multi-tenant SaaS platform** for service-based businesses (aesthetic clinics, car dealerships) to manage appointments, customer messaging, and operations — with AI-powered automation via Claude.

- **Live production:** https://businesscommandcentre.com
- **API:** https://api.businesscommandcentre.com/api/v1
- **Verticals:** Aesthetic, Dealership, Wellness, General (extensible via Vertical Pack system)

---

## Monorepo Structure (Turborepo)

```
booking-os/
├── apps/
│   ├── api/                    # NestJS REST API (port 3001)
│   │   ├── src/
│   │   │   ├── modules/        # 58 feature modules (one dir per domain)
│   │   │   ├── common/         # Guards, decorators, filters, DTOs, PrismaService
│   │   │   └── main.ts         # Bootstrap, Swagger, CORS, cookies, validation
│   │   └── Dockerfile          # Multi-stage production build
│   ├── web/                    # Next.js 15 admin dashboard (port 3000)
│   │   ├── src/
│   │   │   ├── app/            # 81+ pages (App Router)
│   │   │   ├── components/     # Shared components
│   │   │   ├── lib/            # API client, auth, i18n, socket, theme
│   │   │   ├── locales/        # en.json, es.json (600+ keys each)
│   │   │   └── middleware.ts   # Route protection (checks access_token cookie)
│   │   └── Dockerfile          # Multi-stage production build
│   └── whatsapp-simulator/     # WhatsApp testing tool (port 3002)
├── packages/
│   ├── db/                     # Prisma schema (60 models), migrations, seed scripts
│   │   ├── prisma/schema.prisma
│   │   ├── src/seed.ts         # Base seed (idempotent)
│   │   ├── src/seed-demo.ts    # Rich demo data (idempotent)
│   │   ├── src/seed-agentic.ts # One-time agentic data fill
│   │   ├── src/seed-console.ts # Platform console base data
│   │   ├── src/seed-console-showcase.ts # Console demo data
│   │   └── src/seed-content.ts # Content pillar seeding (12 blog posts → ContentDraft)
│   ├── messaging-provider/     # WhatsApp Cloud API abstraction
│   └── shared/                 # Shared types, DTOs, enums, profile field definitions
├── docs/                       # PROJECT_CONTEXT.md, cicd.md, user-stories.md, ux-brainstorm-brief.md
├── docker-compose.yml          # Local development
├── docker-compose.prod.yml     # Production (Nginx + SSL)
├── docker-compose.demo.yml     # Demo quick-start (auto-seeds)
├── DEPLOY.md                   # Deployment & operations guide (READ BEFORE INFRA CHANGES)
└── .github/workflows/ci.yml   # CI/CD pipeline
```

---

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend | Next.js (App Router), React, TypeScript | 15.x, 19.x |
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

## Backend Conventions (NestJS API)

### Module Structure

Every feature is a NestJS module in `apps/api/src/modules/`. Each module follows this pattern:

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

### API Patterns

- All endpoints prefixed with `/api/v1`
- Swagger docs at `/api/docs` (dev only)
- DTOs use `class-validator` decorators (`@IsString()`, `@MaxLength()`, `@IsOptional()`, etc.)
- Pagination: offset-based with `?skip=0&take=20` pattern, capped at reasonable limits
- Errors: throw NestJS exceptions (`NotFoundException`, `ForbiddenException`, `BadRequestException`)
- **Never** return raw Prisma errors to the client

### Database (Prisma)

- Schema at `packages/db/prisma/schema.prisma` — **60 models**, 44 migrations
- Generate client: `npx prisma generate --schema=packages/db/prisma/schema.prisma`
- Create migration: `npx prisma migrate dev --name your_name --schema=packages/db/prisma/schema.prisma`
- `PrismaService` is a global NestJS provider — inject it in constructors
- All queries **must filter by `businessId`** for tenant isolation
- JSON fields (customFields, metadata, aiSettings, etc.) — use `Prisma.JsonValue` type

### Key Enums

```
StaffRole:          OWNER, ADMIN, AGENT, SERVICE_PROVIDER, SUPER_ADMIN
BookingStatus:      PENDING, PENDING_DEPOSIT, CONFIRMED, IN_PROGRESS, COMPLETED, CANCELLED, NO_SHOW
KanbanStatus:       CHECKED_IN, DIAGNOSING, AWAITING_APPROVAL, IN_PROGRESS, READY_FOR_PICKUP
ConversationStatus: OPEN, WAITING, RESOLVED, SNOOZED
ServiceKind:        CONSULT, TREATMENT, OTHER
VerticalPack:       AESTHETIC, SALON, TUTORING, GENERAL, DEALERSHIP, WELLNESS
```

### BullMQ Queues (8)

- `AI_PROCESSING` — AI task processing
- `MESSAGING` — WhatsApp/SMS message dispatch
- `REMINDERS` — Booking reminders
- `NOTIFICATIONS` — Notification delivery
- `CALENDAR_SYNC` — Calendar sync jobs
- `AGENT_PROCESSING` — Background agent job processing
- `ONBOARDING_DRIP` — Onboarding email sequence
- `DUNNING` — Payment failure email sequence
- Queue processors are in `apps/api/src/common/queue/`
- Redis connection via `REDIS_URL` environment variable

### Real-Time (Socket.io)

Key events: `message:new`, `conversation:updated`, `ai:suggestion`, `ai:auto-replied`, `ai:transfer-to-human`, `booking:updated`, `ai:booking-state`, `action-card:created`, `action-card:updated`, `message:status`, `viewing:start`/`viewing:stop`, `presence:update`

---

## Frontend Conventions (Next.js 15)

### App Router

- Pages are in `apps/web/src/app/` using Next.js App Router (not Pages Router)
- Protected pages check `access_token` cookie in `middleware.ts`
- **77 pages** total (17 public, ~40 protected, ~16 console, 4 portal)
- Client components use `'use client'` directive

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
- Feature-specific components co-located with their page or in named subdirectories
- Modals use a consistent pattern: `XxxModal` with `isOpen` + `onClose` props
- Loading states: `Skeleton` component + compositions (`PageSkeleton`, `DetailSkeleton`, `FormSkeleton`, `ListSkeleton`, `InboxSkeleton`, `CalendarSkeleton`) — always use these instead of raw `animate-pulse` divs or "Loading..." text
- Empty states: `EmptyState` component
- Bulk actions: `BulkActionBar` component

### Design Tokens

- **Centralized in `apps/web/src/lib/design-tokens.ts`** — all status colors, elevation constants, and shared style maps
- `BOOKING_STATUS_STYLES` — map of all 7 booking statuses to `{ bg, text, border, dot, label, hex }`
- `CONVERSATION_STATUS_STYLES` — map of 4 conversation statuses (OPEN, WAITING, RESOLVED, SNOOZED)
- `ELEVATION` — shadow + radius tokens: `card`, `modal`, `dropdown`, `cardSm`, `fab`
- Helper functions: `statusBadgeClasses(status)`, `statusCalendarClasses(status)`, `statusHex(status)`
- **Always import from design-tokens.ts** — never define inline status color objects

### Navigation Structure

- Sidebar uses 3 sections: **Workspace** / **Tools** / **Insights** (defined per mode in `apps/web/src/lib/mode-config.ts`)
- Section labels use `.nav-section-label` CSS class from `globals.css`
- Settings link is in the sidebar footer area, not in the main nav
- Mobile uses bottom tab bar (Calendar, Inbox, Clients, Home) + "More" sheet for overflow items

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

## Testing Conventions

### Test Counts
- **~5,000+ total tests** across 330+ test files
- API: ~93% statement coverage, ~81% branch coverage
- Web: ~78% statement coverage, ~73% branch coverage

### Running Tests
```bash
# All tests (via Turborepo)
npm test

# API tests only
cd apps/api && npm test

# Web tests only
cd apps/web && npm test

# Single test file
npx jest path/to/file.spec.ts

# With coverage
npm test -- --coverage
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

## Common Commands

```bash
# Install dependencies
npm install

# Start local development (API + Web)
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
- **docker-build:** Multi-stage Docker builds for API and web images
- **deploy:** `railway up --service api/web --detach` (async — Railway build takes 2-5 min after CI passes)
- **smoke-test:** Runs `scripts/smoke-test.sh` against production after deploy (20 checks: health, DB, auth, security headers, CORS)
- **Migrations:** Auto-run via `scripts/docker-entrypoint.sh` on container startup

### Railway Production

| Property | Value |
|----------|-------|
| Project ID | `37eeca20-7dfe-45d9-8d29-e902a545f475` |
| API domain | `api.businesscommandcentre.com` |
| Web domain | `businesscommandcentre.com` |
| Services | api, web, postgres, redis |

---

## Deployment & Infrastructure Rules

**Read `DEPLOY.md` before making any infrastructure, auth, or deployment changes.** It documents hard-won lessons from production incidents.

### Critical Rules (Do Not Break)

1. **Cookie domain must cover both API and Web subdomains.** Cookies are set by the API (`api.X.com`) but read by Next.js middleware on the web app (`X.com`). The cookie `Domain` is auto-derived from `CORS_ORIGINS`. If you change domains, update `CORS_ORIGINS` first.

2. **`CORS_ORIGINS` is the source of truth for cookie domain.** The API parses the first origin to extract the root domain (e.g., `https://example.com` → `.example.com`). Always include both `www` and non-`www` variants.

3. **`NEXT_PUBLIC_API_URL` is baked at build time.** Changing it requires rebuilding the web Docker image — a runtime env var change won't work.

4. **`railway up --detach` does NOT mean the deploy is live.** CI passing only means Railway received the code. The actual build takes 2-5 more minutes. Always verify with curl or Railway logs.

5. **Deploy BOTH services when code changes span API and Web.** Run `railway up` for api AND web separately. The `railway.toml` health check path (`/api/v1/health`) must exist in both — do NOT remove `apps/web/src/app/api/v1/health/route.ts`.

6. **Never set `sameSite: 'strict'` on auth cookies.** It must be `lax` for cross-subdomain auth to work.

7. **Every deploy must include tests.** Never push code without associated tests for new/changed features.

8. **CSP `connect-src` must use origin only — never include a URL path.** Always use just the origin: `https://api.example.com`. Extraction is done in `apps/web/next.config.js` via `new URL(apiUrl).origin`.

9. **The frontend API client has automatic token refresh — do not remove it.** When a request gets 401, `apps/web/src/lib/api.ts` calls `POST /auth/refresh` before redirecting to /login. Concurrent refresh calls are deduplicated. Auth endpoints (`/auth/*`) skip refresh to avoid loops.

10. **Never use `document.referrer` or `performance.getEntriesByType('navigation')` to detect SPA navigation state.** Use `sessionStorage` flags instead.

11. **Token-based flows must use `TokenService.validateAndConsume()` — never separate validate+markUsed.** The atomic method prevents race conditions in reset-password, accept-invite, and verify-email.

12. **`forceBook` on booking creation is ADMIN-only.** The controller throws `ForbiddenException` if a non-ADMIN user sets `forceBook: true`. Never remove this check.

13. **Graceful shutdown is enabled — do not remove `enableShutdownHooks()` from `main.ts`.** Combined with `railway.toml` health checks, this provides zero-downtime deploys.

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

### Background Agents (5 operational + 12 marketing)
- `WaitlistAgent` — Auto-match waitlist entries to cancelled slots
- `RetentionAgent` — Detect at-risk customers, generate win-back action cards
- `DataHygieneAgent` — Duplicate detection, incomplete profile flagging
- `SchedulingOptimizerAgent` — Gap detection, optimal slot suggestions
- `QuoteFollowupAgent` — Expired quote reminders, follow-up action cards
- 12 Marketing Agents — 6 content (BlogWriter, SocialCreator, EmailComposer, CaseStudy, VideoScript, Newsletter), 2 distribution (ContentScheduler, ContentPublisher), 4 analytics (PerformanceTracker, TrendAnalyzer, ContentCalendar, ContentROI)

Agents run via `AgentSchedulerService` cron → `AGENT_PROCESSING` BullMQ queue → `AgentFrameworkService`. Per-agent `runIntervalMinutes` configurable via `config.config` JSON.

---

## Key Documentation

| Document | Location | Purpose |
|----------|----------|---------|
| PROJECT_CONTEXT.md | `docs/PROJECT_CONTEXT.md` | Full project context — what's built, schema, modules, roadmap |
| DEPLOY.md | `DEPLOY.md` | Deployment operations guide with critical rules |
| cicd.md | `docs/cicd.md` | CI/CD pipeline details |
| user-stories.md | `docs/user-stories.md` | Complete user stories (280 capabilities, 215 gaps) |
| ux-brainstorm-brief.md | `docs/ux-brainstorm-brief.md` | UX improvement brainstorm |

---

## Do Not Build (Yet)
- Don't chase additional verticals beyond the current 4 (aesthetic, dealership, wellness, general) before ROI is repeatable
- Don't overinvest in generic AI chatbot; keep AI tied to structured flows
- Don't build deep enterprise features before pack-led implementation is nailed
