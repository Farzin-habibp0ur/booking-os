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
- **Multi-language** — English & Spanish (589 translation keys), per-business overrides, language picker in sidebar
- **Billing** — Stripe integration (Basic/Pro plans), checkout, customer portal, webhooks, deposit collection
- **Calendar sync** — Google Calendar OAuth integration, iCal feed generation
- **Public booking portal** — Customer-facing booking page at `/book/{slug}` (service selection, availability, booking)
- **Vertical packs** — Industry-specific configs (aesthetic, salon, tutoring, general) that customize labels, required fields, and features
- **Setup wizard** — 9-step onboarding flow for new businesses
- **Notifications** — Email via Resend, automated booking reminders

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

## 5. API Modules (22 Controllers)

All endpoints prefixed with `/api/v1`. Swagger docs at `/api/docs` (dev only).

| Module | Route Prefix | Key Endpoints |
|--------|-------------|---------------|
| **Auth** | `/auth` | POST signup, login, refresh, logout, forgot-password, reset-password, change-password, accept-invite; GET me |
| **Bookings** | `/bookings` | GET list (filtered, paginated), GET calendar view, GET/:id, POST create, PATCH/:id update, PATCH/:id/status |
| **Recurring** | `/bookings/recurring` | POST create series, GET/:seriesId, POST/:seriesId/cancel |
| **Customers** | `/customers` | GET list (search, paginated), GET/:id, POST create, PATCH/:id, GET/:id/bookings, POST import-csv, POST import-from-conversations |
| **Services** | `/services` | GET list, POST create, PATCH/:id, DELETE/:id (soft) |
| **Staff** | `/staff` | GET list, POST create, POST invite, POST/:id/resend-invite, DELETE/:id/invite, PATCH/:id, DELETE/:id, GET/PATCH working-hours, GET/POST/DELETE time-off |
| **Conversations** | `/conversations` | GET list (filtered), GET counts, GET/:id, PATCH assign/status/snooze/tags, GET/:id/messages, POST/:id/booking, notes CRUD |
| **Messages** | `/conversations` | POST/:id/messages (send) |
| **Dashboard** | `/dashboard` | GET stats, GET ai-usage |
| **Reports** | `/reports` | GET bookings-over-time, no-show-rate, response-times, service-breakdown, staff-performance, revenue-over-time, status-breakdown, peak-hours |
| **AI** | `/ai` | GET/PATCH settings, POST summary, POST booking-confirm/cancel/reschedule flows, POST resume-auto-reply, POST customer chat |
| **Billing** | `/billing` | POST checkout, POST portal, GET subscription, POST webhook, POST deposit |
| **Templates** | `/templates` | Full CRUD |
| **Translations** | `/translations` | GET (by locale), GET keys, POST upsert, DELETE |
| **Availability** | `/availability` | GET available slots (by date, service, staff) |
| **Business** | `/business` | GET settings, PATCH update, GET/PATCH notification-settings |
| **Vertical Packs** | `/vertical-packs` | GET/:name config |
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

## 6. Frontend Pages (22 Pages)

| Page | Route | Description |
|------|-------|-------------|
| Login | `/login` | Email + password auth |
| Sign Up | `/signup` | New business registration |
| Forgot Password | `/forgot-password` | Password reset email |
| Reset Password | `/reset-password?token=` | Set new password |
| Accept Invite | `/accept-invite?token=` | Staff invitation acceptance |
| Setup Wizard | `/setup` | 9-step onboarding (business info → WhatsApp → staff → services → hours → templates → profile fields → import → finish) |
| Dashboard | `/dashboard` | KPI cards, today's appointments, unassigned conversations |
| Calendar | `/calendar` | Day/week view, staff columns, click-to-book |
| Bookings | `/bookings` | Filterable booking list with detail modal |
| Inbox | `/inbox` | 4-panel messaging: filters, conversation list, message thread + AI suggestions, customer info sidebar |
| Customers | `/customers` | Searchable list with import/export |
| Customer Detail | `/customers/[id]` | Contact info, tags, stats, AI chat, booking history, custom fields |
| Services | `/services` | Grouped by category, full CRUD |
| Staff | `/staff` | Expandable table with working hours + time off |
| Reports | `/reports` | Charts: bookings, revenue, service breakdown, staff performance, peak hours |
| Settings | `/settings` | Business info, password change, links to sub-pages |
| AI Settings | `/settings/ai` | Toggle AI features, auto-reply config, personality |
| Templates | `/settings/templates` | Message template CRUD with variable detection |
| Translations | `/settings/translations` | Per-locale translation overrides |
| Profile Fields | `/settings/profile-fields` | Required field configuration |
| Account & Import | `/settings/account` | CSV import/export, conversation import |
| Public Booking | `/book/[slug]` | Customer-facing booking portal |
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
- **API:** 31 test suites, 353 tests (unit + integration)
- **Web:** 14 test suites, 96 tests (component + page tests)
- **Shared:** 1 test suite, 19 tests
- **Total: 468 tests, all passing**
- **E2E:** Playwright configured for web app

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
- Logging + structured logs

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

- **Business:** Glow Aesthetic Clinic (aesthetic vertical pack, slug: `glow-aesthetic-clinic`)
- **Staff:** Dr. Sarah Chen (Admin), Maria Garcia (Agent), Dr. Emily Park (Service Provider)
- **Services:** Botox ($350/30min), Dermal Filler ($500/45min), Chemical Peel ($200/60min), Microneedling ($275/45min), Consultation (Free/20min)
- **Customers:** Emma Wilson (VIP, regular), James Thompson (New, latex allergy), Sofia Rodriguez (Regular, Spanish-speaking)
- **Working hours:** Mon-Fri 9am-5pm for both staff
- **Message templates:** Confirmation, reminder, follow-up, cancellation
- **Sample bookings, conversations, and messages**

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

## 14. Backlog — What's Left to Build

### P2 Features (Medium Priority)
| # | Feature | Description |
|---|---------|-------------|
| 13 | Customer Booking Portal | Enhanced public booking experience at `/book/{slug}` — currently basic, needs polish |
| 14 | Calendar Sync | Google/Microsoft calendar two-way sync — OAuth flow built, needs sync logic |
| 16 | Bulk Actions | Multi-select bookings/customers for bulk status updates, exports |
| 17 | Accessibility | ARIA labels, keyboard navigation, screen reader support, focus management |
| 18 | Global Search | Cmd+K search across bookings, customers, conversations, services |
| 19 | Waiting List | When slots are full, allow customers to join a waitlist with auto-notification |

### P3 Features (Lower Priority)
| # | Feature | Description |
|---|---------|-------------|
| 20 | Test Coverage >70% | Increase from current level, add E2E tests |
| 24 | Feature Flags | Runtime feature toggles per business |

### Potential Improvements (from DESIGN_DOCUMENTATION.md)
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
| `npm run test` | Run all tests (468 tests) |
| `npm run test:e2e` | Playwright E2E tests |
| `npm run db:generate` | Generate Prisma client |
| `npm run db:migrate` | Run migrations |
| `npm run db:seed` | Seed demo data |
| `npm run db:studio` | Prisma Studio GUI |
| `npm run format` | Format with Prettier |
