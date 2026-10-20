# TableSignal

TableSignal measures how a restaurant appears in a saved set of AI dining recommendations, connects findings to public source snapshots, creates reviewable content, and repeats the same measurement.

The real case study is **John’s of Bleecker Street, New York City**, using its [official website](https://johnsofbleecker.com/) and [food menu](https://johnsofbleecker.com/food-menu). The local database preserves the collected evidence and actual provider responses. Public-source review does not imply ownership, affiliation, or permission to publish on the restaurant’s website.

## Run

Use Node.js 24 or newer.

```sh
npm install
npm run build
npm run up
```

Open <http://127.0.0.1:3001>. `npm run up` starts a detached local supervisor that restarts the application after an unexpected exit. `npm run local:status` checks it; `npm run down` stops the managed application. It does not install an operating-system login service. `npm start` remains available for foreground operation. For development, `npm run dev` starts the API on 3001 and Vite on 5173. The API binds to loopback; this is a single-operator local application. Default records are stored in `data/tablesignal.sqlite` and survive restarts. Do not delete that database to restart the project.

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

The saved NYC setup has repeatable commands after the API starts:

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

Read [docs/PROGRESS.md](docs/PROGRESS.md) to resume across sessions. [AGENTS.md](AGENTS.md) preserves the current authorization and safeguards. [docs/implementation.md](docs/implementation.md) records the architecture and limits; [PRD.md](PRD.md) remains the complete target specification.
