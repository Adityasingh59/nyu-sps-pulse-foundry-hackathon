import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateMetrics,
  compareRuns,
  rankCompetitors,
} from "../shared/metrics";
import { parseAnswer } from "../shared/parser";
import { generateQuestions } from "../shared/questions";
import type {
  Appearance,
  Query,
  QueryBank,
  QueryResult,
  Restaurant,
  Run,
} from "../shared/types";

const restaurant: Restaurant = {
  id: "linden",
  name: "Linden Table",
  aliases: ["The Linden Table", "Linden"],
  website: "https://lindentable.example",
  location: "Greenwich Village, New York, NY",
  cuisine: "New American",
  facts: [],
  createdAt: "2026-10-20T12:00:00Z",
};

function appearance(
  entityId: string,
  options: Partial<Appearance> = {},
): Appearance {
  return {
    entityId,
    name: entityId,
    mention: true,
    recommended: true,
    position: 1,
    evidenceSpan: "test evidence",
    ambiguous: false,
    ...options,
  };
}
function result(
  queryId: string,
  appearances: Appearance[] = [],
  options: Partial<QueryResult> = {},
): QueryResult {
  return {
    id: `result-${queryId}`,
    queryId,
    sampleId: 0,
    status: "succeeded",
    rawAnswer: "",
    appearances,
    citations: [],
    attempts: 1,
    ...options,
  };
}
const query = (id: string, branded = false): Query => ({
  id,
  text: `Customer question ${id}?`,
  intents: ["locality"],
  branded,
});
const bank: QueryBank = {
  id: "bank",
  restaurantId: restaurant.id,
  version: 1,
  createdAt: "2026-10-20T12:00:00Z",
  contentHash: "frozen-hash",
  queries: [query("a"), query("b"), query("c"), query("d")],
};
function run(
  id: string,
  results: QueryResult[],
  options: Partial<Run> = {},
): Run {
  return {
    id,
    bankId: bank.id,
    restaurantId: restaurant.id,
    mode: "synthetic",
    provider: "fixture",
    model: "v1",
    status: "completed",
    createdAt: "2026-10-20T12:00:00Z",
    settingsHash: "settings-one-sample",
    promptVersion: "v1",
    retrieval: "none",
    results,
    metrics: null,
    competitors: [],
    ...options,
  };
}

test("metrics use valid discovery observations and distinguish mention, recommendation, and position", () => {
  const results = [
    result("a", [
      appearance(restaurant.id, { position: 2 }),
      appearance("competitor"),
      appearance("competitor"),
    ]),
    result("b", [
      appearance(restaurant.id, { recommended: false, position: null }),
      appearance("competitor"),
    ]),
    result("c", [appearance("competitor"), appearance("another")]),
    result("d", [], { status: "failed", error: "timeout" }),
    result("branded", [appearance(restaurant.id)]),
    result("ambiguous", [appearance(restaurant.id, { ambiguous: true })]),
  ];
  const queries = [...bank.queries, query("branded", true), query("ambiguous")];
  const metrics = calculateMetrics(results, restaurant.id, queries);
  assert.equal(metrics.attempted, 5);
  assert.equal(metrics.valid, 3);
  assert.equal(metrics.excludedAmbiguous, 1);
  assert.equal(metrics.mentions, 2);
  assert.equal(metrics.recommendations, 1);
  assert.equal(metrics.mentionRate, (2 / 3) * 100);
  assert.equal(metrics.recommendationRate, (1 / 3) * 100);
  assert.equal(metrics.averagePosition, 2);
  assert.equal(metrics.positionSamples, 1);
  assert.equal(metrics.totalRecommendationAppearances, 5);
  assert.equal(metrics.shareOfVoice, 20);
  assert.equal(metrics.coverage, 60);
  const competitors = rankCompetitors(results, restaurant.id, queries);
  assert.equal(competitors[0].entityId, "competitor");
  assert.equal(competitors[0].appearances, 3);
  assert.equal(competitors[0].shareOfVoice, 60);
  assert.equal(
    competitors.find((entry) => entry.entityId === restaurant.id)?.isTarget,
    true,
  );
  assert.equal(
    competitors.reduce((sum, entry) => sum + entry.shareOfVoice, 0),
    100,
  );
});

