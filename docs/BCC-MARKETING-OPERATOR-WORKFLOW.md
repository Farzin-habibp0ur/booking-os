# BCC Marketing Operator Workflow

> **Purpose:** Daily / weekly playbook for running BCC's own file-based growth engine (Path A). The 15 prompts in `agents/` are the spec; this document is how the founder (and eventually a marketing hire) operates them in rhythm.
>
> **Audience:** Founder running BCC's marketing day-to-day. Future marketing hire when Path B triggers (see [`docs/AI-AGENT-ARCHITECTURE.md`](AI-AGENT-ARCHITECTURE.md)).
> **Last updated:** 2026-05-09

---

## What this is (and isn't)

This is the operator manual for the **file-based primary** growth engine that BCC runs to market itself. It's not a customer-facing product feature. The 12 in-app marketing agents in `apps/api/src/modules/marketing-agent/` are dormant (Path B); this document describes Path A operations.

If you're looking for:

- Customer-facing AI agents the clinic uses → [`docs/AI-AGENT-ARCHITECTURE.md`](AI-AGENT-ARCHITECTURE.md), §System 1.
- The pilot ops playbook for selling AI Front Desk → [`docs/PILOT-OPS.md`](PILOT-OPS.md).
- The 12-minute wedge demo script → [`DEMO_SCRIPT.md`](../DEMO_SCRIPT.md).

This document covers BCC's own marketing rhythm — the engine that brings prospects to the pilot application form.

---

## The directory layout

| Path                             | Role                                                              |
| -------------------------------- | ----------------------------------------------------------------- |
| `agents/*.md`                    | The 15 prompt specs (master orchestrator + 14 specialists)        |
| `system/*.md`                    | Growth-engine config (launch, gates, budget, escalation, etc.)    |
| `data/`                          | Founder-maintained inputs (customer signals, daily metrics)       |
| `briefings/`                     | Daily trend briefings from Trend Scout (P9)                       |
| `briefs/blog/`, `briefs/social/` | Content briefs from Content Strategist (P11)                      |
| `calendar/`                      | Weekly content calendars                                          |
| `queue/pending/`                 | New content drafts awaiting review                                |
| `queue/approved/`                | Founder-approved drafts                                           |
| `queue/published/`               | Drafts that have been published                                   |
| `queue/rejected/`                | Drafts you killed                                                 |
| `queue/archive/`                 | Older queue items moved aside                                     |
| `queue/ready-to-publish/`        | Approved + scheduled, awaiting publisher run                      |
| `engagement/`                    | Daily engagement reports from Community Manager                   |
| `reports/`                       | Generated performance / customer / keyword / optimization reports |
| `logs/`                          | Publishing log + operational logs                                 |
| `assets/recordings/`             | Screen recordings for video content                               |
| `design-specs/`                  | Visual specs + template library                                   |

The 15 prompts read from these directories, transform inputs to outputs, and write to specific paths. Understanding the I/O of each prompt is half the operator's job.

---

## Daily routine (~30–45 min)

Run this every morning, founder-time. Keep it tight.

### 1. Read the briefings (5 min)

```
$ cat briefings/$(date +%Y-%m-%d)*.md
```

The Trend Scout (P9) generated this overnight. Skim:

- Industry signals (med-spa specific — injectables trends, regulatory news, big-account moves).
- Adjacent signals (small-business AI, customer messaging, marketing automation).
- Content opportunities (specific topics worth queueing into the content pipeline).

If the briefing is missing or thin → either Trend Scout didn't run (check MCP fallback in `system/mcp-fallback-config.md`) or there's no signal worth covering. Don't fabricate.

### 2. Check engagement (5 min)

```
$ ls engagement/ | tail -5
$ cat engagement/$(date -v-1d +%Y-%m-%d)*.md  # Yesterday's report
```

Community Manager (P22) summarizes:

