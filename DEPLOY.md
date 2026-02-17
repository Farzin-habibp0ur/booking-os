# Booking OS — Deployment Guide

Quick-start guide for deploying a Booking OS demo instance.

## Prerequisites

- **Docker** 24+ and **Docker Compose** v2
- A domain with DNS pointing to your server (for SSL)
- SMTP credentials (optional, for email notifications)

## 1. Environment Variables

Copy `.env.example` or create `.env` in the repo root:

```env
# Database
DATABASE_URL=postgresql://postgres:postgres@db:5432/booking_os?schema=public
POSTGRES_PASSWORD=postgres

# Redis
REDIS_URL=redis://redis:6379

# Auth
JWT_SECRET=your-secret-key-min-32-chars-here

# App URLs
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_APP_URL=http://localhost:3000

# WhatsApp (optional for demo)
# WHATSAPP_TOKEN=...
# WHATSAPP_VERIFY_TOKEN=...
# WHATSAPP_PHONE_ID=...

# Stripe (optional for demo)
# STRIPE_SECRET_KEY=...
# STRIPE_WEBHOOK_SECRET=...

# Email (optional)
# SMTP_HOST=smtp.example.com
# SMTP_PORT=587
# SMTP_USER=...
# SMTP_PASS=...
```

## 2. Quick Start with Docker

```bash
# Start all services (PostgreSQL, Redis, API, Web)
docker compose -f docker-compose.demo.yml up -d

# Watch logs
docker compose -f docker-compose.demo.yml logs -f

# The API will auto-run migrations and seed demo data on first start.
```

Services will be available at:
- **Web UI**: http://localhost:3000
- **API**: http://localhost:3001

## 3. Demo Login Credentials

| Business | Email | Password | Role |
|----------|-------|----------|------|
| Glow Aesthetic Clinic | sarah@glowclinic.com | password123 | Admin |
| Metro Auto Group | mike@metroauto.com | password123 | Admin |

## 4. Database Seeding

If you need to re-seed demo data manually:

```bash
# Base seed (creates Glow Aesthetic Clinic with staff & services)
docker compose -f docker-compose.demo.yml exec api \
  npx tsx packages/db/src/seed.ts

# Demo data (adds rich sample data for both verticals)
docker compose -f docker-compose.demo.yml exec api \
  npx tsx packages/db/src/seed-demo.ts
```

## 5. Production Deployment with SSL

For production deployments behind Nginx with SSL:

```nginx
server {
    listen 443 ssl http2;
    server_name demo.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/demo.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/demo.yourdomain.com/privkey.pem;

    # Web UI
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # API
    location /api/ {
        rewrite ^/api/(.*) /$1 break;
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    listen 80;
    server_name demo.yourdomain.com;
    return 301 https://$server_name$request_uri;
}
```

Update environment variables for production:
```env
NEXT_PUBLIC_API_URL=https://demo.yourdomain.com/api
NEXT_PUBLIC_APP_URL=https://demo.yourdomain.com
```

## 6. Stopping & Cleanup

```bash
# Stop all services
docker compose -f docker-compose.demo.yml down

# Stop and remove volumes (deletes all data)
docker compose -f docker-compose.demo.yml down -v
```
