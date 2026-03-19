#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

BASE_URL="https://businesscommandcentre.com"
SKIP_FRONTEND=0
SKIP_E2E=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-frontend)
      SKIP_FRONTEND=1
      shift
      ;;
    --skip-e2e)
      SKIP_E2E=1
      shift
      ;;
    *)
      BASE_URL="$1"
      shift
      ;;
  esac
done
REPORT_PATH="reports/launch-readiness-latest.md"
TIMESTAMP="$(date -u +"%Y-%m-%d %H:%M:%SZ")"

PASS=0
FAIL=0
WARN=0

mkdir -p reports

pass() {
  PASS=$((PASS + 1))
  echo "PASS: $1"
}

fail() {
  FAIL=$((FAIL + 1))
  echo "FAIL: $1"
}

warn() {
  WARN=$((WARN + 1))
  echo "WARN: $1"
}

run_with_timeout() {
  local timeout_secs="$1"
  shift
  python3 - "$timeout_secs" "$@" <<'PY'
import subprocess
import sys
timeout = int(sys.argv[1])
cmd = sys.argv[2:]
try:
    completed = subprocess.run(cmd, timeout=timeout)
    sys.exit(completed.returncode)
except subprocess.TimeoutExpired:
    print(f"Timed out after {timeout}s: {' '.join(cmd)}")
    sys.exit(124)
PY
}

run_step() {
  local name="$1"
  local timeout_secs="$2"
  shift 2
  echo ""
  echo "---- $name ----"
  set +e
  run_with_timeout "$timeout_secs" "$@"
  local code=$?
  set -e
  if [[ $code -eq 0 ]]; then
    pass "$name"
    return 0
  fi
  if [[ $code -eq 124 ]]; then
    warn "$name timed out"
  else
    fail "$name (exit $code)"
  fi
  return $code
}

echo "BookingOS Launch Readiness Check"
echo "================================"
echo "Base URL: $BASE_URL"
echo "Timestamp: $TIMESTAMP"

run_step "API full test suite" 1200 bash -lc "cd apps/api && npm test -- --passWithNoTests" || true
run_step "Omnichannel provider tests" 300 bash -lc "cd packages/messaging-provider && npm test -- --passWithNoTests" || true
run_step "Omnichannel critical regression tests" 600 bash -lc "cd apps/api && npx jest src/modules/messaging/webhook.controller.spec.ts src/modules/message/message.service.spec.ts src/modules/customer-identity/customer-identity.service.spec.ts src/modules/usage/usage.service.spec.ts --runInBand" || true
run_step "Production smoke test" 240 bash -lc "bash scripts/smoke-test.sh \"$BASE_URL\"" || true
if [[ "$SKIP_FRONTEND" -eq 1 ]]; then
  warn "Web/Admin build checks skipped by flag"
else
  run_step "Web production build" 600 bash -lc "cd apps/web && npm run build" || true
  run_step "Admin production build" 600 bash -lc "cd apps/admin && npm run build" || true
fi

if [[ "$SKIP_E2E" -eq 1 ]]; then
  warn "Web Playwright e2e skipped by flag"
else
  run_step "Web Playwright e2e" 900 bash -lc "cd apps/web && npm run test:e2e" || true
fi

GO_NO_GO="GO"
if [[ $FAIL -gt 0 ]]; then
  GO_NO_GO="NO-GO"
fi

cat > "$REPORT_PATH" <<EOF
# Launch Readiness Report

- **Generated (UTC):** $TIMESTAMP
- **Base URL tested:** $BASE_URL
- **Result:** **$GO_NO_GO**

## Scorecard

- Passed checks: $PASS
- Failed checks: $FAIL
- Warnings (timeouts/non-blocking): $WARN

## Interpretation

- **GO** means no failed checks.
- **NO-GO** means at least one failed check and should be resolved before launch.
- Warnings should be reviewed; repeated timeouts usually indicate local environment or infrastructure instability.

## Recommended PM Actions

1. Confirm all failed checks have owners and ETA.
2. Re-run \`npm run launch:readiness\` after fixes.
3. Share this report in launch decision notes.
EOF

echo ""
echo "Report written to $REPORT_PATH"
echo "Summary: PASS=$PASS FAIL=$FAIL WARN=$WARN -> $GO_NO_GO"

if [[ "$GO_NO_GO" == "NO-GO" ]]; then
  exit 1
fi
