# Brief validation — deliverables vs. the NYU SPS X Pulse Foundry CFA

Validated **October 20, 2026**. Source brief: `Project Details/NYU SPS X Pulse Foundry.pdf`.
Event: **Friday, October 23, 2026**, 9:00 AM – 7:00 PM, NYU SPS MTC Rooms 1026 & 1027.

This document records what the brief asks for, what is built and independently verified, what is
missing, and what to do with the remaining time. It supplements [PROGRESS.md](PROGRESS.md) (current
state) and [implementation.md](implementation.md) (how it works); it does not replace either.

## 1. Verification method

Claims in `PROGRESS.md` and `reports/johns-bleecker-case-study.md` were re-checked against the
running code and the SQLite store rather than taken at face value. The brief PDF was extracted with
`pypdf` (no `pdftotext` installed locally).

| Claim under test | How it was checked | Result |
| --- | --- | --- |
| 42 tests, 0 failures | `npm test` | Confirmed: 42 pass |
| TypeScript + Vite production build | `npm run build` | Confirmed: clean |
| Two real runs, 40 saved raw answers | `runs` table in `data/tablesignal.sqlite` | Confirmed: 20 + 20, every result `succeeded`, raw answers 732–1678 characters, real provider citations |
| Baseline 75% mention / 100% coverage / 24.59% share of voice | Stored run metrics | Confirmed: exact match to the published case study |
| 20 matched pairs, 0 excluded, 0pp change | `comparisons` table and `reports/johns-bleecker-comparison.json` | Confirmed |
| 20 non-branded questions, four or more intent dimensions | `shared/questions.ts` | Confirmed: 20 templates, 8 intent dimensions, `branded: false`, identity stripped from locality and cuisine substitutions |
| Export only; no publication path | Route list in `server/index.ts` | Confirmed: no approval, action or rollback routes exist |

Store contents at validation time: 5 runs, 119 provider calls, 4 artifacts, 30 opportunities,
48 source snapshots, 3 comparisons, 2 restaurants.

No claim in the existing documentation was found to be overstated.

## 2. Completed — brief deliverables

| Brief deliverable | Status | Evidence |
| --- | --- | --- |
| Working demo using at least one real restaurant, NYU-area preferred | Complete | John's of Bleecker Street, 278 Bleecker Street, Greenwich Village; four official pages retrieved; app served at `http://127.0.0.1:3001` |
| Visibility report vs. named competitors, with specific reasons for the gap | Complete | `reports/johns-bleecker-case-study.md`; Bleecker Street Pizza, Song E' Napule, Denino's Greenwich Village, Arturo's Coal Oven Pizza, each finding tied to a stored snapshot |
| Generated artifacts the restaurant could actually use | Complete | FAQ draft, about copy, validated Restaurant + nested Menu/MenuItem/Offer JSON-LD |
| A measurement mechanism — "re-run this and compare" counts | Complete | Frozen bank re-run with settings/parser compatibility checks; 20 matched pairs, 0 excluded |
| (Bonus) evidence of the agent taking a real action autonomously | Not implemented | Export only; no publication, outreach or CMS integration |

## 3. Completed — four-stage loop

| Stage | Built | Notes |
| --- | --- | --- |
| Discovery | Yes | 20-question frozen bank across 8 intent dimensions; each question runs in a separate ephemeral Codex CLI conversation with live web search; target profile never enters the prompt; mention, recommendation, position and competitors logged per answer |
| Analysis | Partial | Scorecard (mention rate, recommendation rate, average position, share of voice, coverage) plus source-linked opportunities. Evidence base is narrower than the brief lists — see §4.3 |
| Action | Partial | FAQ, about copy and schema markup generated from accepted facts with provenance. No locally-relevant landing content; no autonomous action — see §4.5 |
| Measurement | Partial | Manual re-run and compatibility-checked comparison. No scheduling and no time series — see §4.2 |

## 4. Gaps against the brief

Ordered by risk to the submission.

### 4.1 The demo story is inverted — highest risk

The brief's stated bar is *"here's what's broken, here's what we fixed, here's proof it worked"* and
*"a before → diagnosis → fix → after story, not just a technical pipeline."*

John's of Bleecker Street appears in **15 of 20 answers at average position 1.47**. It is the
incumbent winner, not the struggling business in the brief's Greenwich Kitchen sample case. The
follow-up run shows **0 percentage points of change** because no content was published between runs.
The result is a before and an after that are identical, with no fix in between.

This is honest, and the PRD explicitly permits an unchanged result as valid. It is nonetheless not
the arc the judges described, and "Polish & demo quality" is scored on exactly that arc.

### 4.2 Scheduled re-testing is a core build item, not a bonus

Brief, *What You'll Build* §4: *"Re-run the same query bank on a schedule (daily/weekly) and track
mention rate and rank over time."* The PRD demotes scheduling to P1 ("if time and infrastructure
permit") and it is unimplemented. Measurement is manual re-run only, producing two data points
rather than a trend.

