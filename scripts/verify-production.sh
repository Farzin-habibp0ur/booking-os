#!/usr/bin/env bash
set -uo pipefail

# Production Environment Verification Script for Booking OS
# Usage: bash scripts/verify-production.sh
#
# Checks critical environment variables and connectivity
# before going live with real customers.

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m' # No color

PASS=0
FAIL=0
WARN=0

pass() { echo -e "  ${GREEN}PASS${NC} $1"; PASS=$((PASS + 1)); }
fail() { echo -e "  ${RED}FAIL${NC} $1"; FAIL=$((FAIL + 1)); }
warn() { echo -e "  ${YELLOW}WARN${NC} $1"; WARN=$((WARN + 1)); }

echo ""
echo "=========================================="
echo " Booking OS — Production Verification"
echo "=========================================="
echo ""

# ── 1. Database ──────────────────────────────────────────────────────────────
echo "Database:"
if [ -z "${DATABASE_URL:-}" ]; then
  fail "DATABASE_URL is not set"
else
  pass "DATABASE_URL is set"
  # Test connectivity (requires psql)
  if command -v psql &>/dev/null; then
    if psql "$DATABASE_URL" -c "SELECT 1" &>/dev/null; then
      pass "Database is reachable"
    else
      fail "Database is NOT reachable — check DATABASE_URL"
    fi
  else
    warn "psql not installed — cannot verify database connectivity"
  fi
fi
echo ""

# ── 2. Redis ─────────────────────────────────────────────────────────────────
echo "Redis:"
if [ -z "${REDIS_URL:-}" ]; then
  fail "REDIS_URL is not set (required for BullMQ, WebSocket, brute force, circuit breaker)"
else
  pass "REDIS_URL is set"
  if command -v redis-cli &>/dev/null; then
    if redis-cli -u "$REDIS_URL" PING 2>/dev/null | grep -q PONG; then
      pass "Redis is reachable"
    else
      fail "Redis is NOT reachable — check REDIS_URL"
    fi
  else
    warn "redis-cli not installed — cannot verify Redis connectivity"
  fi
fi
echo ""

# ── 3. JWT Secrets ───────────────────────────────────────────────────────────
echo "Authentication:"
if [ -z "${JWT_SECRET:-}" ]; then
  fail "JWT_SECRET is not set"
elif [ ${#JWT_SECRET} -lt 32 ]; then
  fail "JWT_SECRET is too short (${#JWT_SECRET} chars, need >= 32)"
else
  pass "JWT_SECRET is set (${#JWT_SECRET} chars)"
fi

if [ -z "${JWT_REFRESH_SECRET:-}" ]; then
  fail "JWT_REFRESH_SECRET is not set (required in production)"
elif [ ${#JWT_REFRESH_SECRET} -lt 32 ]; then
  fail "JWT_REFRESH_SECRET is too short (${#JWT_REFRESH_SECRET} chars, need >= 32)"
elif [ "$JWT_REFRESH_SECRET" = "${JWT_SECRET:-}" ]; then
  fail "JWT_REFRESH_SECRET must differ from JWT_SECRET"
else
  pass "JWT_REFRESH_SECRET is set and distinct (${#JWT_REFRESH_SECRET} chars)"
fi
echo ""

# ── 4. Stripe ────────────────────────────────────────────────────────────────
echo "Payments (Stripe):"
if [ -z "${STRIPE_SECRET_KEY:-}" ]; then
  fail "STRIPE_SECRET_KEY is not set"
elif [[ "$STRIPE_SECRET_KEY" == sk_test_* ]]; then
  warn "STRIPE_SECRET_KEY is a TEST key — switch to live key before accepting payments"
else
  pass "STRIPE_SECRET_KEY is set (live key)"
fi

if [ -z "${STRIPE_WEBHOOK_SECRET:-}" ]; then
  fail "STRIPE_WEBHOOK_SECRET is not set"
else
  pass "STRIPE_WEBHOOK_SECRET is set"
fi
echo ""

# ── 5. CORS ──────────────────────────────────────────────────────────────────
echo "CORS & Cookies:"
if [ -z "${CORS_ORIGINS:-}" ]; then
  fail "CORS_ORIGINS is not set (source of truth for cookie domain)"
elif echo "$CORS_ORIGINS" | grep -q "businesscommandcentre.com"; then
  pass "CORS_ORIGINS contains production domain"
else
  warn "CORS_ORIGINS does not contain 'businesscommandcentre.com': $CORS_ORIGINS"
fi
echo ""

# ── 6. Messaging ─────────────────────────────────────────────────────────────
echo "Messaging:"
if [ -z "${MESSAGING_PROVIDER:-}" ]; then
  warn "MESSAGING_PROVIDER is not set (defaults to 'mock' — no real messages sent)"
elif [ "$MESSAGING_PROVIDER" = "mock" ]; then
  fail "MESSAGING_PROVIDER is 'mock' — set to 'whatsapp-cloud' for production"
else
  pass "MESSAGING_PROVIDER is '$MESSAGING_PROVIDER'"
fi
echo ""

# ── 7. Monitoring ────────────────────────────────────────────────────────────
echo "Monitoring:"
if [ -z "${SENTRY_DSN:-}" ]; then
  fail "SENTRY_DSN is not set — errors will not be tracked"
else
  pass "SENTRY_DSN is set"
fi
echo ""

# ── 8. Demo Credentials ─────────────────────────────────────────────────────
echo "Demo Data:"
if [ -n "${DATABASE_URL:-}" ] && command -v psql &>/dev/null; then
  DEMO_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM staff WHERE email IN ('sarah@glowclinic.com', 'mike@metroauto.com', 'maya@serenitywellness.com')" 2>/dev/null | tr -d ' ')
  if [ "$DEMO_COUNT" -gt 0 ] 2>/dev/null; then
    warn "Found $DEMO_COUNT demo accounts in database — remove before accepting real customers"
  else
    pass "No demo credentials found in database"
  fi
else
  warn "Cannot check for demo credentials (no DATABASE_URL or psql not available)"
fi
echo ""

# ── Summary ──────────────────────────────────────────────────────────────────
echo "=========================================="
echo -e " Results: ${GREEN}$PASS passed${NC}, ${RED}$FAIL failed${NC}, ${YELLOW}$WARN warnings${NC}"
echo "=========================================="
echo ""

if [ "$FAIL" -gt 0 ]; then
  echo -e "${RED}Production is NOT ready. Fix the failures above before launch.${NC}"
  exit 1
elif [ "$WARN" -gt 0 ]; then
  echo -e "${YELLOW}Production may be ready, but review the warnings above.${NC}"
  exit 0
else
  echo -e "${GREEN}All checks passed. Production environment looks good.${NC}"
  exit 0
fi
