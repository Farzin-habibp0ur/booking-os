# Booking OS — Deployment & Operations Guide

Complete reference for deploying, configuring, and operating Booking OS in production. Covers Railway (current production), self-hosted Docker, and local demo setups.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Environment Variables Reference](#2-environment-variables-reference)
3. [Railway Deployment (Current Production)](#3-railway-deployment-current-production)
4. [Self-Hosted Docker Deployment](#4-self-hosted-docker-deployment)
5. [Local Demo Quick Start](#5-local-demo-quick-start)
6. [Authentication & Cookie Configuration](#6-authentication--cookie-configuration)
7. [CI/CD Pipeline](#7-cicd-pipeline)
8. [Database Operations](#8-database-operations)
9. [Monitoring & Health Checks](#9-monitoring--health-checks)
10. [Troubleshooting](#10-troubleshooting)
11. [Security Checklist](#11-security-checklist)

---

## 1. Architecture Overview

```
                 Browser
                    │
        ┌───────────┴───────────┐
        ▼                       ▼
 ┌─────────────┐       ┌──────────────┐
 │     Web     │       │     API      │
 │  (Next.js)  │──────►│   (NestJS)   │
 │  port 3000  │ fetch │  port 3001   │
 └─────────────┘       └──────┬───────┘
                               │
                    ┌──────────┼──────────┐
                    ▼                     ▼
             ┌───────────┐         ┌───────────┐
             │ PostgreSQL│         │   Redis   │
             │    16     │         │     7     │
             │ port 5432 │         │ port 6379 │
             └───────────┘         └───────────┘
```

**Monorepo structure:**
- `apps/api` — NestJS REST API + WebSocket (Socket.IO)
- `apps/web` — Next.js 15 frontend (standalone output)
- `packages/db` — Prisma schema, migrations, seed scripts
- `packages/shared` — Shared types and utilities
- `packages/messaging-provider` — WhatsApp Cloud API adapter

**API prefix:** All API routes are under `/api/v1` (set in `apps/api/src/main.ts`).

---

## 2. Environment Variables Reference

### Required for Production

| Variable | Service | Example | Description |
|----------|---------|---------|-------------|
| `NODE_ENV` | API | `production` | Enables secure cookies, disables Swagger, enables Helmet |
| `DATABASE_URL` | API | `postgresql://user:pass@host:5432/booking_os?schema=public` | PostgreSQL connection string |
| `JWT_SECRET` | API | _(64-char hex)_ | Access token signing key. Generate: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` |
| `JWT_REFRESH_SECRET` | API | _(64-char hex)_ | Refresh token signing key. Must differ from JWT_SECRET |
| `CORS_ORIGINS` | API | `https://yourdomain.com,https://www.yourdomain.com` | Comma-separated allowed origins. **Also used to derive cookie Domain** (see section 6) |
| `NEXT_PUBLIC_API_URL` | Web | `https://api.yourdomain.com/api/v1` | API URL the browser calls. Baked into the Next.js build at build time |
| `NEXT_PUBLIC_WS_URL` | Web | `https://api.yourdomain.com` | WebSocket (Socket.IO) URL for real-time features |

### Optional Services

| Variable | Service | Default | Description |
|----------|---------|---------|-------------|
| `REDIS_URL` | API | — | Redis for BullMQ job queues, WebSocket scaling, and caching |
| `ANTHROPIC_API_KEY` | API | — | Claude API key for AI features (intent detection, reply suggestions) |
| `STRIPE_SECRET_KEY` | API | — | Stripe billing |
| `STRIPE_WEBHOOK_SECRET` | API | — | Stripe webhook signature verification |
| `STRIPE_PRICE_ID_BASIC` | API | — | Stripe price ID for Basic plan |
| `STRIPE_PRICE_ID_PRO` | API | — | Stripe price ID for Pro plan |
| `WHATSAPP_PHONE_NUMBER_ID` | API | — | Meta WhatsApp Cloud API |
| `WHATSAPP_ACCESS_TOKEN` | API | — | Meta WhatsApp Cloud API |
| `WHATSAPP_VERIFY_TOKEN` | API | — | Meta webhook verification token |
| `MESSAGING_PROVIDER` | API | `mock` | Set to `whatsapp-cloud` for real WhatsApp messaging |
| `WEBHOOK_SECRET` | API | — | HMAC secret for inbound webhook verification |
| `CALENDAR_ENCRYPTION_KEY` | API | — | Encrypts OAuth tokens at rest. Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `GOOGLE_CLIENT_ID` | API | — | Google Calendar OAuth |
| `GOOGLE_CLIENT_SECRET` | API | — | Google Calendar OAuth |
| `MICROSOFT_CLIENT_ID` | API | — | Outlook Calendar OAuth |
| `MICROSOFT_CLIENT_SECRET` | API | — | Outlook Calendar OAuth |
| `SENTRY_DSN` | API + Web | — | Error tracking |
| `LOG_LEVEL` | API | `info` | Pino log level: trace, debug, info, warn, error, fatal |

### Build-Time vs Runtime

| Variable | When Needed | Notes |
|----------|-------------|-------|
| `NEXT_PUBLIC_API_URL` | **Build time** | Baked into the Next.js static bundle. Changing it requires a rebuild |
| `NEXT_PUBLIC_WS_URL` | **Build time** | Same as above |
| All others | **Runtime** | Can be changed by restarting the service |

---

## 3. Railway Deployment (Current Production)

### Current Setup

| Property | Value |
|----------|-------|
| Project ID | `37eeca20-7dfe-45d9-8d29-e902a545f475` |
| Environment | `production` |
| Services | `api`, `web`, `postgres`, `redis` |
| API domain | `api.businesscommandcentre.com` |
| Web domain | `businesscommandcentre.com` |
| CORS_ORIGINS | `https://businesscommandcentre.com,https://www.businesscommandcentre.com` |

### How Deployment Works

1. Push to `main` triggers GitHub Actions CI (`.github/workflows/ci.yml`)
2. CI runs: lint → test → Docker build validation → deploy
3. Deploy step runs `railway up --service <name> --detach`
4. Railway receives the source code, builds Docker images using the Dockerfiles, and deploys

**Important: `--detach` behavior.** The CI deploy step returns immediately. Railway builds and deploys asynchronously. A green CI does NOT mean the new code is live — Railway's build may take 2-5 minutes after CI completes. Check Railway dashboard or logs to confirm deployment finished.

### Railway Environment Variables

All env vars are set in the Railway dashboard (not via `.env` files). To update:
1. Go to Railway → booking-os project → select service (api or web)
2. Click "Variables" tab
3. Add or update the variable
4. Railway will automatically redeploy the service

### Checking Deployment Status

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login (first time only)
railway login

# Link to project
railway link -p 37eeca20-7dfe-45d9-8d29-e902a545f475 -e production

# View recent logs for the API
railway logs --service api --lines 50

# View recent logs for the web app
railway logs --service web --lines 50
```

Or check the Railway dashboard at https://railway.app for build status and logs.

### Custom Domains & DNS (Cloudflare)

DNS is managed via **Cloudflare** (free plan) with CNAME flattening for the root domain. Railway handles SSL via Let's Encrypt — all Cloudflare DNS records use **DNS only** (grey cloud) mode except `www` which is Proxied for redirect handling.

**Cloudflare Nameservers:** `cash.ns.cloudflare.com`, `lina.ns.cloudflare.com`

**DNS Records:**

| Type | Name | Target | Proxy Status |
|------|------|--------|-------------|
| CNAME | `@` (root) | `uqwnhuyx.up.railway.app` | DNS only |
| CNAME | `api` | `cosm54wn.up.railway.app` | DNS only |
| CNAME | `www` | `businesscommandcentre.com` | Proxied |
| TXT | `_railway-verify` | `railway-verify=870b2ea...` | DNS only |
| TXT | `_railway-verify.api` | `railway-verify=642c0135...` | DNS only |
| TXT | `_dmarc` | `v=DMARC1; p=quarantine...` | DNS only |

**Cloudflare Redirect Rule:** `www` → root (301). Configured via Rules → Redirect Rules using the "Redirect from WWW to root" template.

**Why Cloudflare?** Root/apex domains can't have CNAME records per DNS spec. Cloudflare provides CNAME flattening, which resolves the CNAME to an A record at the edge. GoDaddy (the registrar) doesn't support this, so nameservers were moved to Cloudflare.

**Critical:** Keep all Railway-pointing records as **DNS only** (grey cloud). If you enable Cloudflare's proxy (orange cloud) on `@` or `api`, it will conflict with Railway's SSL certificates.

### Railway GitHub Secret

| Secret | Purpose | How to Refresh |
|--------|---------|----------------|
| `RAILWAY_TOKEN` | Project deploy token (NOT account token) | Railway → Project Settings → Tokens → Create → then `gh secret set RAILWAY_TOKEN` |

---

## 4. Self-Hosted Docker Deployment

For deploying on a VPS/server using Docker Compose with Nginx and SSL.

### Prerequisites

- Docker 24+ and Docker Compose v2
- Domain with DNS A record pointing to your server IP
- Open ports: 80 (HTTP), 443 (HTTPS)

### Steps

```bash
# 1. Clone the repo
git clone https://github.com/your-org/booking-os.git
cd booking-os

# 2. Create .env from production template
cp .env.production .env
# Edit .env — replace all CHANGE_ME values

# 3. Generate secrets
node -e "console.log('JWT_SECRET=' + require('crypto').randomBytes(64).toString('hex'))"
node -e "console.log('JWT_REFRESH_SECRET=' + require('crypto').randomBytes(64).toString('hex'))"
node -e "console.log('WEBHOOK_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"

# 4. Set up SSL certificates (Let's Encrypt)
mkdir -p nginx/ssl certbot/webroot
# Use certbot or your preferred method to get certs
# Place fullchain.pem and privkey.pem in nginx/ssl/

# 5. Update CORS_ORIGINS in .env to match your domain
# CORS_ORIGINS="https://yourdomain.com"

# 6. Build and start
docker compose -f docker-compose.prod.yml up -d

# 7. Watch logs
docker compose -f docker-compose.prod.yml logs -f
```

### Nginx Configuration

The included `nginx/nginx.conf` handles:
- HTTP → HTTPS redirect
- SSL termination (TLS 1.2 + 1.3)
- Reverse proxy: `/api` → API service, `/socket.io` → API WebSocket, all else → Web
- Security headers (HSTS, X-Frame-Options, etc.)
- Gzip compression
- Static asset caching (`/_next/static` → 365 day cache)
- ACME challenge for Let's Encrypt renewal

### Updating a Self-Hosted Deployment

```bash
git pull origin main
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d
```

Database migrations run automatically on API container startup via `scripts/docker-entrypoint.sh`.

---

## 5. Local Demo Quick Start

Spins up a complete instance with rich demo data, no configuration needed.

```bash
# Start everything (PostgreSQL, Redis, API, Web)
docker compose -f docker-compose.demo.yml up -d

# Watch logs — API will run migrations and seed automatically
docker compose -f docker-compose.demo.yml logs -f
```

**Demo URLs:**
- Web UI: http://localhost:3000
- API: http://localhost:3001

**Demo Credentials:**

| Business | Email | Password | Role |
|----------|-------|----------|------|
| Glow Aesthetic Clinic | sarah@glowclinic.com | password123 | Admin |
| Metro Auto Group | mike@metroauto.com | password123 | Admin |

**Reseed manually:**
```bash
docker compose -f docker-compose.demo.yml exec api npx tsx packages/db/src/seed.ts
docker compose -f docker-compose.demo.yml exec api npx tsx packages/db/src/seed-demo.ts
```

**Stop and clean up:**
```bash
docker compose -f docker-compose.demo.yml down      # Stop (keep data)
docker compose -f docker-compose.demo.yml down -v    # Stop and delete all data
```

---

## 6. Authentication & Cookie Configuration

This is the most critical section for production. Getting cookie configuration wrong will cause login to silently fail.

### How Authentication Works

```
1. Browser → POST /api/v1/auth/login  (email + password)
2. API validates credentials, returns JSON with accessToken + refreshToken
3. API also sets TWO httpOnly cookies on the response:
   - access_token  (15 min TTL)
   - refresh_token (7 day TTL)
4. Browser stores cookies automatically
5. All subsequent API requests include cookies (credentials: 'include')
6. Next.js middleware checks for access_token cookie on protected routes
   - If missing → 307 redirect to /login
   - If present → allow through
7. When access_token expires (401 from API):
   - Frontend API client auto-calls POST /auth/refresh (uses refresh_token cookie)
   - If refresh succeeds → new cookies set, original request retried transparently
   - If refresh fails → redirect to /login
```

### Cookie Properties (Production)

| Property | access_token | refresh_token |
|----------|-------------|---------------|
| `httpOnly` | true | true |
| `secure` | true (HTTPS only) | true |
| `sameSite` | lax | lax |
| `path` | `/` | `/` |
| `domain` | `.yourdomain.com` | `.yourdomain.com` |
| `maxAge` | 15 minutes | 7 days |

### How Cookie Domain Is Derived

The API automatically extracts the cookie domain from `CORS_ORIGINS`:

```
CORS_ORIGINS="https://businesscommandcentre.com"
                            │
                            ▼
              hostname: businesscommandcentre.com
                            │
                            ▼
              cookie domain: .businesscommandcentre.com
```

The leading dot means the cookie is shared across ALL subdomains — this is required because the API and web app may live on different subdomains.

### Critical Rules for Cookie Auth

**Rule 1: Cookie domain MUST cover both API and Web domains.**

If your setup is:
- API: `api.example.com`
- Web: `example.com` or `app.example.com`

Then cookie domain must be `.example.com` (covers both). This is derived from `CORS_ORIGINS` automatically.

**If the API and Web are on completely different domains** (e.g., `api-foo.railway.app` and `web-bar.railway.app`), cookie sharing is IMPOSSIBLE. You must use custom domains on the same root domain.

**Rule 2: `sameSite` must be `lax`, not `strict`.**

`strict` blocks cookies on navigations that originate from a different site. Since the API sets cookies and the web app reads them, `lax` is required. The code handles this automatically in production.

**Rule 3: `secure: true` requires HTTPS.**

In production (`NODE_ENV=production`), cookies are marked `Secure`, meaning they're only sent over HTTPS. Both your API and web domains MUST have valid SSL.

**Rule 4: `CORS_ORIGINS` must include the exact web frontend origin.**

The API validates the `Origin` header against `CORS_ORIGINS`. If it doesn't match, the browser blocks the response (including Set-Cookie). Common mistake: setting `CORS_ORIGINS=https://www.example.com` but loading the site at `https://example.com` (no www).

Include both: `CORS_ORIGINS="https://example.com,https://www.example.com"`

**Rule 5: `credentials: 'include'` is set on all frontend fetch requests.**

The web app's API client (`apps/web/src/lib/api.ts`) already does this. If you modify the client, ensure `credentials: 'include'` is always set, otherwise cookies won't be sent.

### Domain Configuration Examples

**Subdomain setup (recommended):**
```
Web:  example.com
API:  api.example.com
CORS_ORIGINS=https://example.com,https://www.example.com
Cookie domain: .example.com  (auto-derived)
NEXT_PUBLIC_API_URL=https://api.example.com/api/v1
```

**Same domain with Nginx routing:**
```
Web:  example.com
API:  example.com/api  (Nginx proxies to API)
CORS_ORIGINS=https://example.com
Cookie domain: .example.com  (auto-derived)
NEXT_PUBLIC_API_URL=https://example.com/api/v1
```

**Railway with custom domains:**
```
Web service:  example.com  (custom domain in Railway)
API service:  api.example.com  (custom domain in Railway)
CORS_ORIGINS=https://example.com,https://www.example.com
Cookie domain: .example.com  (auto-derived)
NEXT_PUBLIC_API_URL=https://api.example.com/api/v1
```

### Next.js Middleware (Route Protection)

File: `apps/web/src/middleware.ts`

The middleware runs on every request (except `_next/static`, `_next/image`, `favicon.ico`, and `/api`). It checks for the `access_token` cookie:

**Public routes (no cookie required):**
- `/login`, `/signup`, `/reset-password`, `/accept-invite`, `/verify-email`
- `/book` (public booking portal)
- `/manage` (customer self-serve)
- `/claim` (claim reservation)
- `/` (home page)

**All other routes:** Require `access_token` cookie. If missing, redirect to `/login`.

### Diagnosing Login Issues

If login appears to succeed (200 from API) but the user gets redirected back to `/login`:

```bash
# 1. Check cookies are set with correct Domain
curl -s -D - -o /dev/null -X POST https://api.yourdomain.com/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"pass"}' 2>&1 | grep -i set-cookie

# Look for:
#   Domain=.yourdomain.com  ← MUST be present
#   SameSite=Lax            ← NOT Strict
#   Secure                  ← MUST be present for HTTPS
#   Path=/                  ← MUST be / for both cookies

# 2. Test full flow: login → use cookies → hit web
curl -s -c /tmp/test-cookies.txt -X POST https://api.yourdomain.com/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"pass"}'

curl -s -D - -o /dev/null -b /tmp/test-cookies.txt https://yourdomain.com/dashboard 2>&1 | head -5
# Should return 200, NOT 307

# 3. Check CORS_ORIGINS matches
railway variables --service api | grep CORS
# Must include the exact domain the browser loads (with https://)
```

---

## 7. CI/CD Pipeline

Defined in `.github/workflows/ci.yml`.

### Pipeline Flow

```
Push to main ──► lint-and-test ──► docker-build ──► deploy
                                                    (main only)
Pull request ──► lint-and-test ──► docker-build
                                   (no deploy)
```

### Job Details

**1. lint-and-test** (~2 min)
- Spins up PostgreSQL 16 service container
- Runs: `npm ci` → Prisma generate → Prisma migrate → format check → lint → test

**2. docker-build** (~2 min)
- Builds both Docker images using `docker-compose.prod.yml`
- Uses dummy env vars (secrets not needed at build time, only at runtime)

**3. deploy** (~10 sec + async Railway build)
- Installs Railway CLI
- Runs `railway up --service api --detach` and `railway up --service web --detach`
- **Detach means CI finishes before Railway is done building.** The actual deploy takes 2-5 more minutes on Railway.

### Manual Deploy Trigger

```bash
gh workflow run ci.yml
```

### Important: Build-Time Variables

`NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_WS_URL` are **baked into the Next.js build**. They are set as Docker build args in `apps/web/Dockerfile`:

```dockerfile
ARG NEXT_PUBLIC_API_URL=https://api.businesscommandcentre.com/api/v1
ARG NEXT_PUBLIC_WS_URL=https://api.businesscommandcentre.com
```

If you change your API domain, you MUST either:
1. Update the Dockerfile defaults and redeploy, OR
2. Pass the new values as Railway build args

---

## 8. Database Operations

### Migrations

Migrations run automatically on every API container startup via `scripts/docker-entrypoint.sh`:

```sh
npx prisma migrate deploy --schema=packages/db/prisma/schema.prisma
```

This is idempotent — already-applied migrations are skipped.

### Manual Migration (Railway)

```bash
# Using Railway's public database URL
DATABASE_URL="postgresql://postgres:<password>@<host>:<port>/railway" \
  npx prisma migrate deploy --schema=packages/db/prisma/schema.prisma
```

Find the public database URL in Railway → postgres service → Variables → `DATABASE_PUBLIC_URL`.

### Seeding Production

```bash
# Seed base data (Glow Aesthetic Clinic)
DATABASE_URL="<public-db-url>" npx tsx packages/db/src/seed.ts

# Seed rich demo data (both verticals)
DATABASE_URL="<public-db-url>" npx tsx packages/db/src/seed-demo.ts
```

Both scripts are idempotent — they check for existing data before inserting.

**One-time agentic data fill** (only needed if seed-demo.ts was run before agentic tables existed):
```bash
# Compile and run via Railway SSH
npx tsc --esModuleInterop --module commonjs --target ES2020 --outDir /tmp/seed-agentic packages/db/src/seed-agentic.ts
B64=$(base64 -i /tmp/seed-agentic/seed-agentic.js)
npx @railway/cli ssh --service api -e production -- "echo '$B64' | base64 -d > /app/seed-agentic.js && cd /app && node seed-agentic.js"
```
This script fills autonomyConfig, actionHistory, outboundDraft, and agentConfig tables. It's idempotent (skips tables that already have data).

### Database Backups

```bash
# Manual backup
pg_dump "$DATABASE_URL" > backup-$(date +%Y%m%d-%H%M%S).sql

# Restore
psql "$DATABASE_URL" < backup-file.sql
```

### Prisma Studio (Database GUI)

```bash
# Local
npx prisma studio --schema=packages/db/prisma/schema.prisma

# Against production (use public URL)
DATABASE_URL="<public-db-url>" npx prisma studio --schema=packages/db/prisma/schema.prisma
```

---

## 9. Monitoring & Health Checks

### Graceful Shutdown & Zero-Downtime Deploys

The API uses NestJS's `enableShutdownHooks()` in `main.ts` to handle `SIGTERM` gracefully — in-flight requests complete before the process exits. Railway sends `SIGTERM` during deploys, so this ensures no dropped connections.

**Railway health checks** are configured in `railway.toml`:
```toml
[deploy.healthcheckPath]
path = "/api/v1/health"
```
Railway waits for the new container to pass its health check before routing traffic to it, providing zero-downtime deploys.

**Frontend resilience:** The web app's API client (`apps/web/src/lib/api.ts`) includes `fetchWithRetry` logic — if a fetch fails during a deploy window, it retries with exponential backoff. This prevents transient errors during the brief overlap between old and new containers.

### Health Endpoint

```
GET /api/v1/health
```

Returns:
```json
{
  "status": "healthy",
  "uptime": 3600,
  "version": "0.1.0",
  "checks": {
    "database": { "status": "ok", "latencyMs": 15 },
    "redis": { "status": "ok", "latencyMs": 8 }
  },
  "memory": { "rss": "128 MB" },
  "timestamp": "2026-02-17T12:00:00.000Z"
}
```

### Docker Health Checks (Self-Hosted)

| Service | Check | Interval |
|---------|-------|----------|
| PostgreSQL | `pg_isready` | 5s |
| Redis | `redis-cli ping` | 5s |
| API | `wget -qO- http://localhost:3001/api/v1/health` | 30s |

### Logging

**Framework:** Pino (via `nestjs-pino`)

- Log level controlled by `LOG_LEVEL` env var (default: `info`)
- Auth headers and cookies are automatically redacted from logs
- Docker logging: json-file driver, max 10MB per file, 3 files retained

**View Railway logs:**
```bash
railway logs --service api --lines 100
railway logs --service web --lines 100
```

**View Docker logs (self-hosted):**
```bash
docker compose -f docker-compose.prod.yml logs -f api
docker compose -f docker-compose.prod.yml logs -f web
```

### Sentry Error Tracking

Set `SENTRY_DSN` (and optionally `NEXT_PUBLIC_SENTRY_DSN` for frontend) to enable automatic error capture.

- Production trace sample rate: 20%
- Development trace sample rate: 100%

---

## 10. Troubleshooting

### Login works (200) but user gets redirected to /login

**Root cause:** Next.js middleware can't see the `access_token` cookie.

**Check:**
1. Cookie `Domain` must cover both API and Web domains (see section 6)
2. `SameSite` must be `Lax`, not `Strict`
3. `CORS_ORIGINS` must include the exact frontend origin (with `https://`)
4. Both domains must have valid SSL (cookies are `Secure` in production)

```bash
curl -s -D - -o /dev/null -X POST https://api.yourdomain.com/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"pass"}' 2>&1 | grep -i "set-cookie"
```

### /auth/me returns stale data (wrong user)

**Root cause:** HTTP caching (ETag / 304 responses).

**Already fixed:** The `/auth/me` endpoint sets `Cache-Control: no-store` and removes the ETag header. If you see this issue, confirm the latest API code is deployed.

### Deploy passed in CI but old code is still running

**Root cause:** `railway up --detach` returns immediately. Railway builds asynchronously.

**Fix:** Wait 2-5 minutes after CI completes, then verify:
```bash
# Check Railway deployment status in dashboard, or:
curl -s https://api.yourdomain.com/api/v1/health | python3 -m json.tool
```

### Railway deploy fails with "Unauthorized"

**Fix:** Regenerate the Railway project token:
1. Railway → Project Settings → Tokens → Create new token
2. `gh secret set RAILWAY_TOKEN` and paste the new token

### Formatting check fails in CI

```bash
npm run format        # Auto-fix all files
git add -A && git commit -m "fix: formatting"
```

### Docker build fails with Next.js prerender error

A page uses client-side hooks (e.g., `useSearchParams`) without a Suspense boundary. Wrap the component:
```tsx
<Suspense fallback={null}>
  <ComponentUsingSearchParams />
</Suspense>
```

### API crashes on startup

Check logs for the specific error:
```bash
railway logs --service api --lines 100
```

Common causes:
- Missing required env var (JWT_SECRET, DATABASE_URL)
- Database unreachable (check DATABASE_URL, network)
- Prisma migration failed (schema drift — run `npx prisma migrate deploy` manually)

### "Table does not exist" errors after adding new Prisma models

**Root cause:** Models were added during development via `prisma db push` instead of `prisma migrate dev`. `db push` updates the database directly but does NOT create migration files. Production runs `prisma migrate deploy`, which only applies migration files.

**Fix:**
1. Create a migration file manually: `packages/db/prisma/migrations/<timestamp>_<name>/migration.sql`
2. Write the CREATE TABLE, indexes, and foreign key SQL
3. Mark as already applied locally: `npx prisma migrate resolve --applied <timestamp>_<name>`
4. Commit and push — production will apply the migration on next deploy

### "Failed to fetch" or API calls blocked by CSP

**Root cause:** The `connect-src` CSP directive includes a URL path (e.g., `https://api.example.com/api/v1`). Per the CSP spec, a path without trailing slash requires an **exact** URL match — sub-paths like `/api/v1/auth/login` are blocked.

**Fix:** CSP `connect-src` must use the **origin only** (no path): `https://api.example.com`. This is handled in `apps/web/next.config.js` using `new URL(apiUrl).origin`. If you modify the CSP configuration, never add a path to `connect-src`.

### "Failed to load dashboard" (or other pages) after inactivity

**Root cause:** The `access_token` has a 15-minute TTL. If the frontend doesn't refresh it, all API calls return 401 after 15 minutes.

**Already fixed:** The frontend API client (`apps/web/src/lib/api.ts`) automatically calls `POST /auth/refresh` on 401 responses, using the httpOnly `refresh_token` cookie (7-day TTL). Sessions survive for up to 7 days. If this error recurs, check that the refresh logic hasn't been removed and that the refresh endpoint is working:

```bash
# Login to get cookies, then test refresh
curl -s -c /tmp/test.txt -X POST https://api.yourdomain.com/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"pass"}' > /dev/null
curl -s -b /tmp/test.txt -X POST https://api.yourdomain.com/api/v1/auth/refresh
# Should return {"accessToken":"...","refreshToken":"..."}
```

### CORS errors in browser console

Verify `CORS_ORIGINS` includes the exact origin the browser is on:
```bash
# Check current value
railway variables --service api | grep CORS
```

The origin must match exactly — `https://example.com` is different from `https://www.example.com`.

### WebSocket connection fails

Ensure `NEXT_PUBLIC_WS_URL` points to the API service (not the web service). On Railway with custom domains, this should be `https://api.yourdomain.com`.

---

## 11. Security Checklist

Before going live, verify:

- [ ] `JWT_SECRET` and `JWT_REFRESH_SECRET` are strong random values (64+ chars), NOT the defaults
- [ ] `NODE_ENV=production` is set on the API service
- [ ] `CORS_ORIGINS` is set to your actual domain(s), not `localhost`
- [ ] Both API and Web have valid SSL certificates
- [ ] Default seed passwords (`password123`) are changed for real users
- [ ] Swagger docs are disabled (automatic when `NODE_ENV=production`)
- [ ] `WEBHOOK_SECRET` is set if using inbound webhooks
- [ ] Database is not publicly accessible (use Railway internal URL, not public URL)
- [ ] Rate limiting is active (built-in: 100 req/min global, 3/min signup, 10/min login)
- [ ] Sentry DSN is configured for error alerting
- [ ] Database backups are scheduled
- [ ] Token-based flows (reset password, accept invite, verify email) use atomic `validateAndConsume` (no race conditions)
- [ ] All password DTO fields have `@MaxLength(128)` (bcrypt DoS prevention)
- [ ] `forceBook` on booking creation is restricted to ADMIN role only
- [ ] Content-Disposition filenames are sanitized (no header injection)
- [ ] Refresh tokens are blacklisted on logout and password change

### Rate Limits (Built-In)

| Endpoint | Limit |
|----------|-------|
| Global | 100 requests / minute |
| POST /auth/signup | 3 / minute |
| POST /auth/login | 10 / minute |
| POST /auth/forgot-password | 3 / minute |
| POST /auth/reset-password | 5 / minute |
| POST /auth/resend-verification | 3 / minute |

### Password Hashing

Bcrypt with 12 salt rounds. Passwords are never stored or logged in plaintext.

---

## Appendix: Key File Paths

| File | Purpose |
|------|---------|
| `.github/workflows/ci.yml` | CI/CD pipeline definition |
| `docker-compose.prod.yml` | Production Docker stack (self-hosted) |
| `docker-compose.demo.yml` | Demo quick-start stack |
| `apps/api/Dockerfile` | API production image (multi-stage) |
| `apps/web/Dockerfile` | Web production image (multi-stage) |
| `scripts/docker-entrypoint.sh` | API startup: migrations then server |
| `nginx/nginx.conf` | Nginx reverse proxy config |
| `apps/api/src/main.ts` | API bootstrap (CORS, cookies, Helmet, Swagger) |
| `apps/api/src/modules/auth/auth.controller.ts` | Cookie configuration (domain, sameSite, secure) |
| `apps/web/src/middleware.ts` | Next.js route protection (checks access_token cookie) |
| `apps/web/src/lib/api.ts` | Frontend API client (credentials: include) |
| `packages/db/prisma/schema.prisma` | Database schema |
| `packages/db/src/seed.ts` | Base seed script |
| `packages/db/src/seed-demo.ts` | Rich demo data seed |
| `.env.example` | Environment variable template |
| `.env.production` | Production env template |
