# CI/CD Pipeline

Booking OS uses GitHub Actions for continuous integration and Railway for production deployment. Every push to `main` triggers the full pipeline: lint, test, build, and deploy.

## Pipeline Overview

```
Push to main ──► lint-and-test ──► docker-build ──► deploy ──► smoke-test
                                                   (main only)
Pull request ──► lint-and-test ──► docker-build
                               └──► e2e-test (Playwright)
```

The workflow is defined in [`.github/workflows/ci.yml`](../.github/workflows/ci.yml).

### Triggers

| Trigger                      | Runs                                               |
| ---------------------------- | -------------------------------------------------- |
| Push to `main`               | lint-and-test → docker-build → deploy → smoke-test |
| Pull request to `main`       | lint-and-test → docker-build + e2e-test            |
| Manual (`workflow_dispatch`) | lint-and-test → docker-build → deploy → smoke-test |

---

## Job 1: lint-and-test

**Runner:** `ubuntu-latest`
**Duration:** ~2 minutes

Spins up a PostgreSQL 16 service container and runs the full quality gate.

### Service containers

| Service    | Image                | Port | Database          |
| ---------- | -------------------- | ---- | ----------------- |
| PostgreSQL | `postgres:16-alpine` | 5432 | `booking_os_test` |

### Environment variables

| Variable             | Value                                                                         |
| -------------------- | ----------------------------------------------------------------------------- |
| `DATABASE_URL`       | `postgresql://postgres:postgres@localhost:5432/booking_os_test?schema=public` |
| `JWT_SECRET`         | `test-secret-for-ci-only`                                                     |
| `JWT_REFRESH_SECRET` | `test-refresh-secret-for-ci-only`                                             |
| `NODE_ENV`           | `test`                                                                        |

### Steps

1. **Checkout** — `actions/checkout@v4`
2. **Setup Node** — Node 20 with npm cache
3. **Install dependencies** — `npm ci`
4. **Generate Prisma client** — `npx prisma generate --schema=packages/db/prisma/schema.prisma`
5. **Run database migrations** — `npx prisma migrate deploy --schema=packages/db/prisma/schema.prisma`
6. **Check formatting** — `npm run format:check` (Prettier)
7. **Lint** — `npm run lint` (ESLint + TypeScript type-checking via Turborepo)
8. **Run tests** — `npm test` (Jest unit + integration tests via Turborepo)

---

## Job 2: e2e-test (Pull Requests Only)

**Runner:** `ubuntu-latest`
**Depends on:** `lint-and-test`
**Condition:** Only runs on pull requests
**Duration:** ~3-5 minutes

Runs Playwright E2E tests against a local development server with seeded test data.

### What it does

1. Sets up PostgreSQL 16, installs dependencies, generates Prisma client
2. Runs database migrations and seeds test data
3. Installs Playwright Chromium browser
4. Runs `npm run test:e2e` in `apps/web` (starts API + web dev servers, runs Playwright)
5. Uploads Playwright HTML report as artifact (7-day retention)

### Test suites

| Suite                    | Tests                                                         | Coverage      |
| ------------------------ | ------------------------------------------------------------- | ------------- |
| `auth.spec.ts`           | Login, invalid credentials, forgot password, logout           | Auth flows    |
| `booking-flow.spec.ts`   | Page load, new booking modal, status filters, table structure | Booking CRUD  |
| `customer-flow.spec.ts`  | Page load, new customer form, search, column rendering        | Customer CRUD |
| `portal-booking.spec.ts` | Portal load, business info, no-auth access, sub-pages         | Public portal |
| `settings.spec.ts`       | Page load, business name edit, save button, sub-page nav      | Settings      |
| `accessibility.spec.ts`  | WCAG 2.1 AA compliance via axe-core on 11 pages               | Accessibility |

### Environment variables

| Variable       | Value                  |
| -------------- | ---------------------- |
| `E2E_EMAIL`    | `sarah@glowclinic.com` |
| `E2E_PASSWORD` | `password123`          |

---

## Job 3: docker-build

**Runner:** `ubuntu-latest`
**Depends on:** `lint-and-test`
**Duration:** ~2 minutes

Validates that all Docker images (API, web, admin) build successfully using the production Docker Compose file.

### What it does

```bash
docker compose -f docker-compose.prod.yml build
```

This builds three images:

#### API image (`apps/api/Dockerfile`)

Multi-stage build:

