#!/usr/bin/env bash
set -euo pipefail

# Database restore script for Booking OS
# Usage: bash scripts/restore-db.sh <backup-file.sql.gz> [--force]
#
# Environment variables:
#   POSTGRES_CONTAINER  — Docker container name (default: booking-os-db-prod)
#   POSTGRES_USER       — Database user (default: postgres)
#   POSTGRES_DB         — Database name (default: booking_os)

POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-booking-os-db-prod}"
POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_DB="${POSTGRES_DB:-booking_os}"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }

if [ $# -lt 1 ]; then
  echo "Usage: $0 <backup-file.sql.gz> [--force]"
  exit 1
fi

BACKUP_FILE="$1"
FORCE="${2:-}"

if [ ! -f "$BACKUP_FILE" ]; then
  log "ERROR: Backup file not found: $BACKUP_FILE"
  exit 1
fi

# Verify Postgres container is running
if ! docker inspect --format='{{.State.Running}}' "$POSTGRES_CONTAINER" 2>/dev/null | grep -q true; then
  log "ERROR: Container '$POSTGRES_CONTAINER' is not running"
  exit 1
fi

# Safety prompt
if [ "$FORCE" != "--force" ]; then
  echo ""
  echo "  WARNING: This will DROP and RECREATE the '$POSTGRES_DB' database."
  echo "  All current data will be permanently lost."
  echo ""
  read -rp "  Type 'yes' to continue: " CONFIRM
  if [ "$CONFIRM" != "yes" ]; then
    log "Restore cancelled"
    exit 0
  fi
fi

log "Restoring from: $BACKUP_FILE"

# Drop and recreate database
log "Dropping and recreating database '$POSTGRES_DB'..."
docker exec "$POSTGRES_CONTAINER" \
  psql -U "$POSTGRES_USER" -d postgres \
  -c "DROP DATABASE IF EXISTS ${POSTGRES_DB};" \
  -c "CREATE DATABASE ${POSTGRES_DB};"

# Restore from backup
log "Importing data..."
gunzip -c "$BACKUP_FILE" | docker exec -i "$POSTGRES_CONTAINER" \
  psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" --quiet

# Run Prisma migrations
log "Running Prisma migrations..."
COMPOSE="docker compose -f docker-compose.prod.yml"
$COMPOSE exec api npx prisma migrate deploy --schema=packages/db/prisma/schema.prisma || {
  log "WARNING: Prisma migrations failed — you may need to run them manually"
}

log "Restore completed successfully"
