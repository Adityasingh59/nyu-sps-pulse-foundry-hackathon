# Project checkpoint

Last verified: **October 23, 2026 (America/New_York)**.

## Cloud migration — October 23 (current)

Governing documents: `AGENTS.md`, `Skills/RULES.md`, `Skills/development.md` (currently untracked in Git). The referenced `skills/tablesignal-development/SKILL.md` **does not exist** in this repository; work followed the two files above.

```text
Milestone / task: M0 — preserve baseline
Status: verified complete
Delivered behavior: Baseline recorded at 03de8bf (main, clean apart from untracked Skills/). Node 24.15.0.
Changed modules: none
Verification actually run and results: npm run build passed; npm test 46 passed / 0 failed / 0 skipped.
  Read-only inventory of data/tablesignal.sqlite: 4 restaurants, 4 banks, 8 runs (143 answers),
  74 sources, 40 opportunities, 7 artifacts, 166 calls, 3 comparisons, 7 idempotency keys.
  Per-table SHA-256 of all rows recorded in-session; identical again after M1 work (no data changed).
  Found one live run not described below: run_04a5818b-dab6-46fc-907c-65770fdd482a (Gandhi Cafe,
  bank_6ef68b4d…, created 2026-10-22T03:55Z, UI-generated idempotency key, 20/20 valid,
  stored recommendation rate 5%, coverage 100%). It is preserved as-is; it has not been reviewed
  or used in any report, and the Gandhi case study still refers to run_36e28381….
Remaining limitations / blockers: none for M0.
Next concrete action: M1.
```

```text
Milestone / task: M1 — cloud vertical slice (restaurant create/read with workspace isolation)
Status: in progress — locally verified; deployment blocked on a Supabase project
Delivered behavior:
  - Next.js 16 App Router app in the same repo (src/app, src/server, src/proxy.ts) beside the
    unchanged legacy Express/Vite app. Supabase email magic-link sign-in (PKCE callback),
    session refresh proxy, sign-out, personal workspace, create/list/reload restaurants.
    Website is optional; entered identity is stored as identity_source='manual'; no facts accepted.
  - supabase/migrations/20261023000000_workspace_restaurants.sql: workspaces, workspace_members,
    restaurants (workspace_id on every row, composite unique for future child FKs, legacy-compatible
    text IDs), RLS on all tables, least-privilege grants (no DELETE, tenant/identity columns not
    updatable), server-controlled membership via idempotent ensure_personal_workspace().
  - Async TenantRepository interface + Supabase implementation using the caller's session (RLS
    applies); service layer validates input and checks membership/role before storage.
    Cross-tenant reads return 404. Mutations need same-host Origin, JSON, <=16 KB. no-store responses.
  - server/ids.ts (pure id/hash/now) and server/validation.ts extracted from store.ts / index.ts so
    cloud code does not import node:sqlite; legacy imports unchanged in behavior.
  - Material additions: next@16.4.2, @supabase/ssr@0.12.7, @supabase/supabase-js@2.117.3 (planned
    stack, exact pins). next 16.4.0 had critical advisories (GHSA-2464-fhr4-w9xw etc.); 16.4.2 audits
    clean. @electric-sql/pglite@0.5.8 (dev only) runs the real migration/RLS in tests without Docker.
    vercel.json, next.config.ts (security headers), cloud:dev/build/start scripts, CI cloud build step.
Changed modules: server/ids.ts, server/validation.ts, server/store.ts, server/index.ts,
  server/collector.ts, server/real-analysis.ts (imports only); src/app/**, src/server/**, src/lib/**,
  src/proxy.ts; supabase/migrations/; tests/cloud-schema.test.ts, tests/cloud-restaurants.test.ts;
  package.json/lock, tsconfig.json (Next-added isolatedModules/plugin), .gitignore, .env.example,
  .github/workflows/ci.yml, vercel.json, next.config.ts; docs/cloud-deployment.md, README.md.
Verification actually run and results:
  - npm run build (tsc + Vite) passed; npm run cloud:build (next build) passed.
  - npm test: 51 passed / 0 failed / 0 skipped (46 existing + 5 new). New tests apply the migration
    to PGlite with Supabase-style auth/role stubs: cross-tenant select/update/insert, self-granted
    membership, moving rows between workspaces, delete and anonymous access are all denied.
  - Local `next start` smoke test on an ephemeral port without Supabase: health reports
    "not configured", data routes 503, cross-origin POST 403, same-origin POST reaches the handler,
    security/no-store headers present. This found and fixed an Origin-vs-request.url host bug.
  - Built server bundle contains no node:sqlite import; no secret variable names in static assets.
  - Default database per-table hashes unchanged.
Remaining limitations / blockers:
  - BLOCKED: no Supabase project/access in this session (Supabase connector not authorized, no CLI,
    Docker daemon not running). Real Supabase Auth, PostgREST and RLS-on-Supabase are unverified.
  - Not deployed. Vercel is connected (team adityasingh59s-projects) but no TableSignal project was
    created: a deployment without Supabase cannot meet the gate, and linking requires pushing.
  - Exit gate (deployed preview creates/reloads a restaurant; another workspace cannot access it)
    NOT met. Checklist in docs/cloud-deployment.md.
  - Legacy data not imported (development.md deployment step 7: tested copy, preserved IDs/hashes).
  - Single personal workspace per user; no invitations/roles UI yet.
Next concrete action: user provides a Supabase preview project (or authorizes the Supabase
  connector) and approves creating the Vercel project + pushing; then apply the migration, set the
  two public env vars, deploy a preview and run the M1 acceptance checklist. M2 work (outbox/Inngest,
  provider adapter) can start meanwhile but M1 stays open until the deployed check passes.
```

