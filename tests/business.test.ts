import test from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { createApplication } from "../server/index.ts";
import { snapshotFromPage, selectUsefulLinks } from "../server/collector.ts";
import { generateQuestions } from "../shared/questions.ts";
import { parseAnswer } from "../shared/parser.ts";
import { createArtifact, ensureOpportunities } from "../server/content.ts";
import type { Restaurant, QueryBank, Run } from "../shared/types.ts";

const business: Restaurant = {
  id: "business-test",
  name: "Atlas Tools",
  website: "https://atlas.example/",
  businessType: "business",
  category: "design software",
  location: "",
  aliases: [],
  facts: [],
  createdAt: "2026-10-23T00:00:00Z",
  confirmedAt: "2026-10-23T00:00:00Z",
};

test("general discovery questions omit target identity and dining/locality/currency assumptions", () => {
  const questions = generateQuestions(business);
  assert.equal(questions.length, 20);
  assert.equal(new Set(questions.map((q) => q.text)).size, 20);
  assert.ok(
    questions.every((q) => q.text.includes("design software") && !q.branded),
  );
  assert.ok(
    questions.every(
      (q) =>
        !/Atlas|NYU|New York|restaurant|lunch|dinner|pizza|\$/i.test(q.text),
    ),
  );
  assert.ok(new Set(questions.flatMap((q) => q.intents)).size >= 5);
  const fallback = generateQuestions({
    ...business,
    category: "Atlas Tools",
    location: "Atlas Tools",
  });
  assert.ok(fallback.every((q) => !q.text.includes(business.name)));
});

test("general evidence extracts matching Organization facts and does not interpret navigation as a food menu", () => {
  const source = snapshotFromPage(business, {
    url: business.website,
    contentType: "text/html",
    body: '<title>Atlas Tools</title><script type="application/ld+json">{"@type":"Organization","name":"Atlas Tools","description":"Design tools for teams","telephone":"+1 212 555 0100"}</script><nav><a href="/menu">Menu</a><a href="/pricing">Pricing</a><a href="/services">Services</a></nav>',
  });
  assert.equal(
    source.draftFacts?.find((f) => f.field === "description")?.value,
    "Design tools for teams",
  );
  assert.ok(
    source.draftFacts?.every((f) => f.provenance === "website" && !f.confirmed),
  );
  assert.ok(!source.draftFacts?.some((f) => f.field === "menuUrl"));
  const links = selectUsefulLinks(
    [
      { url: "https://atlas.example/pricing", text: "Pricing" },
      { url: "https://atlas.example/services", text: "Services" },
      { url: "https://atlas.example/privacy", text: "Privacy" },
      { url: "http://127.0.0.1/pricing", text: "Pricing" },
    ],
    business.website,
    true,
  );
  assert.deepEqual(
    links.map((l) => l.text),
    ["Pricing", "Services"],
  );
  const wrong = snapshotFromPage(business, {
    url: business.website,
    contentType: "text/html",
    body: '<script type="application/ld+json">{"@type":"Organization","name":"Unrelated Brand","telephone":"+1 212 555 9999"}</script>',
  });
  assert.equal(wrong.draftFacts?.length, 0);
});

test("names in non-Latin scripts parse and missing locality cannot resolve a different branch", () => {
  const target = { ...business, name: "山田書店" };
  const parsed = parseAnswer(
    "1. **山田書店** — 山田書店の公式サイトを確認してください。",
    target,
  );
  assert.ok(parsed.some((a) => a.entityId === target.id && a.recommended));
  const differentBranch = parseAnswer(
    "1. **Atlas Tools** (Boston) — A business option.",
    business,
  );
  assert.ok(
    differentBranch.some((a) => a.entityId === business.id && a.ambiguous),
  );
});

test("restaurant menu drafts require an explicit currency rather than assuming dollars mean USD", async () => {
  const runtime = await createApplication({
    dbPath: ":memory:",
    seed: false,
    worker: false,
  });
  const target: Restaurant = {
    ...business,
    businessType: "restaurant",
    facts: [
      {
        field: "menuUrl",
        value: "https://atlas.example/menu",
        confirmed: true,
        provenance: "owner",
      },
      {
        field: "menuItems",
        value: "Soup — $12.00",
        confirmed: true,
        provenance: "owner",
      },
    ],
  };
  try {
    await runtime.store.put("restaurants", target);
    const run: Run = {
      id: "currency-run",
      restaurantId: target.id,
      bankId: "currency-bank",
      mode: "synthetic",
      provider: "fixture",
      model: "fixture",
      promptVersion: "fixture",
      retrieval: "none",
      status: "completed",
      createdAt: target.createdAt,
      settingsHash: "fixture",
      results: [],
      competitors: [],
      metrics: null,
    };
    await runtime.store.put("runs", run);
    const opportunity = {
      id: "currency-op",
      runId: run.id,
      priority: 1,
      title: "Test fixture",
      gap: "Fixture",
      sourceIds: [],
      intents: [],
      action: "Fixture",
      effort: "low" as const,
      rationale: "Fixture",
      uncertainty: "Fixture",
      artifactTypes: ["jsonld" as const],
    };
    const unknown = JSON.parse(
      (await createArtifact(runtime.store, opportunity, "jsonld")).content,
    );
    assert.equal(unknown.hasMenu, undefined);
    target.facts[1].value = "Soup (CAD 12.00)";
    await runtime.store.put("restaurants", target);
    const explicit = JSON.parse(
      (await createArtifact(runtime.store, opportunity, "jsonld")).content,
    );
    assert.equal(
      explicit.hasMenu.hasMenuSection[0].hasMenuItem[0].offers.priceCurrency,
      "CAD",
    );
  } finally {
    await runtime.close();
  }
});