- Inbound signals (DMs, comments, replies on yesterday's content).
- Conversation themes (what prospects asked about, what they pushed back on).
- Hot leads (people who showed clear pilot intent — escalate manually).

Anyone who showed pilot intent gets a personal reply from the founder within 24 hours.

### 3. Review the approval queue (15 min)

```
$ ls queue/pending/
```

Anything with a YELLOW tier prefix needs founder review before publishing. Triage:

- **Approve** (move to `queue/approved/`) — content is on-brand, accurate, and ready.
- **Edit** — adjust in place, then move to `queue/approved/`.
- **Reject** (move to `queue/rejected/`) — note why in the file's footer.
- **Defer** — leave in pending if it needs more time / data / source verification.

Approval velocity matters. Stale queues kill the engine. Aim for queue depth ≤ 7 days.

### 4. Run the publisher (5 min)

```
$ ls queue/ready-to-publish/
```

Publisher (P16) handles the mechanics — pushing approved drafts to scheduled platforms (blog, social, newsletter) per the calendar. Verify nothing's stuck. Check `logs/publishing-log.md` for the tail.

### 5. Skim outbound (5–10 min, twice a week)

On Monday and Thursday mornings, the Outbound Prospecting agent (P21) generates the prospect batch. See [`agents/outbound-prospecting.md`](../agents/outbound-prospecting.md). Review:

```
$ ls queue/pending/*outbound*
```

Each prospect's personalized outreach is YELLOW tier — founder reads, edits if needed, sends. Quality over quantity: ≤10/batch.

### 6. Quick metrics glance (3 min)

Open `data/daily-metrics.md` (founder-maintained) and add today's:

- Pilot applications submitted: N
- Pilot applications accepted: N
- Demo calls booked: N
- Demo calls completed: N
- Subscriptions started: N

Trends across the week feed the weekly performance review (next section).

---

## Content brief intake

The 15-prompt engine doesn't generate content out of thin air. It generates content from briefs.

### Blog briefs (`briefs/blog/`)

Content Strategist (P11) creates these by combining:

- Trend Scout (P9) outputs
- Customer signals from `data/customer-signals.md`
- Keyword Strategist (P23) priority keywords
- Pillar balance from `reports/`

Each brief defines:

- Target keyword(s) + search intent
- Pillar (Industry Insights / Product Education / Customer Success / Thought Leadership / Technical)
- Length target
- CTA (always: Apply for Pilot)
- Audience (US/Canada med-spa owner-operator)

Blog Writer (P12) consumes a brief, produces a draft, drops it in `queue/pending/` for review.

### Social briefs (`briefs/social/`)

Same flow, smaller surface. Social Content Creator (P13) consumes the brief, generates Instagram-style posts (image + caption + suggested hashtags) and drops them in `queue/pending/`.

### How to commission a brief

If you want a specific topic covered:

1. Add a one-liner to `data/founder-priorities.md`.
2. Run Content Strategist (P11) — either directly via Claude Code with the prompt, or wait for the next scheduled run.
3. The brief lands in `briefs/blog/` or `briefs/social/`.

Don't write briefs yourself — that defeats the spec/agent boundary. Either commission via the priorities file or trust the agent to surface from signals.

---

## Approval queue management

The queue is the engine's heart. Manage it ruthlessly.

### Tier convention

- **GREEN** — auto-publish (no founder review). Reserved for low-risk content (e.g., reposts of older approved content, calendar reminders). Most days, GREEN is empty.
- **YELLOW** — founder reviews. Default for new content.
- **RED** — high-risk content (e.g., anything making compliance claims, legal-adjacent topics, anything mentioning specific competitors by name). Founder reviews + counsel review when warranted.

### Naming convention

```
queue/pending/[YYYY-MM-DD]-[TIER]-[type]-[locale]-[slug].md
```

Examples:

- `2026-05-09-YELLOW-blog-en-after-hours-instagram-dms.md`
- `2026-05-09-YELLOW-social-en-pilot-scorecard-explainer.md`
- `2026-05-09-YELLOW-outbound-en-prospecting.md`

Spanish localization: same naming with `-es-` instead of `-en-`. Spanish localization is owned by Spanish Localization (P19).

### Review checklist (per piece)

- [ ] Brand consistent? "Business Command Centre" / "AI Front Desk" / "Apply for Pilot" — no "Booking OS," no "service businesses," no "all-in-one."
- [ ] Compliance posture honored? No HIPAA / BAA / "encrypted at rest" claims (see [`docs/COMPLIANCE-POSTURE.md`](COMPLIANCE-POSTURE.md)).
- [ ] ICP narrow? US/Canada med spas, owner-operated, 1–10 locations.
- [ ] CTA correct? "Apply for Pilot" link to https://businesscommandcentre.com/pilot.
- [ ] Sources cited where claims are made?
- [ ] Tone matches BCC voice? (Confident, plain, no hype, no jargon, no emoji parade.)

If yes to all → move to `queue/approved/`. If no on any → edit or reject.

### Pipeline flow

```
queue/pending/   →   queue/approved/   →   queue/ready-to-publish/   →   queue/published/
   ↓                                                                              ↓
queue/rejected/                                                          (publishing-log.md)
```

Calendar Planner (P14) schedules approved items to `ready-to-publish/`. Publisher (P16) executes the publishing and moves to `published/`.

### Queue health metrics

- **Depth** — items in `queue/pending/`. Target ≤ 7 days of content.
- **Throughput** — items moved to `queue/published/` per week. Target by pillar (see weekly review).
- **Rejection rate** — items in `queue/rejected/` per week. > 30% = a quality or briefing problem.

---

## Calendar plan

### Weekly cadence

| Cadence                     | Output                                           |
| --------------------------- | ------------------------------------------------ |
| 2 blog posts                | Long-form, SEO-targeted, 1500–2500 words         |
| 5–7 social posts            | Mix of Instagram posts + stories                 |
| 1 newsletter                | Weekly roundup to BCC's email list (when active) |
| 2 outbound prospect batches | Mon + Thu, ≤10 prospects each                    |
| Engagement responses        | Daily, ≤30 min                                   |

### Pillar balance (target distribution per month)

| Pillar                          | % of content |
| ------------------------------- | ------------ |
| Industry Insights               | 30%          |
| Product Education               | 25%          |
| Customer Success / Case Studies | 20%          |
| Thought Leadership              | 15%          |
| Technical                       | 10%          |

Calendar Planner (P14) drops `calendar/[YYYY]-week[NN].md` weekly with the planned mix. Founder reviews on Friday for the following week.

### Spanish localization

Spanish content runs at ~30% of English output. Spanish Localization (P19) translates approved English drafts; the founder reviews the Spanish drafts before publishing. (Native-speaker review is on the deferred list.)

> **TBD — confirm with founder.** Whether to localize all approved content or only "evergreen" pieces. Current direction: only evergreen.

---

## Performance review

### Daily (5 min)

Daily metrics in `data/daily-metrics.md` — founder maintains.

### Weekly (60 min, every Friday)

Performance Analyst (P18) generates `reports/[YYYY]-week[NN]-performance.md`. The report covers:

- Pilot funnel: applications → demos → pilots accepted → graduations.
- Content performance by piece: views, clicks-through to /pilot, time on page, social engagement.
- Best / worst performers.
- Pillar balance vs target.
- Outbound: send rate, reply rate, application conversion rate.

Founder reads it Friday afternoon. Decisions:

- Which content patterns to double down on / cut.
- Which outbound templates to retire.
- Whether to brief specific topics for next week.

### Monthly (90 min, first Monday of the month)

Performance Analyst rolls up the month into `reports/[YYYY]-[MM]-monthly-summary.md`. Plus:

- Customer Validation report (`reports/customer-validation-[YYYY-MM-DD].md`) — what we heard from prospects vs what we shipped.
- Keyword Strategist (P23) generates `reports/[YYYY]-[MM]-keywords.md` — search rank, opportunities.
- Optimization recommendations from Learning Engine (P20) — what to A/B test next.

Founder picks 2–3 focus areas for the month.

---

## Cross-references to agent prompts

When you're operating an agent, read its `.md` file first. The prompt is the contract. The operator's job is to provide the inputs the prompt expects and process the outputs.

| Stage                | Prompt                                       | Reads from                             | Writes to                                   |
| -------------------- | -------------------------------------------- | -------------------------------------- | ------------------------------------------- |
| Orchestration        | `agents/master-orchestrator.md`              | All                                    | (coordinates others)                        |
| Trends               | `agents/trend-scout.md`                      | External web (via MCP)                 | `briefings/`                                |
| Strategy             | `agents/content-strategist.md`               | `briefings/`, `data/`, `reports/`      | `briefs/blog/`, `briefs/social/`            |
| Keywords             | `agents/keyword-strategist.md`               | `data/`, search APIs                   | `reports/[date]-keywords.md`                |
| Blog production      | `agents/blog-writer.md`                      | `briefs/blog/`                         | `queue/pending/[date]-YELLOW-blog-*.md`     |
| Social production    | `agents/social-content-creator.md`           | `briefs/social/`                       | `queue/pending/[date]-YELLOW-social-*.md`   |
| Visual production    | `agents/visual-designer.md`                  | Approved drafts + `design-specs/`      | `assets/`, attaches to drafts               |
| Video production     | `agents/video-producer.md`                   | Approved drafts + `assets/recordings/` | `assets/`, attaches                         |
| Localization         | `agents/spanish-localization.md`             | `queue/approved/*-en-*.md`             | `queue/pending/*-YELLOW-*-es-*.md`          |
| Calendar             | `agents/calendar-planner.md` (typically P14) | `queue/approved/`                      | `calendar/`                                 |
| Publishing           | `agents/publisher.md`                        | `queue/ready-to-publish/`              | `queue/published/`, `logs/`                 |
| Performance          | `agents/performance-analyst.md`              | Platform analytics, `logs/`, `data/`   | `reports/[date]-performance.md`             |
| Learning / iteration | `agents/learning-engine.md`                  | `reports/`                             | A/B test plans, recommendations             |
| Engagement           | `agents/community-manager.md`                | Platform DMs/comments                  | `engagement/[date].md`                      |
| Outbound             | `agents/outbound-prospecting.md`             | Prospect MCP, web                      | `queue/pending/[date]-YELLOW-outbound-*.md` |
| Maintenance          | `agents/weekly-maintenance.md`               | All directories                        | Cleanup, archive moves                      |

(Exact filenames may vary; see `agents/` directory listing for current names.)

---

## Weekly maintenance routine

Run every Friday afternoon. Weekly Maintenance (P15-ish, see exact filename) is the spec.

### Archive

- Move `queue/published/*.md` older than 30 days to `queue/archive/`.
- Move `queue/rejected/*.md` older than 30 days to `queue/archive/`.
- Compact `logs/publishing-log.md` if > 5MB.

### Sanity checks

- Verify the queue/ directory hasn't accumulated cruft.
- Verify `briefings/` and `engagement/` have entries for every weekday.
- Verify the publisher hasn't dropped scheduled posts.
- Spot-check 5 random `published/` items: did they actually go live? Are URLs valid?

### Engine tuning

- Are pillar percentages tracking to target?
- Is the rejection rate climbing? (Quality issue.)
- Is queue depth growing? (Throughput issue.)
- Are any specific agents repeatedly producing rejected drafts? (Briefing or prompt issue.)

Note tuning opportunities in `data/founder-priorities.md`. They become next week's iteration backlog.

---

## When the engine is misbehaving

### Trend Scout briefings are missing

Likely an MCP issue. Check `system/mcp-fallback-config.md`. Typical fallback: skip Trend Scout briefing for the day, use yesterday's brief as a fallback. Don't fabricate.

### Blog Writer keeps producing off-brand drafts

The brief is wrong, or the prompt drifted. Read the most recent rejected drafts together — what's the pattern? Tune the prompt (`agents/blog-writer.md`) and re-run on the same brief. If still wrong, the brief is the problem; tune Content Strategist.

### Outbound replies dropping

Outbound Prospecting outputs feel stale (see `agents/outbound-prospecting.md`). Either the templates are tired (Learning Engine should retire them after 30 sends with low reply rates) or the ICP signals are off (verify with Performance Analyst).

### Approval queue exploding

Too much being generated, not enough being reviewed. Either reduce generation cadence (cut some daily runs) or increase review velocity (set a strict 30-min/day budget and ship even imperfect drafts). Stale queues are worse than imperfect content.

---

## What to never do

- **Never publish without founder review** during Year 1. (Auto-publish — GREEN tier — is reserved for explicitly low-risk reposts, and those are rare.)
- **Never claim HIPAA / BAA / "encrypted at rest"** in any output. See [`docs/COMPLIANCE-POSTURE.md`](COMPLIANCE-POSTURE.md).
- **Never enable the 12 dormant in-app marketing agents** until Path B trigger conditions are met. See [`docs/AI-AGENT-ARCHITECTURE.md`](AI-AGENT-ARCHITECTURE.md), §Path B.
- **Never use LinkedIn for outbound prospecting.** Email + Instagram DM only. Decision in [`agents/outbound-prospecting.md`](../agents/outbound-prospecting.md).
- **Never abandon engagement.** Inbound replies / DMs / comments need a 24-hour response.

---

## When Path B triggers (future state)

When the trigger conditions in [`docs/AI-AGENT-ARCHITECTURE.md`](AI-AGENT-ARCHITECTURE.md) §Path B are met, this workflow evolves:

- The 12 in-app marketing agents become the production runtime.
- The founder steps back; a marketing hire owns Path A operations until the in-app system is fully transitioned.
- The 15 file-based prompts continue as the spec — they're the contract, in-app code is the implementation.
- Eventually, Path A retires (or stays as a backup / sandbox for prompt iteration).

That's a future-state conversation. Today, Path A is the engine.

---

## Cross-references

- [`docs/AI-AGENT-ARCHITECTURE.md`](AI-AGENT-ARCHITECTURE.md) — the 5/15/12 boundary and Path A vs Path B trigger conditions.
- [`agents/outbound-prospecting.md`](../agents/outbound-prospecting.md) — example of a file-based prompt spec.
- `system/launch-config.md`, `system/quality-gates.md`, `system/budget-tracker.md`, `system/escalation-rules.md`, `system/mcp-fallback-config.md` — engine configuration.
- `BCC-PIVOT-MASTER-PLAN.md` v3 Locked decisions reference > AI architecture — the locked Path A primary decision.

---

## Change log

| Date       | Change                                                                                                                                                                                                              |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-05-09 | Initial creation. Codifies the daily / weekly operator routine for Path A (file-based primary). References `agents/`, `system/`, `briefings/`, `briefs/`, `queue/`, `engagement/`, `reports/`, `logs/` directories. |
