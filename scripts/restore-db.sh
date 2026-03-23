#!/usr/bin/env bash
set -euo pipefail

# Database restore script for Booking OS
# Usage: bash scripts/restore-db.sh <backup-file> [--force] [--dry-run]
#
# Modes:
#   DATABASE_URL mode  — restore directly via pg_restore / psql
#   Docker mode        — restore inside a Docker container
#
# Supports both .dump (custom format) and .sql.gz (plain SQL) backups.
#
# Environment variables:
#   DATABASE_URL        — If set, connect directly (takes priority over Docker mode)
#   POSTGRES_CONTAINER  — Docker container name (default: booking-os-db-prod)
#   POSTGRES_USER       — Database user (default: postgres)
#   POSTGRES_DB         — Database name (default: booking_os)

POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-booking-os-db-prod}"
POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_DB="${POSTGRES_DB:-booking_os}"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }

if [ $# -lt 1 ]; then
  echo "Usage: $0 <backup-file> [--force] [--dry-run]"
  echo ""
  echo "Options:"
  echo "  --force     Skip confirmation prompt"
  echo "  --dry-run   Validate the backup without restoring"
  exit 1
fi

BACKUP_FILE="$1"
FORCE=false
DRY_RUN=false

shift
for arg in "$@"; do
  case "$arg" in
    --force) FORCE=true ;;
    --dry-run) DRY_RUN=true ;;
    *) log "Unknown argument: $arg"; exit 1 ;;
  esac
done

if [ ! -f "$BACKUP_FILE" ]; then
  log "ERROR: Backup file not found: $BACKUP_FILE"
  exit 1
fi

# Detect format
IS_CUSTOM_FORMAT=false
if [[ "$BACKUP_FILE" == *.dump ]]; then
  IS_CUSTOM_FORMAT=true
fi

# ── Dry run: validate only ──
if [ "$DRY_RUN" = true ]; then
  log "Dry run: validating backup file..."
  if [ "$IS_CUSTOM_FORMAT" = true ]; then
    if [ -n "${DATABASE_URL:-}" ]; then
      pg_restore --list "$BACKUP_FILE" > /dev/null
    else
      # Copy file into container and validate
      docker cp "$BACKUP_FILE" "$POSTGRES_CONTAINER:/tmp/validate.dump"
      docker exec "$POSTGRES_CONTAINER" pg_restore --list /tmp/validate.dump > /dev/null
      docker exec "$POSTGRES_CONTAINER" rm -f /tmp/validate.dump
    fi
    log "Dry run OK: backup is a valid custom-format dump"
  else
    if file "$BACKUP_FILE" | grep -q "gzip"; then
      gunzip -t "$BACKUP_FILE"
      log "Dry run OK: backup is a valid gzip archive"
    else
      log "ERROR: File is not a recognized backup format"
      exit 1
    fi
  fi
  exit 0
fi

# ── Safety prompt ──
if [ "$FORCE" != true ]; then
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

if [ -n "${DATABASE_URL:-}" ]; then
  # ── DATABASE_URL mode ──
  if [ "$IS_CUSTOM_FORMAT" = true ]; then
    log "Restoring custom-format dump via DATABASE_URL..."
    pg_restore --clean --if-exists --no-owner --no-acl -d "$DATABASE_URL" "$BACKUP_FILE" || true
  else
    log "Restoring SQL dump via DATABASE_URL..."
    gunzip -c "$BACKUP_FILE" | psql "$DATABASE_URL" --quiet
  fi
else
  # ── Docker mode ──
  log "Dropping and recreating database '$POSTGRES_DB'..."
  docker exec "$POSTGRES_CONTAINER" \
    psql -U "$POSTGRES_USER" -d postgres \
    -c "DROP DATABASE IF EXISTS ${POSTGRES_DB};" \
    -c "CREATE DATABASE ${POSTGRES_DB};"

  if [ "$IS_CUSTOM_FORMAT" = true ]; then
    log "Restoring custom-format dump via Docker..."
    docker cp "$BACKUP_FILE" "$POSTGRES_CONTAINER:/tmp/restore.dump"
    docker exec "$POSTGRES_CONTAINER" \
      pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --no-acl /tmp/restore.dump || true
    docker exec "$POSTGRES_CONTAINER" rm -f /tmp/restore.dump
  else
    log "Importing SQL data..."
    gunzip -c "$BACKUP_FILE" | docker exec -i "$POSTGRES_CONTAINER" \
      psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" --quiet
  fi

  # Run Prisma migrations
  log "Running Prisma migrations..."
  COMPOSE="docker compose -f docker-compose.prod.yml"
  $COMPOSE exec api npx prisma migrate deploy --schema=packages/db/prisma/schema.prisma || {
    log "WARNING: Prisma migrations failed — you may need to run them manually"
  }
fi

log "Restore completed successfully"