Update, October 23 (later): the user shared a Supabase project (ref `vsuexongedxmjgicgoce`) and a
Vercel account name for Vasu (`vasusolanki114-2227`).
- The project's direct database host resolves to IPv6 only; this Mac has no IPv6 route, so a
  direct connection is not possible from here (the IPv4 session pooler would be needed).
- Running SQL with the database password pasted in chat was **denied by the permission system**
  (credential handling). It was not retried, written to disk or worked around. Nothing has been
  applied to the Supabase project. The password should be rotated because it appeared in chat.
- The connected Vercel account (adityasingh59s-projects) gets HTTP 403 for `vasusolanki114-2227`;
  no project was created in either account.
- Added `supabase/verify/m1_rls_check.sql`: a self-cleaning SQL-editor isolation check. Two new
  PGlite tests prove it passes on the migration, leaves no rows, and fails with a named reason
  (rolled back) when a leaking policy is added. `tests/cloud-schema.test.ts`: 4 passed.
- Still needed: migration + check run in the Supabase SQL editor by the user; the project URL and
  publishable key; a decision on which Vercel account hosts the app.

Update, October 23 (latest): the user reported Supabase step 1 done (migration applied in the SQL
editor; the m1_rls_check.sql output was not observed here) and provided the publishable key. Vasu
will create the Vercel project and add the variables; see `notes.md`.
- External anonymous probe with the publishable key: `restaurants`, `workspaces`,
  `workspace_members` all return 42501 permission denied (tables exist; an unknown table returns
  PGRST205), and RPC `ensure_personal_workspace` as anon returns 42501. Auth settings: email
  enabled, sign-ups open, email confirmation required.
- Built Next app run locally against this project: `/api/health` → `storage: supabase`; data
  routes signed out → 401; `/` → 307 to `/login`; sign-in form renders. No account was created.
- Work committed on branch `cloud/m1-workspace-restaurants` for Vasu's Vercel import (not `main`).
- M1 remains **in progress**: real sign-in, deployed create/reload and two-account isolation on a
  Vercel preview are unverified. Next action: Vasu deploys the branch and runs the checklist in
  docs/cloud-deployment.md; then record the URL, commit and results here.

## Previous task — Indian example near NYU, October 21

The user requested an Indian restaurant near NYU's Washington Square campus that is outside the top five observed recommendations. **Gandhi Cafe, 283 Bleecker Street, New York, NY 10014** (<https://gandhicafeny.com/>) is the new selected example. John's historical data remains intact; Linden Table remains synthetic.