test("name and bare URL onboard two unrelated businesses, with isolated questions, evidence and Organization drafts", async () => {
  const runtime = await createApplication({
    dbPath: ":memory:",
    seed: false,
    worker: false,
    sourceCollector: async (profile, save) => {
      await save(
        snapshotFromPage(profile, {
          url: profile.website,
          contentType: "text/html",
          body: `<title>${profile.name}</title><script type="application/ld+json">${JSON.stringify({ "@type": "Organization", name: profile.name, description: "Test fixture description" })}</script><p>Test fixture.</p>`,
        }),
      );
    },
  });
  const server = runtime.app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  const post = async (path: string, body: unknown, method = "POST") => {
    const response = await fetch(base + path, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    assert.ok(response.ok, `${path}: ${response.status}`);
    return response.json();
  };
  try {
    const one: Restaurant = await post("/restaurants", {
      name: "Atlas Tools",
      website: "atlas.example/#top",
      category: "design software",
    });
    const two: Restaurant = await post("/restaurants", {
      name: "Birch Books",
      website: "https://birch.example",
      businessType: "business",
      category: "bookstores",
      location: "Toronto, Canada",
    });
    assert.notEqual(one.id, two.id);
    assert.equal(one.website, "https://atlas.example/");
    assert.equal(one.businessType, "business");
    assert.equal(one.location, "");
    const bank: QueryBank = await post(
      `/restaurants/${one.id}/query-banks`,
      {},
    );
    const otherBank: QueryBank = await post(
      `/restaurants/${two.id}/query-banks`,
      {},
    );
    assert.ok(
      otherBank.queries.every(
        (q) => q.text.includes("Toronto") && !q.text.includes("Atlas"),
      ),
    );
    assert.ok(bank.queries.every((q) => !/Toronto|Birch/.test(q.text)));
    await post(
      `/restaurants/${one.id}`,
      { confirmed: true, factIndexes: [] },
      "PATCH",
    );
    // Wait for the deterministic injected collector; no external calls occur.
    const deadline = Date.now() + 2000;
    let profile = await runtime.store.get<Restaurant>("restaurants", one.id);
    while (
      profile?.collectionStatus === "collecting" &&
      Date.now() < deadline
    ) {
      await new Promise((resolve) => setTimeout(resolve, 10));
      profile = await runtime.store.get<Restaurant>("restaurants", one.id);
    }
    assert.equal(profile?.collectionStatus, "completed");
    const run: Run = {
      id: "business-run",
      restaurantId: one.id,
      bankId: bank.id,
      mode: "synthetic",
      provider: "Test fixture",
      model: "test",
      retrieval: "none",
      promptVersion: "test",
      settingsHash: "test",
      status: "completed",
      createdAt: one.createdAt,
      results: [],
      metrics: null,
      competitors: [],
      sourceSnapshotIds: (await runtime.store.all<any>("sources"))
        .filter((s) => s.restaurantId === one.id)
        .map((s) => s.id),
    };
    await runtime.store.put("runs", run);
    const findings = await ensureOpportunities(runtime.store, run);
    assert.ok(findings.length);
    assert.ok(
      findings.every(
        (f) => !/dining|pizza|restaurant menu/i.test(f.title + f.gap),
      ),
    );
    assert.match(findings[0].uncertainty, /synthetic examples/);
    const artifact = await createArtifact(runtime.store, findings[0], "jsonld");
    assert.equal(artifact.validation.valid, true);
    const data = JSON.parse(artifact.content);
    assert.equal(data["@type"], "Organization");
    assert.equal(data.name, one.name);
    assert.equal(data.address, undefined);
    assert.equal(data.servesCuisine, undefined);
    assert.ok(!artifact.content.includes("Birch"));
    const about = await createArtifact(runtime.store, findings[0], "about");
    assert.ok(!about.content.includes("located at ."));
    assert.ok(
      !about.content.includes("Test fixture description"),
      "unaccepted source claims stay out of drafts",
    );
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await runtime.close();
  }
});
