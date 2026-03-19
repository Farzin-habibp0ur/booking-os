# A/B Testing Framework

> Last updated: 2026-03-12
> Purpose: Structured system for testing content variations and optimizing performance.
> Referenced by: Learning Engine, Performance Analyst, all content agents

---

## What We Test

| Element             | Platform      | Test Method                                | Minimum Sample               | Primary Metric           |
| ------------------- | ------------- | ------------------------------------------ | ---------------------------- | ------------------------ |
| Headlines/hooks     | Blog, Social  | Alternate versions on consecutive posts    | 5 posts per variant          | Click-through rate       |
| CTA variations      | All           | Rotate CTAs across same content type       | 10 posts per variant         | Conversion rate          |
| Content length      | Blog          | Short (800w) vs Long (1500w) on same topic | 3 posts per variant          | Time on page + signups   |
| Posting times       | Social        | Same content at different times            | 7 posts per time slot        | Engagement rate          |
| Hashtag strategies  | IG, TikTok    | Different hashtag sets on similar content  | 10 posts per set             | Reach / impressions      |
| Video hook style    | TikTok, Reels | Question vs Statement vs Pattern interrupt | 5 videos per style           | Completion rate          |
| Email subject lines | Email         | A/B split on every send                    | 100+ subscribers per variant | Open rate                |
| Spanish vs English  | All           | Same content in both languages             | Track per language           | Engagement + conversions |
| Carousel vs Reel    | Instagram     | Same topic, different format               | 5 posts per format           | Saves + shares           |
| Text vs Image post  | LinkedIn      | Same message, with/without image           | 5 posts per variant          | Impressions + engagement |

---

## Test Protocol

Every A/B test follows this 5-step process:

### 1. HYPOTHESIS

State what you expect before starting. Format:

> "We believe [VARIANT B] will outperform [VARIANT A] on [METRIC] by at least [X%] because [REASON]."

### 2. VARIANTS

- Create exactly **2 variants** (A and B)
- Change **only ONE variable** between them
- Keep everything else identical (same topic, same platform, same audience, same time of week)

### 3. DURATION

- Run test for minimum **2 weeks** OR until minimum sample size is reached (whichever is later)
- Do not declare a winner before minimum sample is met
- If results are trending strongly (>30% difference) after minimum sample, can end early

### 4. MEASUREMENT

- Track the **primary metric** defined for the test type (see table above)
- Also record secondary metrics for context (but don't decide based on them)
- Use platform native analytics — no guessing

### 5. DECISION

| Outcome          | Criteria                                | Action                                                       |
| ---------------- | --------------------------------------- | ------------------------------------------------------------ |
| **Winner**       | Difference > 15% with sufficient sample | Adopt winning variant as default                             |
| **Inconclusive** | Difference < 15% OR insufficient sample | Run for 1 more week, then default to simpler/cheaper variant |
| **Loser**        | Variant B underperforms A by > 15%      | Revert to Variant A, document learning                       |

---

## Active Tests Log

| Test ID | Element | Hypothesis | Variant A | Variant B | Platform | Start Date | End Date | Min Sample | Status  | Winner |
| ------- | ------- | ---------- | --------- | --------- | -------- | ---------- | -------- | ---------- | ------- | ------ |
| T001    |         |            |           |           |          |            |          |            | PLANNED |        |

### Test Status Values

- **PLANNED** — Hypothesis defined, not yet started
- **RUNNING** — Active, collecting data
- **COMPLETE** — Minimum sample reached, winner declared
- **INCONCLUSIVE** — Could not determine winner
- **CANCELLED** — Stopped early (reason required)

---

## Completed Tests Archive

| Test ID                 | Element | Winner | Key Learning | Date Completed | Applied To |
| ----------------------- | ------- | ------ | ------------ | -------------- | ---------- |
| (accumulated over time) |         |        |              |                |            |

---

## Rules

1. **Only run 2-3 active tests at a time** — avoid confounding variables
2. **Every test must have a documented hypothesis BEFORE starting** — no retroactive hypotheses
3. **Learning Engine reviews test results weekly** and recommends new tests
4. **Never test on RED tier content** — too risky for experimentation
5. **Blog A/B tests:** alternate by publish day (Mon=A, Wed=B, Fri=A, next Mon=B, etc.)
6. **Social A/B tests:** alternate by day across same platform
7. **Don't run conflicting tests** — e.g., don't test posting times AND hashtags simultaneously on the same platform
8. **Document negative results too** — knowing what doesn't work is valuable

---

## Suggested First Tests (Month 1)

| Test ID | Element          | Hypothesis                                                                                       | Priority |
| ------- | ---------------- | ------------------------------------------------------------------------------------------------ | -------- |
| T001    | Video hook style | Question hooks ("Did you know...?") get 20% more completions than statement hooks on TikTok      | High     |
| T002    | CTA variations   | Specific CTAs ("Start free trial") convert 25% better than soft CTAs ("Learn more") on Instagram | High     |
| T003    | Posting times    | 9 AM posts get 15% more engagement than 5 PM posts on LinkedIn                                   | Medium   |

---

## Quarterly Review

Every 3 months, compile all test results into a **"What We've Learned"** summary:

1. List all completed tests with winners
2. Identify patterns (e.g., "Questions consistently outperform statements")
3. **Permanently update agent prompts** with proven learnings
4. Archive inconclusive tests — consider re-running with larger samples
5. Plan next quarter's test roadmap based on biggest remaining unknowns

### Quarterly Review Dates

- Q2 2026: June 15, 2026
- Q3 2026: September 15, 2026
- Q4 2026: December 15, 2026

---

## Change Log

| Date       | Change                                | Reason                     |
| ---------- | ------------------------------------- | -------------------------- |
| 2026-03-12 | Initial A/B testing framework created | Content optimization setup |
