# Implementation notes

TableSignal follows the Discovery → Analysis → Action → Measurement loop in [the PRD](../PRD.md). React/Vite provides the interface, Express serves the API, Node’s SQLite stores durable JSON records, and shared TypeScript modules calculate deterministic metrics.

## Real execution and independent questions

The signed-in official Codex CLI adapter is available locally and has executed genuine web-backed dining questions. Each query starts a separate ephemeral conversation in an empty temporary directory; the model receives the neutral question and fixed answering instructions, not the target profile. Model, provider, retrieval method, prompt version, settings hash, request outcome, raw answer, citations and usage are saved. The Responses API adapter is an alternative when a server-side key is supplied.

The fixture adapter remains separate and always synthetic. Neither adapter manufactures an improving result from an exported artifact. Real reruns can change even when no restaurant content has changed.

## Evidence and profile facts

The collector inspects up to five relevant same-site HTML/text pages, observes robots rules, validates HTTP(S) public destinations, pins a checked DNS address, and rechecks redirects. Requests have deadlines and a 2 MB input ceiling; saved readable text is bounded at 50,000 characters and flagged when truncated. PDFs/images are recorded as unsupported rather than bypassed.

JSON-LD and conservative visible-menu extraction create **unconfirmed website observations** with source IDs and exact evidence spans. Reviewing identity is separate from accepting fact indexes. Accepting a website fact preserves its original provenance. Unknown dietary, accessibility and reservation assurances remain unknown.

The case study’s homepage has Restaurant JSON-LD. Its inspected food-menu page has no JSON-LD script. Findings must retain that distinction. Duplicate/ambiguous menu variants are omitted from draft item facts; directly observable price-wording mismatches are presented for business review, without inventing corrected prices.

Competitors are selected from actual valid answers, then their matching provider-cited websites are collected. Domain matching requires the restaurant’s identity, not a shared neighborhood word. Source-review records can exclude a misassociated source while preserving original URL, text, hash and retrieval time. Unsupported or inaccessible evidence is not an information gap.

## Measurement and audit

Mention and recommendation rates are separate. Only explicit ordered recommendation lists have positions. Failed or identity-ambiguous answers are excluded from valid-answer rates and reduce coverage. Share of voice counts each restaurant once per valid answer; the denominator includes restaurants outside the selected display.

The parser is deliberately conservative. Markdown-linked names are supported; positive list descriptions such as “whole pies rather than slices” are not incidental mentions. Restaurant dietary disclosures inside a positive entry are distinguished from an explicit negative recommendation. Free-prose competitors and unclear aliases can still be missed, so the selected demo answers require inspection.

Parser corrections use an explicit `/runs/:id/reparse` action. It preserves raw answers and records before/after appearances and metrics, parser version, analysis revision and timestamp. Comparisons reject incompatible parser versions/configurations and use matching valid question/sample pairs. Source and analysis revisions retain earlier opportunity records and artifact references.

## Actions, storage and recovery

Generated FAQ/about/Restaurant data use accepted facts. Restaurant JSON-LD can include a Menu with reviewed MenuItem/Offer values. Syntax and intended nested types are validated before export. All drafts require review; an edit creates an immutable new version. Export is implemented; external publication is not.

Jobs save observations incrementally. After interruption, queued/running observations recover without erasing attempts or successful answers. Source collection state and competitor evidence collection are also persisted and resumed. Idempotency prevents duplicate baseline/follow-up creation. SQLite WAL supports durable local history; isolated tests use separate temporary files.

## Limits and remaining work

- This is a local single-operator app. Exposing it requires authentication and deployment work; no production multi-tenancy or restaurant CMS access is configured.
- Codex availability depends on the normal signed-in account, allowance, network and installed CLI. Model output is nondeterministic; CLI usage estimates are not dollar billing guarantees. A fixed request count bounds work but cannot guarantee completion under provider limits.
- Local parsing and page extraction are heuristics. Public menu text can contain mistakes, conflicting sizes, reviews, stale details or incomplete structured data.
- Competitor identity/domain matching is conservative and needs review for unclear brands/branches. Not every competitor will have accessible evidence.
- Website review does not grant publication permission. No third-party listing edits, outreach, scheduled monitoring, CMS publishing, approval-gated publication/rollback, or claim of causal ranking improvement is implemented.
- Browser availability can vary by session. Current verification results and any UI verification limit belong in the checkpoint; builds and API checks do not substitute for a claimed browser check.
