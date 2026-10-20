# Project checkpoint

Last verified: **October 20, 2026 (America/New_York)**.

## Current outcome

The user asked to make the fictional prototype work with a real NYC restaurant, run it using available access, and preserve work across token/session restarts. That real-data functional path is now implemented and verified. Preserve the current database and saved outputs; do not restart from synthetic fixtures or repeat completed model calls without a new reason.

The app is running at **http://127.0.0.1:3001** through a detached local supervisor. `npm run local:status` checks it. `npm run up` starts it if necessary; `npm run down` stops the managed server. The supervisor restarts an unexpectedly exited application, preserves SQLite data, and stops after 10 consecutive startup failures. It does not install an OS login/reboot service.

## Real restaurant and provider

- Restaurant: **John’s of Bleecker Street**, 278 Bleecker Street, New York, NY 10014. Official site: <https://johnsofbleecker.com/>; menu: <https://johnsofbleecker.com/food-menu>.
- Local ID: `restaurant_fb9e595c-b29b-4fa8-91e7-bd2aefa0a4aa`.
- Four official target pages were retrieved: homepage, food-menu, drink-menu and about. Accepted facts retain **website** provenance and exact source references. Duplicate/unused draft facts remain unaccepted. No owner affiliation or publishing permission is asserted.
- Available live adapter: official project-local `@openai/codex@0.163.0` with normal **ChatGPT sign-in**, model `gpt-6.1-sol`. `npm run provider:status` verifies normal authentication; no credential files or tokens were opened/extracted.
- Each query uses a separate ephemeral CLI conversation, live web search, an empty temporary directory, a read-only sandbox, fixed settings, and shell/apps/plugins/hooks/computer tools disabled. Raw final answers, actual citations, web-search events and available usage are captured. These are measurements of this Codex CLI configuration, not consumer ChatGPT rankings.
- The alternative Responses API adapter still needs a server-side API key and has not been executed here. The fictional Linden Table workspace remains separately labeled synthetic.

## Completed measurements

1. Baseline: `run_426d5165-73f6-4270-af81-b2715c609fde`.
2. Follow-up: `run_3d567f41-3bb7-4136-a70d-dd29c970d0bf`.

Both repeated the same frozen 20-question bank with compatible provider/model/retrieval settings and reviewed parser `conservative-list-v4`. **Each completed 20/20 valid answers, 15 mentions and 15 recommendations: 75% mention/recommendation rate and 100% coverage.** The comparison has 20 matched valid pairs, 0 excluded, and 0 percentage-point mention/recommendation change. No restaurant content was published between runs; no causal uplift is claimed.

The baseline’s leading observed competitors were Bleecker Street Pizza, Denino’s Greenwich Village and Song E’ Napule. The follow-up’s were Bleecker Street Pizza, Arturo’s Coal Oven Pizza and Song E’ Napule. Their matching provider-cited public sites were collected. Denino’s inspected menu actually contains Menu/MenuItem structured data; the target homepage contains Restaurant schema, while its inspected food-menu page has no JSON-LD script.

## Trust and review corrections

- The parser supports linked bold names and distinguishes positive list descriptions (“whole pies rather than slices”) and quoted dietary restrictions from negative restaurant recommendations. Explicit negative sections and ambiguous identities remain separate.
- Stored raw answers were preserved during explicit reparsing. `/runs/:id/audit` retains before/after appearances, metrics, parser versions and analysis revisions.
- A development domain-matching error initially associated John’s with Bleecker Street Pizza because they share “Bleecker.” That matcher was fixed, regression-tested, and the eight misassociated snapshots were explicitly rejected with review notes. Original URL/content/hash/time remain intact. They do not support current findings.
- Four unrelated Song E’ Napule Upper West Side/Rutherford menu snapshots were similarly excluded, and future competitor collection filters those unrelated branch pages. Current Greenwich Village evidence uses the matching homepage/West Village menu.
- An earlier 512 KB fetch ceiling failed on Song E’ Napule. The bounded input ceiling is now 2 MB; recollection succeeded. Historical failures remain visible, while current evidence collection warnings are empty.
- Source-review rejections are auditable and invalidate current analysis revisions. All generated content still requires review before separately authorized publication.

## Saved deliverables

- `reports/johns-bleecker-case-study.md`: concise real case study with metrics, observations, sources and limits.
- `reports/johns-bleecker-faq.md`: usable FAQ from accepted facts and unambiguous base-size prices.
- `reports/johns-bleecker-jsonld.json`: validated Restaurant + nested Menu/MenuItem/Offer draft.
- `reports/johns-bleecker-comparison.json`: compatible 20-pair repeat comparison.
- Artifact IDs: `artifact_0d90a963-93ad-4c9e-b1f4-24184115f3e3` (JSON-LD), `artifact_a3264311-4d24-4c5e-9309-753b7e6663e9` (FAQ). Both remain saved in the app with the originating baseline run.
- Runtime evidence reports: `data/run_<id>-evidence-report.json`; original SQLite database: `data/tablesignal.sqlite`.

Three current opportunities are supported by actual snapshots: make the menu machine-readable, clarify directly observed size/price wording mismatches, and prepare a source-linked FAQ. The app does not invent a corrected specialty price or promise improved visibility.

## Verification

- **`npm test`: 42 tests passed, 0 failed.** Isolated tests cover metrics, parsing, public fetching/robots, source extraction and review, domain/branch separation, provider capture, nested menu validation, immutable edits/exports, restart recovery, request ceilings and audit preservation.
- **`npm run build`:passed** TypeScript and Vite production build.
- Two actual live runs completed 40 saved answers with no failed calls.
- A deliberate application exit was recovered by the supervisor. **All 40 raw answers retained exact hashes across restarts.** Built-interface HTTP delivery and provider metadata were checked; no active model jobs remain.
- **Browser limitation:** no enabled browser was available in this phase, and a supported Chrome launch timed out. Visual QA of the latest real-data UI changes is unverified. The earlier synthetic milestone had independent desktop/mobile browser checks; do not claim those validate the current interface.

## Resume commands and next work

1. Read `AGENTS.md`, this checkpoint, the case study, `PRD.md` and `README.md`. Check `npm run local:status` before starting another API worker.
2. If the app is stopped: `npm run build` then `npm run up`. Do not run another worker against the same DB/port while the supervisor is active.
3. For the saved real baseline/follow-up, `npm run run:nyc` and `npm run rerun:nyc` use stable idempotency keys and poll the existing saved runs. They should not duplicate model calls.
4. The next useful optional work is visual QA when browser access returns, followed by any explicitly requested production deployment/authentication or new restaurant/provider work. Publishing to restaurant sites, outreach and P1 CMS approval/rollback remain unimplemented and outside current publication authorization.
5. Preserve immutable data and source/audit history. Never use authentication-file extraction, fabricated uplift or a destructive reset as a shortcut.
