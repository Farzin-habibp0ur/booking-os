# BookingOS Documentation Optimization Plan (v2 — Revised)

**Created:** 2026-04-03
**Author:** Farz + Claude
**Status:** Ready for implementation
**Goal:** Reduce CLAUDE.md from 952 → ~715 lines, fix mismatched skills, add 1 project-specific skill, add doc-maintenance + self-validation rules

---

## Revision Notes — What Changed Across Reviews

### v1 → v2 (structural re-evaluation)

The first draft had three problems:

1. **Over-extraction.** Enums (28 lines) and env vars (26 lines) were slated for extraction. But enums are the *primary reference* — they don't exist in the Prisma schema, and Claude needs them almost every session. Both now stay in CLAUDE.md.

2. **Unnecessary new files.** v1 created 3 new docs. But `CHANNEL-SETUP.md`, `PROJECT_CONTEXT.md`, and `cicd.md` already cover those topics. Revised to 1 new doc + 1 extension of existing docs.

3. **Redundant skills.** v1 created 3 new skills. But CLAUDE.md is loaded automatically — duplicating its feature checklist and test patterns as on-demand skills adds maintenance with zero additional availability. Revised to 1 new skill (bookingos-brand only).

### v2 → v3 (doc-maintenance + self-validation)

v2 had a systemic gap: nothing told Claude to update documentation when code changes, and nothing enforced re-validation of work. The existing CLAUDE.md has a 13-step feature checklist and a 4-step pre-commit checklist — neither mentions documentation. A Claude session could add a new module, new enums, or new pages and never touch any docs.

Added Phase 2E with two new CLAUDE.md sections:

- **Documentation Dependency Map** — a specific "when you change X, update Y" table (not vague "keep docs in sync")
- **Self-Validation Protocol** — a 5-step loop (re-read → cross-cutting check → doc check → pre-commit → final review) that must pass with zero issues before work is considered done

This adds ~35 lines to CLAUDE.md, adjusting the target from ~680 to ~715. The tradeoff is worth it: 35 lines of maintenance rules prevent documentation drift across all future sessions.

---

## Current State Analysis

### CLAUDE.md — Section-by-Section Audit (952 lines)

| Section | Lines | Range | Verdict | Reasoning |
|---|---|---|---|---|
| Project Intro + Credentials | 19 | 1–19 | **KEEP** | Essential context, always needed |
| Monorepo Structure | 60 | 22–82 | **KEEP** | Core reference, worth the tokens |
| Tech Stack | 24 | 86–109 | **KEEP** | Quick lookup table |
| Vertical Pack System | 32 | 113–144 | **KEEP** | Critical for vertical-aware development |
| Backend Conventions (Module/Auth/API/Error/DB) | 57 | 147–204 | **KEEP** | Core rules and conventions |
| Key Enums | 28 | 206–233 | **KEEP** | Primary reference — not in Prisma schema, needed every session |
| BullMQ Queues | 15 | 235–248 | **KEEP** | Contains "don't add new queues" rule |
| Real-Time + WebChat details | 10 | 250–258 | **TRIM** | Keep event list, move WebChat specifics to CHANNEL-SETUP.md |
| Omnichannel Messaging | 45 | 260–304 | **EXTRACT** | Deep implementation detail → extend CHANNEL-SETUP.md |
| Inbox UX Features | 23 | 292–304 | **EXTRACT** | Implementation spec → extend CHANNEL-SETUP.md |
| Frontend Conventions (core) | 35 | 308–341 | **KEEP** | Core rules |
| Page Categories | 8 | 317–325 | **EXTRACT** | Reference listing → new REFERENCE.md |
| Mobile App (Capacitor) | 9 | 344–351 | **KEEP** | Brief enough |
| Component Patterns | 16 | 353–368 | **KEEP** | Dev conventions |
| Design Tokens listing | 10 | 370–380 | **TRIM** | Keep rule, trim list of all maps |
| Navigation Structure | 22 | 382–403 | **EXTRACT** | Implementation detail → new REFERENCE.md |
| Design System & UI | 65 | 407–471 | **KEEP core, TRIM animations** | Typography + colors = essential. Animations already in DESIGN_DOCUMENTATION.md |
| Platform Console | 40 | 475–514 | **EXTRACT** | Separate app, rarely needed inline → new REFERENCE.md |
| Testing Conventions | 55 | 518–572 | **KEEP** | Core dev convention |
| Feature Checklist | 18 | 576–593 | **KEEP** | Critical workflow |
| Environment Variables | 26 | 596–621 | **KEEP** | "NEXT_PUBLIC baked at build time" note prevents real bugs |
| Seed Data table | 15 | 625–639 | **EXTRACT** | Rarely needed inline → new REFERENCE.md |
| Common Commands | 52 | 643–694 | **TRIM** | Keep essential 8, cut duplicates |
| CI/CD Pipeline | 33 | 698–730 | **TRIM** | Keep summary + Railway table, point to docs/cicd.md |
| Deployment Rules (1–18) | 55 | 733–787 | **KEEP** | Critical, hard-won production rules |
| AI Architecture | 97 | 791–887 | **TRIM** | Keep summary table + 3-system warning, point to PROJECT_CONTEXT.md |
| Marketing Site | 12 | 891–901 | **KEEP** | Brief enough |
| Key Documentation table | 16 | 905–921 | **KEEP** | Navigation aid |
| Do Not Build | 10 | 925–933 | **KEEP** | Critical guardrails |
| Pre-Commit Checklist | 16 | 937–951 | **KEEP** | Critical workflow |

