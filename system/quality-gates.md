# Content Pipeline Quality Gates

> Last updated: 2026-03-12
> Purpose: Validation checkpoints between pipeline stages to prevent low-quality content from reaching the approval queue.
> Pipeline: Research → Creation → Queue → Approve → Publish → Analyze

All content-producing agents MUST reference this file before passing work to the next stage.

---

## GATE 1: Research → Creation

**Checkpoint between:** Trend Scout / Keyword Strategist → Content Strategist
**When:** Before the Content Strategist plans content from research outputs

### Validation Checklist

| # | Check | Threshold | Required |
|---|-------|-----------|----------|
| 1 | Trend relevance score for BookingOS target audience | >= 7/10 | Yes |
| 2 | Each keyword has verified search volume data attached | Not guessed/estimated | Yes |
| 3 | Trends are current | Within last 7 days | Yes |
| 4 | Trends map to content pillars | >= 3 of 5 trends | Yes |
| 5 | No duplicate trends from previous week's briefing | Zero duplicates | Yes |

### Content Pillars Reference
1. **Booking & Scheduling** — Appointment management, no-shows, calendar optimization
2. **Client Experience** — Customer journey, retention, satisfaction, reviews
3. **Business Growth** — Marketing, acquisition, revenue, scaling
4. **Operations & Efficiency** — Automation, workflows, staff management, time savings
5. **Industry Insights** — Vertical-specific trends (aesthetic, wellness, dealership)

### Fail Action
> **REJECT** — Return to Trend Scout with note:
> "Trends [X, Y] failed relevance gate (code: R02/R03/R06). Replace with BookingOS-relevant alternatives."
> Use rejection codes from the taxonomy below.

---

## GATE 2: Planning → Creation

**Checkpoint between:** Content Strategist → Blog Writer / Social Creator
**When:** Before content creators start writing from the content calendar

### Validation Checklist

| # | Check | Requirement | Required |
|---|-------|-------------|----------|
| 1 | Content pillar assignment | Exactly 1 of 5 pillars | Yes |
| 2 | Funnel stage tag | One of: TOFU / MOFU / BOFU | Yes |
| 3 | Specific CTA defined | Not generic ("learn more") — must name action | Yes |
| 4 | Target keywords (blog) or hashtags (social) | >= 1 primary + 2 secondary | Yes |
| 5 | Unique angle/hook | Distinct from topic name, states the "why now" or "why care" | Yes |
| 6 | Platform is ACTIVE | Check `system/platform-launch-config.md` | Yes |

### CTA Quality Examples

| Bad (Generic) | Good (Specific) |
|---------------|-----------------|
| "Learn more" | "Start your free 14-day trial" |
| "Check it out" | "See how BookingOS reduces no-shows by 40%" |
| "Click here" | "Book a 10-minute demo with our team" |
| "Sign up" | "Create your free BookingOS account — no card required" |

### Fail Action
> **REJECT** — Return brief to Content Strategist with note:
> "Brief for [TITLE] missing [FIELD] (code: R01/R05). Complete before assigning to creator."

---

## GATE 3: Creation → Queue

**Checkpoint between:** All content agents → Approval Queue
**When:** Before any content piece enters the approval queue — the creating agent self-checks

### Validation Checklist

| # | Check | Threshold | Required |
|---|-------|-----------|----------|
| 1 | Word count meets platform minimum | Blog: 800+, Social caption: 50+, Video script: 100+ | Yes |
| 2 | BookingOS product mention or CTA | >= 1 for MOFU/BOFU content (optional for TOFU) | Yes |
| 3 | No placeholder text remaining | Zero matches for: [INSERT], TBD, TODO, FIXME, XXX, ??? | Yes |
| 4 | Correct tier classification | GREEN / YELLOW / RED per classification rules below | Yes |
| 5 | File naming convention | `[DATE]-[TIER]-[PLATFORM]-[LANGUAGE]-[TITLE].md` | Yes |
| 6 | One-line summary at top | First line is a scannable summary for queue review | Yes |

### Tier Classification Rules

| Tier | Criteria | Approval Required |
|------|----------|-------------------|
| **GREEN** | Evergreen/educational content, no claims, no pricing, no competitor mentions, TOFU only | Auto-approve (no human review) |
| **YELLOW** | Product comparisons, testimonials, pricing mentions, case studies, MOFU content | Human review required |
| **RED** | Legal/compliance claims, health/medical references, partnership announcements, crisis response, BOFU with guarantees | Founder review required |

### File Naming Convention

