# Contributing

This is a small, time-boxed project for the NYU SPS X Pulse Foundry hackathon
(Friday, October 23, 2026). The workflow below is deliberately light — enough to keep
`main` releasable during a one-day event, and no more.

## Setup

Node.js 24 or newer is required (`node:sqlite` and the test runner depend on it).
`.nvmrc` pins the version; run `nvm use` if you use nvm.

```sh
npm install
npm run build
npm run up          # detached supervisor on http://127.0.0.1:3001
npm run local:status
npm run down
```

For development, `npm run dev` runs the API on 3001 and Vite on 5173. Stop the dev
server before starting the built server on the same port.

## Before you push

```sh
npm test            # 42 tests, temporary databases, no model calls
npm run build       # tsc --noEmit && vite build
```

CI runs exactly these two commands, plus a guard job that fails if a database or
environment file becomes tracked or a credential-shaped string appears in the
repository.

## Branching

`main` is protected by CI. Work on a branch and open a PR:

```sh
git switch -c <area>/<short-description>
```

Suggested prefixes: `discovery/`, `analysis/`, `action/`, `measurement/`, `ui/`,
`docs/`, `ci/`. Squash-merge into `main`.

Commit messages: imperative mood, one line of subject, body explaining *why* when the
reason is not obvious from the diff.

## The rules that matter most

This project's output is only worth something if it is true. These constraints are
enforced in code and in tests, and a change that weakens one needs an explicit
discussion, not a quiet merge. They are drawn from [AGENTS.md](AGENTS.md) and
[PRD.md](PRD.md).

1. **Never invent a fact.** Prices, hours, ratings, review counts, awards, dietary
   assurances and competitor claims must trace to a real source snapshot. Unknown
   stays unknown.
2. **Keep provenance distinct.** `website`, `owner` and `synthetic` are not
   interchangeable. Accepting a website-observed fact does not make it owner-confirmed.
3. **A failure is not a non-mention.** Failed or ambiguous observations reduce
   coverage. They never count as "the restaurant was not recommended."
4. **Never claim causation.** Visibility changing after an edit is a change, not a
   result of the edit. Provider answers vary on their own.
5. **"Not found" is scoped to what was inspected.** Never render it as "does not exist."
6. **Labels cannot blur.** Live, synthetic and recorded-replay results must be
   impossible to confuse. A synthetic fixture is never presented as a recorded live run.
7. **History is immutable.** Runs, source snapshots and artifact versions are
   append-only. Parser corrections go through `/runs/:id/reparse`, which writes an
   audit record and preserves raw answers.
8. **No publication.** The project has no authorization to modify a real restaurant's
   website, listings or inbox. Export only.
9. **Never touch credentials.** Do not open, copy, parse, print or export CLI
   authentication files or tokens. Use supported sign-in commands or a configured
   server-side key.
10. **Respect fetch etiquette.** robots.txt is honored, failures do not trigger a
    bypass, and request size, time and count stay bounded.

## Scraping and provider cost

Provider calls consume the signed-in account's allowance. The saved workflow commands
(`npm run run:nyc`, `npm run rerun:nyc`) use stable idempotency keys and resume existing
runs rather than duplicating paid work — keep it that way. Per-run ceilings are
configurable via `MAX_REQUESTS_PER_RUN`; do not remove the ceiling.

Never delete `data/tablesignal.sqlite` to make something pass. It holds the real
evidence and every raw provider answer, and it is not in version control.

## Documentation

Update alongside the code:

- [docs/PROGRESS.md](docs/PROGRESS.md) — current state, verified results, next action.
  Required after any consequential change.
- [docs/system-overview.md](docs/system-overview.md) — how the system works.
- [docs/brief-validation.md](docs/brief-validation.md) — status against the event brief.
- [PRD.md](PRD.md) — the target specification, currently **v1.1**. Changes here are product
  decisions. [docs/PRD-v1.0-superseded.md](docs/PRD-v1.0-superseded.md) is retained for history
  only; do not build against it.

Keep status truthful. Running out of context is not completion.
