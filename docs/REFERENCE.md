# BookingOS — Reference Tables

> **Purpose:** Lookup tables and reference material extracted from CLAUDE.md for on-demand access. These are not needed every session but are essential when working in specific areas.

---

## Page Categories

**91+ pages** across `apps/web/` and `apps/admin/`:

**Public pages:** `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/verify-email`, `/accept-invite`, `/book/[slug]` (booking portal), `/manage/*` (self-serve links), `/portal/[slug]/*` (customer portal with OTP auth), `/unsubscribe/[token]` (campaign unsubscribe), `/testimonials/submit/[token]` (customer self-submission portal)

**Marketing pages:** `/` (landing page with hero, features, pricing), `/blog`, `/blog/[slug]` (JSON-LD, OpenGraph), `/pricing`, `/faq`

**Protected pages (tenant):** `/dashboard`, `/bookings`, `/calendar`, `/inbox`, `/customers`, `/customers/[id]`, `/services`, `/staff`, `/waitlist`, `/campaigns`, `/campaigns/new` (4-step wizard), `/campaigns/[id]` (detail with funnel + channel stats), `/automations` (redirects → `/ai/automations`), `/reports`, `/roi`, `/service-board` (dealership kanban), `/settings/*` (18 sub-pages including `/channels`, `/sms`, `/facebook`, `/email-channel`, `/web-chat`, `/testimonials`), `/settings/ai` (redirects → `/ai/settings`), `/packages` (wellness), `/testimonials`, `/marketing/*` (internal only — no sidebar nav), `/ai/*` (AI Hub: overview, agents, actions, automations, performance, settings — 6 sub-pages), `/search`, `/notifications`, `/help`

**Console pages (Super Admin):** These live in `apps/admin/` (port 3002). Routes: `/` (overview), `/businesses` (directory), `/businesses/[id]` (Business 360), `/audit`, `/health`, `/support`, `/billing`, `/billing/past-due`, `/billing/subscriptions`, `/packs`, `/packs/[slug]`, `/packs/skills`, `/agents`, `/messaging`, `/settings`, `/marketing` (landing), `/marketing/queue` (content approval), `/marketing/agents` (12 marketing agents), `/marketing/sequences` (email sequences), `/marketing/rejection-analytics`

---

## Navigation Structure

- **Single source of truth:** All nav routes defined in `apps/web/src/lib/nav-config.ts`, consumed by shell sidebar, mobile tab bar, and command palette
- Sidebar uses 4 sections: **Workspace** / **Tools** / **Insights** / **AI & Agents** (defined per mode in `apps/web/src/lib/mode-config.ts`)
- Admin mode splits sections into **primary** (always visible) and **overflow** (collapsible "More" toggle, collapsed by default, `localStorage` persisted). Agent/provider modes show all paths as primary
- Admin workspace includes: Inbox, Calendar, Customers, Bookings, Waitlist
- Admin primary tools: Services, Staff, Invoices, Marketing, Campaigns. Admin overflow tools: Packages (wellness)
- Admin primary insights: Dashboard, Reports. Admin overflow insights: Monthly Review, ROI
- Admin primary AI: AI & Agents (`/ai`). Admin overflow AI: Action Triage, Agent Status, Automations, AI Settings, Performance
- Every nav item has a distinct lucide-react icon — no duplicates across sections
- All nav labels use i18n keys (`locales/en.json` + `es.json`)
- Section labels use `.nav-section-label` CSS class from `globals.css`
- Settings link is in the sidebar footer area, not in the main nav
- **Marketing pages** (`/marketing/*`) exist but have no sidebar nav — internal tools only
- **SUPER_ADMIN login** redirects to the admin app (`NEXT_PUBLIC_ADMIN_URL`) via `window.location.href`
- **Mobile tab bar** is mode + role aware: admin/agent → Inbox, Calendar, Customers, Home + More; provider → Calendar, Bookings, Home + More
- **Post-login redirect:** Agent → `/inbox`, Provider → `/calendar`, Admin → stays on `/dashboard`
- **Mode route guard:** If the current URL is outside the active mode's section paths, shell redirects to `defaultLandingPath`. Exempt: `/settings/*`, `/admin/*`, `/`
- **Command palette** (⌘K): searches all navigable pages grouped by sidebar section, plus API entity search
- **Chord shortcuts:** G then B/C/I/D/S/A/Q/R/J/W → bookings/customers/inbox/dashboard/services/automations/actions/reports/ai/waitlist
- Mobile swipe gestures: `useSwipeGesture` hook in `apps/web/src/lib/use-swipe-gesture.ts`
- Mobile calendar: `DateScroller` component (`apps/web/src/components/date-scroller.tsx`)

---

## Platform Console (Super Admin)

