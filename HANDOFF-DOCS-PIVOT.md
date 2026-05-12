# Documentation Update Plan: Business Command Centre / AI Front Desk Pivot

Companion to `HANDOFF-BCC-WEDGE.md`. That doc covers the *code*. This one covers the *docs*.

The pivot context (in case any AI agent reads this in isolation):
- Brand: "Booking OS" → **Business Command Centre**
- Wedge: "all-in-one operating system for service businesses" → **AI Front Desk for aesthetic clinics**
- Primary public CTA: self-serve signup → **Apply for Pilot**
- AI default: drafts/suggestions on, **auto-send off**, staff approval required
- Pricing: public 3-tier matrix is gone; tiers stay internal only
- Target market: **US / Canada aesthetic clinics**
- Compliance: **conservative copy only** — no HIPAA / BAA / PHIPA / "encrypted at rest" claims
- Internal names preserved: `@booking-os/*` packages, repo name, DB names, Stripe IDs

---

## Tier 1: Highest leverage — fix these first

These docs encode the old positioning so deeply that a sweep won't fix them. They need rewrites.

### `docs/PROJECT_CONTEXT.md` — REWRITE
First line still calls the product "Booking OS" and frames it as "service-based businesses to manage appointments, customer messaging, and operations." Five `Booking OS` hits. Every contributor reads this doc. Rewrite the intro/positioning section, then sweep "service businesses" → "aesthetic clinics" throughout.

### `DEMO_SCRIPT.md` — REWRITE or RETIRE
Line 129 literally says *"a WhatsApp-first operating system for service businesses."* This is the single most off-brand string in the repo. Either rewrite the entire 53-minute script around the AI Front Desk wedge, or **archive it** and lean on the shorter `docs/SALES-DEMO-PLAN.md`.

### `DESIGN_DOCUMENTATION.md` — REWRITE
Opens with *"Booking OS is a multi-tenant SaaS platform for service-based businesses (aesthetic clinics, salons)"* and lists Salon and Tutoring as verticals. This directly contradicts the aesthetic-only narrowing. Rewrite the product overview and vertical pack section; visual tokens (Sage/Lavender, Inter/Playfair) are unchanged.

### `docs/SALES-DEMO-PLAN.md` — REWRITE
Header is rebranded but the demo flow still tours dashboard + automations + marketing — the "all-in-one" worldview. Also has the line *"HTTPS everywhere, encrypted cookies, … WCAG accessibility compliance"* which trends toward broad security claims the pivot wants conservative. Rewrite around the wedge: pilot pitch → drafts/approve flow → recovered-revenue proof.

### `agents/outbound-prospecting.md` — REWRITE
Outbound prospecting prompt drives the growth engine. Currently broad. Reauthor: aesthetic clinics only, US/Canada, AI Front Desk pitch, Apply for Pilot CTA.

---

## Tier 2: Targeted updates (brand sweep + a few sentences each)

| Path | What to change |
|---|---|
| `CLAUDE.md` | Fix three remaining "Booking OS" mentions; narrow "Target users" line from "service businesses" to "US/Canada aesthetic clinics"; add AI default-posture sentence (drafts on / auto-send off); add pointer to new pilot/front-desk surfaces |
| `AGENTS.md` | Mirror of CLAUDE.md — keep in sync |
| `README.md` | Already largely rewritten — final pass for pilot CTA, AI default, US/Canada scope |
| `docs/REFERENCE.md` | Title still says "BookingOS — Reference Tables"; fix and sweep |
| `docs/CHANNEL-SETUP.md` | Two remaining "Booking OS" hits |
| `docs/STRIPE-SETUP.md` | Add explicit *"Internal-only — public CTA is /pilot, not these tiers"* note so a future contributor doesn't expose the 3-tier matrix |
| `docs/cicd.md` | Opening line still says "Booking OS uses GitHub Actions" |
| `DEPLOY.md` | Body sweep; mention `/pilot-applications` and `/front-desk/summary` if they affect smoke checks |
| `docs/AI_MARKETING_AGENTS_DAILY_WORKFLOW.md` | Brand sweep; verify the "drafts on / auto-send off" default is reflected |
| `docs/user-stories.md` | Title sweep; verify AI sections reflect approval-required default; check for self-serve signup language |
| `docs/URLS.md` | Already mostly updated — title sweep |
| `data/evergreen-trends.md` | Brand sweep; either narrow to aesthetic clinics or document the consumer-side filter |
| `packages/web-chat-widget/README.md` | Decision needed: keep `BookingOSChat.init({...})` global for back-compat, or rename to `BCCChat`. Document either way |
| `docs/bookingos-brand-SKILL.md` | Skill name + description string trigger on "BookingOS"; rename or alias to `bcc-brand` so it triggers on the new name |
| `design-specs/template-library.md` | Eleven brand-string hits |
| `agents/{master-orchestrator, content-strategist, blog-writer, social-content-creator, trend-scout, visual-designer, video-producer, publisher, performance-analyst, learning-engine, weekly-maintenance, spanish-localization, community-manager, keyword-strategist}.md` | Each: brand sweep, narrow audience to aesthetic clinics, change CTAs to "Apply for Pilot" |
| `system/{quality-gates, auto-escalation-rules, product-content-map, budget-tracker}.md` | Brand examples; product-content-map needs aesthetic-only narrowing |
| 5 generic blog posts | `client-retention-strategies-service-businesses.md`, `data-driven-decision-making-small-business.md`, `multi-location-management-challenges.md`, `future-of-ai-service-businesses.md`, `service-industry-trends-2026.md` — retitle/retarget to aesthetic clinics or unpublish |
| 5–7 aesthetic-relevant blog posts | Brand sweep; CTA to `/pilot` |