```
Format: YYYY-MM-DD-TIER-PLATFORM-LANG-slug-title.md

Examples:
  2026-03-17-GREEN-instagram-en-5-ways-reduce-noshows.md
  2026-03-18-YELLOW-linkedin-en-bookingos-vs-calendly.md
  2026-03-19-RED-blog-es-hipaa-compliance-guide.md
```

### Fail Action
> **BLOCK** — Do NOT add to queue. Fix all failing checks and re-validate.
> Log: "Content [TITLE] blocked at Gate 3 (code: R01/R02/R04/R07/R08). Issues: [LIST]."

---

## GATE 4: Queue → Publish

**Checkpoint between:** Publisher → Live
**When:** Before the Publisher formats approved content for publishing

### Validation Checklist

| # | Check | Requirement | Required |
|---|-------|-------------|----------|
| 1 | Content has APPROVED status | Not QUEUED, DRAFT, or REJECTED | Yes |
| 2 | UTM parameters on all links | `?utm_source=[platform]&utm_medium=organic&utm_campaign=[slug]` | Yes |
| 3 | Publish time within optimal window | See platform windows below | Yes |
| 4 | No duplicate to same platform within 24h | Check recent publish log | Yes |
| 5 | Spanish content culturally adapted | Not machine-translated — reviewed for idiom, tone, regional fit | Yes |

### Optimal Publishing Windows (UTC-5 / Eastern)

| Platform | Best Times | Best Days |
|----------|-----------|-----------|
| Instagram | 9:00 AM, 12:00 PM, 5:00 PM | Tue, Wed, Thu |
| TikTok | 7:00 AM, 12:00 PM, 7:00 PM | Tue, Thu, Sat |
| LinkedIn | 7:30 AM, 12:00 PM, 5:30 PM | Tue, Wed, Thu |
| YouTube | 2:00 PM, 5:00 PM | Thu, Fri, Sat |
| Pinterest | 8:00 PM, 9:00 PM | Fri, Sat |
| X/Twitter | 8:00 AM, 12:00 PM, 6:00 PM | Mon, Wed, Fri |

### UTM Parameter Format

```
Base: ?utm_source={platform}&utm_medium=organic&utm_campaign={campaign-slug}

Examples:
  https://businesscommandcentre.com/signup?utm_source=instagram&utm_medium=organic&utm_campaign=noshow-tips-mar26
  https://businesscommandcentre.com/blog/reduce-noshows?utm_source=linkedin&utm_medium=organic&utm_campaign=noshow-guide
```

### Fail Action
> **HOLD** — Do not publish. Flag issue in daily report.
> Log: "Content [TITLE] held at Gate 4 (code: R05/R06/R09). Reason: [DETAIL]."

---

## Rejection Reason Taxonomy

Standardized codes for all gate failures. Every rejection MUST include a code.

| Code | Reason | Common Gate | Severity |
|------|--------|-------------|----------|
| **R01** | Missing required fields | Gate 2, 3 | Medium |
| **R02** | Below quality threshold | Gate 1, 3 | High |
| **R03** | Stale/outdated data (>7 days) | Gate 1 | High |
| **R04** | Wrong tier classification | Gate 3 | Medium |
| **R05** | Platform not yet active (LOCKED) | Gate 2, 4 | Critical |
| **R06** | Duplicate/too similar to recent content | Gate 1, 4 | Medium |
| **R07** | Missing CTA or product tie-in | Gate 3 | Medium |
| **R08** | Placeholder text remaining | Gate 3 | High |
| **R09** | Cultural adaptation needed (Spanish) | Gate 4 | High |
| **R10** | Factual accuracy concern | Any | Critical |

### Severity Response

| Severity | Action |
|----------|--------|
| **Critical** | Block immediately. Do not proceed under any circumstances. Escalate to founder. |
| **High** | Reject and return to previous stage. Must be fixed before re-submission. |
| **Medium** | Reject with specific fix instructions. Can be re-submitted same day. |

---

## Gate Metrics (Track Weekly)

The Performance Analyst should track these weekly:

| Metric | Target | Purpose |
|--------|--------|---------|
| Gate 1 pass rate | >= 80% | Research quality signal |
| Gate 2 pass rate | >= 90% | Brief completeness signal |
| Gate 3 pass rate | >= 85% | Creation quality signal |
| Gate 4 pass rate | >= 95% | Pre-publish readiness signal |
| Most common rejection code | — | Identifies systemic issues |
| Avg rejections before approval | < 1.5 | Pipeline efficiency signal |

If any gate's pass rate drops below target for 2 consecutive weeks, review and tighten the upstream stage's instructions.

---

## Change Log

| Date | Change | Reason |
|------|--------|--------|
| 2026-03-12 | Initial quality gates created | Pipeline quality control setup |
