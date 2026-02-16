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
| Auth | `/auth` | Login, registration, token management |
| Bookings | `/bookings` | CRUD for appointments, status updates |
| Recurring | `/bookings/recurring` | Recurring appointment series |
| Customers | `/customers` | Customer profiles, import/export |
| Services | `/services` | Service catalog with categories |
| Staff | `/staff` | Staff profiles, schedules, roles |
| Conversations | `/conversations` | Customer messaging threads |
| Messages | `/conversations/:id/messages` | Individual messages within threads |
| Dashboard | `/dashboard` | Aggregated stats and metrics |
| Reports | `/reports` | Revenue, bookings, and staff reports |
| AI | `/ai` | Smart scheduling, AI insights |
| Billing | `/billing` | Stripe subscriptions and webhooks |
| Templates | `/templates` | Message and notification templates |
| Translations | `/translations` | Multi-language support |
| Availability | `/availability` | Staff availability and time slots |
| Business | `/business` | Business settings and profile |
| Vertical Packs | `/vertical-packs` | Industry-specific configurations |
| Webhook | `/webhook` | Incoming messaging webhooks |
| Health | `/health` | API health check |
| Public Booking | `/public` | Customer-facing booking portal |
| Calendar Sync | `/calendar-sync` | Google Calendar integration |
| iCal Feed | `/ical` | iCal feed for external calendars |

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
