# Auto-Escalation Rules

> Last updated: 2026-03-12
> Purpose: Automatic tier promotion, agent alerts, and batch approval optimization.
> Referenced by: All content agents + approval queue process

---

## Tier Promotion Rules

Content is automatically promoted to a higher tier when it matches these patterns. Agents must apply these BEFORE submitting to the queue.

### Auto-Promote to YELLOW

| Trigger                                        | Example                                                | Reason                                 |
| ---------------------------------------------- | ------------------------------------------------------ | -------------------------------------- |
| Mentions specific dollar amounts               | "$49/mo", "save $500/year"                             | Pricing claims need human verification |
| Contains customer testimonials or quotes       | "Sarah said BookingOS saved her 10 hours/week"         | Quote accuracy must be verified        |
| References specific statistics or percentages  | "60% reduction in no-shows"                            | Data claims need source verification   |
| Spanish content with cultural references       | Idioms, holidays, regional customs                     | Cultural appropriateness review        |
| Contains time-sensitive offers or deadlines    | "Limited time", "Offer ends March 31"                  | Promotion terms need approval          |
| Mentions specific integrations or partnerships | "Works with Stripe", "Integrates with Google Calendar" | Partnership claims need verification   |

### Auto-Promote to RED

| Trigger                                     | Example                                            | Reason                                 |
| ------------------------------------------- | -------------------------------------------------- | -------------------------------------- |
| Compares BookingOS to competitors by name   | "BookingOS vs Calendly", "Unlike Fresha..."        | Legal risk — claims must be defensible |
| Contains health or medical claims           | "Improve patient outcomes", "HIPAA compliant"      | Regulatory risk                        |
| Uses legal language                         | "Terms of service", "Privacy policy", "Compliance" | Legal accuracy required                |
| Makes guarantees or promises                | "Guaranteed results", "100% uptime"                | Liability risk                         |
| References financial results or ROI numbers | "3x ROI", "Paid for itself in 2 weeks"             | Must be substantiated                  |
| Crisis response or reputation management    | Responding to negative press or reviews            | Brand risk — founder review            |
| Partnership announcements                   | "We've partnered with...", "Official integration"  | Business relationship verification     |

---

## Agent Alert Rules

### Performance Alerts

| Condition                                      | Action                                                             | Urgency |
| ---------------------------------------------- | ------------------------------------------------------------------ | ------- |
| Agent rejection rate > 40% in a week           | Flag for prompt adjustment — review agent instructions             | High    |
| Same rejection code appears 3+ times in a week | Flag for systemic fix — the issue is in the process, not one piece | High    |
| Agent produces 0 content in a scheduled week   | Check if agent prompt is broken or blocked                         | Medium  |
| Agent consistently misclassifies tiers         | Retrain tier classification in agent prompt                        | Medium  |

### Queue Alerts

| Condition                        | Action                                                    | Urgency |
| -------------------------------- | --------------------------------------------------------- | ------- |
| Queue has > 30 items unreviewed  | Send urgent summary with top 5 priority items (RED first) | High    |
| Queue has > 15 items unreviewed  | Send daily digest with count and tier breakdown           | Medium  |
| No items reviewed in 48 hours    | Reminder: "Queue backlog growing — 15 min review needed"  | Medium  |
| RED tier item waiting > 24 hours | Escalate: "RED tier content awaiting founder review"      | High    |

---

## Batch Approval Optimization

### Auto-Approve Candidates (GREEN tier only)

These content types can be suggested for auto-approval to save review time:

| Condition                                                                   | Auto-Approve?             | Rationale                     |
| --------------------------------------------------------------------------- | ------------------------- | ----------------------------- |
| GREEN tier + matches an approved template exactly                           | Suggest auto-approve      | Template already reviewed     |
| Direct repurposing of already-approved content (new platform, same message) | Suggest auto-approve      | Core content already approved |
| Evergreen educational content with no product claims                        | Suggest auto-approve      | Low risk, high volume         |
| Weekend content pre-approved on Friday                                      | Auto-publish (GREEN only) | Maintain weekend cadence      |

### Never Auto-Approve

| Content Type                                    | Reason                           |
| ----------------------------------------------- | -------------------------------- |
| Any YELLOW or RED tier content                  | Requires human judgment          |
| Content with competitor mentions                | Legal risk                       |
| Content with pricing or ROI claims              | Accuracy verification needed     |
| First piece on a new platform (post-unlock)     | Establish quality baseline first |
| Content in a new format not previously approved | Need to validate format quality  |

---

## Escalation Chain

```
GREEN tier → Auto-approve candidates → Founder spot-check (1 in 5)
YELLOW tier → Founder review (same day)
RED tier → Founder review (within 24 hours, before any other tier)
Agent alert → Learning Engine adjusts prompts → Founder notified if 2+ alerts same week
Queue backlog → Daily digest → Urgent summary at 30+ items
```

---

## Change Log

| Date       | Change                                | Reason                   |
| ---------- | ------------------------------------- | ------------------------ |
| 2026-03-12 | Initial auto-escalation rules created | Queue optimization setup |