test("missing observations, unordered positions, and zero denominators stay unavailable", () => {
  const empty = calculateMetrics([], restaurant.id);
  assert.equal(empty.mentionRate, null);
  assert.equal(empty.averagePosition, null);
  assert.equal(empty.shareOfVoice, null);
  assert.equal(empty.coverage, null);
  const failed = calculateMetrics(
    [result("a", [], { status: "failed" })],
    restaurant.id,
  );
  assert.equal(failed.coverage, 0);
  assert.equal(failed.mentionRate, null);
  const absent = calculateMetrics([result("a")], restaurant.id);
  assert.equal(absent.mentionRate, 0);
  assert.equal(absent.shareOfVoice, null);
  const unordered = calculateMetrics(
    [result("a", [appearance(restaurant.id, { position: null })])],
    restaurant.id,
  );
  assert.equal(unordered.recommendationRate, 100);
  assert.equal(unordered.averagePosition, null);
  assert.equal(unordered.positionSamples, 0);
});

test("retries and duplicate entity spans do not inflate observations or share of voice", () => {
  const metrics = calculateMetrics(
    [
      result("a", [], { status: "failed" }),
      result("a", [
        appearance(restaurant.id, { position: 3 }),
        appearance(restaurant.id, { position: 1 }),
      ]),
      result("a", [], { status: "failed" }),
      result("a", [], { sampleId: 1 }),
    ],
    restaurant.id,
  );
  assert.equal(metrics.attempted, 2);
  assert.equal(metrics.valid, 2);
  assert.equal(metrics.mentionRate, 50);
  assert.equal(metrics.totalRecommendationAppearances, 1);
  assert.equal(metrics.averagePosition, 1);
});

test("ordered and unordered recommendations preserve original supporting spans", () => {
  const raw =
    "Here are a few options:\n1. **Village Hearth** — A relaxed option.\n2. **Linden Table** — Seasonal cooking in Greenwich Village.\n- **Juniper & Rye** — Another option.";
  const parsed = parseAnswer(raw, restaurant);
  assert.equal(parsed.length, 3);
  assert.equal(parsed[0].entityId, "restaurant:village-hearth");
  assert.equal(parsed[0].position, 1);
  assert.equal(parsed[1].entityId, restaurant.id);
  assert.equal(parsed[1].recommended, true);
  assert.equal(parsed[1].position, 2);
  assert.equal(parsed[2].entityId, "restaurant:juniper-rye");
  assert.equal(parsed[2].position, null);
  for (const entry of parsed) assert.ok(raw.includes(entry.evidenceSpan));
});

test("target absence and incidental or negative mentions never acquire recommendation positions", () => {
  assert.deepEqual(
    parseAnswer("No restaurant information is available.", restaurant),
    [],
  );
  for (const text of [
    "Linden Table is mentioned in local conversation, but I am not recommending it for this question.",
    "I would not recommend Linden Table.",
    "I recommend avoiding Linden Table.",
    "1. **Linden Table** — Not a recommendation; this location is closed.",
    "Avoid these places:\n1. **Linden Table** — This option is unsuitable.",
    "Avoid these places:\n\n1. **Linden Table** — This option is unsuitable.",
    "Not recommended:\n\n- **Linden Table** — This option is unsuitable.",
    "1. **Village Hearth** — Unlike Linden Table, this is the option I suggest.",
  ]) {
    const target = parseAnswer(text, restaurant).find(
      (entry) => entry.entityId === restaurant.id,
    );
    assert.equal(target?.mention, true, text);
    assert.equal(target?.recommended, false, text);
    assert.equal(target?.position, null, text);
  }
  const prose = parseAnswer("I recommend Linden Table for dinner.", restaurant);
  assert.equal(prose[0].recommended, true);
  assert.equal(prose[0].position, null);
});

