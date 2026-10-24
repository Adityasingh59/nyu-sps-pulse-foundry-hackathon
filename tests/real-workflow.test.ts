import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import { createApplication } from "../server/index.ts";
import type {
  QueryBank,
  Restaurant,
  Run,
  SourceSnapshot,
  ArtifactVersion,
} from "../shared/types.ts";

test("real source review, auditable extraction correction and rejected-source exclusion preserve provenance and raw history", async () => {
  const folder = await mkdtemp(join(tmpdir(), "tablesignal-real-test-"));
  const app = await createApplication({
    dbPath: join(folder, "test.sqlite"),
    worker: false,
    seed: false,
  });
  const restaurant: Restaurant = {
    id: "real",
    name: "John's of Bleecker Street",
    website: "https://johnsofbleecker.com/",
    location: "Greenwich Village, New York",
    aliases: [],
    facts: [
      {
        field: "cuisine",
        value: "Pizza",
        sourceId: "source",
        provenance: "website",
        confirmed: false,
        evidenceSpan: '"servesCuisine":"Pizza"',
      },
    ],
    createdAt: "2026-10-20T00:00:00Z",
  };
  const source: SourceSnapshot = {
    id: "source",
    restaurantId: "real",
    url: restaurant.website,
    title: "Official source",
    sourceKind: "website",
    scope: "target",
    mode: "live",
    status: "succeeded",
    excerpt: "Pizza restaurant",
    contentHash: "original-hash",
    fetchedAt: "2026-10-20T00:00:00Z",
  };
  await app.store.put("restaurants", restaurant);
  await app.store.put("sources", source);
  const bank: QueryBank = {
    id: "bank",
    restaurantId: "real",
    version: 1,
    createdAt: "2026-10-20T00:00:00Z",
    contentHash: "bankhash",
    queries: [
      {
        id: "q",
        text: "Where can I eat pizza in Greenwich Village?",
        intents: ["cuisine"],
        branded: false,
      },
    ],
  };
  await app.store.put("banks", bank);
  const raw =
    "1. **John's of Bleecker Street** — A pizza option serving whole pies rather than slices.";
  const run: Run = {
    id: "run",
    bankId: "bank",
    restaurantId: "real",
    mode: "live",
    provider: "Recorded test provider",
    model: "test",
    status: "completed",
    createdAt: "2026-10-20T01:00:00Z",
    settingsHash: "settings",
    promptVersion: "test",
    retrieval: "test",
    results: [
      {
        id: "result",
        queryId: "q",
        sampleId: 1,
        status: "succeeded",
        rawAnswer: raw,
        citations: [],
        appearances: [],
        attempts: 1,
      },
    ],
    metrics: null,
    competitors: [],
  };
  await app.store.put("runs", run);
  const server = app.app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) =>
    server.once("listening", () => resolve()),
  );
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  async function post(path: string, body: unknown, method = "POST") {
    return fetch(base + path, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }
  try {
    let response = await post(
      "/restaurants/real",
      { confirmed: true, factIndexes: [] },
      "PATCH",
    );
    assert.equal(response.status, 200);
    let reviewed = (await response.json()) as Restaurant;
    assert.equal(reviewed.facts[0].confirmed, false);
    response = await post(
      "/restaurants/real",
      { confirmed: true, factIndexes: [0] },
      "PATCH",
    );
    assert.equal(response.status, 200);
    reviewed = (await response.json()) as Restaurant;
    assert.equal(reviewed.facts[0].confirmed, true);
    assert.equal(reviewed.facts[0].provenance, "website");
    assert.equal(reviewed.facts[0].sourceId, "source");
    response = await post("/runs/run/reparse", {});
    assert.equal(response.status, 200);
    const corrected = (await response.json()) as Run;
    assert.equal(corrected.results[0].rawAnswer, raw);
    assert.equal(corrected.metrics?.recommendations, 1);
    assert.ok(corrected.parserVersion);
    assert.ok(corrected.sourceSnapshotIds?.includes("source"));
    const audits = await (await fetch(base + "/runs/run/audit")).json();
    assert.equal(audits[0].kind, "parser-review");
    assert.deepEqual(audits[0].before.appearances[0].appearances, []);
    response = await post("/sources/source/review", {
      accepted: false,
      reason: "Excluded for a documented test identity mismatch.",
    });
    assert.equal(response.status, 200);
    const excluded = (await response.json()) as SourceSnapshot;
    assert.equal(excluded.contentHash, "original-hash");
    assert.equal(excluded.excerpt, source.excerpt);
    assert.equal(excluded.review?.status, "rejected");
    await app.store.put("opportunities", {
      id: "opportunity",
      runId: "run",
      title: "Test draft",
      gap: "Test",
      sourceIds: ["source"],
      intents: ["cuisine"],
      action: "Review",
      effort: "low",
      priority: 1,
      rationale: "Test",
      uncertainty: "Test",
      artifactTypes: ["jsonld"],
    });
    response = await post("/opportunities/opportunity/artifacts", {
      type: "jsonld",
    });
    assert.equal(response.status, 201);
    const artifact = (await response.json()) as ArtifactVersion;
    assert.equal(JSON.parse(artifact.content).servesCuisine, undefined);
    assert.equal(artifact.requiresConfirmation, true);
    const invalid = {
      ...reviewed,
      facts: [
        ...reviewed.facts,
        {
          field: "hours",
          value: "unknown",
          provenance: "website" as const,
          confirmed: false,
          sourceId: "missing",
        },
      ],
    };
    await app.store.put("restaurants", invalid);
    assert.equal(
      (
        await post(
          "/restaurants/real",
          { confirmed: true, factIndexes: [1] },
          "PATCH",
        )
      ).status,
      400,
    );
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await app.close();
    await rm(folder, { recursive: true, force: true });
  }
});
