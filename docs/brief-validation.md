# Validation — delivered scope vs. PRD v1.1 and the event brief

Revised **October 20, 2026** against [PRD v1.1](../PRD.md). The previous revision of this
document measured against v1.0 and is superseded by this one.

Event: **Friday, October 23, 2026**, 9:00 AM – 7:00 PM, NYU SPS MTC Rooms 1026 & 1027.
Source brief: `Project Details/NYU SPS X Pulse Foundry.pdf`.

## 1. Headline

**Against v1.0 the project was close to complete. Against v1.1 it is roughly half of P0.**

v1.1 promoted nearly every gap identified in the previous revision from optional to required:
a second provider, off-site evidence, three additional artifact types, a controlled retrieval
experiment, scheduled re-runs, a trend chart, and recorded replay. Five of those are at zero.

Nothing regressed. The build did not get worse — the specification got larger.

The good news is that the hardest-won parts are the parts that already exist and are hard to
retrofit under time pressure: real measured data, an immutable audit trail, conservative parsing,
and a comparison gate that refuses to lie. The missing work is mostly additive.

## 2. Verification of existing claims

Re-checked against the running code and the SQLite store, not taken from documentation.

| Claim | Method | Result |
| --- | --- | --- |
| 42 tests, 0 failures | `npm test` | Confirmed |
| TypeScript + Vite build | `npm run build` | Confirmed |
| Two live runs, 40 raw answers | `runs` table | Confirmed: 20 + 20 all `succeeded`, answers 732–1678 chars, real citations |
| 75% mention / 100% coverage / 24.59% SoV | Stored run metrics | Confirmed: exact match to the case study |
| 20 matched pairs, 0 excluded, 0pp change | `comparisons` table | Confirmed |
| 20 non-branded questions, 5+ dimensions | `shared/questions.ts` | Confirmed: 8 intent dimensions, `branded: false`, neutrality enforced at the API boundary |
| Export only, no publication | Route list | Confirmed |

No documented claim was found to be overstated. Store contents: 2 restaurants, 5 runs, 119 calls,
48 sources, 30 opportunities, 4 artifacts, 3 comparisons.

## 3. Status against v1.1 functional requirements

| Req | P0 requirement | Status | Detail |
| --- | --- | --- | --- |
| FR-01 | Identity, profile, provenance | **Done** | Disambiguation, source links, unknown-stays-unknown, owner vs. website provenance all enforced |
| FR-02 | ~20 non-branded questions, 5+ dimensions | **Done** | 8 dimensions; identity stripped from locality/cuisine substitution; branded questions rejected server-side |
| FR-03 | **Two** providers side by side | **Partial** | One adapter executed (Codex CLI, `gpt-6.1-sol`). The Responses API adapter exists but has never run. No per-provider metric split in the UI |
| FR-04 | Parsing and entity matching | **Done, method deviates** | Meets the acceptance criterion — every metric traces to a raw answer and span. But v1.1 specifies LLM extraction under a JSON schema validated in code; the build uses a deterministic regex parser (`conservative-list-v4`) |
| FR-05 | Evidence incl. reviews, press, Reddit | **Partial** | Website content, structured data and provider citations: done. Review counts/ratings, press/blogs, Reddit/forums: **none collected** |
| FR-06 | 3–5 opportunities, ≥1 off-site, exec summary | **Partial** | 3 produced, all on-site, each source-linked. Missing: off-site opportunity, executive summary paragraph, `action_type` and `owner_control` fields |
| FR-07 | 8 artifact types | **Partial** | 3 of 8: `about`, `faq`, Restaurant+Menu JSON-LD. Missing: FAQPage JSON-LD, local landing page, outreach drafts, menu descriptions as a distinct artifact |
| FR-08 | Approval and publication | **Not built (correctly P1)** | No approval, publish, read-back or rollback routes |
| FR-09 | Live re-run and comparison | **Done** | Compatibility gate is stricter than v1.1 requires: 10 fields must match or metrics stay `null` |
| **FR-10** | **Controlled A / A-repeat / B experiment** | **Not started** | No corpus versioning, no retriever, no experiment service or routes |
| **FR-11** | **Scheduled daily re-run + trend chart** | **Not started** | No scheduler, no trend series, no `trigger` field on runs |
| **FR-12** | **Recorded replay** | **Not built** | `EvidenceMode` is `synthetic \| live` only. No replay mode, label or original-timestamp display |