test("same-name branches and unsupported short aliases remain ambiguous", () => {
  for (const text of [
    "1. **Linden Table (Brooklyn)** — A dining room in New York.",
    "1. **Linden Table** in Boston — A nearby dining option.",
    "1. **Linden Table Boston** — Seasonal menu.",
    "1. **Linden Table — Boston** — Seasonal menu.",
    "- **Linden** — A relaxed restaurant.",
  ]) {
    const target = parseAnswer(text, restaurant).find(
      (entry) => entry.entityId === restaurant.id,
    );
    assert.equal(target?.ambiguous, true, text);
    assert.equal(
      calculateMetrics([result("a", [target!])], restaurant.id).valid,
      0,
    );
  }
  assert.equal(
    parseAnswer("- **Linden** — Greenwich Village.", restaurant)[0].ambiguous,
    false,
  );
  assert.equal(
    parseAnswer(
      "- **Linden Table** in Greenwich Village for lunch.",
      restaurant,
    )[0].ambiguous,
    false,
  );
  assert.equal(
    parseAnswer(
      "- **Linden** — https://lindentable.example/menu",
      restaurant,
    )[0].ambiguous,
    false,
  );
  assert.deepEqual(parseAnswer("The Lindenwood room is open.", restaurant), []);
});

test("plain list names and markdown links work without converting advice headings into entities", () => {
  const parsed = parseAnswer(
    "1. Village Hearth: Seasonal plates.\n2. [Washington Square Kitchen](https://example.com) — Lunch.\n- Check opening hours\n- Vegetarian options: check the menu",
    restaurant,
  );
  assert.deepEqual(
    parsed.map((entry) => entry.entityId),
    ["restaurant:village-hearth", "restaurant:washington-square-kitchen"],
  );
});

test("question generation is repeatable, non-branded, and covers multiple dining dimensions", () => {
  const queries = generateQuestions(restaurant);
  assert.equal(queries.length, 20);
  assert.deepEqual(queries, generateQuestions(restaurant));
  assert.equal(new Set(queries.map((query) => query.id)).size, 20);
  assert.equal(new Set(queries.map((query) => query.text)).size, 20);
  assert.ok(new Set(queries.flatMap((query) => query.intents)).size >= 4);
  for (const query of queries) {
    assert.equal(query.branded, false);
    assert.ok(
      !query.text.toLowerCase().includes(restaurant.name.toLowerCase()),
    );
    for (const alias of restaurant.aliases)
      assert.ok(!query.text.toLowerCase().includes(alias.toLowerCase()));
    assert.ok(!/Linden Table (?:offers|serves|has)/i.test(query.text));
  }
  const embeddedName = {
    ...restaurant,
    location: `${restaurant.name}, New York`,
    cuisine: `${restaurant.name} specials`,
  };
  assert.ok(
    generateQuestions(embeddedName).every(
      (query) => !query.text.includes(restaurant.name),
    ),
  );
});

test("comparisons use only matched valid query/sample pairs and report percentage point deltas", () => {
  const before = run("before", [
    result("a", [appearance(restaurant.id)]),
    result("b"),
    result("c", [], { status: "failed" }),
    result("d", [], { sampleId: 1 }),
  ]);
  const after = run("after", [
    result("a", [appearance(restaurant.id)]),
    result("b", [appearance(restaurant.id)]),
    result("c", [appearance(restaurant.id)]),
    result("d", [], { sampleId: 0 }),
  ]);
  const comparison = compareRuns(before, after, bank, bank);
  assert.equal(comparison.compatible, true);
  assert.equal(comparison.matched, 2);
  assert.equal(comparison.excluded, 3); // c failed, d/sample 0 missing before, d/sample 1 missing after.
  assert.equal(comparison.beforeMetrics?.mentionRate, 50);
  assert.equal(comparison.afterMetrics?.mentionRate, 100);
  assert.equal(comparison.mentionRateChange, 50);
  assert.equal(comparison.recommendationRateChange, 50);
  assert.deepEqual(
    comparison.pairs.map((pair) => pair.queryId),
    ["a", "b"],
  );
  assert.ok(
    comparison.limitations.some((text) => text.includes("Sample counts")) ===
      false,
  ); // Equal configured/observed counts; IDs differ.
});