- Gandhi Cafe profile: `restaurant_4aa7d7e9-06e1-466a-967e-3a962c59c132`.
- Selection screen: `run_74f649c4-1ad1-4268-81f5-1f0653c1344d`, stored under the initially considered Mint Masala profile. All three neutral Indian-restaurant questions completed, five options per answer, with no Gandhi Cafe appearance. This is a scoped screening observation, not an objective citywide rank. Mint Masala's application website fetch returned HTTP 403 and was preserved as failed.
- Frozen 20-question Indian/NYU bank: `bank_6ef68b4d-68b8-44ef-b789-928ef5c9999d`. **Baseline completed:** `run_36e28381-95b2-41a1-a007-9e4a7cec2db2`, stable idempotency key `gandhi-cafe-indian-nyu-baseline-v1`. Do not start a duplicate. Codex CLI / `gpt-6.1-sol`, **20/20 valid, 0 failures, 2 mentions/recommendations (10%), 100% coverage, 3.03% share of voice, average observed position 2.5 across 2 appearances**. All 20 answers and extracted list entries were manually inspected; no target results were removed or regenerated.
- Two Gandhi Cafe public pages were fetched and stored with original hashes/times. Phone and menu URL were accepted with `website` provenance; no owner facts were invented. Additional source details/uncertainties are in [restaurant-research.md](restaurant-research.md).
- The interface now persists the selected restaurant in browser local storage, validates a saved ID against the current database, and tolerates unavailable browser storage. The open Chrome tab is switched to Gandhi Cafe; **selection survived refresh**. The recommendation landscape now shows the five leading competitors plus the target and Others. Numeric labels use recommendation-count rank across all saved names (ties share rank), instead of renumbering a reduced subset and making a lower-ranked target look fourth.
- **Final `npm run build` passed; final `npm test`: 46 passed, 0 failed, 0 skipped.** Earlier tests overlapped a Vite rebuild and skipped lifecycle; the final full run followed the completed build and includes it. All tests use isolated databases and make no live calls.
- Historical integrity checkpoint: `data/indian-case-historical-integrity.json`. The final bootstrap comparison confirmed **all original 5 runs / 100 answers retained their IDs and exact raw-answer hashes**.
- Gandhi Cafe is outside the top five by recommendation frequency: six distinct businesses appeared more often. **Name-normalization limitation:** the parser split Masala Times (3) and Masala Times Greenwich Village (10), despite all answers identifying 194 Bleecker Street. Reviewed combined count: 13/20. The app ranks Gandhi eighth among saved names; it is seventh among distinct businesses. This does not affect the 2/20 target rate or the outside-five conclusion. No historical extraction was silently merged.
- Leading observed competitors were selected before evidence collection. Mint Masala's site returned 403 and Masala Times' robots check returned 403; both remain unavailable, not absent information. Thelewala's cited matching homepage was collected. Source-backed findings are a machine-readable menu and a dining FAQ, scoped to the two target snapshots. No fabricated third opportunity or unsupported competitive advantage was added.
- New deliverables: [case study](../reports/gandhi-cafe-case-study.md), [FAQ](../reports/gandhi-cafe-faq.md), [about draft](../reports/gandhi-cafe-about.md), [Restaurant JSON-LD](../reports/gandhi-cafe-jsonld.json). The three drafts validated and remain in Content studio, IDs `artifact_dd835ce9-559f-4818-af76-d547862d78d9`, `artifact_af606e69-27ba-4cc2-9d51-a14cbb0de0cd`, `artifact_f25397d5-3894-42ec-89a1-4627fdfd92a3`. With only two accepted profile facts, the drafts are deliberately sparse: no unaccepted hours, prices or dietary assurances; JSON-LD has no invented nested menu items. Evidence report: `data/run_36e28381-95b2-41a1-a007-9e4a7cec2db2-evidence-report.json`.
- Final Chrome check confirmed Gandhi Cafe remains selected after refresh, the completed 10% / 100% scorecard, five leading competitor rows plus the target, and two opportunities. Desktop screenshot: [overview](../reports/gandhi-cafe-overview.png). The local supervisor remains healthy at <http://127.0.0.1:3001>; no model jobs remain active. This browser check covers this desktop overview, not every page or mobile layout.

**Next concrete action:** use the saved Gandhi Cafe example for the demo; review additional operational facts against the original public snapshots before enriching its drafts. A future explicit competitor-alias review can merge the two observed Masala Times names without changing raw answers. No follow-up run or publication has been requested. The remaining PRD v1.1 gaps in `brief-validation.md` are still open.

## GitHub handoff — October 21