**Estimated reduction: ~270 lines → CLAUDE.md target: ~680 lines**

### Validation Findings

Verified against the actual codebase on 2026-04-03:

1. **Enums are NOT defined in Prisma schema** (`grep "^enum " schema.prisma` = 0 results). They're TypeScript enums in `packages/shared/` and service files. The CLAUDE.md list is the primary discoverable reference. **Decision: KEEP in CLAUDE.md.**

2. **DESIGN_DOCUMENTATION.md (1,410 lines) already documents micro-animations.** The 12-line animation list in CLAUDE.md is a direct duplicate. **Decision: Remove from CLAUDE.md, add pointer.**

3. **PROJECT_CONTEXT.md (1,302 lines) already documents AI architecture** — intent detection, reply generation, booking assistant, agentic framework. **Decision: Keep summary table in CLAUDE.md, point to PROJECT_CONTEXT.md for details.**

4. **CHANNEL-SETUP.md (396 lines) already documents channel setup.** The omnichannel messaging *architecture* (services, patterns, UI components) is related but distinct — it belongs as an extension of CHANNEL-SETUP.md, not a separate file. **Decision: Extend CHANNEL-SETUP.md.**

5. **docs/cicd.md already documents CI/CD pipeline details** — job descriptions, service containers, environment variables. **Decision: Point to cicd.md instead of duplicating.**

6. **No `.claudeignore` exists.** Confirmed. 84 modules + non-code directories would pollute search results.

7. **`brand-guidelines` skill uses Anthropic's brand** (Poppins/Lora, `#d97757` orange). Confirmed conflict with BookingOS (Inter/Playfair Display, Sage `#8AA694`/Lavender `#9F8ECB`). **Decision: Replace.**

8. **`google-sheets-memory` skill references "Cyber Legends."** Tab names (Pipeline Ground Truth, Team Roles) have no BookingOS equivalent. **Decision: Remove.**

### Skills Audit

| Skill | Status | Action | Reasoning |
|---|---|---|---|
| docx | Relevant | Keep | Document generation for clients |
| xlsx | Relevant | Keep | Export features, billing reports |
| pdf | Relevant | Keep | Invoices, booking confirmations |
| pptx | Relevant | Keep | Sales decks, investor presentations |
| schedule | Relevant | Keep | Aligns with agent scheduling system |
| skill-creator | Meta-useful | Keep | For building future skills |
| doc-coauthoring | Useful | Keep | Writing specs, PRDs, decision docs |
| canvas-design | Low relevance | Keep | No harm, optional creative use |
| brand-guidelines | **CONFLICTING** | **Replace** | Uses Anthropic's brand, not BookingOS's |
| google-sheets-memory | **IRRELEVANT** | **Remove** | References different project |

---

## Implementation Plan — 4 Phases

### Phase 1: Quick Wins (No Code Changes)

**Estimated time: 30 minutes**
**Risk: None**

#### 1A. Create `.claudeignore`

Create `/booking-os/.claudeignore`:

