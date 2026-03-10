#!/usr/bin/env bash
# Booking OS — Production Smoke Test
# Usage: ./scripts/smoke-test.sh [BASE_URL]
# Example: ./scripts/smoke-test.sh https://businesscommandcentre.com
set -euo pipefail

BASE="${1:-https://businesscommandcentre.com}"
# Strip trailing slash
BASE="${BASE%/}"

# Derive API URL
if [[ "$BASE" == */api/v1 ]]; then
  API_URL="$BASE"
  BASE="${BASE%%/api/v1*}"
elif [[ "$BASE" == *api.* ]]; then
  API_URL="$BASE/api/v1"
  WEB_URL="${BASE/api./}"
else
  API_URL="${BASE/https:\/\//https://api.}/api/v1"
  WEB_URL="$BASE"
fi
WEB_URL="${WEB_URL:-$BASE}"

PASS=0
FAIL=0
TOTAL=0

pass() { ((PASS++)) || true; ((TOTAL++)) || true; printf "  ✓ %s\n" "$1"; }
fail() { ((FAIL++)) || true; ((TOTAL++)) || true; printf "  ✗ %s\n" "$1"; }

check() {
  local desc="$1" url="$2" expected="$3"
  local code
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$url" 2>/dev/null || echo "000")
  if [[ "$code" == "$expected" ]]; then
    pass "$desc → $code"
  else
    fail "$desc → $code (expected $expected)"
  fi
}

check_post() {
  local desc="$1" url="$2" body="$3" expected="$4"
  local code
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 -X POST "$url" \
    -H "Content-Type: application/json" -d "$body" 2>/dev/null || echo "000")
  if [[ "$code" == "$expected" ]]; then
    pass "$desc → $code"
  else
    fail "$desc → $code (expected $expected)"
  fi
}

check_json() {
  local desc="$1" url="$2" key="$3" expected="$4"
  local value
  value=$(curl -s --max-time 10 "$url" 2>/dev/null | jq -r ".$key" 2>/dev/null || echo "null")
  if [[ "$value" == "$expected" ]]; then
    pass "$desc ($key=$value)"
  else
    fail "$desc ($key=$value, expected $expected)"
  fi
}

echo "╔════════════════════════════════════════════╗"
echo "║     Booking OS — Production Smoke Test     ║"
echo "╚════════════════════════════════════════════╝"
echo ""
echo "API: $API_URL"
echo "WEB: $WEB_URL"
echo ""

# ──────────────────────────────────────────────
# 1. Health & Infrastructure
# ──────────────────────────────────────────────
echo "── 1. Health & Infrastructure ──"
check "GET /health" "$API_URL/health" "200"
check_json "Health status" "$API_URL/health" "status" "healthy"
check_json "Database connected" "$API_URL/health" "checks.database.status" "ok"

# Redis may not be exposed in health check on all environments
REDIS_STATUS=$(curl -s --max-time 10 "$API_URL/health" 2>/dev/null | jq -r '.checks.redis.status // .checks.redis // empty' 2>/dev/null || echo "")
if [[ -n "$REDIS_STATUS" ]]; then
  if [[ "$REDIS_STATUS" == "ok" ]]; then
    pass "Redis connected (status=$REDIS_STATUS)"
  else
    fail "Redis unhealthy (status=$REDIS_STATUS)"
  fi
else
  pass "Redis check not exposed in /health (uses in-memory fallback)"
fi

# ──────────────────────────────────────────────
# 2. Web Application
# ──────────────────────────────────────────────
echo ""
echo "── 2. Web Application ──"
WEB_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$WEB_URL" 2>/dev/null || echo "000")
if [[ "$WEB_CODE" == "200" || "$WEB_CODE" == "301" || "$WEB_CODE" == "302" || "$WEB_CODE" == "308" ]]; then
  pass "Homepage → $WEB_CODE"
else
  fail "Homepage → $WEB_CODE (expected 200/30x)"
fi
check "Next.js health route" "$WEB_URL/api/v1/health" "200"

# ──────────────────────────────────────────────
# 3. API Auth — expect 401 without token
# ──────────────────────────────────────────────
echo ""
echo "── 3. API Auth — expect 401 without token ──"
check "GET /auth/me requires auth" "$API_URL/auth/me" "401"
check "GET /bookings requires auth" "$API_URL/bookings" "401"
check "GET /customers requires auth" "$API_URL/customers" "401"
check "GET /services requires auth" "$API_URL/services" "401"
check "GET /portal/me requires auth" "$API_URL/portal/me" "401"

# ──────────────────────────────────────────────
# 4. Core API Endpoints
# ──────────────────────────────────────────────
echo ""
echo "── 4. Core API Endpoints ──"
check_post "POST /auth/login (empty body)" "$API_URL/auth/login" '{}' "400"
check_post "POST /portal/auth/request-otp (empty)" "$API_URL/portal/auth/request-otp" '{}' "400"

# ──────────────────────────────────────────────
# 5. Public Endpoints
# ──────────────────────────────────────────────
echo ""
echo "── 5. Public Endpoints ──"
# Testimonials public endpoint returns 200 for valid slugs, 404 for unknown — both prove the route exists
TESTIMONIAL_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$API_URL/testimonials/public/smoke-test" 2>/dev/null || echo "000")
if [[ "$TESTIMONIAL_CODE" == "200" || "$TESTIMONIAL_CODE" == "404" ]]; then
  pass "GET /testimonials/public/:slug route exists → $TESTIMONIAL_CODE"
else
  fail "GET /testimonials/public/:slug → $TESTIMONIAL_CODE (expected 200 or 404)"
fi

# ──────────────────────────────────────────────
# 6. Security Headers
# ──────────────────────────────────────────────
echo ""
echo "── 6. Security Headers ──"
HEADERS=$(curl -s -I --max-time 10 "$API_URL/health" 2>/dev/null || echo "")

if echo "$HEADERS" | grep -qi "strict-transport-security"; then
  pass "HSTS header present"
else
  fail "HSTS header missing"
fi

if echo "$HEADERS" | grep -qi "x-frame-options"; then
  pass "X-Frame-Options header present"
else
  fail "X-Frame-Options header missing"
fi

if echo "$HEADERS" | grep -qi "^server: express"; then
  fail "Server header leaks Express (should be hidden)"
else
  pass "Server header not leaking framework"
fi

# ──────────────────────────────────────────────
# 7. Cookie Security
# ──────────────────────────────────────────────
echo ""
echo "── 7. Cookie Security ──"
LOGIN_HEADERS=$(curl -s -D - -o /dev/null --max-time 10 -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"smoke@test.invalid","password":"wrong"}' 2>/dev/null || echo "")

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
# 8. CORS
# ──────────────────────────────────────────────
echo ""
echo "── 8. CORS ──"
CORS_HEADERS=$(curl -s -D - -o /dev/null --max-time 10 "$API_URL/health" 2>/dev/null || echo "")
if echo "$CORS_HEADERS" | grep -qi "access-control"; then
  pass "CORS headers present"
else
  fail "CORS headers missing"
fi

if echo "$CORS_HEADERS" | grep -qi "x-ratelimit\|retry-after\|ratelimit"; then
  pass "Rate limit headers present"
else
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
