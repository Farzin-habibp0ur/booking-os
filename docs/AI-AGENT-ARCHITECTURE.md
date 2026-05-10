# AI Agent Architecture — 5/15/12 Boundary + Path A vs Path B

> **Purpose:** Explains the three AI systems running across BCC: 5 customer-facing operational agents (in code), 15 file-based marketing prompts (BCC's own growth engine), and 12 in-app marketing agents (dormant). They're often confused; this document is the canonical boundary.
>
> **Audience:** Engineering, founder, future hires. Anyone who has to answer "is this an agent?" or "where does this code live?"
> **Last updated:** 2026-05-09

---

## The three systems at a glance

| System                           | Count | Where                                   | Surface                   | Status                                    |
| -------------------------------- | ----- | --------------------------------------- | ------------------------- | ----------------------------------------- |
| **Operational agents**           | 5     | `apps/api/src/modules/agent-framework/` | Customer-facing (clinics) | LIVE — bundled into the AI Front Desk SKU |
| **File-based marketing prompts** | 15    | `agents/*.md` (root of repo)            | BCC-only (we run these)   | LIVE — Path A primary growth engine       |
| **In-app marketing agents**      | 12    | `apps/api/src/modules/marketing-agent/` | BCC-internal (admin)      | DORMANT — `AgentConfig.isEnabled = false` |

These are completely separate. Do not consolidate them. Do not enable the dormant set without hitting the trigger conditions in §Path B below.

---

## System 1: 5 operational agents (customer-facing)

### What they are

Background agents that run inside each clinic's tenant, generating action cards and (sometimes) drafting follow-up messages for staff approval. They're part of the **AI Front Desk** product.

### The five agents

| Agent                      | Purpose                                                   | Card expiry     |
| -------------------------- | --------------------------------------------------------- | --------------- |
| `WaitlistAgent`            | Auto-match waitlist entries to cancelled slots.           | 48 hours        |
| `RetentionAgent`           | Detect at-risk customers; generate win-back action cards. | 14 days         |
| `DataHygieneAgent`         | Duplicate detection, incomplete-profile flagging.         | 30 days         |
| `SchedulingOptimizerAgent` | Gap detection, optimal-slot suggestions.                  | 1 day after gap |
| `QuoteFollowupAgent`       | Expired quote reminders, follow-up cards.                 | 7 days          |

All five set `expiresAt` on `ActionCard` records. The `@Cron(EVERY_MINUTE)` expiry job auto-transitions expired PENDING cards to EXPIRED status.

### How they run

- **Scheduled** by `AgentSchedulerService` per each agent's `AgentConfig.runIntervalMinutes`.
- **Tenant-isolated** — every agent run scopes to a single `businessId`.
- **Tracked** via `AgentRun` records (status / results / errors / duration). `AgentConfig.lastRunAt` updated on every run for observability.
- **Action cards** are the agents' output, surfaced in the inbox and dashboard.
- **Pre-generated messages** — Retention, Quote, and Waitlist agents store channel-specific `suggestedMessages` in card metadata so staff can send a follow-up via the customer's preferred channel without re-prompting the AI.
- **Autonomy levels** per agent type via `AutonomyConfig`: OFF → SUGGEST → AUTO_WITH_REVIEW → FULL_AUTO. Default at provisioning is conservative (SUGGEST). Increases as trust builds.

### Why these five

They are the wedge proof points. Each agent maps to one of the seven attribution reasons in [`docs/BOOKING-ATTRIBUTION-DEFINITION.md`](BOOKING-ATTRIBUTION-DEFINITION.md):

- `WaitlistAgent` → `WAITLIST_MATCH` attribution
- `QuoteFollowupAgent` → `QUOTE_FOLLOWUP` attribution
- `RetentionAgent`, `SchedulingOptimizerAgent`, `DataHygieneAgent` — operational support that increases the surface area of conversations the AI Front Desk can act on (which feeds `AI_BOOKING`, `AFTER_HOURS_AI`, and `UNANSWERED_THRESHOLD` attributions indirectly).

The customer (clinic) sees the action cards these agents generate. The clinic does not see the agents themselves except in the AI command center page (`/ai`).

### Where this surfaces in product

- `/ai` — AI command center for the clinic (Overview / Agents / Actions / Performance tabs).
- `/ai/agents` — enable / disable individual agents, configure schedules and autonomy levels.
- `/inbox` — action cards inline + bulk follow-up.
- `/dashboard` — briefing feed sourced from action cards.

### Where the code lives

```
apps/api/src/modules/agent-framework/         # Framework + scheduler + feedback
apps/api/src/modules/agent-skills/             # Pack-aware skill catalog
apps/api/src/modules/agent-config/             # AgentConfig CRUD
apps/api/src/modules/<agent-name>-agent/       # Individual agent implementations
```

---

## System 2: 15 file-based marketing prompts (BCC's own marketing)

### What they are

A directory of markdown prompts that we (BCC) run as the file-based primary growth engine. Each `.md` is an agent specification — purpose, schedule, inputs, outputs, anti-spam rules, fallback. We run them by reading the spec, executing it (with AI assistance), and writing outputs to the queue / briefings / engagement / reports directories.

This is **not** a product feature. It's how BCC does its own marketing.

### The 15 prompts

Located in `agents/*.md`:

- `master-orchestrator.md`
- `content-strategist.md`
- `blog-writer.md`
- `social-content-creator.md`
- `trend-scout.md`
- `visual-designer.md`
- `video-producer.md`
- `publisher.md`
- `performance-analyst.md`
- `learning-engine.md`
- `weekly-maintenance.md`
- `spanish-localization.md`
- `community-manager.md`
- `keyword-strategist.md`
- `outbound-prospecting.md`

(Originally 15 in the catalog — verify count after Phase 9 Tier 2 sweep.)

### Why file-based, not in-app

Three reasons:

1. **We are the user.** The growth engine is for BCC's own marketing operations. Building it as an in-app product to consume internally would be over-engineering before product-market fit on the clinic side.
2. **Prompts evolve faster than code.** Tweaking a markdown file is a 30-second loop; deploying a code change is a 15-minute loop. During growth-engine iteration, that 30-second loop is the asset.
3. **Founder bandwidth.** Path B (in-app) requires a marketing hire to operate. Path A (file-based) requires a founder + Claude Code + consistent rituals.

### How we operate this engine

The file-based engine is run end-to-end by the founder, daily / weekly, following the rituals in [`docs/BCC-MARKETING-OPERATOR-WORKFLOW.md`](BCC-MARKETING-OPERATOR-WORKFLOW.md). Outputs queue → review → publish via `queue/pending`, `queue/approved`, `queue/published`. Performance reports land in `reports/`.

This system feeds:

- BCC's blog (`apps/web/content/posts/*.md`)
- BCC's social / Instagram presence
- BCC's outbound prospecting (`agents/outbound-prospecting.md` → `queue/pending/[date]-YELLOW-outbound-en-prospecting.md`)
- BCC's own newsletter, case studies, video scripts

### Why it's clearly separate from the customer surface

Customers (clinics) never see the `agents/` directory. There is no UI surface. There are no tenant-isolated tables. It's prompts + outputs in the repo, period.

---

## System 3: 12 in-app marketing agents (DORMANT, embryo of product #2)

### What they are

Twelve NestJS services in `apps/api/src/modules/marketing-agent/agents/` that mirror the file-based prompts but are designed to run in-app, per-tenant. They were built during the pre-pivot "agentic-first" phase as the foundation of an in-app marketing automation product.

### The 12 agents

| Agent ID               | Purpose                                               |
| ---------------------- | ----------------------------------------------------- |
| `MKT_BLOG_WRITER`      | Generate blog content                                 |
| `MKT_SOCIAL_CREATOR`   | Generate social media posts                           |
| `MKT_EMAIL_COMPOSER`   | Generate email drafts (newsletters, drips, broadcast) |
| `MKT_CASE_STUDY`       | Generate customer case studies                        |
| `MKT_VIDEO_SCRIPT`     | Generate video scripts                                |
| `MKT_NEWSLETTER`       | Generate newsletter copy                              |
| `MKT_SCHEDULER`        | Schedule content for publishing                       |
| `MKT_PUBLISHER`        | Publish queued content                                |
| `MKT_PERF_TRACKER`     | Track per-piece performance metrics                   |
| `MKT_TREND_ANALYZER`   | Analyze trends inside performance data                |
| `MKT_CALENDAR_PLANNER` | Generate weekly content calendars                     |
| `MKT_ROI_REPORTER`     | Roll up content ROI for stakeholders                  |

### Status: DORMANT

- All 12 agents have `AgentConfig.isEnabled = false` by default.
- The `agent-config.service.ts` legacy filter list was updated in pivot Phase 2 to use these `MKT_*` IDs (replacing earlier short names like `'BlogWriter'`).
- Surfaces (`/marketing/queue`, `/marketing/agents`, `/marketing/sequences`) live in the **admin app** under `SUPER_ADMIN` gating only. Clinics do not see them.

### Why dormant

We chose **Path A** (file-based primary) over **Path B** (in-app primary) for Year 1. Reasons:

1. **Product focus.** AI Front Desk is the wedge. AI Marketing Manager is product #2 — distinct customer, distinct surface, distinct sales motion. Lighting it up now would dilute the wedge.
2. **Path A iterates faster.** The growth engine is still being calibrated. Markdown edits are faster than code edits.
3. **Customer value isn't proven for product #2.** Selling clinics on "AI Marketing Manager" requires proof points we don't yet have. AI Front Desk earns the trust first.

### Path B trigger conditions

We re-enable Path B (i.e., un-defer the 12 in-app agents and start surfacing them as a product) when **all** of these are true:

1. **5+ paying clinics on the AI Front Desk SKU** for at least 60 days each, with a measurable retention / health signal.
2. **A marketing hire.** Path B requires someone who's not the founder operating this layer day-to-day.
3. **A clear product framing.** "AI Marketing Manager" is the working name; the actual SKU, pricing, and positioning need a real product definition before code surfaces to customers.
4. **Customer pull.** At least 3 paying clinics ask, unprompted, for marketing automation help.

Until all four are true, the 12 in-app agents remain dormant. The file-based system carries the load.

### What "Path B activation" looks like

When triggered, Path B is a **separate product launch**, not a feature flip:

- AI Marketing Manager gets its own positioning, pricing, and sales motion.
- The 12 in-app agents become the production runtime.
- The 15 file-based prompts continue to evolve as the spec — they're the contract, the in-app agents are the implementation. (This is similar to how the operational agents have prose specs in `system/` and code in `apps/api/`.)
- A marketing hire owns the Path B operations day-to-day; the founder steps back to product strategy.

---

## The boundary, restated

| Question                                           | Answer                                                                              |
| -------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Where do clinics see "agents"?                     | The 5 operational agents, in `/ai/*` pages.                                         |
| Where does BCC operate marketing agents?           | File-based, by founder, in `agents/*.md` outputs.                                   |
| Where are the dormant in-app marketing agents?     | `apps/api/src/modules/marketing-agent/`. Only visible in admin app, gated, dormant. |
| Can clinics access the marketing agents?           | No. SUPER_ADMIN only.                                                               |
| Will AI Front Desk and AI Marketing Manager merge? | No. Two products, two SKUs, two sales motions.                                      |
| What about adding new operational agents (#6, #7)? | Possible, scoped to AI Front Desk. Each new agent must map to a wedge proof point.  |

---

## Implementation cross-reference

### Operational agents (System 1)

| File                                                        | Role                                              |
| ----------------------------------------------------------- | ------------------------------------------------- |
| `apps/api/src/modules/agent-framework/`                     | Framework, scheduler, feedback                    |
| `apps/api/src/modules/agent-config/agent-config.service.ts` | Per-business agent enablement                     |
| `apps/api/src/modules/agent-skills/`                        | Pack-aware skill catalog                          |
| `apps/api/src/modules/<agent-name>-agent/`                  | Individual agent code (5 of them)                 |
| `packages/db/prisma/schema.prisma`                          | `AgentConfig`, `AgentRun`, `AgentFeedback` models |

### File-based marketing prompts (System 2)

| Path                                           | Role                                                       |
| ---------------------------------------------- | ---------------------------------------------------------- |
| `agents/*.md`                                  | The 15 prompt specs (master orchestrator + 14 specialists) |
| `system/*.md`                                  | Growth engine config (launch, gates, budget, escalation)   |
| `data/`, `briefings/`, `briefs/`, `calendar/`  | Founder inputs                                             |
| `queue/{pending,approved,rejected,published}/` | Content approval pipeline                                  |
| `engagement/`, `reports/`, `logs/`             | Outputs                                                    |
| `assets/recordings/`, `design-specs/`          | Production assets                                          |

### In-app marketing agents (System 3, dormant)

| File                                                              | Role                                             |
| ----------------------------------------------------------------- | ------------------------------------------------ |
| `apps/api/src/modules/marketing-agent/agents/`                    | The 12 agent service implementations             |
| `apps/api/src/modules/marketing-agent/marketing-agent.service.ts` | Shared utilities                                 |
| `apps/admin/src/app/marketing/queue/`                             | Approval queue UI (admin app, SUPER_ADMIN only)  |
| `apps/admin/src/app/marketing/agents/`                            | Agent dashboard UI (admin app, SUPER_ADMIN only) |
| `apps/admin/src/app/marketing/sequences/`                         | Email sequences UI (admin app, SUPER_ADMIN only) |
| `apps/admin/src/components/marketing/`                            | 9 shared React components                        |

---

## Common confusions and how to resolve them

### "Aren't the file-based prompts and the in-app agents the same thing?"

Conceptually similar (both are marketing-content generators); architecturally and operationally separate. The file-based prompts are the **spec**; the in-app agents are an **unactivated implementation**. When (if) Path B triggers, the in-app agents will follow the file-based specs as their behavioral contract.

### "Are the 5 operational agents going to be marketed as 'AI agents'?"

Yes — they're customer-facing, they're called agents in the UI (`/ai/agents`), and the marketing copy refers to them as such. AI Front Desk = inbox + drafts + the 5 agents.

### "Can a clinic enable a marketing agent for themselves?"

No. The marketing agent surface is gated behind `SUPER_ADMIN` (BCC staff only) and lives in the admin app. Clinics cannot reach it. When Path B activates, it'll be a separate SKU with its own subscription gate.

### "Are the 5 + 15 + 12 separate dependencies or do they share infrastructure?"

They share **some** infrastructure:

- All three eventually use the Anthropic Claude API via `ClaudeClient`.
- The 5 operational agents and the 12 in-app marketing agents share `AgentFrameworkService`, `AgentSchedulerService`, and `AgentConfig` / `AgentRun` / `AgentFeedback` tables.
- The file-based prompts share the `ClaudeClient` indirectly (via the founder running them through Claude Code) but have no NestJS / Prisma surface at all.

The boundary is enforced by **what's enabled**, not by what code exists.

---

## Future "AI Marketing Manager" product (not yet built)

When Path B triggers, AI Marketing Manager becomes BCC's product #2. Distinct from AI Front Desk:

- Different ICP (probably the same clinics, but a different buyer pain).
- Different pricing tier.
- Different sales motion (likely upsell to existing AI Front Desk customers first, before net-new).
- Different team (a marketing hire owns it).
- Different metrics (content ROI, engagement, attribution at the campaign level).

The 12 dormant agents are its production substrate. The 15 file-based prompts are its behavioral spec. The 5 operational agents stay independent — they belong to AI Front Desk.

This is a Year 2+ conversation.

---

## Cross-references

- `BCC-PIVOT-MASTER-PLAN.md` v3 Locked decisions reference > AI architecture — the locked Path A vs Path B decision.
- [`docs/BCC-MARKETING-OPERATOR-WORKFLOW.md`](BCC-MARKETING-OPERATOR-WORKFLOW.md) — daily / weekly operator playbook for the file-based engine.
- [`docs/PLATFORM-DECOMMISSION-PLAN.md`](PLATFORM-DECOMMISSION-PLAN.md) — DEFERRED status for the 12 in-app marketing agents.
- [`docs/BOOKING-ATTRIBUTION-DEFINITION.md`](BOOKING-ATTRIBUTION-DEFINITION.md) — how the 5 operational agents map to attribution reasons.
- [`agents/outbound-prospecting.md`](../agents/outbound-prospecting.md) — example of a file-based prompt.

---

## Change log

| Date       | Change                                                                                                                                                                                                               |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-05-09 | Initial creation. Codifies the 5/15/12 boundary, Path A vs Path B decision, dormant status of in-app marketing agents, and trigger conditions for Path B activation. References `BCC-PIVOT-MASTER-PLAN.md` v3 locks. |