### Scorecard

Five of twelve requirements fully met; four partial; three at zero. The three at zero —
FR-10, FR-11, FR-12 — are the ones v1.1 §18 explicitly forbids cutting.

## 4. Status against the brief's deliverables

The brief is less demanding than v1.1. Measured against the brief alone:

| Brief deliverable | Status |
| --- | --- |
| Working demo on at least one real restaurant | **Complete** — John's of Bleecker Street, Greenwich Village, four official pages |
| Visibility report vs. named competitors with specific gap reasons | **Complete** — snapshot-linked findings naming Bleecker Street Pizza, Song E' Napule, Denino's, Arturo's |
| Generated artifacts the restaurant could use | **Complete** — FAQ, about copy, validated Restaurant+Menu JSON-LD |
| A measurement mechanism ("re-run and compare" counts) | **Complete** — 20 matched pairs, 0 excluded |
| (Bonus) autonomous real action | **Not attempted** |

**The brief's deliverables are met. v1.1's P0 is not.** That gap is a deliberate product
decision in v1.1 to aim above the brief's floor, and it is the right call for judging — but it
means "we satisfy the brief" is not the same as "we are done."

## 5. The problem v1.1 solves, and the one it does not

### Solved: the demo arc

The previous revision's top finding was that the demo story is inverted. John's appears in
**15 of 20 answers at average position 1.47** — it is the incumbent winner, not the struggling
business in the brief's Greenwich Kitchen example — and the follow-up run shows **0pp change**
because nothing was published between runs. There is a before and an identical after with no fix
between them, which is not the *"what's broken → what we fixed → proof it worked"* arc judges
were told to expect.

v1.1 fixes this structurally by making **FR-10 the proof mechanism**. The controlled experiment
produces a real before/after under conditions we control and can explain, with an A-repeat
negative control showing how much the result moves by chance alone. That is a stronger and more
honest answer than hoping a live run shifts in one day.

This also means the earlier suggestion to swap in a weaker restaurant is **no longer the primary
fix**. It remains useful — a visible gap makes the diagnosis more vivid — but FR-10 carries the
proof either way.

### Not solved: there is still nothing to diagnose

FR-10 proves that *better information changes retrieval-based recommendations*. It does not supply
the finding that makes an owner care. With no review counts, the brief's own worked example —
*"340 Google reviews, you have 40"* — remains impossible to produce, and all three current
opportunities are structural-markup observations about a restaurant that is already winning.

**FR-05's off-site evidence is what makes FR-10 worth watching.** They should be built in that
order.

## 6. Open process items — elimination-level

These are unchanged and still unresolved. They outrank every engineering item below.

- **Advance-coding eligibility.** v1.1 §18 puts this first in the pre-event checklist: confirm with
  Dr. Steven Goss (`swg3@nyu.edu`) whether pre-built code is permitted. A substantial codebase now
  exists. If the answer is no, the prep must be reduced to data, keys and prompts — and knowing
  that on Thursday is survivable in a way that discovering it on Friday is not.
- **Team submissions only.** Individual submissions will not be considered. Members and roles
  still unconfirmed.
- **Submission format unspecified.** Repo, deck, recording — ask.

## 7. Plan for the remaining three days

v1.1 §18 supplies an hour-by-hour event-day plan. What follows is the **pre-event** ordering, which
§18 leaves to us, and it assumes advance coding is permitted. If it is not, items 2–6 become
Friday work and only item 1 survives.

### Thursday priority order

**1. Confirm eligibility, team and format.** Blocks everything. One email.