```
# Generated outputs (reports, briefings, logs — not source code)
reports/
briefings/
queue/
logs/
engagement/
calendar/

# Archive (superseded docs)
archive/

# Media assets
assets/recordings/

# Build artifacts
node_modules/
.next/
dist/
apps/web/ios/
apps/web/android/

# Growth engine (file-based agent prompts, not NestJS code)
agents/
system/
data/
briefs/
design-specs/
```

**Why these entries:** Each directory was verified to contain non-code content. The `agents/` directory contains prompt files for BookingOS's internal marketing engine — explicitly documented in CLAUDE.md as "NOT NestJS code." These files are still accessible via the `Read` tool with a direct path; `.claudeignore` only excludes them from Glob/Grep indexing.

#### 1B. Remove `google-sheets-memory` skill

Delete `/mnt/.claude/skills/google-sheets-memory/`. References "Cyber Legends" project with irrelevant tab names. If agent memory persistence is needed for BookingOS later, create a purpose-built skill.

#### 1C. Remove `brand-guidelines` skill

Delete `/mnt/.claude/skills/brand-guidelines/`. Applies Anthropic's brand (Poppins, Lora, `#d97757`) which conflicts with BookingOS's design system. Replaced in Phase 3.

---

### Phase 2: CLAUDE.md Slim Down

**Estimated time: 2–3 hours**
**Risk: Low — moves content, doesn't delete it**
**Target: 952 → ~680 lines**

Strategy: extract reference-heavy sections to either 1 new doc or existing docs. Replace with 2–3 line pointers. No information is lost.

#### 2A. Create `docs/REFERENCE.md` (1 new file, ~120 lines)

Collects "lookup table" content that developers need occasionally but not every session.

**Move into it:**

1. **Page Categories** (CLAUDE.md lines 317–325) — full listing of 91+ pages by category
2. **Navigation Structure details** (CLAUDE.md lines 382–403) — mode splits, overflow, chord shortcuts, mobile gestures, DateScroller
3. **Platform Console** (CLAUDE.md lines 475–514) — admin app architecture, features list, console-specific models
4. **Seed Data table** (CLAUDE.md lines 625–639) — 9-row table of seed scripts

**Replace in CLAUDE.md with:**
```markdown
### Page Categories
> 91+ pages across public, protected, and console. See `docs/REFERENCE.md` for the full listing.

### Navigation Structure
Single source of truth at `nav-config.ts` + `mode-config.ts`. 4 sidebar sections: Workspace / Tools / Insights / AI & Agents. Command palette (⌘K) searches all pages.
> For detailed nav implementation (mode splits, overflow, chord shortcuts, mobile): see `docs/REFERENCE.md`.

## Platform Console (Super Admin)
The Console is a standalone Next.js app at `apps/admin/` (port 3002) for SUPER_ADMIN users. Dark sidebar theme, 20 routes across 11 sections. Auth flows through the customer app.
> For full console documentation: see `docs/REFERENCE.md`.

## Seed Data
All seed scripts in `packages/db/src/`. Idempotent (safe to re-run).
> For the full seed script table with commands: see `docs/REFERENCE.md`.
```

**Net savings: ~70 lines**

#### 2B. Extend `docs/CHANNEL-SETUP.md` (existing file)

Add a new section "## Messaging Architecture" at the bottom of the existing CHANNEL-SETUP.md. Move into it:

1. **Omnichannel key services** (CLAUDE.md lines 264–280) — CustomerIdentityService, CircuitBreakerService, DLQ, UsageService
2. **Key patterns** (CLAUDE.md lines 272–280) — channel denormalization, lastInboundChannel, webhook signatures
3. **UI components** (CLAUDE.md lines 282–290) — ChannelBadge, ReplyChannelSwitcher, ChannelsOnFile, etc.
4. **Inbox UX features** (CLAUDE.md lines 292–304) — adaptive composer, channel pills, draft persistence
5. **WebChat gateway details** (CLAUDE.md lines 255–258) — visitor sessions, pre-chat forms, file uploads

**Replace in CLAUDE.md with:**
```markdown
### Omnichannel Messaging
BookingOS supports 6 channels: WhatsApp, Instagram DM, Facebook Messenger, SMS, Email, Web Chat. All fully implemented.
- Customer identity resolution: `CustomerIdentityService` (phone → email → social IDs)
- Circuit breaker on all outbound calls: `CircuitBreakerService`
- All webhooks verify provider signatures (HMAC-SHA256/SHA1, timing-safe comparison)
> For service architecture, UI components, and inbox UX patterns: see `docs/CHANNEL-SETUP.md` § Messaging Architecture.
```

