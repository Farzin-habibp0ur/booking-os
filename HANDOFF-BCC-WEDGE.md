# Handoff: Business Command Centre / AI Front Desk Wedge

Branch: `codex-business-command-centre-wedge` (note hyphen, not slash — original plan said `codex/...` but Git ref permissions blocked it; rename if you care).

**Critical:** Nothing is committed yet. All work is in the working tree. There is also a `.git/index.lock` left behind from the previous session — delete it before any `git` operation.

---

## What was done (verified present in working tree)

### Backend (apps/api)
- `apps/api/src/modules/pilot-application/` — controller, service, module, spec, plus `dto/create-pilot-application.dto.ts` and `dto/update-pilot-application.dto.ts`
- `apps/api/src/modules/front-desk/` — controller, service, module, spec
- Both modules wired into `apps/api/src/app.module.ts`
- `apps/api/src/modules/outbound/outbound.service.ts` modified to write/update `frontDeskAttribution` rows when AI drafts are created and when they transition to SENT
- Email/auth/billing/dunning/onboarding-drip/two-factor/calendar-sync services rebranded to "Business Command Centre"
- Test mocks extended in `apps/api/src/test/mocks.ts`

### Database (packages/db)
- `PilotApplication` model added to `packages/db/prisma/schema.prisma` (~line 1120)
- `FrontDeskAttribution` model added (~line 1150)
- Migration: `packages/db/prisma/migrations/20260509000000_add_pilot_applications_and_front_desk_attribution/migration.sql`

### Web (apps/web)
- `(marketing)/landing-page.tsx` — fully rewritten around AI Front Desk wedge
- `(marketing)/page.tsx` — metadata updated
- `(marketing)/pricing/page.tsx` — replaced with pilot-oriented pricing
- `(marketing)/faq/page.tsx` — rewritten with new FAQ copy
- `(marketing)/pilot/page.tsx` + `pilot-application-form.tsx` — new public pilot application
- `(marketing)/privacy/page.tsx`, `terms/page.tsx`, `security/page.tsx` — new conservative trust pages
- `app/layout.tsx`, `marketing-nav.tsx`, `marketing-footer.tsx`, `sitemap.ts`, `manifest.json`, `og-image.png/route.tsx` — brand updated
- `(protected)/ai/layout.tsx`, `ai/components/ai-value-kpis.tsx`, `ai/components/ai-setup-wizard.tsx` — AI Hub → AI Front Desk, KPIs now consume `/front-desk/summary`
- `(protected)/automations/*`, `settings/ai/page.tsx`, `command-palette.tsx`, `shell.tsx`, `dashboard/page.tsx`, `help/page.tsx`, `book/[slug]/page.tsx`, `portal/*`, `install-prompt.tsx`, `nps-survey.tsx`, `help-button.tsx`, `add-to-calendar.tsx`, blog pages — all rebranded
- `locales/en.json` and `locales/es.json` — updated strings
- `lib/settings-config.ts` — updated

### Admin (apps/admin)
- `apps/admin/src/app/pilot-applications/page.tsx` — new triage page with search/status filter and inline updates
- `admin-shell.tsx` — Pilot Apps nav entry + brand rename
- `app/layout.tsx`, `app/agents/page.tsx` — rebranded

### Tests updated
- `(marketing)/page.test.tsx`, `(marketing)/faq/page.test.tsx`
- `(protected)/ai/layout.test.tsx`
- `(protected)/ai/components/ai-value-kpis.test.tsx` (rewritten)
- `(protected)/ai/components/ai-setup-wizard.test.tsx`
- `business.service.spec.ts`
- New: `pilot-application.service.spec.ts`, `front-desk.service.spec.ts`

### Docs / env
- `README.md`, `AGENTS.md`, `DEPLOY.md`, `docs/REFERENCE.md`, `docs/URLS.md`, `docs/CHANNEL-SETUP.md`, `docs/SALES-DEMO-PLAN.md` — updated
- `.env.example` — `PILOT_APPLICATION_NOTIFY_EMAIL` added (commented, ~line 62)

---

## What is NOT done / broken / risky

### Blocking issues
1. **`.git/index.lock` exists** — remove it: `rm -f .git/index.lock`
2. **Nothing is committed** — `git diff main...HEAD` is empty. All work is unstaged.
3. **Prisma client was never regenerated.** Both new services and the modified `outbound.service.ts` use `(this.prisma as any).pilotApplication` / `.frontDeskAttribution` to compile around the missing types. You **must** run `npx prisma generate --schema=packages/db/prisma/schema.prisma` and then strip the `as any` casts.
4. **`outbound.service.spec.ts` was NOT updated** even though `outbound.service.ts` gained ~60 lines plus two new `frontDeskAttribution` writes. Tests will fail.
5. **Validation never ran:** no evidence of `npm run lint`, `npm test`, or `npm run build` having been executed against the new state.

### Test files likely to fail (still reference "Booking OS" or have stale assertions)
- `apps/web/src/app/(protected)/ai/settings/page.test.tsx:63` — stale `describe('AiSettingsPage (AI Hub)')` block
- `apps/web/src/app/portal/page.test.tsx` (lines 186, 188)
- `apps/web/src/app/(marketing)/blog/page.test.tsx` (lines 18, 27)
- `apps/web/src/app/book/[slug]/page.test.tsx` (line 989)
- `apps/web/src/components/nps-survey.test.tsx`, `install-prompt.test.tsx`
- `apps/api/src/modules/{notification,dunning,messaging/twilio-sms,messaging/instagram,email}/*.spec.ts` — verify against rebranded source files

