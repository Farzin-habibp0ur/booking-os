# CI/CD Pipeline

Booking OS uses GitHub Actions for continuous integration and Railway for production deployment. Every push to `main` triggers the full pipeline: lint, test, build, and deploy.

## Pipeline Overview

```
Push to main ──► lint-and-test ──► docker-build ──► deploy
                                                    (main only)
Pull request ──► lint-and-test ──► docker-build
                                   (no deploy)
```

The workflow is defined in [`.github/workflows/ci.yml`](../.github/workflows/ci.yml).

### Triggers

| Trigger              | Runs                            |
| -------------------- | ------------------------------- |
| Push to `main`       | lint-and-test → docker-build → deploy |
| Pull request to `main` | lint-and-test → docker-build  |
| Manual (`workflow_dispatch`) | lint-and-test → docker-build → deploy |

---

## Job 1: lint-and-test

**Runner:** `ubuntu-latest`
**Duration:** ~2 minutes

Spins up a PostgreSQL 16 service container and runs the full quality gate.

### Service containers

| Service    | Image               | Port | Database          |
| ---------- | ------------------- | ---- | ----------------- |
| PostgreSQL | `postgres:16-alpine` | 5432 | `booking_os_test` |

### Environment variables

| Variable             | Value                                   |
| -------------------- | --------------------------------------- |
| `DATABASE_URL`       | `postgresql://postgres:postgres@localhost:5432/booking_os_test?schema=public` |
| `JWT_SECRET`         | `test-secret-for-ci-only`               |
| `JWT_REFRESH_SECRET` | `test-refresh-secret-for-ci-only`       |
| `NODE_ENV`           | `test`                                  |

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

## Job 2: docker-build

**Runner:** `ubuntu-latest`
**Depends on:** `lint-and-test`
**Duration:** ~2 minutes

Validates that both Docker images build successfully using the production Docker Compose file.

### What it does

```bash
docker compose -f docker-compose.prod.yml build
```

This builds two images:

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

### Dummy environment variables

The build step passes dummy values for required env vars (JWT secrets, API keys, etc.) since they're only needed at runtime, not build time. Actual production values are configured in Railway.

---

## Job 3: deploy

**Runner:** `ubuntu-latest`
**Depends on:** `docker-build`
**Condition:** Only runs on pushes to `main` (not on pull requests)
**Duration:** ~10 seconds

### What it does

1. Installs the Railway CLI (`npm install -g @railway/cli`)
2. Deploys the **API** service to Railway production
3. Deploys the **Web** service to Railway production

```bash
railway up --service api -p 37eeca20-7dfe-45d9-8d29-e902a545f475 -e production --detach
railway up --service web -p 37eeca20-7dfe-45d9-8d29-e902a545f475 -e production --detach
```

The `--detach` flag means the CI job doesn't wait for Railway's own build to finish. Railway receives the source code and handles the Docker build + deploy asynchronously.

### Railway project

| Property       | Value                                    |
| -------------- | ---------------------------------------- |
| Project ID     | `37eeca20-7dfe-45d9-8d29-e902a545f475`   |
| Environment    | `production`                             |
| Services       | `api`, `web`, `postgres`, `redis`        |
| API domain     | `api.businesscommandcentre.com`          |
| Web domain     | `businesscommandcentre.com`              |

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

## GitHub Secrets

| Secret          | Purpose                           | How to update                     |
| --------------- | --------------------------------- | --------------------------------- |
| `RAILWAY_TOKEN` | Railway project deploy token      | `gh secret set RAILWAY_TOKEN`     |

The Railway token must be a **Project Token** (created from Railway → Project Settings → Tokens), not an Account Token. It must be scoped to the `production` environment.

---

## Production Architecture (Railway)

```
                    ┌──────────────┐
                    │   Railway    │
                    │   Project    │
                    └──────┬───────┘
                           │
            ┌──────────────┼──────────────┐
            │              │              │
     ┌──────▼──────┐ ┌────▼────┐ ┌───────▼───────┐
     │     web     │ │   api   │ │   postgres    │
     │  (Next.js)  │ │ (Nest)  │ │  (Postgres    │
     │  port 3000  │ │ port 3001│ │   16-alpine)  │
     └─────────────┘ └────┬────┘ └───────────────┘
                          │
                     ┌────▼────┐
                     │  redis  │
                     │ (Redis  │
                     │ 7-alpine)│
                     └─────────┘
```

---

## Production Docker Compose

The `docker-compose.prod.yml` file defines the full production stack for self-hosting. Railway uses the individual Dockerfiles directly, but the compose file is used in CI to validate builds and is available for VPS deployment.

### Services

| Service    | Image/Build            | Port  | Health check                              |
| ---------- | ---------------------- | ----- | ----------------------------------------- |
| `postgres` | `postgres:16-alpine`   | 5432  | `pg_isready`                              |
| `redis`    | `redis:7-alpine`       | 6379  | `redis-cli ping`                          |
| `api`      | `apps/api/Dockerfile`  | 3001  | `wget -qO- http://localhost:3001/api/v1/health` |
| `web`      | `apps/web/Dockerfile`  | 3000  | —                                         |
| `nginx`    | `nginx:alpine`         | 80/443 | —                                        |

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

### Docker build
```bash
docker compose -f docker-compose.prod.yml build
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