---

## Tier 3: Decisions before edits

These docs aren't independently fixable until you decide what to do with the broader platform.

| Path | Decision needed |
|---|---|
| `Campaigns-Implementation-Plan.md`, `Campaigns-Co-Testing-Plan.md` | Campaigns: kept and hidden, kept and shown to paid tiers, or removed? 19 brand-hits in the implementation plan |
| `VERTICAL-CONSOLIDATION-PROMPT.md`, `vertical-consolidation-plan.md` | If aesthetic-only narrowing is implemented, archive these. If not yet, they're authoritative |
| `REFERRAL-PROMPTS.md`, `referral-claude-code-prompts.md`, `deposit-payment-link-plan.md` | These are forward roadmap. Do they still ship? If yes, brand sweep. If no, archive |
| `apps/web/content/posts/building-multi-tenant-saas-nextjs.md`, `real-time-features-websockets-nestjs.md` | Engineering devblog — keep, retire, or move to a separate engineering blog? |
| Capacitor mobile app, Spanish locale, public booking widget | Out of scope of "docs," but each implies a doc. Decide once |

---

## Tier 4: Archive candidates

Move under `archive/` once their work is shipped or superseded:

- `AI-HUB-FIX-PLAN.md` (sprint snapshot)
- `BookingOS_Implementation_Prompts.md`
- `CLAUDE-CODE-PROMPTS.md` (root — duplicate already exists in archive/)
- `dashboard-bugs-fix-prompts.md`
- `referral-claude-code-prompts.md`
- `reports/customer-validation-2026-03-14.md` (pre-launch snapshot, replace with first-pilot-cohort report later)
- `self-review-loop-skill.md` (likely duplicate of `.claude/skills/self-review-loop/SKILL.md`)
- `AI-Hub-Validation-Report.md` (rename or archive once superseded)

---

## Six docs that need to be CREATED

These don't exist. Each one is gated by a decision the founder has to make before writing.

### 1. `docs/PILOT-OPS.md` — Pilot operations playbook
**Owner decision:** triage SLA, qualification bar, kill criteria, pilot length, pricing band.
**Contents:** how to triage `PilotApplication` rows in admin (NEW → CONTACTED → ACCEPTED/REJECTED), qualification questions on the discovery call, what to provision when ACCEPTED (business record, demo data, channels), pilot success criteria (e.g. "10+ qualified leads handled, 3+ recovered bookings, response time <X hours within 30 days"), kill criteria (e.g. "no recovered booking attributed in first 21 days").

### 2. `docs/PILOT-SALES-SCRIPT.md` — Pitch and objection handling
**Owner decision:** opening line, three proof points, top five objections.
**Contents:** target persona, opening hook, AI Front Desk demo flow in 8 minutes, ROI calculator framing, objection responses ("we already use Boulevard," "is this HIPAA compliant," "will the AI sound like us," "what if it sends something wrong"), close. Different from `SALES-DEMO-PLAN.md` (the demo flow); this is the conversation around it.

### 3. `docs/RECOVERED-REVENUE-DEFINITION.md` — Attribution rules
**Highest priority of the six.** Without this, you can't tell if a pilot worked.
**Owner decision:** attribution window, AI-assist threshold, tie-breaks, manual override policy.
**Contents:** definitions of `INBOUND_LEAD`, `AI_DRAFT`, `WAITLIST_FILL`, `CONSULT_FOLLOWUP` sources; rules for `OPEN`/`BOOKED`/`WON`/`LOST` transitions; the 14-day default window and when it shrinks/expands; what counts as "AI-assisted" (e.g. AI draft sent within X minutes of customer message → all subsequent bookings attributed to AI for Y days); estimated value computation (booking value? lifetime value? deposit?); confidence flags; how staff can override an attribution.

### 4. `docs/COMPLIANCE-POSTURE.md` — What we DO and DO NOT claim
**Owner decision:** when (if ever) to upgrade compliance claims.
**Contents:** explicit "we DO claim" list (HTTPS, RBAC, tenant isolation, audit-minded ops, webhook signature verification, encryption in transit, staff approval mode); explicit "we DO NOT claim" list (HIPAA, BAA, PHIPA, GDPR-as-product-feature, "encrypted at rest" without proof, "fully automated"); marketing copy guardrails; legal-review trigger conditions; US/Canada scope; what to do if a prospect asks for a BAA (decline politely + explain what we offer instead).

