#!/usr/bin/env bash
set -euo pipefail

# Health monitoring script for Booking OS
# Usage: bash scripts/monitor.sh
#
# Environment variables:
#   HEALTH_URL          — Health endpoint URL (default: http://localhost:3001/api/v1/health)
#   CHECK_INTERVAL      — Seconds between checks (default: 60)
#   FAILURE_THRESHOLD   — Consecutive failures before alerting (default: 3)
#   ALERT_WEBHOOK_URL   — Slack/Discord webhook URL for alerts (optional)

HEALTH_URL="${HEALTH_URL:-http://localhost:3001/api/v1/health}"
CHECK_INTERVAL="${CHECK_INTERVAL:-60}"
FAILURE_THRESHOLD="${FAILURE_THRESHOLD:-3}"
ALERT_WEBHOOK_URL="${ALERT_WEBHOOK_URL:-}"

FAILURES=0
ALERTED=false

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }

send_alert() {
  local message="$1"
  local color="${2:-#dc3545}"

  if [ -z "$ALERT_WEBHOOK_URL" ]; then
    return
  fi

  # Slack-compatible payload (also works with Discord /slack endpoints)
  local payload
  payload=$(cat <<EOF
{
  "attachments": [{
    "color": "${color}",
    "title": "Booking OS Monitor",
    "text": "${message}",
    "ts": $(date +%s)
  }]
}
EOF
)

  curl -sf -X POST -H "Content-Type: application/json" \
    -d "$payload" "$ALERT_WEBHOOK_URL" >/dev/null 2>&1 || \
    log "WARNING: Failed to send webhook alert"
}

log "Starting health monitor"
log "  Endpoint:  $HEALTH_URL"
log "  Interval:  ${CHECK_INTERVAL}s"
log "  Threshold: ${FAILURE_THRESHOLD} failures"
log "  Webhook:   ${ALERT_WEBHOOK_URL:-not configured}"
echo ""

while true; do
  HTTP_STATUS=$(curl -sf -o /dev/null -w "%{http_code}" --max-time 10 "$HEALTH_URL" 2>/dev/null || echo "000")

  if [ "$HTTP_STATUS" = "200" ]; then
    if [ "$ALERTED" = true ]; then
      log "RECOVERY: Service is back (HTTP $HTTP_STATUS)"
      send_alert "Service recovered and is healthy again." "#28a745"
      ALERTED=false
    else
      log "OK: HTTP $HTTP_STATUS"
    fi
    FAILURES=0
  else
    FAILURES=$((FAILURES + 1))
    log "FAIL ($FAILURES/$FAILURE_THRESHOLD): HTTP $HTTP_STATUS"

    if [ "$FAILURES" -ge "$FAILURE_THRESHOLD" ] && [ "$ALERTED" = false ]; then
      log "ALERT: Service is DOWN ($FAILURES consecutive failures)"
      send_alert "Service is DOWN! ${FAILURES} consecutive health check failures (HTTP ${HTTP_STATUS})." "#dc3545"
      ALERTED=true
    fi
  fi

  sleep "$CHECK_INTERVAL"
done