**Why extend rather than create:** CHANNEL-SETUP.md already covers *how to configure* each channel. Adding *how the messaging system works internally* is a natural companion. Developers working on messaging will read one file, not two.

**Net savings: ~55 lines**

#### 2C. Trim AI Architecture section (in-place)

Keep the component summary table (10 lines) and the 5 operational agent descriptions (15 lines). Trim:

1. **AI Draft Pipeline details** (lines 808–829) — 5-step flow, key endpoints → already in PROJECT_CONTEXT.md
2. **Marketing agents list** (lines 847–856) → already documented in admin app, filtered from customer API
3. **Internal Growth Engine** (lines 859–867) → file-based, described in "agents/" section of monorepo structure
4. **Internal vs External Boundary table** (lines 869–887) → reference material, rarely needed inline

**Replace extracted content with:**
```markdown
### AI Draft Pipeline & Agents
> For the full auto-reply flow, key endpoints, and agent details: see `docs/PROJECT_CONTEXT.md`.
**Three AI systems exist and are completely separate:** operational agents (NestJS, customer-facing), marketing agents (NestJS, admin-only via SUPER_ADMIN), growth engine (file-based prompts in `agents/`). Do not confuse them.
```

**Net savings: ~60 lines**

#### 2D. Trim remaining sections (in-place edits)

| Edit | What changes | Saves |
|---|---|---|
| **Design Tokens** (370–380) | Remove list of all token maps/helpers. Keep: "Centralized in `design-tokens.ts` — always import from here. Never define inline status color objects." | ~8 lines |
| **Micro-Animations** (456–467) | Remove entirely — direct duplicate of DESIGN_DOCUMENTATION.md. Add: "For micro-animation CSS classes, see `DESIGN_DOCUMENTATION.md`." | ~12 lines |
| **Common Commands** (643–694) | Remove Capacitor commands (already in Mobile section), Docker build (in CI/CD), Prisma Studio (in Database section). Keep: install, dev, format, format:check, lint, test, generate, migrate, seed. | ~20 lines |
| **CI/CD job details** (706–719) | Remove per-job descriptions (lint-and-test, docker-build, e2e-test, mobile CI). Keep pipeline diagram + Railway table. Add: "For full job details, see `docs/cicd.md`." | ~15 lines |
| **PublicBookingController slug logic** (257–258) | Move to CHANNEL-SETUP.md with other WebChat content | ~3 lines |

**Net savings: ~58 lines**

#### Phase 2 Total

| Source | Lines saved |
|---|---|
| 2A. Page categories, nav, console, seeds → REFERENCE.md | ~70 |
| 2B. Omnichannel, inbox UX, WebChat → CHANNEL-SETUP.md | ~55 |
| 2C. AI draft pipeline, marketing agents, boundary → pointer to PROJECT_CONTEXT.md | ~60 |
| 2D. Tokens, animations, commands, CI/CD trimming | ~58 |
| 2E. Documentation maintenance + validation rules (ADDED) | +35 lines |
| **Net total** | **~208 lines saved** |

**Revised CLAUDE.md: ~952 - 208 = ~744 lines** (realistically ~715 after whitespace cleanup)

#### 2E. Add Documentation Maintenance Rules & Self-Validation Protocol (NEW)

These are two new sections that get **added** to CLAUDE.md. They cost ~35 lines but solve a critical gap: currently, nothing tells Claude to update docs when code changes, and nothing enforces re-validation of work before considering it done.

##### Documentation Dependency Map

Add this after the "How to Add a New Feature (Checklist)" section, as **step 14** in the checklist AND as a standalone reference:

