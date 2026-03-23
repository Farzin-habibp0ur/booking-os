#!/usr/bin/env bash
set -euo pipefail

# Database backup script for Booking OS
# Usage: bash scripts/backup-db.sh
#
# Modes:
#   DATABASE_URL mode  — connect directly via pg_dump (for CI, Railway, remote DBs)
#   Docker mode        — run pg_dump inside a Docker container (for self-hosted)
#
# Environment variables:
#   DATABASE_URL           — If set, connect directly (takes priority over Docker mode)
#   BACKUP_DIR             — Directory to store backups (default: ./backups)
#   BACKUP_RETENTION_DAYS  — Delete backups older than N days (default: 7)
#   AWS_S3_BUCKET          — If set, upload backup to this S3 bucket
#   POSTGRES_CONTAINER     — Docker container name (default: booking-os-db-prod)
#   POSTGRES_USER          — Database user (default: postgres)
#   POSTGRES_DB            — Database name (default: booking_os)

BACKUP_DIR="${BACKUP_DIR:-./backups}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-7}"
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-booking-os-db-prod}"
POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_DB="${POSTGRES_DB:-booking_os}"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }

# Create backup directory
mkdir -p "$BACKUP_DIR"

if [ -n "${DATABASE_URL:-}" ]; then
  # ── DATABASE_URL mode: use pg_dump with custom format ──
  FILENAME="bookingos-backup-${TIMESTAMP}.dump"
  FILEPATH="${BACKUP_DIR}/${FILENAME}"

  if ! command -v pg_dump &>/dev/null; then
    log "ERROR: pg_dump not found. Install PostgreSQL client tools."
    exit 1
  fi

  log "Starting backup via DATABASE_URL (custom format)..."
  pg_dump "$DATABASE_URL" --format=custom --no-owner --no-acl -f "$FILEPATH"
else
  # ── Docker mode: run pg_dump inside container ──
  FILENAME="booking_os_${TIMESTAMP}.sql.gz"
  FILEPATH="${BACKUP_DIR}/${FILENAME}"

  if ! docker inspect --format='{{.State.Running}}' "$POSTGRES_CONTAINER" 2>/dev/null | grep -q true; then
    log "ERROR: Container '$POSTGRES_CONTAINER' is not running"
    exit 1
  fi

  log "Starting backup of database '$POSTGRES_DB' via Docker..."
  docker exec "$POSTGRES_CONTAINER" \
    pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --no-acl \
    | gzip > "$FILEPATH"
fi

# Validate backup is non-empty
if [ ! -s "$FILEPATH" ]; then
  log "ERROR: Backup file is empty, removing"
  rm -f "$FILEPATH"
  exit 1
fi

FILESIZE=$(du -h "$FILEPATH" | cut -f1)
log "Backup complete: $FILEPATH ($FILESIZE)"

# Clean up old backups
if [ "$BACKUP_RETENTION_DAYS" -gt 0 ]; then
  DELETED=$(find "$BACKUP_DIR" \( -name "booking_os_*.sql.gz" -o -name "bookingos-backup-*.dump" \) -mtime +"$BACKUP_RETENTION_DAYS" -print -delete | wc -l | tr -d ' ')
  if [ "$DELETED" -gt 0 ]; then
    log "Cleaned up $DELETED backup(s) older than $BACKUP_RETENTION_DAYS days"
  fi
fi

# Optional S3 upload
if [ -n "${AWS_S3_BUCKET:-}" ]; then
  log "Uploading to s3://${AWS_S3_BUCKET}/backups/${FILENAME}..."
  if aws s3 cp "$FILEPATH" "s3://${AWS_S3_BUCKET}/backups/${FILENAME}"; then
    log "S3 upload complete"
  else
    log "WARNING: S3 upload failed"
    exit 1
  fi
fi

log "Backup finished successfully"