### 5. `docs/AI-FRONT-DESK-OPERATOR-GUIDE.md` — In-product help for clinic staff
**Owner decision:** target reading level (clinic receptionist, not engineer).
**Contents:** how to approve/edit/reject an AI draft; when to override; how to handle a misclassified intent; how to read the front-desk summary dashboard; when to escalate to a manager; common message types and what good looks like. This is what's missing for the actual end-users.

### 6. `docs/PLATFORM-DECOMMISSION-PLAN.md` — Fate of "all-in-one" features
**Owner decision:** hide, deprioritize, or remove?
**Contents:** for each non-wedge surface (Campaigns, marketing agents, invoices, clinical photos/records, broad CRM, mobile app, Spanish locale, platform admin console), the decision: kept-and-hidden / kept-and-deprioritized / removed. With sequencing: which to hide before first pilot, which to leave running. Rationale: the codebase currently says "all-in-one" while the marketing says "AI Front Desk" — that tension breeds half-pivoted commits forever unless a doc resolves it.

---

## Suggested execution order

1. **Decisions first.** Spend an hour on the questions in Tier 3 and the Six Missing Docs. Without these, the next 30 doc edits are guesses.
2. **Tier 1 rewrites.** PROJECT_CONTEXT, DESIGN_DOCUMENTATION, SALES-DEMO-PLAN, DEMO_SCRIPT (or archive), outbound-prospecting agent. These set the narrative for everything else.
3. **Create the Six Missing Docs.** Especially `RECOVERED-REVENUE-DEFINITION.md` — this gates pilot evaluation.
4. **Tier 2 sweep.** Mostly mechanical brand renames; agent prompts get the new audience.
5. **Tier 4 archive.** Clean up.
6. **Verify.** `git grep -i "booking os\|all-in-one\|service businesses\|hundreds of clinics"` should return only results inside `archive/`, internal package names, and intentional historical references.

---

## Claude Code prompt to execute the doc updates

Paste this in Claude Code after `HANDOFF-BCC-WEDGE.md` is finished and committed:

````text
Implement the documentation pivot per HANDOFF-DOCS-PIVOT.md. Stay on branch
codex-business-command-centre-wedge.

Constraints:
- Do not change internal package names, repo name, DB names, Stripe IDs, or @booking-os/* references.
- All visible product copy uses "Business Command Centre" (brand) and "AI Front Desk" (wedge).
- Target market in copy: US / Canada aesthetic clinics.
- AI defaults documented as: drafts/suggestions on, auto-send off, staff approval required.
- Compliance copy stays conservative — no HIPAA/BAA/PHIPA/"encrypted at rest" claims.

Order of work:

1. Ask me the Tier 3 decisions and the questions for the Six Missing Docs before
   writing anything. Do not assume answers. Capture answers in HANDOFF-DOCS-PIVOT.md
   under a new "Decisions made" section.

2. Tier 1 rewrites, in this order:
   - docs/PROJECT_CONTEXT.md
   - DESIGN_DOCUMENTATION.md
   - docs/SALES-DEMO-PLAN.md
   - DEMO_SCRIPT.md (rewrite or move to archive/)
   - agents/outbound-prospecting.md

3. Create the Six Missing Docs in this order:
   - docs/RECOVERED-REVENUE-DEFINITION.md  (highest priority — gates pilot evaluation)
   - docs/PILOT-OPS.md
   - docs/PILOT-SALES-SCRIPT.md
   - docs/COMPLIANCE-POSTURE.md
   - docs/AI-FRONT-DESK-OPERATOR-GUIDE.md
   - docs/PLATFORM-DECOMMISSION-PLAN.md

4. Tier 2 brand sweep across the files listed in HANDOFF-DOCS-PIVOT.md.
   For agents/*.md and system/*.md, also narrow audience and change CTAs.

5. Tier 4 archive moves. Use `git mv path archive/path` so history is preserved.

6. Verification:
   git grep -i "booking os" -- ':!node_modules' ':!archive/' ':!*.lock' ':!packages/*/package*.json' ':!HANDOFF-*.md'
   git grep -i "all-in-one\|operating system for service\|hundreds of clinics" -- ':!node_modules' ':!archive/'
   Both should return zero or near-zero hits (only intentional historical references).

7. Self-review per .claude/skills/self-review-loop/SKILL.md. Re-read every doc
   you touched and verify positioning is consistent across all of them.

8. Commit in logical chunks: one commit per Tier so the history reads as a
   pivot, not a patch storm.
````

Stop reading HANDOFF-DOCS-PIVOT.md when this section ends — everything below would just repeat the audit.