### Docs not yet updated
- `docs/PROJECT_CONTEXT.md` (5+ "Booking OS" references)
- `docs/STRIPE-SETUP.md`
- `docs/user-stories.md`
- `docs/cicd.md`

### Untracked clutter from earlier sessions
The working tree has unrelated untracked files: `BookingOS_Automations_*.docx`, `Campaigns-*.{md,docx}`, `deposit-payment-link-plan.md`, `self-review-loop-skill.md`, modified `sync_v2.py`, `.agents/`, `.claude/plans/`, `.sheet-sync/`. Decide whether each belongs in this commit before staging.

---

## Claude Code prompt to finish the work

Paste this into Claude Code in your terminal:

````text
Continue the Business Command Centre / AI Front Desk wedge implementation on branch `codex-business-command-centre-wedge`. The previous session left the working tree dirty with no commits. Read HANDOFF-BCC-WEDGE.md for context before starting.

Do these in order. Stop and report if any step fails non-trivially.

1. Unblock git:
   - Remove `.git/index.lock` if present.
   - Confirm branch is `codex-business-command-centre-wedge`. Do not rename.
   - `git status --short` to see the universe of changes.

2. Regenerate Prisma client:
   - `npx prisma generate --schema=packages/db/prisma/schema.prisma`
   - Then in `apps/api/src/modules/pilot-application/pilot-application.service.ts`, `apps/api/src/modules/front-desk/front-desk.service.ts`, and `apps/api/src/modules/outbound/outbound.service.ts`, remove every `(this.prisma as any)` cast that targets `pilotApplication` or `frontDeskAttribution`. Replace with proper typed access.

3. Fix `outbound.service.spec.ts`:
   - Read `apps/api/src/modules/outbound/outbound.service.ts` to see the new `frontDeskAttribution` writes (one in `createAiDraft`, one in `markSent`).
   - Update the spec to mock `prisma.frontDeskAttribution.create` / `.update` and assert they are called with the right shape on draft creation and on transition to SENT.
   - Make sure the existing tests still pass.

4. Fix stale test references:
   - `apps/web/src/app/(protected)/ai/settings/page.test.tsx:63` — rename the describe to "AiSettingsPage (AI Front Desk)".
   - Audit and update any test asserting "Booking OS" against a source file that now says "Business Command Centre":
     - `apps/web/src/app/portal/page.test.tsx`
     - `apps/web/src/app/(marketing)/blog/page.test.tsx`
     - `apps/web/src/app/book/[slug]/page.test.tsx`
     - `apps/web/src/components/nps-survey.test.tsx`
     - `apps/web/src/components/install-prompt.test.tsx`
     - `apps/api/src/modules/{notification,dunning,messaging/twilio-sms,messaging/instagram,email}/*.spec.ts`
   - Only change tests where the corresponding source file was rebranded. Do not change tests guarding internal package names like `@booking-os/*`.

5. Finish doc rebrand:
   - Update remaining "Booking OS" references in `docs/PROJECT_CONTEXT.md`, `docs/STRIPE-SETUP.md`, `docs/user-stories.md`, `docs/cicd.md` to "Business Command Centre" where customer-facing. Keep internal package and repo names as-is.

6. Triage untracked files:
   - Review untracked files (`BookingOS_Automations_*.docx`, `Campaigns-*.{md,docx}`, `deposit-payment-link-plan.md`, `self-review-loop-skill.md`, `sync_v2.py` modifications, `.agents/`, `.claude/plans/`, `.sheet-sync/`).
   - Ask me which to include in this commit, which to gitignore, which to delete. Default: do not commit anything unrelated to this wedge.

7. Run validation in this order. Fix every failure before moving on:
   - `npm run format`
   - `npm run format:check`
   - `npm run lint`
   - `npm test`
   - `npm run build`

8. Self-review per `.claude/skills/self-review-loop/SKILL.md`:
   - Re-read the original plan in HANDOFF-BCC-WEDGE.md and verify every item under "What was done" and "What is NOT done" is now satisfied.
   - Run again until a pass finds zero issues. Report pass count.

9. Security review per `.claude/skills/security-review/SKILL.md`:
   - Pay particular attention to the public `POST /pilot-applications` endpoint: rate limiting, honeypot, min-submit-time, no PII leakage in error responses, generic success envelope.
   - Verify `GET /front-desk/summary` and admin pilot-application endpoints have `TenantGuard` / `@Roles(SUPER_ADMIN)` as appropriate.

10. Commit and push:
    - Use a single commit message: "Reposition as Business Command Centre / AI Front Desk wedge".
    - `git push -u origin codex-business-command-centre-wedge`.
    - Open a PR description summarizing the wedge change.

Constraints:
- Do not rename internal package names (`@booking-os/*`), repo name, database name, or Stripe plan ids.
- Keep AI default posture: drafts enabled, auto-send disabled, staff approval required.
- Keep claims on `/security` and `/privacy` conservative — no HIPAA/BAA/encrypted-at-rest claims unless backed by code+contracts.
````

---

## Quick sanity checklist before you start

```bash
cd /Users/farzinhabibpour/Projects/booking-os
rm -f .git/index.lock
git status --short --branch
git diff --stat | head -50
```

If `git diff --stat` shows ~80 modified files plus many new `pilot-application/`, `front-desk/`, `(marketing)/pilot/`, `(marketing)/privacy/`, `(marketing)/terms/`, `(marketing)/security/`, and `pilot-applications/` files, the working tree is intact and Claude Code can proceed.
