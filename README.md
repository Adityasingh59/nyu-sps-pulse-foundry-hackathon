# TableSignal

TableSignal measures how a restaurant appears in a saved set of AI dining recommendations, connects findings to public source snapshots, creates reviewable content, and repeats the same measurement.

The selected example is **Gandhi Cafe, 283 Bleecker Street, New York City**, an Indian restaurant near NYU's Washington Square campus, using its [official website](https://gandhicafeny.com/). It was recommended in **2 of 20 valid answers (10%, 100% coverage)**, outside the five most frequently recommended restaurants in this sample. This is a scoped observation, not a citywide quality ranking. See the [case study](reports/gandhi-cafe-case-study.md) and [checkpoint](docs/PROGRESS.md). Select Gandhi Cafe in the restaurant chooser; the browser remembers the selection across refreshes.

The earlier **John’s of Bleecker Street** case study, collected evidence and actual provider responses remain preserved. Public-source review does not imply ownership, affiliation, or permission to publish on any restaurant's website.

## Run on your computer

Install **Git and Node.js 24 or newer** (npm is included), then run:

```sh
git clone https://github.com/Adityasingh59/nyu-sps-pulse-foundry-hackathon.git
cd nyu-sps-pulse-foundry-hackathon
npm ci
npm run setup
```

Open **<http://127.0.0.1:3001>**. On Windows PowerShell, use `npm.cmd ci` and `npm.cmd run setup` if script execution is blocked. If you already cloned the project, run the last two commands from its folder. Setup builds the UI and starts the app in the background; it makes no live model calls.

The [team setup guide](docs/team-setup.md) includes Windows, macOS, and Linux instructions, updating after a pull, development, optional provider sign-in, and troubleshooting. Each clone starts with the clearly labeled **Linden Table synthetic example** and has its own SQLite database. This computer's saved live runs and provider credentials are not included in Git; the reviewed real case study is available in [reports/](reports/).

| Task | Command |
| --- | --- |
| Start again after a reboot | `npm run up` |
| Check the server | `npm run local:status` |
| Stop the background server | `npm run down` |
| Develop with live reload | `npm run dev` (open port 5173) |

`npm run up` starts a detached local supervisor that restarts the application after an unexpected exit. It does not install an operating-system login service. `npm start` runs in the foreground after a build. Stop the managed server before starting development or foreground mode on the same API port. The API binds to loopback; this is a single-operator local application. Default records are stored in `data/tablesignal.sqlite` and survive pulls, installs, builds, and restarts. Do not delete that database to restart the project.

## Live provider

The preferred available provider on this machine is the **official Codex CLI with ChatGPT sign-in**. The project includes `@openai/codex` as an optional dependency. Use supported authentication commands:

```sh
npm run provider:status
# Only if sign-in is actually required:
npm run provider:login
```

The adapter runs each question in a separate, ephemeral conversation with live web search, a fixed model, an empty temporary working directory, a read-only sandbox, and shell/apps/plugins/hooks/computer tools disabled. It never inserts the target restaurant profile into the answering prompt. It stores the actual answer, cited URLs, web-search events, timestamps and available usage. This measures that **Codex CLI configuration**, not a consumer ChatGPT ranking. Calls use the account’s Codex allowance; the application does not buy credits or enable paid overage.

A server-side `OPENAI_API_KEY` selects the alternative Responses API/web-search adapter. That alternative has not been executed without an API key. See [.env.example](.env.example) for configuration; `.env` is not automatically loaded. Never copy credentials out of CLI authentication files.

## Real restaurant workflow

1. Add a name, public website and specific location; confirm the business identity.
2. Collect public pages. Review extracted draft facts against their saved evidence, then accept selected facts. Their provenance stays `website`.
3. Freeze a neutral question bank and start a live run. Each completed observation is saved incrementally; failures reduce coverage.
4. Inspect actual answers, target/competitor appearances, list positions and source citations.
5. Inspect a bounded set of provider-cited websites for up to three observed leading competitors. Fetch failures and source-review exclusions remain visible.
6. Review evidence-backed opportunities. Generate, edit and export a FAQ, restaurant copy, or Restaurant JSON-LD with a nested menu from accepted item/price facts.
7. Repeat the saved bank and settings, then compare only matched valid observations. Variation does not establish the effect of an edit.

The historical John's of Bleecker Street setup has repeatable commands after the API starts (these do not run the new Gandhi Cafe example):

```sh
npm run setup:nyc
npm run run:nyc
npm run rerun:nyc
```

`setup:nyc` creates the real profile if missing and collects its public pages; it does **not** silently accept facts. The analysis commands use stable idempotency keys and resume the existing baseline/follow-up rather than starting duplicate paid work. Review identity and facts in the interface first. The fictional Linden Table example remains a separate, clearly labeled synthetic workspace.

## Verification and continuation

```sh
npm test
npm run build
```

Tests use temporary databases and ephemeral ports; they do not call the model or erase local data. Coverage includes metrics, conservative parsing, source provenance, safe fetching and robots rules, immutable artifact versions, nested menu validation, independent provider capture, restart recovery, request ceilings and audit records.

Read [docs/PROGRESS.md](docs/PROGRESS.md) to resume across sessions. [AGENTS.md](AGENTS.md) preserves the current authorization and safeguards. [docs/system-overview.md](docs/system-overview.md) explains how the system works, technically and non-technically; [docs/implementation.md](docs/implementation.md) records design decisions and limits.

For the team: [Vasu's handoff — what works, limitations and next steps](docs/vasu-handoff.md).

[PRD.md](PRD.md) is the current target specification (**v1.1**); [docs/brief-validation.md](docs/brief-validation.md) tracks delivered scope against it and against the event brief. v1.1 raised P0 considerably, so several of its requirements are not yet built — the validation document is the authoritative gap list. [docs/PRD-v1.0-superseded.md](docs/PRD-v1.0-superseded.md) is retained for history only.
