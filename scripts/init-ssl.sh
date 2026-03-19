#!/usr/bin/env bash
set -euo pipefail

# SSL certificate initialization for Booking OS (Let's Encrypt)
# Usage: bash scripts/init-ssl.sh
#
# Required environment variables:
#   DOMAIN      — Your domain name (e.g., businesscommandcentre.com)
#   CERT_EMAIL  — Email for Let's Encrypt notifications
#
# Optional:
#   CERT_STAGING    — Set to "true" to use LE staging (for testing)
#   SSL_CERT_DIR    — Certificate output directory (default: ./nginx/ssl)
#   WEBROOT_DIR     — Certbot webroot directory (default: ./certbot/webroot)

DOMAIN="${DOMAIN:?ERROR: DOMAIN environment variable is required}"
CERT_EMAIL="${CERT_EMAIL:?ERROR: CERT_EMAIL environment variable is required}"
CERT_STAGING="${CERT_STAGING:-false}"
SSL_CERT_DIR="${SSL_CERT_DIR:-./nginx/ssl}"
WEBROOT_DIR="${WEBROOT_DIR:-./certbot/webroot}"

COMPOSE="docker compose -f docker-compose.prod.yml"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }

STAGING_FLAG=""
if [ "$CERT_STAGING" = "true" ]; then
  STAGING_FLAG="--staging"
  log "Using Let's Encrypt STAGING environment"
fi

# ── Phase 1: Create self-signed cert so Nginx can start ──
log "Phase 1: Creating temporary self-signed certificate..."
mkdir -p "$SSL_CERT_DIR"

openssl req -x509 -nodes -days 1 \
  -newkey rsa:2048 \
  -keyout "${SSL_CERT_DIR}/privkey.pem" \
  -out "${SSL_CERT_DIR}/fullchain.pem" \
  -subj "/CN=${DOMAIN}" \
  2>/dev/null

log "Self-signed certificate created"

# ── Phase 2: Start Nginx and run certbot ──
log "Phase 2: Starting Nginx..."
mkdir -p "$WEBROOT_DIR"

$COMPOSE up -d nginx
sleep 3

# Verify Nginx is responding on port 80
if ! curl -sf "http://localhost/.well-known/acme-challenge/" -o /dev/null 2>/dev/null; then
  log "WARNING: Nginx may not be serving ACME challenges yet — continuing anyway"
fi

log "Requesting certificate from Let's Encrypt..."
docker run --rm \
  -v "${WEBROOT_DIR}:/var/www/certbot" \
  -v "$(pwd)/certbot/etc:/etc/letsencrypt" \
  certbot/certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --email "$CERT_EMAIL" \
    --agree-tos \
    --no-eff-email \
    -d "$DOMAIN" \
    $STAGING_FLAG

# ── Phase 3: Copy real certs and reload Nginx ──
log "Phase 3: Installing certificates..."
cp "certbot/etc/live/${DOMAIN}/fullchain.pem" "${SSL_CERT_DIR}/fullchain.pem"
cp "certbot/etc/live/${DOMAIN}/privkey.pem" "${SSL_CERT_DIR}/privkey.pem"

$COMPOSE exec nginx nginx -s reload
log "Nginx reloaded with Let's Encrypt certificate"

log "SSL initialization complete for ${DOMAIN}"
echo ""
echo "  Certificate files:"
echo "    ${SSL_CERT_DIR}/fullchain.pem"
echo "    ${SSL_CERT_DIR}/privkey.pem"
echo ""
echo "  Set up auto-renewal with:"
echo "    0 3 * * * cd $(pwd) && bash scripts/renew-ssl.sh"
