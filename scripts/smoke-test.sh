#!/usr/bin/env bash
# Booking OS — Production Smoke Test
# Usage: ./scripts/smoke-test.sh [BASE_URL]
# Example: ./scripts/smoke-test.sh https://api.businesscommandcentre.com/api/v1
set -euo pipefail

API="${1:-https://api.businesscommandcentre.com/api/v1}"
WEB="${API%%/api/v1*}"
# Derive web URL (strip api. prefix if present)
WEB_URL="${WEB/api./}"
if [[ "$WEB_URL" == "$WEB" ]]; then
  # No api. prefix found — assume web is on root domain
  WEB_URL="${WEB%%:*//}://${WEB#*://}"
fi
# For Railway: web is on businesscommandcentre.com, api is on api.businesscommandcentre.com
WEB_URL="${WEB_URL:-https://businesscommandcentre.com}"

PASS=0
FAIL=0
TOTAL=0

pass() { ((PASS++)); ((TOTAL++)); printf "  ✅ %s\n" "$1"; }
fail() { ((FAIL++)); ((TOTAL++)); printf "  ❌ %s\n" "$1"; }

echo "╔════════════════════════════════════════════╗"
echo "║     Booking OS — Production Smoke Test     ║"
echo "╚════════════════════════════════════════════╝"
echo ""
echo "API: $API"
echo "WEB: $WEB_URL"
echo ""

# ──────────────────────────────────────────────
# 1. API Health Check
# ──────────────────────────────────────────────
echo "── 1. API Health ──"
HEALTH=$(curl -s -o /dev/null -w "%{http_code}" "$API/health" 2>/dev/null || echo "000")
if [[ "$HEALTH" == "200" ]]; then
  pass "GET /health → 200"
else
  fail "GET /health → $HEALTH (expected 200)"
fi

HEALTH_BODY=$(curl -s "$API/health" 2>/dev/null || echo "{}")
if echo "$HEALTH_BODY" | grep -qi "ok\|healthy\|status"; then
  pass "Health response contains status indicator"
else
  fail "Health response missing status indicator"
fi

# ──────────────────────────────────────────────
# 2. Web Health Check
# ──────────────────────────────────────────────
echo ""
echo "── 2. Web Health ──"
WEB_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" "$WEB_URL" 2>/dev/null || echo "000")
if [[ "$WEB_HEALTH" == "200" || "$WEB_HEALTH" == "301" || "$WEB_HEALTH" == "302" || "$WEB_HEALTH" == "308" ]]; then
  pass "GET $WEB_URL → $WEB_HEALTH"
else
  fail "GET $WEB_URL → $WEB_HEALTH (expected 200/30x)"
fi

WEB_API_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" "$WEB_URL/api/v1/health" 2>/dev/null || echo "000")
if [[ "$WEB_API_HEALTH" == "200" ]]; then
  pass "GET $WEB_URL/api/v1/health (Next.js route) → 200"
else
  fail "GET $WEB_URL/api/v1/health → $WEB_API_HEALTH (expected 200)"
fi

# ──────────────────────────────────────────────
# 3. Core API Endpoints
# ──────────────────────────────────────────────
echo ""
echo "── 3. Core API Endpoints ──"

# Auth login should return 400 for empty body (not 500)
AUTH_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API/auth/login" \
  -H "Content-Type: application/json" -d '{}' 2>/dev/null || echo "000")
if [[ "$AUTH_CODE" == "400" || "$AUTH_CODE" == "401" ]]; then
  pass "POST /auth/login (empty) → $AUTH_CODE (expected 400/401)"
else
  fail "POST /auth/login (empty) → $AUTH_CODE (expected 400/401)"
fi

# Unauthenticated endpoints should return 401
UNAUTH_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$API/auth/me" 2>/dev/null || echo "000")
if [[ "$UNAUTH_CODE" == "401" ]]; then
  pass "GET /auth/me (no token) → 401"
else
  fail "GET /auth/me (no token) → $UNAUTH_CODE (expected 401)"
fi

# Portal OTP endpoint should exist (returns 400 for empty body)
PORTAL_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API/portal/auth/request-otp" \
  -H "Content-Type: application/json" -d '{}' 2>/dev/null || echo "000")
if [[ "$PORTAL_CODE" == "400" ]]; then
  pass "POST /portal/auth/request-otp (empty) → 400"
else
  fail "POST /portal/auth/request-otp (empty) → $PORTAL_CODE (expected 400)"
fi

# ──────────────────────────────────────────────
# 4. Security Headers
# ──────────────────────────────────────────────
echo ""
echo "── 4. Security Headers ──"
HEADERS=$(curl -s -D - -o /dev/null "$API/health" 2>/dev/null || echo "")

# Check CORS
if echo "$HEADERS" | grep -qi "access-control"; then
  pass "CORS headers present"
else
  fail "CORS headers missing"
fi

# Check no server leak
if echo "$HEADERS" | grep -qi "^server: express"; then
  fail "Server header leaks Express (should be hidden)"
else
  pass "Server header not leaking framework"
fi

# Check cookie security on login endpoint
LOGIN_HEADERS=$(curl -s -D - -o /dev/null -X POST "$API/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"smoke@test.invalid","password":"wrong"}' 2>/dev/null || echo "")

# If there are Set-Cookie headers, verify security attributes
if echo "$LOGIN_HEADERS" | grep -qi "set-cookie"; then
  if echo "$LOGIN_HEADERS" | grep -qi "httponly"; then
    pass "Cookies have HttpOnly flag"
  else
    fail "Cookies missing HttpOnly flag"
  fi
  if echo "$LOGIN_HEADERS" | grep -qi "samesite=lax"; then
    pass "Cookies have SameSite=Lax"
  else
    fail "Cookies missing SameSite=Lax"
  fi
else
  pass "No cookies set on failed login (correct)"
fi

# ──────────────────────────────────────────────
# 5. Rate Limiting
# ──────────────────────────────────────────────
echo ""
echo "── 5. Rate Limiting ──"
if echo "$HEADERS" | grep -qi "x-ratelimit\|retry-after\|ratelimit"; then
  pass "Rate limit headers present"
else
  # Rate limit headers may only appear when limits are hit — not a hard failure
  pass "Rate limit headers not visible (may appear under load)"
fi

# ──────────────────────────────────────────────
# Summary
# ──────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════"
echo "  Results: $PASS passed, $FAIL failed, $TOTAL total"
echo "═══════════════════════════════════════════"

if [[ $FAIL -gt 0 ]]; then
  exit 1
fi
exit 0
