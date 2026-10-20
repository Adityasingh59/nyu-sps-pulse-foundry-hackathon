import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Server } from "node:http";
import { createApplication } from "../server/index.ts";
import type {
  ArtifactVersion,
  Bootstrap,
  Comparison,
  Opportunity,
  QueryBank,
  Restaurant,
  Run,
  SourceSnapshot,
} from "../shared/types.ts";

async function openApplication(dbPath: string, worker = true) {
  const runtime = createApplication({ dbPath, worker });
  let server: Server;
  await new Promise<void>((resolve, reject) => {
    server = runtime.app.listen(0, "127.0.0.1", () => resolve());
    server.once("error", reject);
  });
  const address = server!.address();
  assert.ok(address && typeof address !== "string");
  const baseUrl = `http://127.0.0.1:${address.port}/api`;
  let closed = false;
  const request = (path: string, options?: RequestInit) =>
    fetch(`${baseUrl}${path}`, {
      ...options,
      headers: { "Content-Type": "application/json", ...options?.headers },
    });
  const json = async <T>(path: string, options?: RequestInit): Promise<T> => {
    const response = await request(path, options);
    const value = await response.json();
    assert.ok(
      response.ok,
      `${options?.method ?? "GET"} ${path}: ${response.status} ${JSON.stringify(value)}`,
    );
    return value as T;
  };
  return {
    request,
    json,
    store: runtime.store,
    close: async () => {
      if (closed) return;
      closed = true;
      await new Promise<void>((resolve, reject) =>
        server!.close((error) => (error ? reject(error) : resolve())),
      );
      await runtime.close();
    },
  };
}

async function isolatedApplication(t: TestContext) {
  const directory = mkdtempSync(join(tmpdir(), "tablesignal-workflow-"));
  const dbPath = join(directory, "test.sqlite");
  const application = await openApplication(dbPath);
  t.after(async () => {
    await application.close();
    rmSync(directory, { recursive: true, force: true });
  });
  return { ...application, dbPath };
}

const body = (value: unknown): RequestInit => ({
  method: "POST",
  body: JSON.stringify(value),
});