```markdown
## Documentation Maintenance (MANDATORY)

When you modify code, you MUST update the corresponding documentation. This is not optional.

### Dependency Map — What to Update When

| When you change...                     | Update these                                                                                      |
|----------------------------------------|---------------------------------------------------------------------------------------------------|
| New Prisma model                       | CLAUDE.md model count, seed script if demo data needed                                            |
| New/changed enum value                 | CLAUDE.md Key Enums section (this is the primary reference — not in Prisma schema)                |
| New API module                         | Register in `app.module.ts`, CLAUDE.md module count if stated                                     |
| New page or route                      | `docs/REFERENCE.md` page categories, `nav-config.ts`, `mode-config.ts`, `locales/*.json`          |
| New environment variable               | CLAUDE.md env vars table, `.env.example` with comment                                             |
| Design system change (colors/tokens)   | `design-tokens.ts`, CLAUDE.md Design System section, `DESIGN_DOCUMENTATION.md`                    |
| New BullMQ queue                       | CLAUDE.md BullMQ section (and discuss consolidation — 8 is already a lot)                         |
| New messaging channel or provider      | `docs/CHANNEL-SETUP.md`, CLAUDE.md omnichannel summary                                           |
| New agent type                         | CLAUDE.md Key Enums (AgentType), `docs/PROJECT_CONTEXT.md`                                        |
| New seed script                        | `docs/REFERENCE.md` seed table                                                                    |
| Auth, cookie, or CORS change           | `DEPLOY.md`, then verify with the curl command in CLAUDE.md § Deployment Rules                    |
| New Socket.IO event                    | CLAUDE.md Real-Time event list                                                                    |
| Deployment or infrastructure change    | `DEPLOY.md` (read it first — it documents hard-won lessons)                                       |
| New vertical pack                      | CLAUDE.md Vertical Pack System, `docs/PROJECT_CONTEXT.md`, seed scripts                           |

### Rules
- If you're unsure whether a doc needs updating, check. It's faster to verify than to fix stale docs later.
- Never update CLAUDE.md model/module/page counts with approximate numbers — count the actual items.
- When extracting content to a reference doc, always leave a pointer in CLAUDE.md.
- After updating any doc, re-read the section you changed to confirm it's consistent with surrounding content.
```

##### Self-Validation Protocol

Add this after the Pre-Commit Checklist:

```markdown
## Self-Validation Protocol (MANDATORY)

After completing ANY task (feature, bugfix, refactor, doc update), perform this validation loop:

### Step 1: Re-read your changes
- Re-read every file you modified. Check for: typos, inconsistencies, missing imports, incomplete implementations.
- If you find issues, fix them before proceeding.

### Step 2: Verify cross-cutting concerns
- Did you add a new component? Check: tests exist, translations added, design tokens used (not inline colors).
- Did you change an API endpoint? Check: DTOs have validators, controller has guards, tests cover success AND error paths.
- Did you modify the schema? Check: migration created, Prisma client regenerated, seed scripts still valid.
- Did you change auth or cookies? Run the curl verification command from Deployment Rules.

### Step 3: Documentation check
- Consult the Documentation Dependency Map above. Update every doc that your change affects.
- If you changed CLAUDE.md, verify it's under the target line count (see version header).

### Step 4: Run pre-commit checks
- `npm run format` → `npm run format:check` → `npm run lint` → `npm test`
- If ANY step fails, fix it and restart from Step 1 (not just Step 4).

### Step 5: Final review
- Re-read the complete diff of all changes one more time.
- Ask yourself: "If someone reviews this PR tomorrow, will anything surprise them?"
- If yes, fix it or add a comment explaining why.

Do NOT consider work complete until all 5 steps pass with zero issues. Loop as many times as needed.
```

**Why this belongs in CLAUDE.md (not a skill):** These are behavioral rules that must be active in every session. Skills are on-demand; CLAUDE.md is always loaded. A Claude session that modifies code but doesn't update docs creates drift that compounds over time. Making it a permanent rule in the always-loaded file ensures it's never skipped.

**Impact on Feature Checklist:** Step 14 should be added:
```
14. **Documentation** — Consult the Documentation Dependency Map and update all affected docs
```

**Impact on Pre-Commit Checklist:** The Self-Validation Protocol supersedes the current pre-commit checklist. The pre-commit steps (format → lint → test) become Step 4 of the broader protocol. Keep the pre-commit section as-is for quick reference, but add a note: "This is Step 4 of the Self-Validation Protocol. Complete all 5 steps before considering work done."

---

### Phase 3: Create BookingOS Brand Skill

**Estimated time: 1 hour**
**Risk: None — adds 1 new skill**

#### 3A. Create `bookingos-brand` skill

**Location:** `/mnt/.claude/skills/bookingos-brand/SKILL.md`

**Purpose:** Replace the removed `brand-guidelines` skill with one using BookingOS's actual design system. This skill is valuable because it activates when generating visual outputs alongside other skills (pptx, docx, canvas-design) — it's the styling layer, not a development rule.

**SKILL.md frontmatter:**
```yaml
---
name: bookingos-brand
description: "Applies BookingOS brand styling (Sage/Lavender palette, Inter/Playfair Display typography, rounded-2xl components) to any visual output. Use whenever creating styled documents, presentations, PDFs, UI mockups, charts, or any artifact that should match BookingOS's design system. Also trigger when the user mentions brand colors, styling, design guidelines, visual formatting, or wants something to 'look like BookingOS'. This skill should be used alongside docx, pptx, pdf, and canvas-design skills to ensure correct branding."
---
```

**Skill body should encode:**

```markdown
# BookingOS Brand Guidelines

## Typography
- **Display / Headers:** Playfair Display (Google Fonts) — use for page titles, large metrics, high-impact headers
- **Body / UI / Data:** Inter (Google Fonts) — use for body text, labels, buttons, table data
- **Fallbacks:** Playfair Display → Georgia; Inter → Arial/Helvetica

## Color Palette

### Sage (primary actions, success, confirmations)
| Token | Hex | Usage |
|---|---|---|
| sage-50 | #F4F7F5 | Badge backgrounds |
| sage-100 | #E4EBE6 | Hover states |
| sage-500 | #8AA694 | Icons, accents |
| sage-600 | #71907C | Primary buttons, links |
| sage-900 | #3A4D41 | Badge text |

### Lavender (AI features, highlights, pending states)
| Token | Hex | Usage |
|---|---|---|
| lavender-50 | #F5F3FA | AI feature backgrounds |
| lavender-100 | #EBE7F5 | AI borders |
| lavender-500 | #9F8ECB | AI accents |
| lavender-600 | #8A75BD | AI interactive elements |
| lavender-900 | #4A3B69 | AI badge text |

### Neutrals
- Background: #FCFCFD (warm off-white — never use gray-50)
- Body text: slate-800
- Secondary text: slate-500

## Component Style Rules
1. Border radii: rounded-2xl default (rounded-3xl for auth/hero cards)
2. Borders: Avoid. Prefer soft, diffused drop shadows
3. Shadows: shadow-soft = 0 12px 40px -12px rgba(0,0,0,0.05)
4. Primary button: bg-sage-600 hover:bg-sage-700 text-white rounded-xl
5. Dark button: bg-slate-900 hover:bg-slate-800 text-white rounded-xl
6. Inputs: bg-slate-50 border-transparent focus:bg-white focus:ring-sage-500 rounded-xl
7. AI elements: Always use lavender palette (bg-lavender-50 border-lavender-100 text-lavender-900)

## Status Colors (from design-tokens.ts)
- Confirmed/Completed: sage (bg-sage-50, text-sage-900)
- Pending: lavender (bg-lavender-50, text-lavender-900)
- Cancelled/No-show: red (bg-red-50, text-red-700)
- In Progress: amber (bg-amber-50, text-amber-700)

## Design Philosophy
"Minimalist Premium" — Apple Health meets Stripe. Lots of whitespace, subtle shadows,
highly legible typography, deliberate use of color. No external component libraries.
```

**Why only this skill and not bookingos-dev / bookingos-testing:**
- CLAUDE.md is loaded *automatically* every session. The feature checklist and pre-commit rules are already there. A `bookingos-dev` skill would duplicate them — same information, lower availability (skills are on-demand, CLAUDE.md is always-on).
- Test patterns are already in CLAUDE.md's Testing Conventions section. Real spec files in the codebase (e.g., `booking.service.spec.ts`) serve as better templates than skill-maintained boilerplate that could drift from actual code.
- The brand skill fills a genuine gap: it provides styling information that other skills (pptx, docx, canvas-design) need when generating visual outputs. CLAUDE.md has this info too, but skills can co-trigger — when `pptx` triggers, `bookingos-brand` should also trigger to ensure correct styling.

---

### Phase 4: Maintenance & Scaling

**Estimated time: Ongoing**
**Risk: None**

#### 4A. Add CLAUDE.md version tracking

Add at the top of CLAUDE.md:
```markdown
<!-- Version: 2.0 | Last optimized: 2026-04-03 | Target: <730 lines -->
```

#### 4B. Quarterly review cadence

Every quarter, check:
- Has CLAUDE.md grown past 730 lines? Extract newly added reference material.
- Is `docs/REFERENCE.md` still accurate?
- Are the sections added to CHANNEL-SETUP.md still current?
- Is the `bookingos-brand` skill still aligned with design-tokens.ts?
- Has a new vertical or major feature been added that needs skill updates?

#### 4C. Future skills (evaluated, deferred)

| Skill | When to revisit | Justification |
|---|---|---|
| `bookingos-dev` | When onboarding a second developer | Currently redundant with CLAUDE.md; valuable for developers who don't read the full file |
| `bookingos-testing` | When test patterns diverge across apps | Currently, CLAUDE.md + existing spec files are sufficient |
| `prisma-ops` | When schema exceeds ~120 models | Would encode @@map names, migration conventions, JSON field rules |
| `bookingos-memory` | If cross-session agent state is needed | Currently agents use DB-backed `AgentConfig.lastRunAt` and `ActionCard` records |

---

## File Inventory — What Gets Created/Modified

| Action | File | Phase |
|---|---|---|
| CREATE | `.claudeignore` | 1A |
| DELETE | `/mnt/.claude/skills/google-sheets-memory/` | 1B |
| DELETE | `/mnt/.claude/skills/brand-guidelines/` | 1C |
| CREATE | `docs/REFERENCE.md` (~120 lines) | 2A |
| EXTEND | `docs/CHANNEL-SETUP.md` (+~70 lines) | 2B |
| EDIT | `CLAUDE.md` — extract sections (952 → ~715 lines) | 2A–2D |
| ADD | `CLAUDE.md` — Documentation Maintenance section (+~20 lines) | 2E |
| ADD | `CLAUDE.md` — Self-Validation Protocol section (+~15 lines) | 2E |
| ADD | `CLAUDE.md` — Feature Checklist step 14 (+1 line) | 2E |
| CREATE | `/mnt/.claude/skills/bookingos-brand/SKILL.md` | 3A |
| EDIT | `CLAUDE.md` (add version header) | 4A |

**Total new files: 3** (down from 6 in v1)
**Total extended files: 1**
**Total deleted: 2 skill directories**
**Total edited: 1 (CLAUDE.md)**

---

## Validation Checklist

### Phase 1
- [ ] `.claudeignore` exists at repo root with correct entries
- [ ] `google-sheets-memory` skill directory is deleted
- [ ] `brand-guidelines` skill directory is deleted
- [ ] No remaining skill references "Cyber Legends" or Anthropic colors

### Phase 2
- [ ] CLAUDE.md is under 730 lines
- [ ] Every extracted section has a 2–3 line pointer in CLAUDE.md
- [ ] Key Enums section is STILL in CLAUDE.md (not extracted — primary reference)
- [ ] Environment Variables table is STILL in CLAUDE.md (not extracted — critical notes)
- [ ] `docs/REFERENCE.md` contains: page categories, navigation details, console details, seed data
- [ ] `docs/CHANNEL-SETUP.md` has new "Messaging Architecture" section with: services, patterns, UI components, inbox UX
- [ ] No information was deleted — only moved or pointed to existing docs
- [ ] Pointers reference correct docs: PROJECT_CONTEXT.md for AI, cicd.md for pipeline, DESIGN_DOCUMENTATION.md for animations
- [ ] Documentation Dependency Map section exists with the full change→doc mapping table
- [ ] Self-Validation Protocol section exists with all 5 steps
- [ ] Feature Checklist now has 14 steps (step 14: Documentation)
- [ ] Pre-Commit Checklist references the Self-Validation Protocol

### Phase 3
- [ ] `bookingos-brand` skill uses Sage #8AA694 (not Anthropic #d97757)
- [ ] `bookingos-brand` skill uses Lavender #9F8ECB (not Anthropic #6a9bcc)
- [ ] `bookingos-brand` skill uses Inter + Playfair Display (not Poppins + Lora)
- [ ] Skill description mentions co-triggering with docx/pptx/pdf/canvas-design
- [ ] Background color is #FCFCFD (not gray-50 or #faf9f5 which is Anthropic's)

### Phase 4
- [ ] CLAUDE.md has version header with target line count
- [ ] Quarterly review is calendared
