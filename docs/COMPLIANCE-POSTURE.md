# Compliance Posture — Year 1

> **Purpose:** The single source of truth for what Business Command Centre claims about compliance, what we don't claim, and how we respond when prospects ask for HIPAA / BAA / PHIPA assurances. Year 1 (now) is **non-HIPAA, non-PHI**. This document tells you what to say (and what not to say).
>
> **Audience:** Founder, sales, marketing, customer-facing staff, engineering. Anyone who writes a public sentence on behalf of BCC needs to read this.
>
> **Last updated:** 2026-05-09

---

## The headline

**BCC is non-clinical infrastructure. Your PMS remains the system of record for any patient health information.**

That sentence is the public stance. Use it verbatim in sales calls, security questionnaires, and marketing copy. Variations are fine for tone, but the substance — **non-clinical**, **PMS is system of record**, **no PHI** — does not change.

---

## Year-1 stance (now)

| Property                            | Position                                                                                                                                                                                                                    |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| HIPAA compliance                    | **Not claimed.** We are non-HIPAA in Year 1.                                                                                                                                                                                |
| Business Associate Agreements (BAA) | **Not signed.** We decline politely. See decline script below.                                                                                                                                                              |
| PHI handling                        | **Not collected.** We deliberately removed clinical schema (`MedicalRecord`, `ClinicalPhoto`, `PhotoComparison`, all `Aftercare*` models) and clinical UI. `TreatmentSession.beforePhoto`/`afterPhoto` FKs removed.         |
| PHIPA (Canadian privacy) compliance | **Not claimed.** Canadian customers are welcome; the same non-clinical-infrastructure stance applies.                                                                                                                       |
| GDPR / CCPA                         | We respect data deletion and access requests. Privacy / terms pages exist at `/privacy`, `/terms`, `/security`.                                                                                                             |
| "Encrypted at rest" claims          | **Do not make this claim publicly** in Year 1. Postgres at-rest encryption depends on the deployment substrate (Railway managed Postgres). We don't currently audit and certify it. Don't promise what we haven't verified. |
| TLS in transit                      | Yes — every public endpoint is HTTPS, every webhook is TLS, internal service-to-service is over the Railway private network.                                                                                                |
| Tenant isolation                    | Yes — every database query filters by `businessId`. Documented in `CLAUDE.md` and audited as part of the security-review skill.                                                                                             |

---

## What we DO claim (the safe list)

These are claims we can make truthfully, today, on any public surface. Use these as the building blocks for any new copy.

- **Non-clinical infrastructure.** We sit in front of your PMS to handle inbound messages and bookings. We are not a system of record for patient health information.
- **Inbox + AI Front Desk.** AI drafts replies; staff approve and send. Multi-channel: Instagram, WhatsApp, SMS, email, web chat, Facebook Messenger.
- **Two-metric attribution.** Bookings captured + bookings that would have been missed without BCC, derived from the seven-reason contract in [`docs/BOOKING-ATTRIBUTION-DEFINITION.md`](BOOKING-ATTRIBUTION-DEFINITION.md).
- **Tenant isolation.** Each clinic's data is logically isolated by `businessId` at every database query.
- **TLS in transit.** All public endpoints use HTTPS; webhooks are TLS; cookies are `Secure; HttpOnly; SameSite=Lax`.
- **Token-based auth with httpOnly cookies.** Tokens rotate. Concurrent refresh is deduplicated. Brute-force protection on login. Detailed auth rules in `CLAUDE.md`.
- **Staff approval by default.** AI drafts require staff approval. Auto-send is opt-in per channel after the clinic is comfortable.
- **Kill switch.** During pilot, the clinic can stop service any time. After graduation, the subscription can be cancelled month-to-month.
- **30-day free concierge pilot.** No card on file during pilot, founder onboards personally, success scorecard determines graduation.

---

## What we do NOT claim (the never list)

