# Booking OS

A modern, full-featured appointment booking and business management platform built for service-based businesses (salons, clinics, spas, and more).

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15, React 19, Tailwind CSS 4 |
| Backend | NestJS 11, Prisma ORM |
| Database | PostgreSQL 16 |
| AI | Anthropic Claude (smart scheduling, insights) |
| Payments | Stripe (subscriptions, invoicing) |
| Messaging | WhatsApp Business API, email (Resend) |
| Infra | Turborepo, Docker, GitHub Actions |

## Monorepo Structure

```
booking-os/
├── apps/
│   ├── api/               # NestJS REST API (port 3001)
│   ├── web/               # Next.js admin dashboard (port 3000)
│   └── whatsapp-simulator/# WhatsApp testing tool
├── packages/
│   ├── db/                # Prisma schema, migrations, seed data
│   ├── messaging-provider/# Messaging abstraction layer
│   └── shared/            # Shared types and utilities
├── docs/                  # Additional documentation
├── nginx/                 # Reverse proxy config
└── scripts/               # Utility scripts
```

## Prerequisites

- **Node.js** 20+
- **PostgreSQL** 16
- **Redis** (optional, for caching)

## Getting Started

1. **Clone the repository**
   ```bash
   git clone <repo-url>
   cd booking-os
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` with your database credentials and API keys. See [Environment Variables](#environment-variables) below.

4. **Set up the database**
   ```bash
   npm run db:generate
   npm run db:migrate
   ```

5. **Seed sample data**
   ```bash
   npm run db:seed
   ```

6. **Start the development servers**
   ```bash
   npm run dev
   ```

7. **Open the app**
   - Dashboard: [http://localhost:3000](http://localhost:3000)
   - API: [http://localhost:3001/api/v1](http://localhost:3001/api/v1)
   - API Docs (Swagger): [http://localhost:3001/api/docs](http://localhost:3001/api/docs)
   - Login: `sarah@glowclinic.com` / `password123`

## Available Scripts

Run from the monorepo root:

| Command | Description |
|---------|-------------|
| `npm run dev` | Start all apps in development mode |
| `npm run build` | Build all apps and packages |
| `npm run lint` | Lint all apps and packages |
| `npm run test` | Run unit tests |
| `npm run test:e2e` | Run Playwright end-to-end tests |
| `npm run format` | Format code with Prettier |
| `npm run format:check` | Check code formatting |
| `npm run db:generate` | Generate Prisma client |
| `npm run db:migrate` | Run database migrations |
| `npm run db:seed` | Seed the database with sample data |
| `npm run db:studio` | Open Prisma Studio (database GUI) |

## API Modules

All endpoints are prefixed with `/api/v1`. Interactive API docs are available at `/api/docs` (Swagger UI) in development.

| Module | Route | Description |
|--------|-------|-------------|
| Auth | `/auth` | Login, registration, token management, email verification |
| Bookings | `/bookings` | CRUD for appointments, status updates, bulk actions, deposit/reschedule/cancel links |
| Recurring | `/bookings/recurring` | Recurring appointment series |
| Customers | `/customers` | Customer profiles, import/export, bulk tag/untag, notes CRUD, unified timeline |
| Services | `/services` | Service catalog with categories and service kinds |
| Staff | `/staff` | Staff profiles, schedules, roles, invitations |
| Conversations | `/conversations` | Customer messaging threads, notes |
| Messages | `/conversations/:id/messages` | Individual messages within threads |
| Dashboard | `/dashboard` | Aggregated stats, AI usage, milestone nudges |
| Reports | `/reports` | Revenue, bookings, staff, peak hours, consult conversion |
| AI | `/ai` | Smart scheduling, AI insights, auto-reply, customer chat |
| Billing | `/billing` | Stripe subscriptions, webhooks, deposit collection |
| Templates | `/templates` | Message and notification templates |
| Translations | `/translations` | Multi-language support |
| Availability | `/availability` | Staff availability and time slots |
| Business | `/business` | Business settings, notification/policy/waitlist settings, pack install |
| ROI | `/roi` | ROI dashboard, baseline, weekly review, email review |
| Vertical Packs | `/vertical-packs` | Industry-specific configurations |
| Automation | `/automations` | Playbooks, custom rules, activity log |
| Campaign | `/campaigns` | Campaign CRUD, audience preview, send engine |
| Offer | `/offers` | Promotions and offers management |
| Waitlist | `/waitlist` | Waitlist entries, offers, claims |
| Saved Views | `/saved-views` | Named filter presets, pinning, sharing |
| Search | `/search` | Global search with offset, types filter, totals |
| Self-Serve | `/manage` | Customer reschedule/cancel via token links |
| Webhook | `/webhook` | Incoming messaging webhooks (WhatsApp, generic HMAC) |
| Email | `/email` | Email notification endpoints |
| Locations | `/locations` | Multi-location management with resources |
| Quotes | `/quotes` | Service quotes with customer approval |
| Pack Builder | `/admin/packs` | Vertical pack CRUD (Super Admin) |
| Health | `/health` | API health check |
| Public Booking | `/public` | Customer-facing booking portal with waitlist join |
| Calendar Sync | `/calendar-sync` | Google Calendar integration |
| iCal Feed | `/ical` | iCal feed for external calendars |
| ActionCard | `/action-cards` | Action card CRUD, approve/dismiss/snooze/execute, expiry cron |
| ActionHistory | `/action-history` | Unified audit trail, polymorphic entity references |
| Autonomy | `/autonomy` | Per-action-type autonomy configs, level checking |
| Outbound | `/outbound` | Staff-initiated outbound message drafts |
| Briefing | `/briefing` | Daily briefing feed, opportunity detection (deposit pending, overdue replies, open slots) |
| Agent | `/agent` | Agent framework CRUD, agent runs, scheduling, AGENT_PROCESSING queue, 5 background agents |
| Agent Feedback | `/agent-feedback` | Staff feedback CRUD on agent run outcomes, aggregation stats |
| Agent Skills | `/agent-skills` | Skills catalog per vertical pack, business-level overrides |

## Environment Variables

Copy `.env.example` to `.env` for a full list of configuration options. Key variable groups:

- **Database** — `DATABASE_URL`, PostgreSQL connection string
- **Auth** — `JWT_SECRET`, `JWT_EXPIRES_IN`
- **Stripe** — `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- **AI** — `ANTHROPIC_API_KEY`
- **Email** — `RESEND_API_KEY`
- **WhatsApp** — `WHATSAPP_API_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`
- **Google Calendar** — `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- **Sentry** — `SENTRY_DSN`

## Deployment

The project includes Docker Compose configurations for production deployment with Nginx reverse proxy. See [`docs/cicd.md`](docs/cicd.md) for the full CI/CD pipeline documentation.

```bash
# Production build and deploy
make deploy
```

## Project Documentation

| Document | Description |
|----------|-------------|
| [`DESIGN_DOCUMENTATION.md`](DESIGN_DOCUMENTATION.md) | Product design, data models, user flows, tech stack |
| [`CLAUDE.md`](CLAUDE.md) | Design system and UI guidelines |
| [`DEMO_SCRIPT.md`](DEMO_SCRIPT.md) | Demo walkthrough script |
| [`docs/cicd.md`](docs/cicd.md) | CI/CD pipeline and deployment |
| [`.env.example`](.env.example) | Environment variable template with comments |