test("comparison excludes branded observations and unresolved identities from matched coverage", () => {
  const brandedBank = {
    ...bank,
    queries: [...bank.queries, query("branded", true)],
  };
  const before = run("before", [
    result("a"),
    result("b", [appearance(restaurant.id, { ambiguous: true })]),
    result("branded", [appearance(restaurant.id)]),
  ]);
  const after = run("after", [
    result("a"),
    result("b"),
    result("branded", [appearance(restaurant.id)]),
  ]);
  const comparison = compareRuns(before, after, brandedBank, brandedBank);
  assert.equal(comparison.matched, 1);
  assert.equal(comparison.excluded, 1);
  assert.equal(comparison.mentionRateChange, 0);
});

test("changed frozen bank or provider configuration blocks headline comparisons", () => {
  const before = run("before", [result("a")]);
  for (const changed of [
    { mode: "live" },
    { provider: "different" },
    { model: "v2" },
    { settingsHash: "settings-two-samples" },
    { promptVersion: "v2" },
    { retrieval: "web" },
    { restaurantId: "other" },
  ] as Partial<Run>[]) {
    const comparison = compareRuns(
      before,
      run("after", [result("a", [appearance(restaurant.id)])], changed),
      bank,
      bank,
    );
    assert.equal(comparison.compatible, false, JSON.stringify(changed));
    assert.ok(comparison.reasons.length > 0);
    assert.equal(comparison.beforeMetrics, null);
    assert.equal(comparison.afterMetrics, null);
    assert.equal(comparison.mentionRateChange, null);
  }
  assert.equal(
    compareRuns(before, run("after", []), bank, {
      ...bank,
      contentHash: "changed",
    }).compatible,
    false,
  );
  const none = compareRuns(run("before", []), run("after", []), bank, bank);
  assert.equal(none.matched, 0);
  assert.equal(none.mentionRateChange, null);
});

test("linked bold restaurant names preserve target identity and recommendation positions", () => {
  const target = {
    ...restaurant,
    name: "John's of Bleecker Street",
    aliases: ["John's of Bleecker St."],
    website: "https://johnsofbleecker.com/",
    location: "Greenwich Village, New York City",
  };
  const answers = parseAnswer(
    "1. **[John’s of Bleecker Street](https://johnsofbleecker.com/)** — A pizza option in Greenwich Village.\n2. **[Ribalta](https://ribaltanyc.com/)** — A pizza restaurant.",
    target,
  );
  assert.equal(answers.find((a) => a.entityId === target.id)?.ambiguous, false);
  assert.equal(answers.find((a) => a.entityId === target.id)?.position, 1);
  assert.equal(answers.find((a) => a.name === "Ribalta")?.position, 2);
  assert.ok(answers.every((a) => a.evidenceSpan.includes("https://")));
});

test("positive recommendation list details do not become incidental mentions because they compare menu formats", () => {
  const parsed = parseAnswer(
    "1. **Linden Table** — A good dinner option serving whole pies rather than slices.",
    restaurant,
  );
  assert.equal(
    parsed.find((a) => a.entityId === restaurant.id)?.recommended,
    true,
  );
  assert.equal(parsed.find((a) => a.entityId === restaurant.id)?.position, 1);
  const prose = parseAnswer(
    "Try Other Bistro instead of Linden Table.",
    restaurant,
  );
  assert.equal(
    prose.find((a) => a.entityId === restaurant.id)?.recommended,
    false,
  );
});

test("a positive list recommendation may quote a restaurant-specific dietary restriction without becoming a negative recommendation", () => {
  const answer =
    "1. **Linden Table** — Publishes ingredient information. The restaurant says it does not recommend these pizzas for people with celiac disease.\n2. **Village Hearth** — Not recommended; permanently closed.";
  const entries = parseAnswer(answer, restaurant);
  assert.equal(
    entries.find((a) => a.entityId === restaurant.id)?.recommended,
    true,
  );
  assert.equal(
    entries.find((a) => a.name === "Village Hearth")?.recommended,
    false,
  );
});