**2. FR-05 off-site evidence — reviews first.** Highest value per hour in the whole list. Review
count and rating for the target and top three competitors unlocks FR-06's off-site opportunity,
makes the executive summary concrete, and feeds corpus A in FR-10. Use official APIs (Google
Places, Yelp Fusion) within their terms; v1.1 explicitly permits manual entry with source URL and
date as the fallback, which is a legitimate shortcut under time pressure. Press and Reddit after,
and manual entry is fine there too.

**3. FR-10 controlled experiment.** The largest build and uncuttable. Corpus versioning, a fixed
retriever, A / A-repeat / B runs, and the integrity rule that only target content changes between
A and B. The A-repeat negative control is not optional decoration — without it a B-side improvement
is indistinguishable from noise, and a judge will ask.

**4. FR-12 recorded replay.** Small, and it de-risks the entire presentation. Extend `EvidenceMode`
with a replay mode, persist the original mode and timestamp, and render a permanent label. v1.1 §18
forbids cutting it, and the demo must never wait on a live call.

**5. FR-07 remaining artifact types.** FAQPage JSON-LD is nearly free given the existing FAQ
generator and validator. The landing page and outreach drafts are text generation against accepted
facts. Note v1.1 wants visible placeholders — `[owner to confirm: hours]` — where the current build
omits unknown fields entirely; that is a small behavioural change worth making, since a visible
placeholder is more honest than a silent omission.

**6. FR-11 scheduler and trend chart.** A daily trigger writing to run history, plus a chart with
sample size per point. Keep controlled-simulation results on a separate series — v1.1 is explicit
that they must never be mixed into the live trend line.

**7. FR-03 second provider.** Cheapest path: supply a key for the existing Responses API adapter
and show both. v1.1 permits shipping one provider if the second displays as "configured but
unavailable", so this is a UI state plus a written generalization argument — which is still
unwritten anywhere and takes about twenty minutes.

### Deliberately not doing

- **No stack migration.** v1.1 §10 suggests Python/FastAPI with Next.js or Streamlit as a *default
  suggestion*, not a requirement. The working system is TypeScript/Express/React with 42 passing
  tests and real collected data. Rewriting it three days out would destroy the only genuine asset
  the project has. This override should be stated out loud, not left implicit.
- **No removal of "deferred" hardening.** v1.1 §4 lists idempotency keys, the immutable audit model
  and SSRF hardening as deferred. All three are built and tested. Deferred means "not required",
  not "must be removed" — and the audit trail is the strongest evidence of analytical rigor the
  project has.
- **No FR-08 publication before P0 closes.** Bonus-only, and it carries real authorization risk
  against a business the team does not represent.
- **No parser rewrite to the LLM-extraction method in FR-04.** The deterministic parser meets
  FR-04's acceptance criterion and is more traceable. Its weakness — missing free-prose competitors
  — is worth noting in the demo, not fixing under time pressure. Revisit after the event.

### Cut order if Friday runs short

v1.1 §18 specifies: P1 publication → Gmail outreach drafts → multi-sample runs → second provider.
Never cut the controlled experiment, the evidence table, or replay.

## 8. Standing constraints

These bound every item above and are enforced in code and tests. From [AGENTS.md](../AGENTS.md)
and PRD v1.1 §4 and §7.

- Never invent a fact. No prices, hours, ratings, review counts, awards or dietary assurances
  without a real source. Unknown stays unknown, and v1.1 prefers a visible placeholder to silence.
- Keep `website`, `owner` and `synthetic` provenance distinct.
- Failures reduce coverage; they are never counted as "not recommended."
- Never claim causation between a content edit and a change in public AI products.
- "Not found" is scoped to the pages inspected.
- Live, controlled-simulation, recorded-replay and synthetic results must be impossible to confuse.
- Runs, snapshots and artifact versions are immutable; corrections are audited.
- No publication to a real restaurant's site, listings or inbox. Export only.
- Review recommendations must be policy-compliant — ask all customers, never gate or incentivize.
- Respect robots.txt, rate limits and API terms; prefer official APIs over scraping review sites.
