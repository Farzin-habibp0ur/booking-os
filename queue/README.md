# Approval Queue — How It Works

> Purpose: Central content approval pipeline for all growth engine output.
> References: `system/quality-gates.md`, `system/auto-escalation-rules.md`, `system/rejection-tracker.md`

---

## Folder Structure

```
queue/
  pending/       ← Agents place new content here (after passing Gate 3)
  approved/      ← Founder moves approved content here
  rejected/      ← Founder moves rejected content here (with rejection code in filename)
  published/     ← Publisher moves published content here (after passing Gate 4)
  archive/       ← Content older than 30 days moves here automatically
```

---

## File Naming Convention

### New content (pending)
```
[DATE]-[TIER]-[PLATFORM]-[LANGUAGE]-[TITLE].md
Example: 2026-03-17-GREEN-instagram-en-5-ways-reduce-noshows.md
```

### Rejected content
```
[DATE]-REJECTED-[CODE]-[PLATFORM]-[LANGUAGE]-[TITLE].md
Example: 2026-03-17-REJECTED-R07-instagram-en-5-ways-reduce-noshows.md
```

### Published content
```
[DATE]-PUBLISHED-[PLATFORM]-[LANGUAGE]-[TITLE].md
Example: 2026-03-17-PUBLISHED-instagram-en-5-ways-reduce-noshows.md
```

---

## Daily Review Process (15 minutes)

### Step 1: Triage (2 min)
- Open `queue/pending/`
- Count items by tier: RED ___ | YELLOW ___ | GREEN ___
- If > 30 items, focus on RED + YELLOW only (defer GREEN to next session)

### Step 2: Review RED tier first (5 min)
- These need the most careful review — legal, medical, competitor claims
- Approve → move to `approved/`
- Reject → rename with rejection code, move to `rejected/`, log in `system/rejection-tracker.md`

### Step 3: Review YELLOW tier (5 min)
- Check pricing accuracy, testimonial verification, cultural adaptation
- Same approve/reject flow

### Step 4: Review GREEN tier (3 min)
- Quick scan for obvious issues
- Auto-approve candidates (see `system/auto-escalation-rules.md`) can be batch-approved
- Spot-check 1 in 5 auto-approve candidates

### Step 5: Log (1 min)
- Update `system/rejection-tracker.md` with any rejections
- Note any patterns for Learning Engine

---

## Tier Quick Reference

| Tier | Review Level | Examples |
|------|-------------|---------|
| **GREEN** | Quick scan, auto-approve candidates | Evergreen tips, educational content, TOFU |
| **YELLOW** | Careful review required | Pricing mentions, testimonials, MOFU, Spanish cultural content |
| **RED** | Founder deep review required | Competitor comparisons, health claims, legal language, guarantees |

---

## Content File Template

Every content file in the queue should follow this structure:

```markdown
# [One-line summary for quick scanning]

**Tier:** GREEN / YELLOW / RED
**Platform:** Instagram / TikTok / LinkedIn / Blog / YouTube / Pinterest
**Language:** EN / ES
**Pillar:** [1 of 5 content pillars]
**Funnel Stage:** TOFU / MOFU / BOFU
**CTA:** [Specific call to action]
**Product Feature:** [Feature from product-content-map.md, if MOFU/BOFU]
**Screen Recording:** [filename.mp4, if applicable]

---

[Content body]

---

**Hashtags/Keywords:** [list]
**UTM Campaign Slug:** [slug for tracking]
**Gate 3 Self-Check:** PASSED
```

---

## Archive Policy

- Content in `published/` older than 30 days → move to `archive/`
- Content in `rejected/` older than 14 days → move to `archive/`
- Content in `approved/` older than 7 days without publishing → flag as stale
- Archive is never deleted — used for Learning Engine analysis
