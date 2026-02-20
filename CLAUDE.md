# Booking OS — Project Guidelines

## Design System & UI Guidelines

### Aesthetic
We use a **"Minimalist Premium"** aesthetic — think Apple Health meets Stripe.
Lots of whitespace, subtle shadows, highly legible typography, and deliberate use of color.

### Typography
- **UI / Data font:** `Inter` (Google Fonts) — set as Tailwind's default `font-sans`.
- **Display / Header font:** `Playfair Display` (Google Fonts) — set as Tailwind's `font-serif`.
- Use `font-serif` for large metrics, page titles, and high-impact headers.
- Use `font-sans` (Inter) for body text, labels, buttons, and data.

### Color Palette
Replace standard Tailwind blues with our custom semantic palette:

**Sage (primary actions, confirmations, success):**
- 50: `#F4F7F5`, 100: `#E4EBE6`, 500: `#8AA694`, 600: `#71907C`, 900: `#3A4D41`

**Lavender (AI features, highlights, pending states):**
- 50: `#F5F3FA`, 100: `#EBE7F5`, 500: `#9F8ECB`, 600: `#8A75BD`, 900: `#4A3B69`

**Backgrounds:** Warm off-white `#FCFCFD` instead of `gray-50`.
**Default text:** `slate-800` for body, `slate-500` for secondary.

### Component Style Rules
1. **Border radii:** Use `rounded-2xl` (or `rounded-3xl` for auth cards). Avoid sharp corners.
2. **Borders:** Remove borders where possible. Prefer soft, diffused drop shadows over border lines.
3. **Shadows:** Use the custom `shadow-soft` (`0 12px 40px -12px rgba(0, 0, 0, 0.05)`) for cards and containers.
4. **Buttons:** Use `rounded-xl` with subtle hover transitions. Primary = `bg-sage-600 hover:bg-sage-700 text-white`. Dark = `bg-slate-900 hover:bg-slate-800 text-white`.
5. **Inputs:** Softer look — `bg-slate-50 border-transparent focus:bg-white focus:ring-2 focus:ring-sage-500 rounded-xl`.
6. **No external component libraries.** Strictly Tailwind CSS utility classes.

### Status Badge Colors
Use muted, pastel tones instead of generic traffic-light colors:
- Confirmed / Completed → `bg-sage-50 text-sage-900`
- Pending → `bg-lavender-50 text-lavender-900`
- Cancelled / No-show → `bg-red-50 text-red-700`
- In Progress → `bg-amber-50 text-amber-700`

### AI Feature Styling
All AI-related UI elements use the **lavender** palette:
- `bg-lavender-50 border border-lavender-100 text-lavender-900 rounded-xl`

---

## Deployment & Infrastructure Rules

**Read `DEPLOY.md` before making any infrastructure, auth, or deployment changes.** It documents hard-won lessons from production incidents.

### Critical Rules (Do Not Break)

1. **Cookie domain must cover both API and Web subdomains.** Cookies are set by the API (`api.X.com`) but read by Next.js middleware on the web app (`X.com`). The cookie `Domain` is auto-derived from `CORS_ORIGINS`. If you change domains, update `CORS_ORIGINS` first.

2. **`CORS_ORIGINS` is the source of truth for cookie domain.** The API parses the first origin to extract the root domain (e.g., `https://example.com` → `.example.com`). Always include both `www` and non-`www` variants.

3. **`NEXT_PUBLIC_API_URL` is baked at build time.** Changing it requires rebuilding the web Docker image — a runtime env var change won't work.

4. **`railway up --detach` does NOT mean the deploy is live.** CI passing only means Railway received the code. The actual build takes 2-5 more minutes. Always verify with curl or Railway logs.

5. **Deploy BOTH services when code changes span API and Web.** `railway up` only deploys the currently linked service. Run `railway service api && railway up --detach` AND `railway service web && railway up --detach` separately. Verify both with `railway deployment list`. The `railway.toml` health check path (`/api/v1/health`) must exist in both — do NOT remove `apps/web/src/app/api/v1/health/route.ts`.

6. **Never set `sameSite: 'strict'` on auth cookies.** It must be `lax` for cross-subdomain auth to work.

6. **Every deploy must include tests.** Never push code without associated tests for new/changed features.

7. **CSP `connect-src` must use origin only — never include a URL path.** The CSP spec requires exact path matching (without trailing slash). Using `https://api.example.com/api/v1` blocks sub-paths like `/api/v1/auth/login`. Always use just the origin: `https://api.example.com`. The extraction is done in `apps/web/next.config.js` via `new URL(apiUrl).origin`.

8. **The frontend API client has automatic token refresh — do not remove it.** When a request gets 401, `apps/web/src/lib/api.ts` calls `POST /auth/refresh` (using the httpOnly refresh_token cookie) before redirecting to /login. This keeps sessions alive for 7 days (refresh token TTL) instead of 15 minutes (access token TTL). Concurrent refresh calls are deduplicated. Auth endpoints (`/auth/*`) skip refresh to avoid loops.

9. **Never use `document.referrer` or `performance.getEntriesByType('navigation')` to detect SPA navigation state.** These APIs reflect the initial page load, not client-side navigations. Use `sessionStorage` flags instead (set on action, check and clear on target page).

10. **Token-based flows must use `TokenService.validateAndConsume()` — never separate validate+markUsed.** The atomic method uses `updateMany` with WHERE conditions (`usedAt: null, expiresAt > now`) so only one concurrent request can succeed, preventing race conditions in reset-password, accept-invite, and verify-email.

11. **`forceBook` on booking creation is ADMIN-only.** The controller throws `ForbiddenException` if a non-ADMIN user sets `forceBook: true`. Never remove this check.

12. **Graceful shutdown is enabled — do not remove `enableShutdownHooks()` from `main.ts`.** Combined with `railway.toml` health checks, this provides zero-downtime deploys. The frontend's `fetchWithRetry` handles transient failures during the deploy window.

### After Any Auth or Cookie Change

Verify with:
```bash
curl -s -D - -o /dev/null -X POST https://api.businesscommandcentre.com/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"sarah@glowclinic.com","password":"password123"}' 2>&1 | grep -i set-cookie
```
Confirm: `Domain=.businesscommandcentre.com`, `SameSite=Lax`, `Secure`, `Path=/`.