1. **deps** — Installs npm dependencies
2. **builder** — Generates Prisma client, builds shared packages (`@booking-os/shared`, `@booking-os/db`, `@booking-os/messaging-provider`), then builds the API (`@booking-os/api`)
3. **runner** — Production image with non-root `nestjs` user, copies only built artifacts and Prisma schema. Runs `docker-entrypoint.sh` which executes migrations then starts the API

#### Web image (`apps/web/Dockerfile`)

Multi-stage build:

1. **deps** — Installs npm dependencies
2. **builder** — Builds shared package, then Next.js app with standalone output
3. **runner** — Production image with non-root `nextjs` user, runs `node apps/web/server.js`

#### Admin image (`apps/admin/Dockerfile`)

Multi-stage build:

1. **deps** — Installs npm dependencies
2. **builder** — Builds shared package, then Next.js admin app with standalone output
3. **runner** — Production image with non-root `nextjs` user, runs `node apps/admin/server.js` on port 3002

### Dummy environment variables

The build step passes dummy values for required env vars (JWT secrets, API keys, etc.) since they're only needed at runtime, not build time. Actual production values are configured in Railway.

---

## Job 4: deploy (staged)

**Runner:** `ubuntu-latest`
**Depends on:** `docker-build`
**Condition:** Only runs on pushes to `main` (not on pull requests)
**Duration:** ~5-15 minutes (includes health polling per service)

### What it does

Deploys services **sequentially** with health checks between each stage. If any service fails its health check, the pipeline stops — preventing broken cascading deploys.

1. Installs the Railway CLI (`npm install -g @railway/cli`)
2. **Stage 1:** Deploy API → poll `api.businesscommandcentre.com/api/v1/health` every 5s (5-min timeout). Verifies HTTP 200 AND JSON `.status` is `healthy` or `degraded`.
3. **Stage 2:** Deploy Web → poll `businesscommandcentre.com/api/v1/health` every 5s (5-min timeout). Verifies HTTP 200.
4. **Stage 3:** Deploy Admin → poll `admin.businesscommandcentre.com/api/v1/health` every 5s (5-min timeout). Verifies HTTP 200.

Each `railway up` uses `--detach` so Railway receives the code and builds asynchronously. The health polling waits for the new version to go live before proceeding.

### Railway project

| Property     | Value                                      |
| ------------ | ------------------------------------------ |
| Project ID   | `37eeca20-7dfe-45d9-8d29-e902a545f475`     |
| Environment  | `production`                               |
| Services     | `api`, `web`, `admin`, `postgres`, `redis` |
| API domain   | `api.businesscommandcentre.com`            |
| Web domain   | `businesscommandcentre.com`                |
| Admin domain | `admin.businesscommandcentre.com`          |

### Database migrations

Migrations are **not** run as a separate CI step. Instead, the API's `docker-entrypoint.sh` runs `npx prisma migrate deploy` on every container startup, before the NestJS server starts. This ensures migrations always run in the production environment with the real database.

```sh
#!/bin/sh
set -e
echo "Running database migrations..."
npx prisma migrate deploy --schema=packages/db/prisma/schema.prisma
echo "Starting API server..."
exec node dist/apps/api/src/main
```

---

## Job 5: bundle-check

**Runner:** `ubuntu-latest`
**Depends on:** `lint-and-test`
**Condition:** Runs on every push and PR (parallel with `docker-build`, does not block deploy)

### What it does

Builds the web app natively and reports the `.next/` bundle size to GitHub step summary. Fails the job if the bundle exceeds 60MB.

1. `npm ci` + Prisma generate + web-chat widget build
2. `npx turbo run build --filter=web` with production `NEXT_PUBLIC_*` env vars
3. Measures `du -sb apps/web/.next/` and posts a markdown table to `$GITHUB_STEP_SUMMARY`
4. Fails if size > 62,914,560 bytes (60MB)

---

## Job 6: smoke-test

**Runner:** `ubuntu-latest`
**Depends on:** `deploy`
**Condition:** Only runs on pushes to `main` (not on pull requests)
**Duration:** ~30 seconds (health checks already done in deploy job)

### What it does

Runs `scripts/smoke-test.sh` against production. Since the deploy job already verified all three services are healthy, the smoke test focuses on functional verification. The script performs 24 checks across 9 categories:

1. **Health & Infrastructure** — API health endpoint, database connectivity, Redis status
2. **Web Application** — Homepage, Next.js health route
3. **API Auth** — Verifies `/auth/me`, `/bookings`, `/customers`, `/services`, `/portal/me` return 401 without token
4. **Core API Endpoints** — Login and portal OTP endpoints accept/reject requests correctly
5. **Public Endpoints** — Testimonials public route exists
6. **Security Headers** — HSTS, X-Frame-Options, no server framework leak
7. **Cookie Security** — HttpOnly, SameSite=Lax on auth cookies
8. **CORS** — Access-Control headers present
9. **Admin Console** — Admin app health endpoint

```bash
./scripts/smoke-test.sh https://businesscommandcentre.com
```

If any check fails, the job exits with code 1 and the pipeline is marked as failed.

---

## GitHub Secrets

| Secret          | Purpose                      | How to update                 |
| --------------- | ---------------------------- | ----------------------------- |
| `RAILWAY_TOKEN` | Railway project deploy token | `gh secret set RAILWAY_TOKEN` |

The Railway token must be a **Project Token** (created from Railway → Project Settings → Tokens), not an Account Token. It must be scoped to the `production` environment.

---

## Production Architecture (Railway)

```
                      ┌──────────────┐
                      │   Railway    │
                      │   Project    │
                      └──────┬───────┘
                             │
         ┌──────────┬────────┼────────┬──────────┐
         │          │        │        │          │
  ┌──────▼──────┐ ┌─▼──────┐│ ┌──────▼───────┐ ┌▼────────┐
  │     web     │ │ admin  │ │ │   postgres   │ │  redis  │
  │  (Next.js)  │ │(Next.js)│ │ │  (Postgres   │ │ (Redis  │
  │  port 3000  │ │port 3002│ │ │   16-alpine) │ │7-alpine)│
  └─────────────┘ └────────┘ │ └──────────────┘ └─────────┘
                        ┌─────▼─────┐
                        │    api    │
                        │  (Nest)   │
                        │ port 3001 │
                        └───────────┘
```

---

## Production Docker Compose

The `docker-compose.prod.yml` file defines the full production stack for self-hosting. Railway uses the individual Dockerfiles directly, but the compose file is used in CI to validate builds and is available for VPS deployment.

### Services

| Service    | Image/Build             | Port   | Health check                                    |
| ---------- | ----------------------- | ------ | ----------------------------------------------- |
| `postgres` | `postgres:16-alpine`    | 5432   | `pg_isready`                                    |
| `redis`    | `redis:7-alpine`        | 6379   | `redis-cli ping`                                |
| `api`      | `apps/api/Dockerfile`   | 3001   | `wget -qO- http://localhost:3001/api/v1/health` |
| `web`      | `apps/web/Dockerfile`   | 3000   | —                                               |
| `admin`    | `apps/admin/Dockerfile` | 3002   | `wget -qO- http://localhost:3002`               |
| `nginx`    | `nginx:alpine`          | 80/443 | —                                               |

### Volumes

- `postgres_data` — Persistent PostgreSQL data
- `redis_data` — Persistent Redis data

---

## Running the Pipeline Locally

### Format check

```bash
npm run format:check
```

### Lint + type-check

```bash
npm run lint
```

### Tests

```bash
npm test
```

### E2E tests (Playwright)

```bash
cd apps/web && npm run test:e2e
```

### Docker build

```bash
docker compose -f docker-compose.prod.yml build
```

### Production smoke test

```bash
./scripts/smoke-test.sh https://businesscommandcentre.com
```

### Manual deploy trigger

```bash
gh workflow run ci.yml
```

---

## Troubleshooting

### Deploy fails with "Unauthorized"

The `RAILWAY_TOKEN` is invalid or expired. Generate a new **Project Token** from Railway → booking-os project → Settings → Tokens, then update:

```bash
gh secret set RAILWAY_TOKEN
```

### API crashes on startup

Check Railway logs:

```bash
npx @railway/cli logs --service api --environment production --latest --lines 50
```

Common causes: missing environment variables in Railway, database connection issues, or missing module imports.

### Formatting check fails

Run Prettier to auto-fix:

```bash
npm run format
```

Then commit the changes.

### Docker build fails with prerender errors

Usually a Next.js page using client-side hooks (e.g., `useSearchParams`) without a `Suspense` boundary. Wrap the component in `<Suspense fallback={null}>`.

### "Table does not exist" errors after deploying new models

If new Prisma models were added during development using `prisma db push` instead of `prisma migrate dev`, no migration file exists. Production runs `prisma migrate deploy` which only applies migration files. Create the migration SQL manually, mark it as applied locally with `prisma migrate resolve --applied`, and push. See `DEPLOY.md` troubleshooting for details.
