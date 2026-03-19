# Agent Platform Filter

> MANDATORY PRE-FLIGHT CHECK for all content-producing agents.
> This document must be consulted BEFORE creating any content.

---

## Rule

**BEFORE CREATING CONTENT:** Read `[WORKSPACE]/system/platform-launch-config.md`

1. **Only create content for platforms with status: ACTIVE**
2. **Skip all LOCKED platforms** — do not create content, do not add to queue, do not schedule
3. **If a platform was recently unlocked** (within the last 2 weeks of its unlock date), produce content at **50% of target cadence** before ramping to full cadence

---

## Quick Reference: Current Platform Status

> Keep this section in sync with `platform-launch-config.md`. Updated: 2026-03-12.

| Platform  | Status | Cadence (if ACTIVE) |
| --------- | ------ | ------------------- |
| Instagram | ACTIVE | 5 posts/week        |
| TikTok    | ACTIVE | 5 videos/week       |
| LinkedIn  | ACTIVE | 4 posts/week        |
| YouTube   | LOCKED | — skip —            |
| Pinterest | LOCKED | — skip —            |
| X/Twitter | LOCKED | — skip —            |

---

## Agent Checklist

Before each content batch, every content-producing agent must:

- [ ] **Read** `platform-launch-config.md` to get current platform statuses
- [ ] **Filter** the content plan to ACTIVE platforms only
- [ ] **Check** if any platform was unlocked in the last 14 days
  - If yes: produce at 50% cadence for that platform
  - If no: produce at full cadence
- [ ] **Do NOT** create drafts, outlines, or assets for LOCKED platforms
- [ ] **Do NOT** add LOCKED platform content to the approval queue

---

## What to Do When a Platform Is Unlocked

When the Performance Analyst recommends unlocking a phase and `platform-launch-config.md` is updated:

1. **Week 1-2 (Ramp-up period):**
   - Produce content at 50% of the platform's target cadence
   - Prioritize repurposing top-performing content from Phase A platforms
   - Test 2-3 content formats to find what resonates
   - Monitor engagement closely — report in weekly review

2. **Week 3+ (Full cadence):**
   - Scale to 100% of target cadence
   - Begin creating platform-native content (not just repurposed)
   - Add platform to regular content calendar

---

## Platform-Specific Repurposing Rules (for newly unlocked platforms)

### YouTube (when unlocked)

- Shorts: Repurpose top TikTok/Reels (re-export with no watermark)
- Long-form: Expand top-performing carousel topics into 3-10 min tutorials
- Thumbnails: Create from highest-engagement Instagram static posts

### Pinterest (when unlocked)

- Pins: Convert Instagram carousels to vertical pin format
- Infographics: Repurpose LinkedIn document posts
- Blog pins: Link to existing blog content from Phase B4

### X/Twitter (when unlocked)

- Threads: Repurpose top LinkedIn text posts into thread format
- Tweets: Extract key insights from all platform top performers
- Engagement: Prioritize replies and quote tweets in the niche

---

## Error Handling

If an agent encounters a platform not listed in `platform-launch-config.md`:

- **Do NOT create content for it**
- Log the unknown platform in the weekly report
- Flag for manual review

If `platform-launch-config.md` is unavailable or unreadable:

- **Default to Phase A platforms only** (Instagram, TikTok, LinkedIn)
- Log the error and notify for manual review