The Console is a **standalone Next.js app** at `apps/admin/` for platform-wide administration, accessible only to `SUPER_ADMIN` users. It runs on port 3002 and will be deployed to `admin.businesscommandcentre.com`.

### Admin App Architecture

- **Separate app:** `apps/admin/` — independent from `apps/web/`, with its own auth, middleware, and layout
- **20 routes** across 11 sections
- **Dark sidebar theme:** `bg-slate-900` with red "ADMIN" badge — visually distinct from the customer app
- **Auth flow:** Users authenticate via the customer app; the admin app checks for auth cookies and validates `SUPER_ADMIN` role
- **No analytics:** No PostHog, no service worker, `X-Robots-Tag: noindex, nofollow`
- **API client:** Same `ApiClient` class as the web app — on 401, redirects to customer app login
- **View-As:** `ViewAsBanner` component for time-limited tenant impersonation with reason and action logging

### Console Features

- **Overview** (`/`) — Platform KPIs, billing breakdown, audit feed
- **Business Directory** (`/businesses`) — Search, filter by plan/billing/health, paginated table
- **Business 360** (`/businesses/[id]`) — Summary, People, and Billing tabs
- **View-as** — `ViewAsSession` model for time-limited tenant impersonation
- **Security & Audit** (`/audit`) — `PlatformAuditLog` (separate from per-tenant `ActionHistory`)
- **System Health** (`/health`) — DB, business activity, agents, calendar, messaging health checks
- **Support Cases** (`/support`) — Full CRUD with `SupportCase` + `SupportCaseNote` models
- **Billing Dashboard** (`/billing`) — MRR, churn rate, plan distribution, `BillingCredit` management
- **Pack Registry** (`/packs`) — Vertical pack management with version history
- **AI & Agents Governance** (`/agents`) — Agent performance, action card funnel, `PlatformAgentDefault`
- **Messaging Ops** (`/messaging`) — Delivery rates, webhook health, failure analysis
- **Dead Letter Queue** (`/admin/dlq/*`) — DLQ management API
- **Usage Tracking** (`/admin/usage/*`) — Per-channel message usage and billing rates
- **Platform Settings** (`/settings`) — `PlatformSetting` model with bulk save

### Console-Specific Models

- `ViewAsSession` — Super Admin tenant impersonation with expiry and action logging
- `PlatformAuditLog` — Platform-level audit trail
- `PlatformAgentDefault` — Platform-wide agent governance defaults per agent type
- `PlatformSetting` — Key-value platform settings by category
- `SupportCase` / `SupportCaseNote` — Support ticket tracking
- `BillingCredit` — Platform-issued billing credits
- `DeviceToken` — Push notification device registration

---

## Seed Data

All seed scripts are in `packages/db/src/`. They are **idempotent** (safe to re-run) and use dedup checks.

| Script                     | Command                                            | Purpose                                                                                                                                                                      | When to Use                   |
| -------------------------- | -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| `seed.ts`                  | `npx tsx packages/db/src/seed.ts`                  | Base data: 3 businesses (aesthetic + dealership + wellness), staff, services, working hours                                                                                  | Fresh database setup, CI      |
| `seed-demo.ts`             | `npx tsx packages/db/src/seed-demo.ts`             | Rich demo data: bookings, customers, conversations, action cards, campaigns (3), automation rules (3) with logs                                                              | Demo environments, testing    |
| `seed-agentic.ts`          | `npx tsx packages/db/src/seed-agentic.ts`          | Agentic framework data: agent configs, agent runs, action cards, autonomy configs                                                                                            | One-time production fill      |
| `seed-wellness.ts`         | `npx tsx packages/db/src/seed-wellness.ts`         | Wellness vertical: packages, memberships, intake data                                                                                                                        | Also called from seed.ts      |
| `seed-console.ts`          | `npx tsx packages/db/src/seed-console.ts`          | Console base data: platform settings, agent defaults                                                                                                                         | Super Admin setup             |
| `seed-console-showcase.ts` | `npx tsx packages/db/src/seed-console-showcase.ts` | Console demo data: support cases, audit logs                                                                                                                                 | Console demos                 |
| `seed-content.ts`          | `npx tsx packages/db/src/seed-content.ts`          | 12 blog posts across 5 content pillars → ContentDraft records                                                                                                                | Marketing content setup       |
| `seed-instagram.ts`        | `npx tsx packages/db/src/seed-instagram.ts`        | 4 Instagram DM conversations (story reply, ad referral, ice breaker, expiring window)                                                                                        | Instagram integration testing |
| `seed-omnichannel.ts`      | `npx tsx packages/db/src/seed-omnichannel.ts`      | Multi-channel customers, conversations + messages, MessageUsage with segments/cost (7 days), channelSettings                                                                 | Omnichannel foundation setup  |