Do **not** put these on any public surface, in any sales email, on the website, in marketing copy, in the product, or in answers to security questionnaires. If a prospect requires any of them, we are the wrong fit in Year 1.

- HIPAA compliant
- HIPAA Business Associate Agreement available / signable
- PHIPA compliant (Canadian)
- "Built for HIPAA-regulated environments"
- "Encrypted at rest" (we'll add this when we audit and verify it; not in Year 1)
- "Stores patient medical records securely" (we deliberately don't store medical records)
- "End-to-end encrypted" (BCC sees plaintext message bodies in order to draft replies; we are honest about this)
- "SOC 2 compliant" (not in Year 1)
- ISO 27001 / FedRAMP / any other regulated-industry compliance framework
- "Suitable for enterprise medical practices" (we explicitly target owner-operated 1–10 location med spas)

If marketing copy or website copy ever drifts toward these claims, treat it as a bug and fix it immediately. Brand grep is part of Phase 12 of `BCC-PIVOT-MASTER-PLAN.md`.

---

## BAA decline script

A prospect's compliance / legal team asks: "Will you sign a BAA?" Here's how to respond.

### Email or async response

> Thanks for raising this — it's an important question, and I want to be straight with you.
>
> In Year 1, BCC is **non-HIPAA** infrastructure. We don't sign Business Associate Agreements, and we don't position ourselves as a system that handles PHI. That's a deliberate product decision, not an oversight: we removed clinical schema (medical records, before/after photos, aftercare protocols, treatment histories) so we're not a Business Associate under the HIPAA definition.
>
> What we handle is the layer **in front of** your PMS — inbound messages, AI-drafted replies, bookings, customers' contact info, and prices paid. The same data your front desk would handle on a phone call. Your PMS remains the system of record for patient health information.
>
> If you require a BAA today to evaluate vendors, we are not the right fit yet. We're working toward a HIPAA path in Year 2 once we have BAAs lined up with our subprocessors and a PHI minimization audit complete. I'd love to add you to our Year 2 waitlist so we're in touch when that's ready.
>
> If your team is comfortable with vendors that explicitly stay on the non-PHI side of the line, I'd love to walk you through what we do cover. The pilot is 30 days, free, concierge, with a kill switch any time.
>
> Let me know which path makes sense.
>
> [Founder]
> Business Command Centre

### On a live call

Slow down. Don't rush. The BAA question is a serious question and deserves a serious answer.

> "Honest answer: we don't sign BAAs in Year 1. We deliberately built BCC as non-clinical infrastructure — we removed medical records, clinical photos, aftercare protocols from the schema entirely so we're not handling what HIPAA defines as PHI. Your PMS stays the system of record for any patient health information.
>
> I know that's a hard line. If your team requires a BAA today to evaluate vendors, I'm the wrong vendor for you right now. We're working toward HIPAA in Year 2 — once we have subprocessor BAAs and a PHI audit done. Want me to add you to our Year 2 waitlist so we're in touch when that lands?
>
> If your team is OK with a vendor explicitly on the non-PHI side, I'd love to keep going. The pilot terms are 30 days, free, kill switch any time. But I won't pretend we're HIPAA compliant when we're not."

The honesty is the asset. Owners and clinical directors trust founders who tell them what they don't do almost as much as they trust founders who oversell what they do. The Year-1 stance is defensible — explain it confidently.

---

## What to do when a prospect adds them to the waitlist

If a prospect asks for a BAA and accepts the Year 2 waitlist offer:

1. In `/admin/pilot-applications`, click **"Add to Year 2 Waitlist"**. Status updates to `WAITLIST_YEAR_2`.
2. The polite "thanks, we're not yet ready for HIPAA-required practices" email fires automatically.
3. Tag the application internally as `compliance_blocker` (vs `practice_type_out_of_icp`) so we can prioritize HIPAA-driven prospects when we trigger the Year 2 path.
4. Do **not** keep them in active sales conversation. Year 2 is Year 2.

---

## Year-2 trigger conditions for HIPAA upgrade

We unlock HIPAA / BAA path when **all** of these are true:

1. **Revenue base** — at least 20 paying clinics on the AI Front Desk SKU, generating ARR sufficient to fund the upgrade work without external capital.
2. **Subprocessor BAAs** — BAAs signed with all PHI-touching subprocessors: Anthropic (or another LLM provider with HIPAA-eligible offering), AWS / Railway (whoever hosts production), Resend or our outbound email provider, Twilio, the messaging providers (WhatsApp Business API, Meta), and any storage provider for attachments.
3. **PHI minimization audit** — Internal audit confirming exactly what fields cross the BCC trust boundary and what the redaction strategy is for any field that could carry PHI. Documented and reviewed by external counsel.
4. **Reintroduction of clinical schema (selectively)** — Decide which previously-removed clinical models we re-introduce (medical records, photo tracking, aftercare protocols, treatment histories) under HIPAA controls. Not all of them; only what the Year 2 ICP genuinely needs.
5. **Counsel review of public claims** — Before any public "HIPAA compliant" or "BAA available" claim, a written sign-off from external counsel.
6. **Year 2 ICP signal** — At least 10 Year-2-waitlist clinics queued, indicating real pull for the HIPAA tier.

Until all six are true, we hold the line on the Year-1 stance.

> **TBD — confirm with founder.** Numbers above (20 paying clinics, 10 waitlist signals) are reasonable defaults but not yet calibrated to revenue projections. Refine when the first cohort completes pilot.

---

## How this stance is enforced in product

The compliance posture isn't just a sales talking point — it's enforced in code:

- **Schema** — `MedicalRecord`, `ClinicalPhoto`, `PhotoComparison`, all `Aftercare*` models removed from `packages/db/prisma/schema.prisma` (Phase 2 of `BCC-PIVOT-MASTER-PLAN.md`). Migration `phase2_remove_clinical_models` records the removal.
- **UI** — Aesthetic vertical clinical components deleted (`apps/web/src/components/aesthetic/medical-*.tsx`, `photo-*.tsx`, `aftercare-*.tsx`). Customer detail page no longer renders clinical sections.
- **API** — `apps/api/src/modules/aftercare/` removed; medical-records and clinical-photos endpoints removed.
- **Public copy** — Marketing pages (`apps/web/src/app/(marketing)/{landing-page,pricing/page,faq/page,privacy/page,terms/page,security/page}.tsx`) reviewed against this stance in Phase 5; any drift caught in Phase 9 and Phase 12 brand grep.
- **Tests** — Brand-grep verification in Phase 12: `git grep -i "HIPAA\|BAA\|PHI\b\|PHIPA\|encrypted at rest"` should return zero customer-facing hits outside of:
  - This document (`docs/COMPLIANCE-POSTURE.md`) — declines and decline scripts.
  - `BCC-PIVOT-MASTER-PLAN.md` — historical context.

---

## Cross-references

- [`docs/PROJECT_CONTEXT.md`](PROJECT_CONTEXT.md) — overview, including the public stance verbatim.
- [`docs/PILOT-OPS.md`](PILOT-OPS.md) — kill criteria include "clinic asks for HIPAA / BAA mid-pilot."
- [`docs/PILOT-SALES-SCRIPT.md`](PILOT-SALES-SCRIPT.md) — Objection #2 ("How is this HIPAA compliant?").
- [`agents/outbound-prospecting.md`](../agents/outbound-prospecting.md) — explicit "never claim HIPAA / BAA / encrypted at rest" rule for outbound.
- `BCC-PIVOT-MASTER-PLAN.md` — the locked decisions backing this stance.

---

## Change log

| Date       | Change                                                                                                                                          |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-05-09 | Initial creation. Codifies Year-1 non-HIPAA / non-PHI stance, public claim list, never list, BAA decline script, and Year-2 trigger conditions. |
