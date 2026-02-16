#!/usr/bin/env bash
set -euo pipefail

# SSL certificate renewal for Booking OS (Let's Encrypt)
# Usage: bash scripts/renew-ssl.sh
# Cron:  0 3 * * * cd /path/to/booking-os && bash scripts/renew-ssl.sh
#
# Optional environment variables:
#   SSL_CERT_DIR  — Certificate output directory (default: ./nginx/ssl)
#   WEBROOT_DIR   — Certbot webroot directory (default: ./certbot/webroot)

SSL_CERT_DIR="${SSL_CERT_DIR:-./nginx/ssl}"
WEBROOT_DIR="${WEBROOT_DIR:-./certbot/webroot}"
COMPOSE="docker compose -f docker-compose.prod.yml"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }

log "Starting certificate renewal check..."

docker run --rm \
  -v "${WEBROOT_DIR}:/var/www/certbot" \
  -v "$(pwd)/certbot/etc:/etc/letsencrypt" \
  certbot/certbot renew \
    --webroot \
    --webroot-path=/var/www/certbot \
    --quiet

# Copy any renewed certs
RENEWED=0
for DOMAIN_DIR in certbot/etc/live/*/; do
  if [ -d "$DOMAIN_DIR" ]; then
    DOMAIN=$(basename "$DOMAIN_DIR")
    if [ "$DOMAIN" = "README" ]; then continue; fi

    cp "${DOMAIN_DIR}fullchain.pem" "${SSL_CERT_DIR}/fullchain.pem"
    cp "${DOMAIN_DIR}privkey.pem" "${SSL_CERT_DIR}/privkey.pem"
    RENEWED=1
    log "Copied renewed certificates for ${DOMAIN}"
  fi
done

if [ "$RENEWED" -eq 1 ]; then
  $COMPOSE exec nginx nginx -s reload
  log "Nginx reloaded with renewed certificates"
else
  log "No certificates were renewed"
fi

log "Renewal check complete"