async function finished(
  application: Awaited<ReturnType<typeof openApplication>>,
  runId: string,
): Promise<Run> {
  const deadline = Date.now() + 8_000;
  while (Date.now() < deadline) {
    const run = await application.json<Run>(`/runs/${runId}`);
    if (!["queued", "running"].includes(run.status)) return run;
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
  throw new Error("Synthetic run did not complete within the test deadline.");
}

test("saved synthetic workflow repeats honestly and keeps edited artifacts immutable across restart", async (t) => {
  const application = await isolatedApplication(t);
  const bootstrap = await application.json<Bootstrap>("/bootstrap");
  const baseline = bootstrap.runs.find(
    (run) => run.restaurantId === bootstrap.demoRestaurantId,
  )!;
  assert.equal(baseline.mode, "synthetic");
  assert.equal(baseline.status, "completed");
  assert.equal(baseline.results.length, 20);
  assert.equal(baseline.metrics?.mentions, 6);
  assert.equal(baseline.metrics?.recommendations, 5);
  assert.equal(baseline.metrics?.mentionRate, 30);
  assert.equal(baseline.metrics?.recommendationRate, 25);
  assert.equal(baseline.metrics?.averagePosition, 2);
  assert.equal(baseline.metrics?.positionSamples, 3);
  assert.equal(baseline.metrics?.totalRecommendationAppearances, 45);
  assert.equal(baseline.metrics?.coverage, 100);
  assert.ok(
    baseline.results.every((result) =>
      result.rawAnswer.includes("Synthetic example only"),
    ),
  );

  const rerunRequest = body({ idempotencyKey: "workflow-rerun" });
  const repeat = await application.json<Run>(
    `/runs/${baseline.id}/rerun`,
    rerunRequest,
  );
  assert.notEqual(repeat.id, baseline.id);
  const repeatedRequest = await application.json<Run>(
    `/runs/${baseline.id}/rerun`,
    rerunRequest,
  );
  assert.equal(
    repeatedRequest.id,
    repeat.id,
    "repeated HTTP submission must not start a second paid run",
  );
  const conflict = await application.request(
    "/runs",
    body({
      bankId: baseline.bankId,
      mode: "synthetic",
      idempotencyKey: "workflow-rerun",
    }),
  );
  assert.equal(conflict.status, 409);
  const completed = await finished(application, repeat.id);
  assert.equal(completed.status, "completed");
  assert.deepEqual(completed.metrics, baseline.metrics);
  assert.deepEqual(
    completed.results.map((result) => result.rawAnswer),
    baseline.results.map((result) => result.rawAnswer),
  );
  const comparison = await application.json<Comparison>(
    `/comparisons?before=${baseline.id}&after=${repeat.id}`,
  );
  assert.equal(comparison.compatible, true);
  assert.equal(comparison.matched, 20);
  assert.equal(comparison.excluded, 0);
  assert.equal(comparison.mentionRateChange, 0);
  assert.equal(comparison.recommendationRateChange, 0);

  const opportunities = await application.json<Opportunity[]>(
    `/runs/${baseline.id}/opportunities`,
  );
  assert.ok(opportunities.length > 0);
  for (const opportunity of opportunities) {
    assert.ok(opportunity.sourceIds.length > 0);
    assert.ok(
      opportunity.sourceIds.every((id) =>
        bootstrap.sources.some((source) => source.id === id),
      ),
      "every source link must resolve",
    );
  }
  const faqOpportunity = opportunities.find((opportunity) =>
    opportunity.artifactTypes.includes("faq"),
  )!;
  const original = await application.json<ArtifactVersion>(
    `/opportunities/${faqOpportunity.id}/artifacts`,
    body({ type: "faq" }),
  );
  assert.equal(original.validation.valid, true);
  assert.equal(original.requiresConfirmation, true);
  const editedContent = `${original.content}\n\nOwner review note: verify current availability before use.`;
  const edited = await application.json<ArtifactVersion>(
    `/artifacts/${original.id}`,
    { method: "PATCH", body: JSON.stringify({ content: editedContent }) },
  );
  assert.notEqual(edited.id, original.id);
  assert.equal(edited.version, original.version + 1);
  assert.notEqual(edited.contentHash, original.contentHash);
  const exported = await application.request(`/artifacts/${edited.id}/export`);
  assert.equal(exported.status, 200);
  assert.match(exported.headers.get("content-disposition") ?? "", /attachment/);
  assert.equal(await exported.text(), editedContent);

  const schemaOpportunity = opportunities.find((opportunity) =>
    opportunity.artifactTypes.includes("jsonld"),
  )!;
  const schema = await application.json<ArtifactVersion>(
    `/opportunities/${schemaOpportunity.id}/artifacts`,
    body({ type: "jsonld" }),
  );
  assert.equal(schema.validation.valid, true);
  const invalid = await application.json<ArtifactVersion>(
    `/artifacts/${schema.id}`,
    { method: "PATCH", body: JSON.stringify({ content: '{"@type":' }) },
  );
  assert.equal(invalid.validation.valid, false);
  assert.equal(
    (await application.request(`/artifacts/${invalid.id}/export`)).status,
    409,
  );
  assert.equal(
    (await application.request(`/artifacts/${schema.id}/export`)).status,
    200,
    "a failed edited version must not corrupt the previous version",
  );

  await application.close();
  const reopened = await openApplication(application.dbPath, false);
  try {
    const restored = await reopened.json<Bootstrap>("/bootstrap");
    assert.equal(
      restored.artifacts.find((artifact) => artifact.id === original.id)
        ?.content,
      original.content,
    );
    assert.equal(
      restored.artifacts.find((artifact) => artifact.id === edited.id)?.content,
      editedContent,
    );
    assert.equal(
      restored.runs.find((run) => run.id === completed.id)?.status,
      "completed",
    );
    const sameRequest = await reopened.json<Run>(
      `/runs/${baseline.id}/rerun`,
      rerunRequest,
    );
    assert.equal(
      sameRequest.id,
      repeat.id,
      "idempotency must survive a server restart",
    );
  } finally {
    await reopened.close();
  }
});

test("hard request ceiling preserves partial results and excludes failures from answer rates", async (t) => {
  const application = await isolatedApplication(t);
  const bootstrap = await application.json<Bootstrap>("/bootstrap");
  const baseline = bootstrap.runs[0];
  const previousLimit = process.env.MAX_REQUESTS_PER_RUN;
  let started: Run;
  try {
    process.env.MAX_REQUESTS_PER_RUN = "1";
    started = await application.json<Run>(
      "/runs",
      body({
        bankId: baseline.bankId,
        mode: "synthetic",
        idempotencyKey: "one-request-budget",
      }),
    );
  } finally {
    if (previousLimit === undefined) delete process.env.MAX_REQUESTS_PER_RUN;
    else process.env.MAX_REQUESTS_PER_RUN = previousLimit;
  }
  const partial = await finished(application, started!.id);
  assert.equal(partial.status, "partial");
  assert.equal(
    partial.results.reduce((sum, result) => sum + result.attempts, 0),
    1,
    "two workers must share the same hard request ceiling",
  );
  assert.equal(
    partial.results.filter((result) => result.status === "failed").length,
    19,
  );
  assert.equal(partial.metrics?.attempted, 20);
  assert.equal(partial.metrics?.valid, 1);
  assert.equal(partial.metrics?.coverage, 5);
  assert.equal(
    partial.metrics?.mentionRate,
    100,
    "nineteen failed observations must not become negative mentions",
  );
  assert.equal(
    (await application.request(`/runs/${partial.id}/retry-failed`, body({})))
      .status,
    409,
  );
  const comparison = await application.json<Comparison>(
    `/comparisons?before=${baseline.id}&after=${partial.id}`,
  );
  assert.equal(
    comparison.compatible,
    false,
    "a changed saved request configuration must block headline comparison",
  );
  assert.equal(comparison.mentionRateChange, null);
});

test("API rejects cross-origin mutations, local fetch destinations, and branded discovery questions", async (t) => {
  const application = await isolatedApplication(t);
  const before = await application.json<Bootstrap>("/bootstrap");
  const unrelatedOrigin = await application.request("/runs", {
    ...body({}),
    headers: { Origin: "https://unrelated.example" },
  });
  assert.equal(unrelatedOrigin.status, 403);
  for (const website of [
    "http://127.0.0.1",
    "http://[::1]",
    "http://169.254.169.254",
    "file:///etc/passwd",
  ]) {
    const response = await application.request(
      "/restaurants",
      body({ name: "Unsafe destination", website, location: "New York" }),
    );
    assert.equal(response.status, 400, website);
  }
  const restaurant = before.restaurants.find(
    (value) => value.id === before.demoRestaurantId,
  )!;
  const branded = await application.request(
    `/restaurants/${restaurant.id}/query-banks`,
    body({
      queries: [
        {
          text: `Would you recommend ${restaurant.name}?`,
          intents: ["locality"],
          branded: false,
        },
      ],
    }),
  );
  assert.equal(branded.status, 400);
  const after = await application.json<Bootstrap>("/bootstrap");
  assert.equal(after.restaurants.length, before.restaurants.length);
  assert.equal(after.banks.length, before.banks.length);
  const alternateBank = await application.json<QueryBank>(
    `/restaurants/${restaurant.id}/query-banks`,
    body({
      queries: [
        {
          text: "Where can I get an early lunch near NYU?",
          intents: ["locality", "occasion"],
          branded: false,
        },
      ],
    }),
  );
  assert.equal(alternateBank.version, before.banks[0].version + 1);
  assert.notEqual(alternateBank.contentHash, before.banks[0].contentHash);
  const withNewBank = await application.json<Bootstrap>("/bootstrap");
  assert.deepEqual(
    withNewBank.banks.find((bank) => bank.id === before.banks[0].id)?.queries,
    before.banks[0].queries,
    "new versions must leave the saved original bank unchanged",
  );
});

test("synthetic answers do not turn independent source evidence into fictional competitor findings", async (t) => {
  const application = await isolatedApplication(t);
  const timestamp = "2026-10-20T12:00:00.000Z";
  // Seed a saved public-page observation directly so this regression performs no
  // external networking and cannot depend on a real site's changing content.
  const restaurant: Restaurant = {
    id: "independent-profile",
    name: "Independent Kitchen",
    website: "https://independent.example",
    location: "New York City",
    aliases: [],
    createdAt: timestamp,
    confirmedAt: timestamp,
    facts: [
      {
        field: "cuisine",
        value: "American",
        provenance: "owner",
        confirmed: true,
      },
    ],
  };
  const source: SourceSnapshot = {
    id: "independent-source",
    restaurantId: restaurant.id,
    url: restaurant.website,
    title: "Independent Kitchen · inspected page",
    fetchedAt: timestamp,
    contentHash: "independent-source-hash",
    excerpt:
      "FAQ: The current menu is linked here. Opening hours and prices require confirmation.",
    status: "succeeded",
    mode: "live",
  };
  const bank: QueryBank = {
    id: "independent-bank",
    restaurantId: restaurant.id,
    version: 1,
    createdAt: timestamp,
    contentHash: "independent-bank-hash",
    queries: [
      {
        id: "independent-question",
        text: "Where can I eat near NYU?",
        intents: ["locality"],
        branded: false,
      },
    ],
  };
  application.store.put("restaurants", restaurant);
  application.store.put("sources", source);
  application.store.put("banks", bank);
  const run = await application.json<Run>(
    "/runs",
    body({
      bankId: bank.id,
      mode: "synthetic",
      idempotencyKey: "separate-source-mode",
    }),
  );
  await finished(application, run.id);
  const opportunities = await application.json<Opportunity[]>(
    `/runs/${run.id}/opportunities`,
  );
  assert.ok(opportunities.length > 0);
  for (const opportunity of opportunities) {
    assert.deepEqual(opportunity.sourceIds, [source.id]);
    assert.ok(
      !/fictional homepage|no direct dining FAQ|Village Hearth/i.test(
        `${opportunity.gap} ${opportunity.competitorExample ?? ""}`,
      ),
      "provider fixture mode must not invent facts about independent sources",
    );
    assert.ok(
      !/fictional source excerpts/i.test(opportunity.uncertainty),
      "source provenance must remain distinct from synthetic answer mode",
    );
    assert.match(opportunity.uncertainty, /synthetic/i);
  }
});
