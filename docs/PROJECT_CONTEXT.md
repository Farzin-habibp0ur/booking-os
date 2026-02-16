# Booking OS — Complete Project Context

> **Purpose:** This document gives full context on the Booking OS platform — what it is, what's been built, how it's structured, and what's left to build. Share this with an AI assistant or new developer to get productive immediately.

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
- **Service catalog** — Categories, pricing, durations, buffer times, deposit requirements, soft delete
- **Analytics & reports** — Bookings over time, revenue, service breakdown, staff performance, no-show rates, peak hours
- **Multi-language** — English & Spanish (600+ translation keys), per-business overrides, language picker in sidebar
- **Billing** — Stripe integration (Basic/Pro plans), checkout, customer portal, webhooks, deposit collection
- **Calendar sync** — Google Calendar OAuth integration, iCal feed generation
- **Public booking portal** — Customer-facing booking page at `/book/{slug}` (service selection, availability, booking)
- **Vertical packs** — Industry-specific configs (aesthetic, salon, tutoring, general) that customize labels, required fields, and features
- **Setup wizard** — 10-step onboarding flow for new businesses with feature readiness checklist and test booking
- **Notifications** — Email via Resend, WhatsApp, automated booking reminders, notification timeline

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
│   │       ├── modules/        # 23 feature modules (see §5)
│   │       ├── common/         # Guards, decorators, filters, DTOs, Prisma service
│   │       └── main.ts         # Bootstrap, Swagger, CORS, validation
│   ├── web/                    # Next.js admin dashboard (port 3000)
│   │   └── src/
│   │       ├── app/            # 22 pages (see §6)
│   │       ├── components/     # 9 shared components
│   │       ├── lib/            # API client, auth, i18n, socket, toast
│   │       └── locales/        # en.json, es.json (589 keys each)
│   └── whatsapp-simulator/     # WhatsApp testing tool (port 3002)
├── packages/
│   ├── db/                     # Prisma schema, migrations, seed data
│   ├── messaging-provider/     # WhatsApp Cloud API abstraction
│   └── shared/                 # Shared types and utilities
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

## 4. Database Schema (18 Models)

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
               ├── (*) AiUsage
               └── (*) CalendarConnection
