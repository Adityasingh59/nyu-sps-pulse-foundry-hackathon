# TableSignal development guardrails

Purpose: deliver the agreed product completely, in order, with the smallest maintainable implementation. Apply these rules to planning, implementation, review and deployment in this repository.

Read this file with `AGENTS.md` and `development.md` before working. The latest explicit user instruction controls scope; `development.md` defines the current migration sequence; PRD v1.1 defines product requirements. Historical checkpoints describe past work, not new authorization or current proof. Record real conflicts and resolve them from current instructions; ask only when the missing decision materially blocks work.

## 1. Stay inside the requested outcome

- Continue in this repository. Reuse working parsing, metrics, evidence handling, validation and UI components.
- Support arbitrary restaurants/cafes through data and configuration. Keep example businesses as profiles/fixtures, never business-logic branches.
- Build for the agreed Vercel/cloud environment. A localhost-only implementation does not meet the hosting requirement.
- For a documentation request, deliver documentation. For an implementation request, deliver working behavior and verification, not just a plan or mock screen.
- Do not add unrelated features, redesign the whole interface, or replace the stack without a demonstrated requirement.
- Do not silently downgrade requirements. Mark deferred or blocked work explicitly and keep its acceptance criteria in the backlog.

## 2. Use one development sequence

Follow the milestones in `development.md`:

1. M0: inspect and preserve the current baseline.
2. M1: deployed authenticated restaurant persistence.
3. M2: durable source collection and provider execution.
4. M3: generic business/branch onboarding and relevant questions.
5. M4: evidence-backed reporting and usable exports.
6. M5: controlled measurement, replay and remaining PRD features.
7. M6: deployment verification and release readiness.

Keep one primary milestone active. Finish its acceptance gate before starting unrelated work. Implement prerequisites when necessary and record why. A blocked external dependency may justify moving to independent work; do not label the blocked milestone complete.

For each task, write a short entry in the checkpoint: outcome, milestone, affected modules, acceptance checks and known dependency. Keep it brief; do not generate a separate planning document for every change.

## 3. Avoid overengineering

Before adding a dependency, service, abstraction or feature, answer:

- Which current acceptance criterion requires it?
- Can the existing code or selected stack satisfy that criterion?
- What is the smallest implementation that remains correct and testable?

Record a short rationale for a material addition. Do not ask the user to approve routine implementation choices already inside the agreed scope.

Defaults:

| Use now | Add only when justified |
|---|---|
| One configured production API provider and adapter boundary | Additional executed providers when addressing the PRD requirement |
| Existing deterministic parser and metrics | LLM extraction when a demonstrated parsing gap needs it |
| Bounded HTML collection and reviewed imports | Browser automation, PDF/OCR workers when required sources need them |
| Simple fixed keyword/BM25 retrieval | Vector database when measured retrieval needs warrant it |
| Existing UI components and focused changes | Broad design-system or styling rewrite |
| Supabase and Inngest as planned | Extra queues, caches, microservices or infrastructure |
| Exportable reviewed assets | Permissioned publication after core requirements work |

Do not build speculative extensibility, generic workflow engines, Kubernetes infrastructure, billing, SSO or compliance certification for today's demo. Keep future GRC work in the future phase. Basic hosted security and durable jobs are required infrastructure, not optional polish.

## 4. Do not underdeliver

A feature is not complete because a button exists, a mock returns success, or TypeScript compiles. Deliver the necessary UI, validated API, persistence, background execution, failure states and relevant verification for that feature.

Required behavior includes:

- Correct branch identity, with clarification for ambiguous names.
- Business-appropriate questions, explicit geographic scope and no example-specific assumptions.
- Real source provenance, visible collection limits and fact review.
- Actual saved provider responses for live claims, deterministic metrics and visible coverage.
- Usable exports tied to reviewed facts; immutable versions and history.
- Durable cloud state and jobs; refresh or browser closure must not lose accepted work.
- Honest loading, empty, partial, failed and retry states.
- Tenant authorization, server-side secrets, bounded cost and safe URL fetching.

