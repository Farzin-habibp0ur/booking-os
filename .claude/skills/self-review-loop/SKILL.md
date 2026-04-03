---
name: self-review-loop
description: "Iterative self-review protocol that runs after completing any non-trivial task. The agent reviews its own work against source material, fixes any issues found, then re-reviews from scratch — repeating until a full review pass finds zero errors. This skill should trigger automatically after completing any task that involves code changes, document creation, analysis, plans, reports, data work, or any multi-step output. Also trigger when the user asks to 'review', 'verify', 'check your work', 'make sure it's correct', or 'audit'. If you produced something, review it before presenting it as done."
---

# Self-Review Loop

This skill defines an iterative verification process. The core idea: a single review pass is unreliable because fixes in one area can introduce issues in another, and the reviewer (you) gets fatigued or anchored to assumptions from the first pass. The solution is to loop — review, fix, then review again with fresh eyes — until a complete pass finds nothing wrong.

This matters because the cost of delivering wrong work is much higher than the cost of an extra review pass. A plan with a wrong variable name wastes hours of a developer's time. A report with an incorrect number undermines trust in every other number. The loop catches these.

## When This Activates

Run this protocol after completing any task that produces an artifact — code, documents, plans, analyses, reports, spreadsheets, data transformations, configurations, or any multi-step output. The only exceptions are pure conversation (answering a question, explaining a concept) and trivial single-line changes where there's genuinely nothing to verify.

## The Loop

### Pass Structure

Each review pass has three phases:

**Phase 1 — Re-read your output against the source using tools.**
Go back to the actual source material (code files, data, requirements, whatever your work was based on) and compare it to what you produced. Critically: use Read, Grep, and other file tools to re-read the actual files — do not rely on your memory or earlier context of what the source said. This is the single most common failure mode: you remembered something slightly wrong during initial work, and a memory-based review will repeat the same mistake because you're comparing your output against the same faulty memory. The tool call is what breaks the cycle.

Specific things to check per output type:

- **Code changes:** Re-read every modified file. Check imports, variable names, type signatures, guard clauses, test coverage. If you referenced line numbers, verify they still match.
- **Documents/plans:** Cross-reference every factual claim against its source. If you said "line 163 does X", go read line 163. If you said "the model has 23 relations", count them.
- **Analysis/reports:** Verify calculations, check that numbers add up, confirm data sources are correctly cited.
- **Data work:** Spot-check output rows against input, verify transformations applied correctly, check edge cases (nulls, empty strings, boundaries).

**Phase 2 — Fix everything you found.**
Don't just note issues — fix them immediately. Each fix is a small change, and small changes can introduce new issues (a corrected variable name might not match elsewhere, a fixed number might change a downstream calculation). This is exactly why you need another pass after fixing.

**Phase 3 — Count and report.**
At the end of each pass, state clearly: "Pass N: Found X issues." This is your loop control. If X > 0, you must do another pass. If X = 0, you're done.

### Exit Condition

The loop exits when — and only when — a **complete** review pass finds **zero issues**. Not "zero important issues." Not "a couple minor things but they're fine." Zero. If you found something and fixed it, that doesn't count as a clean pass — you need another pass after the fix to confirm you didn't break anything.

### Efficiency

The loop sounds expensive, but in practice it converges fast. The typical pattern:

- Pass 1: Find 3-5 issues (the ones you missed during initial work)
- Pass 2: Find 1-2 issues (introduced by fixes, or things the first pass made you notice)
- Pass 3: Find 0 issues (clean pass, done)

Most tasks complete in 2-3 passes. If you're consistently hitting 4+ passes, that's a signal the initial work quality needs improvement — slow down during the creation phase.

### What "Fresh Eyes" Means

Between passes, mentally reset. Don't just skim the parts you changed — review the entire output again. The point is that fixing issue A might have broken the context around issue B, or might have made issue C (which was previously obscured) visible. A targeted re-check of only what you changed defeats the purpose.

For large outputs (100+ lines, multiple files), you can prioritize: start with the areas you changed, then scan the rest. But don't skip the scan.

## Integration with Project Workflows

This skill complements project-specific validation steps (like linting, testing, and doc checks). The self-review loop runs on the content and logic level — verifying correctness of what you wrote. Project checks (formatting, type-checking, tests) run on the mechanical level. Both are needed; neither replaces the other.

Typical ordering:
1. Complete the task
2. Run the self-review loop (this skill) — verify content correctness
3. Run project-specific checks (lint, test, format) — verify mechanical correctness
4. If project checks fail, fix the issue and restart from step 2 (not just step 3) — because code fixes can introduce content-level errors that need re-verification

## Communicating Results

When reporting the loop outcome to the user, be specific:

**Good:** "I ran 3 review passes. Pass 1 found 2 issues (incorrect relation count, missing timezone parameter). Pass 2 found 1 issue (the fix introduced an inconsistent variable name). Pass 3 was clean — zero issues found."

**Bad:** "I reviewed the work and it looks good." (This tells the user nothing about rigor.)

The user should be able to see that you actually did the work, not just claimed to.

## Progress Tracking

If a TodoList or progress tracking tool is available, add the review passes as explicit items. For example: "Self-review Pass 1", "Self-review Pass 2 (fixing Pass 1 issues)", "Self-review Pass 3 (clean pass)". This gives the user visibility into the loop in real time rather than only seeing the summary at the end.