```

### Key Models

| Model | Key Fields | Notes |
|-------|-----------|-------|
| **Business** | name, slug (unique), timezone, verticalPack, aiSettings (JSON), defaultLocale, packConfig (JSON) | Multi-tenant root |
| **Staff** | name, email (unique), role (ADMIN/SERVICE_PROVIDER/AGENT), passwordHash, locale, isActive | Auth + assignment |
| **Customer** | name, phone (unique per biz), email, tags[], customFields (JSON) | Flexible profiles |
| **Service** | name, durationMins, price, category, bufferBefore/After, depositRequired, isActive | Catalog items |
| **Booking** | customerId, serviceId, staffId, status (6 states), startTime, endTime, recurringSeriesId | Core entity |
| **Conversation** | customerId, assignedToId, channel (WHATSAPP/WEB), status (4 states), tags[], metadata (JSON) | AI state stored in metadata |
| **Message** | conversationId, direction (IN/OUT), content, contentType, externalId, senderStaffId | Chat messages |
| **MessageTemplate** | name, category (5 types), body (with {{variables}}), variables[] | Notification templates |
| **Subscription** | stripeCustomerId, plan (basic/pro), status | Billing state |

**Booking statuses:** PENDING → CONFIRMED → IN_PROGRESS → COMPLETED (also: CANCELLED, NO_SHOW)
**Conversation statuses:** OPEN, WAITING, SNOOZED, RESOLVED

---

## 5. API Modules (24 Controllers)

All endpoints prefixed with `/api/v1`. Swagger docs at `/api/docs` (dev only).

| Module | Route Prefix | Key Endpoints |
|--------|-------------|---------------|
| **Auth** | `/auth` | POST signup, login, refresh, logout, forgot-password, reset-password, change-password, accept-invite; GET me |
| **Bookings** | `/bookings` | GET list (filtered, paginated), GET calendar view, GET/:id, POST create, PATCH/:id update, PATCH/:id/status, POST/:id/send-deposit-request, POST/:id/send-reschedule-link, POST/:id/send-cancel-link, GET/:id/cancel-policy, GET/:id/reschedule-policy |
| **Recurring** | `/bookings/recurring` | POST create series, GET/:seriesId, POST/:seriesId/cancel |
| **Customers** | `/customers` | GET list (search, paginated), GET/:id, POST create, PATCH/:id, GET/:id/bookings, POST import-csv, POST import-from-conversations |
| **Services** | `/services` | GET list, POST create, PATCH/:id, DELETE/:id (soft) |
| **Staff** | `/staff` | GET list, POST create, POST invite, POST/:id/resend-invite, DELETE/:id/invite, PATCH/:id, DELETE/:id, GET/PATCH working-hours, GET/POST/DELETE time-off |
| **Conversations** | `/conversations` | GET list (filtered), GET counts, GET/:id, PATCH assign/status/snooze/tags, GET/:id/messages, POST/:id/booking, notes CRUD |
| **Messages** | `/conversations` | POST/:id/messages (send) |
| **Dashboard** | `/dashboard` | GET stats, GET ai-usage |
| **Reports** | `/reports` | GET bookings-over-time, no-show-rate, response-times, service-breakdown, staff-performance, revenue-over-time, status-breakdown, peak-hours, consult-to-treatment-conversion, deposit-compliance-rate |
| **ROI** | `/roi` | GET dashboard, POST go-live, GET weekly-review, POST email-review |
| **AI** | `/ai` | GET/PATCH settings, POST summary, POST booking-confirm/cancel/reschedule flows, POST resume-auto-reply, POST customer chat |
| **Billing** | `/billing` | POST checkout, POST portal, GET subscription, POST webhook, POST deposit |
| **Templates** | `/templates` | Full CRUD |
| **Translations** | `/translations` | GET (by locale), GET keys, POST upsert, DELETE |
| **Availability** | `/availability` | GET available slots (by date, service, staff) |
| **Business** | `/business` | GET settings, PATCH update, GET/PATCH notification-settings, POST install-pack, POST create-test-booking |
| **Vertical Packs** | `/vertical-packs` | GET/:name config |
| **Self-Serve** | `/manage` | GET /reschedule/:token, POST /reschedule/:token, GET /cancel/:token, POST /cancel/:token |
| **Webhooks** | `/webhook` | GET whatsapp (verify), POST whatsapp (inbound), POST inbound (generic HMAC), GET simulator/outbox |
| **Health** | `/health` | GET health check |
| **Public Booking** | `/public` | GET/:slug business info, GET/:slug/services, GET/:slug/availability, POST/:slug/book |
| **Calendar Sync** | `/calendar-sync` | GET connections, GET providers, POST connect/:provider, GET callback/:provider, DELETE connections/:provider, GET ical-feed-url, POST regenerate-ical-token |
| **iCal Feed** | `/ical` | GET/:token.ics |

### Auth & Multi-tenancy
- JWT-based auth (access + refresh tokens in httpOnly cookies)
- `TenantGuard` extracts businessId from JWT and injects into every request
- `@BusinessId()` decorator provides tenant isolation on all queries
- Role-based access: `@Roles('ADMIN')` decorator + `RolesGuard` (three roles: ADMIN, SERVICE_PROVIDER, AGENT)

---

## 6. Frontend Pages (26 Pages)

| Page | Route | Description |
|------|-------|-------------|
| Login | `/login` | Email + password auth |
| Sign Up | `/signup` | New business registration |
| Forgot Password | `/forgot-password` | Password reset email |
| Reset Password | `/reset-password?token=` | Set new password |
| Accept Invite | `/accept-invite?token=` | Staff invitation acceptance |
| Setup Wizard | `/setup` | 10-step onboarding (clinic type → business info → WhatsApp → staff → services → hours → templates → profile fields → import → finish with readiness checklist + test booking) |
| Dashboard | `/dashboard` | KPI cards, today's appointments, unassigned conversations, attention needed panel, go-live checklist, first-10-bookings milestones |
| Calendar | `/calendar` | Day/week view, staff columns, click-to-book |
| Bookings | `/bookings` | Filterable booking list with detail modal, deposit request, reschedule/cancel link actions |
| Inbox | `/inbox` | 4-panel messaging: filters, conversation list, message thread + AI suggestions, customer info sidebar with Clinic Intake card |
| Customers | `/customers` | Searchable list with import/export |
| Customer Detail | `/customers/[id]` | Contact info, tags, stats, AI chat, booking history, custom fields |
| Services | `/services` | Grouped by category, full CRUD, service kind badges (CONSULT/TREATMENT/OTHER) |
| Staff | `/staff` | Expandable table with working hours + time off |
| Reports | `/reports` | Charts: bookings, revenue, service breakdown, staff performance, peak hours |
| ROI Dashboard | `/roi` | ROI metrics (conversion, no-shows, response time, consult→treatment, utilization, deposit compliance), baseline comparison, recovered revenue estimate, weekly review tab |
| Settings | `/settings` | Business info, password change, links to sub-pages |
| AI Settings | `/settings/ai` | Toggle AI features, auto-reply config, personality |
| Templates | `/settings/templates` | 10 message templates with variable detection, unresolved var warnings |
| Translations | `/settings/translations` | Per-locale translation overrides |
| Profile Fields | `/settings/profile-fields` | Required field configuration |
| Account & Import | `/settings/account` | CSV import/export, conversation import |
| Public Booking | `/book/[slug]` | Customer-facing booking portal |
| Self-Serve Reschedule | `/manage/reschedule/[token]` | Clinic-branded reschedule page with policy-aware slot picker |
| Self-Serve Cancel | `/manage/cancel/[token]` | Clinic-branded cancel confirmation page with optional reason |
| Calendar Sync | `/settings/calendar` | Google Calendar connection management |
| Billing | `/settings/billing` | Stripe subscription management |
| Notifications | `/settings/notifications` | Notification preferences |

### Key Frontend Components
- `Shell` — App layout with sidebar navigation, i18n provider, vertical pack provider
- `BookingFormModal` — Create/reschedule booking with service, staff, date, time slot selection
- `BookingDetailModal` — View booking details, update status, reschedule
- `AiSuggestions` — AI draft reply display with edit/send/dismiss
- `AiBookingPanel` — Multi-step AI booking/cancel/reschedule flow in sidebar
- `AiSummary` — AI conversation summary with refresh
- `LanguagePicker` — Locale selector (English/Spanish)
- `Skeleton` — Loading skeletons and empty state components

---

## 7. AI Architecture

The AI system uses Claude (Anthropic API) through a modular pipeline:

| Component | File | Purpose |
|-----------|------|---------|
| `ClaudeClient` | `claude.client.ts` | API client wrapper with error handling, graceful degradation when key missing |
| `IntentDetector` | `intent-detector.ts` | Classifies messages into intents: GENERAL_INQUIRY, BOOK_APPOINTMENT, CANCEL_APPOINTMENT, RESCHEDULE_APPOINTMENT |
| `ReplyGenerator` | `reply-generator.ts` | Generates contextual reply drafts using conversation history + business context |
| `BookingAssistant` | `booking-assistant.ts` | Multi-step booking flow: service → date → time → confirm |
| `CancelAssistant` | `cancel-assistant.ts` | Identifies and cancels bookings from conversation |
| `RescheduleAssistant` | `reschedule-assistant.ts` | Identifies and reschedules bookings |
| `ProfileCollector` | `profile-collector.ts` | Conversationally collects missing required profile fields |
| `AiService` | `ai.service.ts` | Orchestrator: routes intents, manages conversation metadata state, handles auto-reply |

**AI state** is persisted in `conversation.metadata` JSON field, enabling stateful multi-turn flows.

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

## 9. Testing

### Current Coverage
- **API unit tests:** 36 test suites, 499 tests (unit + integration)
- **E2E tests:** 54 Playwright tests (0 failures), 1 skipped
- **Total: 553 tests, all passing**

### What's Tested
- All AI components (intent detection, reply generation, booking/cancel/reschedule assistants, profile collector)
- Auth service + integration tests
- Booking, customer, staff, conversation, service services
- Billing service (Stripe integration)
- Webhook controller (WhatsApp inbound, HMAC verification)
- Calendar sync service
- Guards (tenant isolation, roles)
- Token service
- Dashboard service
- Reminder service
- Notification service
- ROI service (dashboard, weekly review, email review)
- Business service (install pack, create test booking)
- Vertical pack service (aesthetic, general packs)
- Logging + structured logs

### E2E Test Coverage (Playwright)
- Authentication flows (login, redirects, protected routes)
- Navigation (sidebar, active states, browser history)
- All primary pages (bookings, customers, services, staff, settings, inbox)
- Setup wizard flow
- **Workflow tests:** booking lifecycle, deposit flow, consult completion, self-serve reschedule/cancel pages, ROI dashboard, template settings

---

## 10. CI/CD Pipeline

```
Push to main → lint-and-test → docker-build → deploy (Railway)
Pull request → lint-and-test → docker-build (no deploy)
```

- **lint-and-test:** PostgreSQL 16 service container, runs `npm run lint` + `npm run test`
- **docker-build:** Multi-stage Docker builds for API and web
- **deploy:** Railway deployment (API + web services)
- **Full docs:** `docs/cicd.md`

---

## 11. Environment Configuration

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

## 12. Seed Data (Demo Account)

The seed script (`packages/db/src/seed.ts`) creates:

- **Business:** Glow Aesthetic Clinic (aesthetic vertical pack, slug: `glow-aesthetic-clinic`, setupComplete: true)
- **Staff:** Dr. Sarah Chen (Admin), Maria Garcia (Agent), Dr. Emily Park (Service Provider)
- **Services:** Consultation (Free/30min, CONSULT), Botox ($350/30min, TREATMENT, deposit required $50), Dermal Filler ($500/45min, TREATMENT), Chemical Peel ($200/45min, TREATMENT), Microneedling ($300/60min, TREATMENT)
- **Customers:** Emma Wilson (VIP, regular), James Thompson (New, latex allergy), Sofia Rodriguez (Regular, Spanish-speaking), Liam Parker (deposit demo)
- **Working hours:** Mon-Fri 9am-5pm for all staff
- **Message templates:** 10 templates (Confirmation, Reminder, Follow-up, Consult Follow-up, Aftercare, Treatment Check-in, Deposit Request, Cancellation Confirmation, Reschedule Link, Cancel Link)
- **Sample bookings:** Confirmed, completed, cancelled, PENDING_DEPOSIT bookings
- **Sample conversations and messages**
- **Consult booking** with CONSULT_FOLLOW_UP reminder
- **Treatment booking** with AFTERCARE and TREATMENT_CHECK_IN reminders
- **ROI baseline** for dashboard metrics
- **Notification settings** with follow-up delays and check-in hours

---

## 13. Design System

Two design references exist:

### CLAUDE.md (Active — "Minimalist Premium")
- **Fonts:** Inter (body), Playfair Display (headers)
- **Colors:** Sage (primary/success), Lavender (AI/highlights), off-white backgrounds
- **Style:** `rounded-2xl`, soft shadows (`shadow-soft`), no borders, no component libraries
- **Buttons:** `bg-sage-600` primary, `bg-slate-900` dark
- **AI elements:** Lavender palette (`bg-lavender-50 border-lavender-100`)

### DESIGN_DOCUMENTATION.md (Legacy reference — 746 lines)
- Complete page-by-page UI documentation
- All data models, user flows, component inventory
- Currently describes the older blue-based color scheme

---

## 14. Roadmap — What's Next

Phase 1 ("Outcome Machine for Aesthetics") is **complete** (27/27 tasks). The roadmap continues with:

### Phase 2: Automation & Growth Engine (3-6 months)
- Smart waitlists with auto-notification
- No-show prediction and prevention
- Automated rebooking campaigns
- Revenue optimization suggestions
- Multi-channel outreach (SMS, email campaigns)

### Phase 3: Platformization + Second Vertical (6-12 months)
- Plugin/extension system
- Second vertical (salon, tutoring, or wellness)
- Marketplace for integrations
- White-label capabilities

### Phase 4: Engagement OS + Benchmarking (12-24 months)
- Industry benchmarking
- Customer engagement scoring
- Loyalty/rewards engine
- Partner marketplace

### Backlog (Medium Priority)
| # | Feature | Description |
|---|---------|-------------|
| 13 | Customer Booking Portal | Enhanced public booking experience at `/book/{slug}` — currently basic, needs polish |
| 14 | Calendar Sync | Google/Microsoft calendar two-way sync — OAuth flow built, needs sync logic |
| 16 | Bulk Actions | Multi-select bookings/customers for bulk status updates, exports |
| 17 | Accessibility | ARIA labels, keyboard navigation, screen reader support, focus management |
| 18 | Global Search | Cmd+K search across bookings, customers, conversations, services |
| 19 | Waiting List | When slots are full, allow customers to join a waitlist with auto-notification |

### Potential Improvements
- Mobile responsiveness optimization
- Dark mode
- Animations/transitions
- Onboarding tooltips
- Calendar UI polish
- Chart customization (use design system colors)
- Empty state illustrations

---

## 15. How to Run Locally

```bash
git clone <repo-url>
cd booking-os
npm install
cp .env.example .env          # Edit with your DB credentials
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev                    # Starts all apps
```

- Dashboard: http://localhost:3000
- API: http://localhost:3001/api/v1
- Swagger: http://localhost:3001/api/docs
- Login: sarah@glowclinic.com / password123

---

## 16. Key Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start all apps |
| `npm run build` | Build all |
| `npm run lint` | Lint all |
| `npm run test` | Run all unit tests (499 tests) |
| `npm run test:e2e` | Playwright E2E tests |
| `npm run db:generate` | Generate Prisma client |
| `npm run db:migrate` | Run migrations |
| `npm run db:seed` | Seed demo data |
| `npm run db:studio` | Prisma Studio GUI |
| `npm run format` | Format with Prettier |
