#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "BookingOS Dev Environment Doctor"
echo "================================"

warn() {
  echo "WARN: $1"
}

ok() {
  echo "OK: $1"
}

if [[ "$ROOT_DIR" == *"/Desktop/"* || "$ROOT_DIR" == *"/Documents/"* ]]; then
  warn "Project is under Desktop/Documents. If iCloud sync is enabled, builds may timeout on file reads."
  warn "Recommendation: move repo to ~/Projects/booking-os for stable local build performance."
fi

if command -v node >/dev/null 2>&1; then
  NODE_MAJOR="$(node -v | sed -E 's/^v([0-9]+).*/\1/')"
  if [[ "$NODE_MAJOR" -ne 20 ]]; then
    warn "Node $(node -v) detected. Recommended Node version is v20 (see .nvmrc)."
  else
    ok "Node version is $(node -v)"
  fi
else
  warn "Node not found in PATH."
fi

if [[ -d "node_modules/@next/swc-darwin-arm64" ]]; then
  xattr -dr com.apple.quarantine "node_modules/@next/swc-darwin-arm64" 2>/dev/null || true
  ok "Cleared quarantine attributes for Next.js SWC binary (darwin-arm64)."
fi

if [[ -f "node_modules/turbo-darwin-arm64/bin/turbo" ]]; then
  chmod +x "node_modules/turbo-darwin-arm64/bin/turbo" || true
  ok "Ensured turbo binary is executable."
fi

if [[ -f "node_modules/.bin/playwright" ]]; then
  chmod +x "node_modules/.bin/playwright" || true
  ok "Ensured Playwright binary is executable."
fi

echo ""
echo "Done. Next recommended checks:"
echo "  1) npm run launch:readiness"
echo "  2) If frontend still fails locally, run from a non-iCloud path (e.g., ~/Projects)."