One-provider fallback does not mean two providers were delivered. Export does not mean publication. Viewing a report does not mean recorded replay is complete. A reduced event demo does not mean all PRD v1.1 requirements are complete.

## 5. Protect evidence and results

Never invent facts, reviews, prices, dietary assurances, competitors, successful requests or improvement. Missing evidence stays unknown. Failed requests reduce coverage, not recommendation rates.

Keep website, manual, owner and synthetic provenance distinct. Preserve raw responses, timestamps, hashes and historical artifacts. Apply alias/extraction corrections through explicit new versions. Never relabel old restaurant data as a new target.

Keep independent live queries free of target profile injection. Separate live, controlled, replay and synthetic modes. For A/A-repeat/B, freeze settings and competitor evidence; change only approved target content. Report zero change or regression honestly. Do not claim public AI ranking causation from a controlled experiment.

## 6. Protect deployment and data

- No production SQLite files, in-memory job queues, detached local supervisors or signed-in CLI runtime dependencies.
- Verify identity and workspace access on the server for every scoped operation, including exports and background jobs.
- Keep credentials server-side; never read or repurpose authentication files. Do not expose secrets in logs, code, exports or browser bundles.
- Validate URL/DNS/redirect destinations and prevent private-network access; treat crawled content as untrusted data.
- Use durable idempotency, bounded retries and configured budgets. Never retry paid work indefinitely.
- Preserve existing data; test migrations on copies, use backups and record validation. Do not delete data to make tests pass.
- Analysis permission is not publication or outreach permission. Keep third-party actions outside scope unless explicitly authorized.

## 7. Verify proportionately

Use the smallest meaningful verification set that covers the changed behavior and its risks. Add tests for new behavior and regression risks; do not add tests that merely repeat implementation or inflate counts.

For application changes, run relevant isolated tests, type checks/build and the milestone's integration checks. For cloud claims, verify the deployed environment, persistence, authorization and real job callback path. A local build is insufficient deployment evidence.

For documentation-only changes, check consistency, references and formatting; do not claim new application test results. If credentials or services are unavailable, complete independent work and clearly identify the unverified integration.

Once required checks pass, stop expanding the test scope unless a new change, failure or unresolved risk warrants it. Do not delay completion for unrelated refactors or cosmetic perfection.

## 8. Definition of done

Mark a task complete only when all applicable conditions hold:

- The stated acceptance criteria are met by actual behavior.
- Changes remain within scope and use the existing architecture appropriately.
- Relevant success, failure and isolation cases have been checked.
- Required persistence, validation and security are present.
- No hidden mock, unexplained placeholder or silent fallback is presented as real functionality.
- `docs/PROGRESS.md` records changes, checks actually run, results, remaining limitations and the next action.

Mark status accurately: **not started**, **in progress**, **blocked**, or **verified complete**. Track deployment separately if local verification is complete but deployment is pending. Never say “production ready” solely because files were generated.

## 9. Handle blockers without losing momentum

Continue reversible, authorized work without repeatedly requesting confirmation. Ask only for a necessary missing choice, access, budget or authorization that cannot be inferred. Explain exactly what is blocked and why; continue independent work where possible.

Do not introduce paid services, expand spending limits, publish restaurant content, send messages, overwrite user work or perform destructive data operations based on assumptions. Do not bypass denied access or fake a successful integration.

If a task grows beyond its acceptance criteria, put the additional idea in the future backlog and return to the active milestone. If a necessary dependency changes the plan, record the revised sequence and its reason before continuing.

## 10. End each checkpoint clearly

Use this compact format in `docs/PROGRESS.md`:

```text
Milestone / task:
Status:
Delivered behavior:
Changed modules:
Verification actually run and results:
Remaining limitations / blockers:
Next concrete action:
```

Keep the user-facing update brief: what works, how verified, what remains. Do not confuse a local commit with a GitHub push or a push with a deployment. Stop when the authorized outcome is complete; do not manufacture extra work to continue the session.
