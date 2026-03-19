# URL Reference

Quick-reference for all domains, services, dashboards, and endpoints used in Booking OS.
For detailed setup and deployment instructions, see [DEPLOY.md](../DEPLOY.md).

---

## Production URLs

| URL | Purpose |
|-----|---------|
| `https://businesscommandcentre.com` | Web app (root domain) |
| `https://www.businesscommandcentre.com` | Web app (www redirect) |
| `https://admin.businesscommandcentre.com` | Admin console (SUPER_ADMIN only) |
| `https://api.businesscommandcentre.com` | API root |
| `https://api.businesscommandcentre.com/api/v1` | API v1 base path |
| `https://api.businesscommandcentre.com/api/v1/health` | API health check |
| `https://admin.businesscommandcentre.com/api/v1/health` | Admin health check |
| `https://businesscommandcentre.com/api/v1/health` | Web-proxied health check |

**Cookie domain:** `.businesscommandcentre.com` (cross-subdomain auth)

---

## Local Development

| Service | URL | Port |
|---------|-----|------|
| Web UI (Next.js) | `http://localhost:3000` | 3000 |
| API (NestJS) | `http://localhost:3001` | 3001 |
| API v1 base | `http://localhost:3001/api/v1` | 3001 |
| Swagger / OpenAPI docs | `http://localhost:3001/api/docs` | 3001 |
| API health check | `http://localhost:3001/api/v1/health` | 3001 |
| Admin Console (Next.js) | `http://localhost:3002` | 3002 |
| WhatsApp Simulator | `http://localhost:3003` | 3003 |
| PostgreSQL | `127.0.0.1:5432` | 5432 |
| Redis | `127.0.0.1:6379` | 6379 |

---

## Railway

| Property | Value |
|----------|-------|
| Platform | [railway.app](https://railway.app) |
| Project ID | `37eeca20-7dfe-45d9-8d29-e902a545f475` |
| Environment | `production` |

**Services:**

| Service | Type |
|---------|------|
| `api` | NestJS backend |
| `web` | Next.js customer frontend |
| `admin` | Next.js admin console |
| `postgres` | PostgreSQL database |
| `redis` | Redis cache (optional) |

**CNAME targets:**

| Subdomain | CNAME Target |
|-----------|--------------|
| `@` (root) | `uqwnhuyx.up.railway.app` |
| `api` | `cosm54wn.up.railway.app` |
| `admin` | `6v4k4tij.up.railway.app` |

**Railway CLI:**

```bash
railway link -p 37eeca20-7dfe-45d9-8d29-e902a545f475 -e production
railway up --service <name> --detach
```

**Health check:** `/api/v1/health` (120s timeout, configured in `railway.toml`)

---

## Cloudflare DNS

**Nameservers** (set at GoDaddy registrar):

- `cash.ns.cloudflare.com`
- `lina.ns.cloudflare.com`

**DNS records:**

| Type | Name | Target | Proxy |
|------|------|--------|-------|
| CNAME | `@` (root) | `uqwnhuyx.up.railway.app` | DNS only |
| CNAME | `api` | `cosm54wn.up.railway.app` | DNS only |
| CNAME | `admin` | `6v4k4tij.up.railway.app` | DNS only |
| CNAME | `www` | `businesscommandcentre.com` | Proxied |
| TXT | `_railway-verify` | `railway-verify=870b2ea...` | DNS only |
| TXT | `_railway-verify.api` | `railway-verify=642c0135...` | DNS only |
| TXT | `_railway-verify.admin` | `railway-verify=d5bd379d...` | DNS only |
| TXT | `_dmarc` | `v=DMARC1; p=quarantine...` | DNS only |

> Railway-pointing CNAME records must stay **DNS only** (grey cloud) so Railway can handle SSL via Let's Encrypt.

---

## GitHub

| Property | Value |
|----------|-------|
| Repository | `https://github.com/Farzin-habibp0ur/booking-os.git` |
| CI/CD workflow | `.github/workflows/ci.yml` |
| CI triggers | Push to `main`, PRs to `main`, manual dispatch |
| Pipeline | lint &rarr; test &rarr; Docker build validation &rarr; deploy |

---

## Third-Party Services

| Service | Purpose | Env Vars | Dashboard |
|---------|---------|----------|-----------|
| **Stripe** | Billing & payments | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID_BASIC`, `STRIPE_PRICE_ID_PRO` | [dashboard.stripe.com](https://dashboard.stripe.com) |
| **Anthropic (Claude)** | AI intent detection & reply suggestions | `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com) |
| **WhatsApp Cloud API** | Meta WhatsApp messaging | `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_VERIFY_TOKEN` | [developers.facebook.com](https://developers.facebook.com) |
| **Google Calendar** | Calendar OAuth integration | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | [console.cloud.google.com](https://console.cloud.google.com) |
| **Microsoft Outlook** | Outlook Calendar OAuth | `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET` | [portal.azure.com](https://portal.azure.com) |
| **Sentry** | Error tracking (API + Web + Admin) | `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN_ADMIN` | [sentry.io](https://sentry.io) |
| **Resend** | Transactional email + email channel messaging | `RESEND_API_KEY` | [resend.com](https://resend.com) |
| **Twilio** | SMS/MMS messaging | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` | [twilio.com/console](https://twilio.com/console) |
| **Instagram DM** | Instagram messaging | `INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET` | [developers.facebook.com](https://developers.facebook.com) |
| **Facebook Messenger** | Messenger messaging | `FACEBOOK_VERIFY_TOKEN`, `FACEBOOK_APP_SECRET` | [developers.facebook.com](https://developers.facebook.com) |

**Messaging provider toggle:** Set `MESSAGING_PROVIDER` to `mock` (default) or `whatsapp-cloud` for production. SMS, Facebook, and Email have separate per-channel configuration via Location settings.

---

## Docker Base Images

| Image | Purpose |
|-------|---------|
| `node:20-alpine` | Node.js runtime (API & Web) |
| `postgres:16-alpine` | PostgreSQL database |
| `redis:7-alpine` | Redis cache |
| `nginx:alpine` | Reverse proxy |