### 4.3 Analysis inputs are narrower than the brief lists

The brief names website copy, structured data, **Google Business Profile, Yelp/TripAdvisor listings,
press coverage, blog mentions, and Reddit/forum discussion**. The collector inspects own-site pages
and provider-cited competitor sites only.

Most consequentially there is **no review-count data of any kind**, so the single most concrete lever
in the brief's own worked example — *"340 Google reviews (you have 40)"* — cannot be produced.

### 4.4 One provider, and the generalization argument is unwritten

Only the Codex CLI adapter (`gpt-6.1-sol`, ChatGPT sign-in) has executed. The Responses API adapter
exists but has never run; there is no Gemini or Perplexity path.

The brief permits this — *"build for the ones you can reach"* — **on the condition that you clearly
explain how the approach generalizes to others.** That explanation does not currently appear in the
PRD, the implementation notes or the case study. This is a writing task, not an engineering one.

### 4.5 Action layer is missing locally-relevant landing content

Supported artifact types are `faq | about | jsonld`. The brief specifically calls for
*"locally-relevant landing content (e.g. 'Best lunch spots near NYU' written to plausibly earn a
citation)"* and improved menu descriptions.

### 4.6 Visual QA unverified

`PROGRESS.md` flags this honestly and it remains unresolved: no browser was available in the last
phase and a Chrome launch timed out. The earlier synthetic milestone's browser checks do not validate
the current interface. The brief weights demo polish.

## 5. Judging-criteria read

| Criterion | Assessment |
| --- | --- |
| Discovery depth | Strong on query realism and independence; thin on platform breadth (one provider), and the generalization explanation is missing |
| Analytical rigor | Strongest area — source snapshots, exact evidence spans, rejected-source audit trail, separation of mention from recommendation, scoped absence findings |
| Actionability | Good — three evidence-backed opportunities and exportable artifacts; weakened by no review data and no landing content |
| Autonomy (bonus) | Not attempted |
| Measurability | Credible mechanism, but two points and no schedule |
| Polish & demo quality | At risk — see §4.1 and §4.6 |

## 6. Process flags — elimination-level, not scoring-level

- **Team submissions only.** The brief states individual submissions will not be considered. PRD §19
  still lists team and registration status as unresolved.
- **Advance-work eligibility.** PRD §19 flags that the brief does not state whether pre-event coding
  is permitted. Still unconfirmed with organizers. Contact: Dr. Steven Goss, `swg3@nyu.edu`.
- **Submission format unspecified.** The brief does not name a required repository, deck, hosting or
  recording format. Worth confirming.
- **Not a git repository.** Whatever the submission format, version history is worth having.

## 7. Suggestions for remaining time

Three days to the event. Ordered by value per hour.

### Priority 1 — fix the demo arc (§4.1)

Select a second, genuinely weak NYU-area restaurant as the primary demo subject so the diagnosed gap
is real, then use the controlled retrieval experiment already specified in PRD §9 to produce an
honest *after*. Keep John's of Bleecker Street as the contrasting "healthy incumbent" case — the
comparison between a winner and a straggler is itself a strong three-minute story.

Label the controlled experiment exactly as PRD §9 requires: it demonstrates behavior in our
retrieval setup and is not proof of improved visibility in public AI products. Do not manufacture an
improving result.

### Priority 2 — write the generalization paragraph (§4.4)

Roughly 20 minutes of prose covering: the adapter interface, what a Gemini or Perplexity adapter
would need to implement, which metrics are provider-independent, and why per-provider results are
not directly comparable. Add it to the case study and the README.

### Priority 3 — add one third-party evidence channel (§4.3)

Review counts are the highest-value single addition, because they unlock the brief's own example
comparison. Respect the brief's note on scraping etiquette and rate limits. If no compliant source is
reachable in the time available, state that limitation explicitly rather than leaving the gap silent.

### Priority 4 — add a landing-content artifact type (§4.5)

Extend `ArtifactType` with a locally-relevant landing page generated from accepted facts, following
the same provenance and validation rules as the existing types.

### Priority 5 — scheduled re-testing (§4.2)

Even a simple interval trigger writing to the existing run history would convert two data points into
a trend and satisfy an explicit build item.

### Priority 6 — visual QA (§4.6)

Run when browser access returns, as `PROGRESS.md` already plans.

### Not recommended before the event

Approval-gated publication, rollback, outreach and CMS integration. These are bonus-only, carry real
authorization risk against a business the team does not represent, and cost more than the remaining
items are worth.

## 8. Standing constraints

Unchanged from `PROGRESS.md` and the PRD, repeated here because they bound every suggestion above:

- Website review does not grant publication permission. No third-party listing edits.
- No fabricated reviews, ratings, prices, awards, dietary assurances or uplift figures.
- Live, simulated, recorded and synthetic results must remain distinctly labeled.
- Historical runs and source snapshots are immutable; corrections are versioned and auditable.
