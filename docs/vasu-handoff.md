# Vasu: what works and what still needs work

For **@Vasusolanki811** · October 21, 2026 (America/New_York).

The local Discovery → Analysis → Draft → Re-run/Compare workflow works with real restaurant data. **PRD v1.1 P0 is not complete.** The new example makes a visibility gap easier to demonstrate; it does not prove a fix improved recommendations.

## What works

| Area | Verified behavior |
| --- | --- |
| Setup | Node.js 24+, `npm ci`, then `npm run setup` builds and starts the managed local server. Open <http://127.0.0.1:3001>. `npm run local:status` and `npm run down` manage it. |
| Real example | Gandhi Cafe, 283 Bleecker Street, near NYU's Washington Square campus. Its completed baseline has **20/20 valid answers, 2 recommendations (10%), 100% coverage, 3.03% share of voice**. Six distinct competitors were recommended more often. |
| Discovery | A frozen 20-question Indian/NYU bank runs through the configured Codex CLI / `gpt-6.1-sol` adapter. Each question is independent and contains no target name or profile. Actual answers, citations and outcomes are saved. |
| Dashboard | Mention/recommendation rates, position with sample size, coverage, raw-answer inspection and five leading competitor rows plus the target. Selected restaurant survives refresh in the same browser. |
| Evidence | Two target pages are saved with URLs, timestamps and hashes. Website-derived facts retain website provenance after review. Failures remain visible. |
| Drafts | FAQ, about copy and Restaurant JSON-LD validated and exported. Editing creates a new artifact version. These are review drafts. |
| Measurement | Manual repeat and compatible-run comparisons work. John's historical baseline/follow-up has 20 matched pairs and 0 percentage-point change. No Gandhi follow-up has been run. |
| Persistence | SQLite preserves runs, sources and versions across restarts. The original five runs / 100 raw answers retained their exact IDs and answer hashes after the Gandhi work. |

Read the [Gandhi case study](../reports/gandhi-cafe-case-study.md) and [desktop screenshot](../reports/gandhi-cafe-overview.png). The [system overview](system-overview.md) explains the stack and flow; older example/count references there describe the October 20 snapshot.

## What is limited or not working yet

- **Gandhi's raw run is local.** GitHub contains the reviewed report, screenshot and exported drafts, not this computer's SQLite database or credentials. A fresh clone starts with the clearly labeled synthetic Linden Table example. Pulling this update does not automatically load the saved Gandhi run into another computer's dashboard.
- **Competitor aliases need review.** “Masala Times” (3 answers) and “Masala Times Greenwich Village” (10) are stored separately, although those answers identify the same branch. Combined count: 13/20. Gandhi is eighth among stored names and seventh among distinct businesses; its 2/20 rate and outside-top-five conclusion remain valid. Raw answers were preserved.
- **Two competitor sites are unavailable.** Mint Masala returned HTTP 403; Masala Times' robots check returned HTTP 403. Thelewala's matching cited homepage was collected. Unavailable pages are not evidence of missing information.
- **Drafts are sparse.** Only the phone link and menu URL are accepted Gandhi profile facts. Other visible hours/menu details still need source review, so no prices, dietary guarantees or nested menu items were invented.
- Only one provider configuration has actually run. The alternative Responses API adapter exists but is unverified here; there is no second-provider comparison interface.
- Review counts/ratings, independent press/blog and forum evidence, and evidence-backed off-site opportunities are not implemented.
- FAQPage JSON-LD, a local landing page, outreach drafts and distinct menu-description artifacts are not implemented.
- Controlled A / A-repeat / B experiments (**FR-10**), scheduled measurement/trend charts (**FR-11**) and a dedicated recorded-replay mode (**FR-12**) are not implemented. Saved data can be viewed, but that is not the full specified replay feature.
- Publication, approval/read-back/rollback, Gmail integration, production authentication and multi-user hosting are not implemented. The app runs locally for one operator.

The [v1.1 gap assessment](brief-validation.md) remains the detailed requirement checklist; its October 20 counts and John's-specific examples are historical.

## How to pick up the work

```sh
git pull --ff-only
npm ci
npm run setup
```

These commands make no new model calls. Keep an existing `data/tablesignal.sqlite`; never delete it to restart. A fresh clone gets its own database. Stop the managed server with `npm run down` before using `npm run dev` on the same port.

For the Gandhi example on another machine, review the checked-in case study and drafts first. Creating a new profile or deliberately starting a new live baseline needs that machine's own provider access and produces a new measurement. The existing `setup:nyc`, `run:nyc` and `rerun:nyc` commands still target **John's**, not Gandhi.

Suggested next work: collect source-backed off-site evidence, build the controlled experiment with its A-repeat control, add recorded replay, then scheduled measurement/trends. Review additional Gandhi facts and the Masala Times alias split before presenting exact competitor ranks. Confirm event eligibility and submission requirements with the organizers.

## Verification

- Latest local build passed; **46 tests passed, 0 failed, 0 skipped**. Tests use temporary databases and no live model calls.
- Desktop Chrome check confirmed Gandhi's completed scorecard and selection after refresh. This does not validate all screens or mobile layouts.
- The preceding setup commit `5b74884` passed GitHub's Linux, Windows and macOS verification jobs. Check Actions for this new push; do not assume the previous run validates new commits.
- No restaurant content was published, no restaurant was contacted and no causal visibility improvement is claimed.