The user requested pushing the updates with clear commit messages and a GitHub note for Vasu. [Vasu's handoff](vasu-handoff.md) distinguishes working scope, limitations, missing v1.1 features and fresh-clone behavior. The private repository is `Adityasingh59/nyu-sps-pulse-foundry-hackathon`; `@Vasusolanki811` is an existing collaborator. The user also requested `@mallikagadgil19` and `@JaydenPeerize511`: both received **write-access invitations**, pending acceptance when created. No Google Drive update was requested after clarification.

Before this push, `main` matched `origin/main` at `5b74884`. The previous cross-platform setup workflow has now been verified in GitHub Actions: Linux, Windows and macOS jobs all succeeded. Rebuilt the current UI before the final local test run; no new provider calls were started. This push includes source, documentation, reviewed public case-study outputs and a screenshot; default SQLite data and authentication remain excluded.

## Earlier completed outcome: John's of Bleecker Street

The user asked to make the fictional prototype work with a real NYC restaurant, run it using available access, and preserve work across token/session restarts. That real-data functional path is now implemented and verified. Preserve the current database and saved outputs; do not restart from synthetic fixtures or repeat completed model calls without a new reason.

The app is running at **http://127.0.0.1:3001** through a detached local supervisor. `npm run local:status` checks it. `npm run up` starts it if necessary; `npm run down` stops the managed server. The supervisor restarts an unexpectedly exited application, preserves SQLite data, and stops after 10 consecutive startup failures. It does not install an OS login/reboot service.

## Team setup update — October 20, 2026

The latest requested work is to run the app and make it straightforward for teammates to clone and run on their own computers. This does not close the remaining PRD v1.1 gaps in `docs/brief-validation.md`.

- Added **`npm run setup`**: after `npm ci`, it builds the UI and starts the managed local server using Node directly, including paths with spaces. Node.js 24+ is required. README, CONTRIBUTING and [team-setup.md](team-setup.md) provide clone, Windows PowerShell, macOS/Linux, update, development and troubleshooting steps.
- Replaced Unix process inspection in the supervisor with local Node IPC (Windows named pipes / Unix sockets). Start, status and stop identify the project's own supervisor; stop waits for it to exit. Status reports its actual port, PID and database, including custom `TABLESIGNAL_DB_PATH`. `TABLESIGNAL_RUNTIME_DIR` isolates runtime files for lifecycle tests. The built UI must exist before `up`; `setup` builds it first.
- The optional provider now launches the official project-local JavaScript entry point through Node instead of depending on an operating-system-specific npm shim. Direct executable overrides remain supported. Vite's development API proxy respects `PORT`.
- CI is configured to build/test on Windows, macOS and Linux. These hosted matrix jobs have **not yet been run** for these local changes; current execution verification is on macOS / Node 24.15.0.
- A fresh clone seeds only the clearly labeled synthetic Linden Table workspace. The saved real NYC database remains local and ignored; reports remain checked in. Teammates configure their own provider access only for deliberate new live measurements.
- `npm ci` succeeded (0 reported vulnerabilities), `npm run setup` succeeded, and **46 tests passed, 0 failed, 0 skipped** after the build. Lifecycle tests use temporary databases/runtime directories and verify exact synthetic answer hashes, timestamps, and IDs survive restart. HTTP checks confirmed health, the built HTML, JavaScript and CSS are served successfully.
- A separate clean-install smoke check copied only current source into a temporary directory with spaces (no existing dependencies, build, database, Git metadata or credentials). `npm ci` then `npm run setup` succeeded; health/UI returned 200 and bootstrap contained only the synthetic workspace. Managed shutdown completed and the temporary copy was removed. This check used macOS; Windows/Linux execution remains pending CI.
- The existing default database retained **5 saved runs and 100 answer records**, with an identical combined ID/raw-answer SHA-256 before and after the startup changes: `b695185bb53e0b51008b06f19537c72bc8f59fc41c801f30977bc2d2f03deb6c`. This count includes synthetic records; it does not change the completed live measurements described below. No new live provider runs were started.
- Historical note: this setup workflow was subsequently committed as `5b74884` and pushed. Its Linux, Windows and macOS Actions jobs all succeeded; see the October 21 GitHub handoff above for the latest update.

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

- **`npm test`: 46 tests passed, 0 failed.** Isolated tests cover metrics, parsing, public fetching/robots, source extraction and review, domain/branch separation, provider capture and portable launching, nested menu validation, immutable edits/exports, restart recovery, managed-server lifecycle, request ceilings and audit preservation. Build first to include the managed-server test; it explicitly skips if `dist/index.html` is absent.
- **`npm run build`:passed** TypeScript and Vite production build.
- Two actual live runs completed 40 saved answers with no failed calls.
- A deliberate application exit was recovered by the supervisor. **All 40 raw answers retained exact hashes across restarts.** Built-interface HTTP delivery and provider metadata were checked; no active model jobs remain.
- **Browser limitation:** no enabled browser was available in this phase, and a supported Chrome launch timed out. Visual QA of the latest real-data UI changes is unverified. The earlier synthetic milestone had independent desktop/mobile browser checks; do not claim those validate the current interface.

## Resume commands and next work

1. Read `AGENTS.md`, this checkpoint, the case study, `PRD.md` and `README.md`. Check `npm run local:status` before starting another API worker.
2. If the app is stopped: `npm run setup` (build + managed start), or `npm run up` if the UI is already built. Do not run another worker against the same DB/port while the supervisor is active. For a new clone, see [team-setup.md](team-setup.md).
3. For the saved real baseline/follow-up, `npm run run:nyc` and `npm run rerun:nyc` use stable idempotency keys and poll the existing saved runs. They should not duplicate model calls.
4. The next useful optional work is visual QA when browser access returns, followed by any explicitly requested production deployment/authentication or new restaurant/provider work. Publishing to restaurant sites, outreach and P1 CMS approval/rollback remain unimplemented and outside current publication authorization.
5. Preserve immutable data and source/audit history. Never use authentication-file extraction, fabricated uplift or a destructive reset as a shortcut.
