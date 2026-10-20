import express from "express";
import type { ErrorRequestHandler, Request } from "express";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type {
  ArtifactType,
  ArtifactVersion,
  Bootstrap,
  EvidenceMode,
  Opportunity,
  ProfileFact,
  Query,
  QueryBank,
  QueryResult,
  Restaurant,
  Run,
  SourceSnapshot,
} from "../shared/types.ts";
import {
  calculateMetrics,
  compareRuns,
  rankCompetitors,
} from "../shared/metrics.ts";
import { generateQuestions } from "../shared/questions.ts";
import { parseAnswer, PARSER_VERSION } from "../shared/parser.ts";
import {
  collectSources,
  collectSourcePage,
  validatePublicUrl,
} from "./collector.ts";
import { extractProfileFactsFromSnapshots } from "./evidence.ts";
import { createArtifact, ensureOpportunities } from "./content.ts";
import {
  boundedEnv,
  liveAnswer,
  liveConfigured,
  providerInfo,
  LIVE_MODEL,
  LIVE_RETRIEVAL,
  PROMPT_VERSION,
  syntheticAnswer,
  SYNTHETIC_RETRIEVAL,
} from "./providers.ts";
import type { ProviderSettings } from "./providers.ts";
import { collectCompetitorEvidence } from "./competitive-evidence.ts";
import { hash, id, now, Store } from "./store.ts";

const DEMO_ID = "restaurant_linden";
class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
function textInput(value: unknown, field: string, max = 400): string {
  if (typeof value !== "string" || !value.trim() || value.length > max)
    throw new ApiError(
      400,
      `${field} must be a non-empty string of at most ${max} characters.`,
    );
  return value.trim();
}
function requireEntity<T>(
  store: Store,
  table: Parameters<Store["get"]>[0],
  key: string,
): T {
  const value = store.get<T>(table, key);
  if (!value) throw new ApiError(404, "The requested record was not found.");
  return value;
}
function requestKey(req: Request): string {
  return textInput(
    req.body?.idempotencyKey ?? req.header("Idempotency-Key"),
    "idempotencyKey",
    180,
  );
}
function factsInput(value: unknown, confirmed: boolean): ProfileFact[] {
  if (value === undefined) return [];
  if (value === null || typeof value !== "object")
    throw new ApiError(
      400,
      "facts must be an array of facts or an object of field values.",
    );
  const values = Array.isArray(value)
    ? value
    : Object.entries(value as object).map(([field, value]) => ({
        field,
        value,
      }));
  if (values.length > 30)
    throw new ApiError(400, "At most 30 owner facts can be saved.");
  return values.map((fact: Record<string, unknown>) => {
    if (!fact || typeof fact !== "object")
      throw new ApiError(400, "Each fact must contain a field and value.");
    return {
      field: textInput(fact.field, "fact field", 80),
      value: textInput(fact.value, "fact value", 2_000),
      provenance: "owner" as const,
      confirmed: confirmed || fact.confirmed === true,
    };
  });
}
function metrics(store: Store, run: Run): Run {
  const bank = store.get<QueryBank>("banks", run.bankId);
  run.metrics = calculateMetrics(run.results, run.restaurantId, bank?.queries);
  run.competitors = rankCompetitors(
    run.results,
    run.restaurantId,
    bank?.queries,
  );
  return run;
}
function settingsFor(mode: EvidenceMode, runId: string): ProviderSettings {
  return {
    id: runId,
    adapter: mode === "live" ? providerInfo().adapter : undefined,
    model: mode === "live" ? LIVE_MODEL : "synthetic-fixture-v1",
    promptVersion: PROMPT_VERSION,
    retrieval: mode === "live" ? LIVE_RETRIEVAL : SYNTHETIC_RETRIEVAL,
    maxRequests: boundedEnv("MAX_REQUESTS_PER_RUN", 40, 1, 60),
    maxOutputTokens: boundedEnv("MAX_OUTPUT_TOKENS", 900, 200, 2000),
    timeoutMs: boundedEnv(
      "PROVIDER_TIMEOUT_MS",
      process.env.OPENAI_API_KEY ? 45000 : 150000,
      1000,
      180000,
    ),
    retryCeilings: {},
  };
}
function settingsFingerprint(settings: ProviderSettings) {
  const { id: _id, retryCeilings: _retry, ...fixed } = settings;
  return hash(fixed);
}
function newRun(
  store: Store,
  bank: QueryBank,
  mode: EvidenceMode,
  sourceRun?: Run,
): Run {
  const restaurant = requireEntity<Restaurant>(
    store,
    "restaurants",
    bank.restaurantId,
  );
  if (!restaurant.confirmedAt)
    throw new ApiError(
      409,
      "Confirm the restaurant profile before starting a run.",
    );
  if (mode === "live" && !liveConfigured())
    throw new ApiError(409, providerInfo().status);
  if (
    mode === "live" &&
    new URL(restaurant.website).hostname.endsWith(".example")
  )
    throw new ApiError(
      400,
      "The fictional demonstration restaurant supports synthetic examples only.",
    );
  if (
    store
      .all<Run>("runs")
      .filter(
        (run) =>
          run.mode === "live" && ["queued", "running"].includes(run.status),
      ).length >= 1 &&
    mode === "live"
  )
    throw new ApiError(
      409,
      "One live run is already active. Wait for it to finish before starting another.",
    );
  const runId = id("run");
  const previous = sourceRun
    ? requireEntity<ProviderSettings>(store, "settings", sourceRun.id)
    : undefined;
  const settings = previous
    ? { ...previous, id: runId, retryCeilings: {} }
    : settingsFor(mode, runId);
  const run: Run = {
    id: runId,
    bankId: bank.id,
    restaurantId: bank.restaurantId,
    mode,
    provider:
      mode === "live"
        ? sourceRun?.provider || providerInfo().name
        : "TableSignal synthetic example",
    model: settings.model,
    status: "queued",
    parserVersion: PARSER_VERSION,
    analysisRevision: 1,
    sourceSnapshotIds: store
      .all<SourceSnapshot>("sources")
      .filter(
        (s) =>
          s.restaurantId === restaurant.id &&
          s.scope !== "competitor" &&
          s.sourceKind !== "manual",
      )
      .map((s) => s.id),
    createdAt: now(),
    settingsHash: settingsFingerprint(settings),
    promptVersion: settings.promptVersion,
    retrieval: settings.retrieval,
    results: bank.queries.map((query) => ({
      id: id("result"),
      queryId: query.id,
      sampleId: 1,
      status: "queued",
      rawAnswer: "",
      appearances: [],
      citations: [],
      attempts: 0,
    })),
    metrics: null,
    competitors: [],
    ...(sourceRun ? { sourceRunId: sourceRun.id } : {}),
  };
  store.put("settings", settings);
  return store.put("runs", metrics(store, run));
}
function seed(store: Store) {
  if (store.get("restaurants", DEMO_ID)) return;
  const createdAt = now();
  const homeId = "source_linden_home",
    menuId = "source_linden_menu";
  const restaurant: Restaurant = {
    id: DEMO_ID,
    name: "Linden Table",
    website: "https://lindentable.example",
    location: "Greenwich Village, New York City, near NYU",
    aliases: ["The Linden Table"],
    cuisine: "Seasonal American",
    createdAt,
    confirmedAt: createdAt,
    facts: [
      {
        field: "menuItems",
        value:
          "Tomato farro bowl ($16); herb-roasted chicken ($24). Fictional sample menu.",
        sourceId: menuId,
        provenance: "synthetic",
        confirmed: true,
      },
      {
        field: "menuUrl",
        value: "https://lindentable.example/menu",
        sourceId: menuId,
        provenance: "synthetic",
        confirmed: true,
      },
      {
        field: "description",
        value: "A fictional seasonal neighborhood kitchen in Greenwich Village",
        sourceId: homeId,
        provenance: "synthetic",
        confirmed: true,
      },
    ],
  };
  store.put("restaurants", restaurant);
  for (const source of [
    {
      id: homeId,
      url: restaurant.website,
      title: "Linden Table · fictional homepage",
      excerpt:
        "Synthetic source fixture. Linden Table: a seasonal neighborhood kitchen in Greenwich Village, New York City, near NYU. Our fictional homepage introduces the restaurant with a short sentence. There is no dining FAQ in this fixture. Inspection metadata: No JSON-LD script found in inspected page HTML.",
    },
    {
      id: menuId,
      url: "https://lindentable.example/menu",
      title: "Linden Table · fictional menu",
      excerpt:
        "Synthetic source fixture. Sample menu: Tomato farro bowl — $16. Herb-roasted chicken — $24. Cuisine: Seasonal American. This fixture does not specify opening hours, reservations, accessibility, dietary suitability, or ingredient guarantees. Inspection metadata: No JSON-LD script found in inspected page HTML.",
    },
    {
      id: "source_village_menu",
      url: "https://villagehearth.example/menu",
      title: "Village Hearth · fictional competitor menu",
      excerpt:
        "Synthetic competitor source fixture. Village Hearth presents example dishes and prices in a single menu page. It also includes a short FAQ for menu updates and current availability. No real restaurant website was inspected.",
    },
  ])
    store.put<SourceSnapshot>("sources", {
      ...source,
      restaurantId: DEMO_ID,
      status: "succeeded",
      fetchedAt: createdAt,
      contentHash: hash(source.excerpt),
      mode: "synthetic",
    });
  const queries = generateQuestions(restaurant);
  const bank: QueryBank = {
    id: "bank_linden_v1",
    restaurantId: restaurant.id,
    version: 1,
    createdAt,
    queries,
    contentHash: hash(queries),
  };
  store.put("banks", bank);
  const run = newRun(store, bank, "synthetic");
  run.id = "run_linden_baseline";
  const settings = settingsFor("synthetic", run.id);
  store.put("settings", settings);
  // Remove the temporary queued run created to use exactly the same initialization path.
  const temporary = store
    .all<Run>("runs")
    .find((value) => value.id !== run.id && value.bankId === bank.id);
  if (temporary) {
    store.db.prepare("DELETE FROM runs WHERE id=?").run(temporary.id);
    store.db.prepare("DELETE FROM settings WHERE id=?").run(temporary.id);
  }
  run.results = queries.map((query, index) => {
    const answer = syntheticAnswer(restaurant, query, index);
    const result: QueryResult = {
      id: `result_linden_${index + 1}`,
      queryId: query.id,
      sampleId: 1,
      status: "succeeded",
      rawAnswer: answer.rawAnswer,
      appearances: parseAnswer(answer.rawAnswer, restaurant),
      citations: answer.citations,
      latencyMs: 0,
      executedAt: createdAt,
      attempts: 1,
    };
    store.put("calls", {
      id: `call_linden_${index + 1}`,
      runId: run.id,
      resultId: result.id,
      attempt: 1,
      executedAt: createdAt,
      rawResponse: answer.rawResponse,
    });
    return result;
  });
  run.status = "completed";
  run.completedAt = createdAt;
  store.put("runs", metrics(store, run));
  ensureOpportunities(store, run);
}

export function createApplication(
  options: { dbPath?: string; worker?: boolean; seed?: boolean } = {},
) {
  const store = new Store(
    options.dbPath ??
      process.env.TABLESIGNAL_DB_PATH ??
      resolve("data/tablesignal.sqlite"),
  );
  if (options.seed !== false) store.transaction(() => seed(store));
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "120kb" }));
  // Local operator app: mutating browser requests must originate from our loopback UI.
  app.use("/api", (req, res, next) => {
    const origin = req.header("origin");
    if (
      origin &&
      !/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(origin)
    ) {
      res.status(403).json({
        error:
          "This local application accepts browser requests from localhost only.",
      });
      return;
    }
    if (origin) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
    }
    if (req.method === "OPTIONS") {
      res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type, Idempotency-Key",
      );
      res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,OPTIONS");
      res.status(204).end();
      return;
    }
    res.setHeader("Cache-Control", "no-store");
    next();
  });
  let closed = false;
  const background = new Set<Promise<unknown>>();
  const active = new Set<string>();
  const track = (promise: Promise<unknown>) => {
    background.add(promise);
    void promise.finally(() => background.delete(promise)).catch(() => {});
  };
  const saveRun = (run: Run) => store.put("runs", metrics(store, run));
  const collectingRestaurants = new Set<string>();
  function scheduleCollection(restaurant: Restaurant) {
    if (collectingRestaurants.has(restaurant.id)) return;
    collectingRestaurants.add(restaurant.id);
    const latest = requireEntity<Restaurant>(
      store,
      "restaurants",
      restaurant.id,
    );
    latest.collectionStatus = "collecting";
    delete latest.collectionError;
    store.put("restaurants", latest);
    const snapshots: SourceSnapshot[] = [];
    const task = collectSources(latest, (snapshot) => {
      if (closed) return;
      const saved = {
        ...snapshot,
        sourceKind: "website" as const,
        scope: "target" as const,
        entityId: restaurant.id,
      };
      snapshots.push(saved);
      store.put("sources", saved);
    })
      .then(() => {
        if (closed) return;
        const current = requireEntity<Restaurant>(
          store,
          "restaurants",
          restaurant.id,
        );
        const extracted = extractProfileFactsFromSnapshots(snapshots);
        for (const fact of extracted) {
          if (
            !current.facts.some(
              (old) => old.field === fact.field && old.value === fact.value,
            )
          )
            current.facts.push(fact);
        }
        current.lastCollectedAt = now();
        current.collectionStatus = snapshots.some(
          (source) => source.status === "succeeded",
        )
          ? "completed"
          : "failed";
        current.collectionError =
          current.collectionStatus === "failed"
            ? "No allowed website pages could be retrieved. Inspect the failed source snapshots."
            : undefined;
        store.put("restaurants", current);
      })
      .catch(() => {
        if (closed) return;
        const current = requireEntity<Restaurant>(
          store,
          "restaurants",
          restaurant.id,
        );
        current.collectionStatus = "failed";
        current.collectionError =
          "Website collection could not complete. Existing evidence has been preserved.";
        store.put("restaurants", current);
      })
      .finally(() => collectingRestaurants.delete(restaurant.id));
    track(task);
  }
  for (const restaurant of store
    .all<Restaurant>("restaurants")
    .filter((r) => r.collectionStatus === "collecting"))
    scheduleCollection(restaurant);

  const collectingRuns = new Set<string>();
  function scheduleCompetitorCollection(run: Run) {
    if (collectingRuns.has(run.id)) return;
    if (["queued", "running"].includes(run.status))
      throw new ApiError(
        409,
        "Wait for the recommendation run to finish before collecting its leading competitors.",
      );
    if (run.mode !== "live")
      throw new ApiError(
        400,
        "Synthetic fixtures have no public competitor sites to inspect.",
      );
    collectingRuns.add(run.id);
    run.evidenceStatus = "collecting";
    store.put("runs", run);
    const target = requireEntity<Restaurant>(
      store,
      "restaurants",
      run.restaurantId,
    );
    const sourceIds: string[] = [];
    const task = collectCompetitorEvidence(run, target, (source) => {
      if (!closed) {
        sourceIds.push(source.id);
        store.put("sources", source);
      }
    })
      .then((warnings) => {
        if (closed) return;
        const latest = requireEntity<Run>(store, "runs", run.id);
        latest.evidenceStatus = "completed";
        latest.evidenceCompletedAt = now();
        latest.evidenceWarnings = warnings;
        latest.analysisRevision = (latest.analysisRevision ?? 1) + 1;
        store.put("runs", latest);
        store.put("calls", {
          id: id("audit"),
          runId: run.id,
          kind: "evidence-collected",
          at: now(),
          sourceIds,
          warnings,
          analysisRevision: latest.analysisRevision,
        });
        ensureOpportunities(store, latest);
      })
      .catch(() => {
        if (!closed) {
          const latest = requireEntity<Run>(store, "runs", run.id);
          latest.evidenceStatus = "failed";
          latest.evidenceWarnings = [
            "Competitor collection could not complete; existing sources and answers are preserved.",
          ];
          store.put("runs", latest);
        }
      })
      .finally(() => collectingRuns.delete(run.id));
    track(task);
  }
  for (const run of store
    .all<Run>("runs")
    .filter(
      (r) =>
        r.evidenceStatus === "collecting" &&
        !["queued", "running"].includes(r.status),
    ))
    scheduleCompetitorCollection(run);
  const updateResult = (runId: string, result: QueryResult) => {
    const run = requireEntity<Run>(store, "runs", runId);
    run.results = run.results.map((value) =>
      value.id === result.id ? result : value,
    );
    saveRun(run);
  };
  for (const run of store
    .all<Run>("runs")
    .filter((value) => ["queued", "running"].includes(value.status))) {
    run.status = "queued";
    run.results = run.results.map((result) =>
      result.status === "running"
        ? {
            ...result,
            status: "queued",
            error: "Interrupted attempt recovered after restart.",
          }
        : result,
    );
    saveRun(run);
  }
  async function perform(runId: string, resultId: string) {
    const run = requireEntity<Run>(store, "runs", runId),
      settings = requireEntity<ProviderSettings>(store, "settings", runId);
    const bank = requireEntity<QueryBank>(store, "banks", run.bankId),
      restaurant = requireEntity<Restaurant>(
        store,
        "restaurants",
        run.restaurantId,
      );
    const query = bank.queries.find(
      (value) =>
        value.id ===
        run.results.find((value) => value.id === resultId)?.queryId,
    )!;
    let result = run.results.find((value) => value.id === resultId)!;
    const ceiling = settings.retryCeilings[result.id] ?? 2;
    for (;;) {
      if (result.attempts >= ceiling) {
        result = {
          ...result,
          status: "failed",
          error:
            "Interrupted observation reached its retry ceiling; retry manually or start a new run.",
          executedAt: now(),
        };
        updateResult(runId, result);
        break;
      }
      const current = requireEntity<Run>(store, "runs", runId);
      if (
        current.results.reduce((sum, value) => sum + value.attempts, 0) >=
        settings.maxRequests
      ) {
        result = {
          ...result,
          status: "failed",
          error: `Per-run ceiling of ${settings.maxRequests} provider requests reached. This answer is excluded.`,
          executedAt: now(),
        };
        updateResult(runId, result);
        break;
      }
      result = {
        ...result,
        status: "running",
        attempts: result.attempts + 1,
        error: undefined,
      };
      updateResult(runId, result);
      const started = Date.now();
      try {
        const answer =
          run.mode === "synthetic"
            ? await new Promise<ReturnType<typeof syntheticAnswer>>(
                (resolveAnswer) =>
                  setTimeout(
                    () =>
                      resolveAnswer(
                        syntheticAnswer(
                          restaurant,
                          query,
                          bank.queries.indexOf(query),
                        ),
                      ),
                    120,
                  ),
              )
            : await liveAnswer(query, settings);
        result = {
          ...result,
          status: "succeeded",
          rawAnswer: answer.rawAnswer,
          citations: answer.citations,
          appearances: parseAnswer(answer.rawAnswer, restaurant),
          latencyMs: Date.now() - started,
          executedAt: now(),
          error: undefined,
        };
        store.put("calls", {
          id: id("call"),
          runId,
          resultId,
          attempt: result.attempts,
          executedAt: result.executedAt,
          latencyMs: result.latencyMs,
          rawResponse: answer.rawResponse,
        });
        updateResult(runId, result);
        break;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Provider execution failed.";
        const safeError = /API key|Bearer|sk-[a-zA-Z0-9]/i.test(message)
          ? "Provider authentication failed. Check server configuration."
          : message;
        store.put("calls", {
          id: id("call"),
          runId,
          resultId,
          attempt: result.attempts,
          executedAt: now(),
          error: safeError,
          latencyMs: Date.now() - started,
        });
        result = {
          ...result,
          status: "failed",
          error: safeError,
          latencyMs: Date.now() - started,
          executedAt: now(),
        };
        updateResult(runId, result);
        const retryable = !(
          error instanceof Error &&
          "retryable" in error &&
          error.retryable === false
        );
        if (closed || !retryable || result.attempts >= ceiling) break;
        await new Promise((resolveDelay) =>
          setTimeout(resolveDelay, Math.min(1500, result.attempts * 300)),
        );
      }
    }
  }
  function finishRuns() {
    for (const run of store
      .all<Run>("runs")
      .filter((value) => ["queued", "running"].includes(value.status))) {
      if (
        run.results.some((result) =>
          ["queued", "running"].includes(result.status),
        )
      )
        continue;
      const successes = run.results.filter(
        (result) => result.status === "succeeded",
      ).length;
      run.status =
        successes === run.results.length
          ? "completed"
          : successes
            ? "partial"
            : "failed";
      run.completedAt = now();
      saveRun(run);
      if (run.mode === "live" && successes > 0)
        scheduleCompetitorCollection(run);
      else ensureOpportunities(store, run);
    }
  }
  function tick() {
    if (closed) return;
    finishRuns();
    for (const run of store
      .all<Run>("runs")
      .filter((value) => ["queued", "running"].includes(value.status))) {
      if (run.status === "queued") {
        run.status = "running";
        store.put("runs", run);
      }
      for (const result of run.results.filter(
        (value) => value.status === "queued",
      )) {
        if (active.size >= 2) return;
        if (active.has(result.id)) continue;
        active.add(result.id);
        const task = perform(run.id, result.id)
          .catch((error) => {
            const latest = requireEntity<Run>(
              store,
              "runs",
              run.id,
            ).results.find((value) => value.id === result.id)!;
            updateResult(run.id, {
              ...latest,
              status: "failed",
              error: "Internal execution error; this observation is excluded.",
              executedAt: now(),
            });
            console.error(
              "Worker observation failed",
              error instanceof Error ? error.name : "unknown",
            );
          })
          .finally(() => {
            active.delete(result.id);
            if (!closed) finishRuns();
          });
        track(task);
      }
    }
  }
  const interval = options.worker === false ? undefined : setInterval(tick, 75);
  if (interval) interval.unref();

  app.get("/api/health", (_req, res) =>
    res.json({ ok: true, storage: "sqlite", mode: "local operator" }),
  );
  app.get("/api/bootstrap", (_req, res) => {
    const value: Bootstrap = {
      restaurants: store.all("restaurants"),
      banks: store.all("banks"),
      runs: store.all<Run>("runs").map((run) => metrics(store, run)),
      artifacts: store
        .all<ArtifactVersion>("artifacts")
        .map((artifact) => ({
          ...artifact,
          runId:
            artifact.runId ||
            store.get<Opportunity>("opportunities", artifact.opportunityId)
              ?.runId,
        })),
      sources: store.all("sources"),
      provider: providerInfo(),
      demoRestaurantId: DEMO_ID,
      preferredRestaurantId: store
        .all<Restaurant>("restaurants")
        .find((r) => !r.facts.some((f) => f.provenance === "synthetic"))?.id,
    };
    res.json(value);
  });
  app.post("/api/restaurants", (req, res) => {
    const confirmed = req.body?.confirmed === true;
    const website = textInput(req.body?.website, "website", 2000);
    try {
      validatePublicUrl(website);
    } catch (error) {
      throw new ApiError(
        400,
        error instanceof Error ? error.message : "Invalid website.",
      );
    }
    const restaurant: Restaurant = {
      id: id("restaurant"),
      name: textInput(req.body?.name, "name", 120),
      website: new URL(website).href,
      location: textInput(req.body?.location, "location", 300),
      cuisine: req.body?.cuisine
        ? textInput(req.body.cuisine, "cuisine", 120)
        : undefined,
      aliases: Array.isArray(req.body?.aliases)
        ? req.body.aliases
            .slice(0, 10)
            .map((v: unknown) => textInput(v, "alias", 140))
        : [],
      facts: factsInput(req.body?.facts, confirmed),
      createdAt: now(),
      ...(confirmed ? { confirmedAt: now() } : {}),
    };
    store.put("restaurants", restaurant);
    const source: SourceSnapshot = {
      id: id("source"),
      restaurantId: restaurant.id,
      url: restaurant.website,
      title: "Manually entered profile",
      sourceKind: "manual",
      fetchedAt: now(),
      contentHash: hash(restaurant),
      excerpt: `Operator-entered ${confirmed ? "reviewed" : "draft"} identity: ${restaurant.name}; ${restaurant.location}. ${restaurant.cuisine ? `Cuisine: ${restaurant.cuisine}.` : ""} ${restaurant.facts.map((f) => `${f.field}: ${f.value}`).join("; ")}. This source records manual input, not independent public website evidence or a claim of ownership.`,
      status: "succeeded",
      mode: "live",
    };
    store.put("sources", source);
    restaurant.facts = restaurant.facts.map((fact) => ({
      ...fact,
      sourceId: source.id,
    }));
    store.put("restaurants", restaurant);
    scheduleCollection(restaurant);
    res.status(201).json(restaurant);
  });
  app.post("/api/restaurants/:id/collect-sources", (req, res) => {
    const restaurant = requireEntity<Restaurant>(
      store,
      "restaurants",
      req.params.id,
    );
    if (restaurant.facts.some((f) => f.provenance === "synthetic"))
      throw new ApiError(
        400,
        "Synthetic fixtures have no public website to collect.",
      );
    scheduleCollection(restaurant);
    res.status(202).json({ status: "collecting" });
  });
  app.patch("/api/restaurants/:id", (req, res) => {
    const restaurant = requireEntity<Restaurant>(
      store,
      "restaurants",
      req.params.id,
    );
    if (req.body?.confirmed !== true)
      throw new ApiError(400, "Review the identity with confirmed: true.");
    const indexes = req.body.factIndexes ?? [];
    if (
      !Array.isArray(indexes) ||
      indexes.some(
        (i: unknown) =>
          !Number.isInteger(i) ||
          Number(i) < 0 ||
          Number(i) >= restaurant.facts.length,
      )
    )
      throw new ApiError(
        400,
        "factIndexes must contain valid profile-fact indexes.",
      );
    if (req.body.facts !== undefined)
      restaurant.facts.push(...factsInput(req.body.facts, true));
    if (req.body.aliases !== undefined) {
      if (!Array.isArray(req.body.aliases) || req.body.aliases.length > 10)
        throw new ApiError(400, "Use at most10 full restaurant aliases.");
      restaurant.aliases = req.body.aliases.map((v: unknown) =>
        textInput(v, "alias", 140),
      );
    }
    for (const index of indexes) {
      const fact = restaurant.facts[index];
      if (fact.provenance === "website") {
        const source = fact.sourceId
          ? store.get<SourceSnapshot>("sources", fact.sourceId)
          : undefined;
        if (
          !source ||
          source.status !== "succeeded" ||
          source.mode !== "live" ||
          source.scope === "competitor"
        )
          throw new ApiError(
            400,
            "A website fact needs its own successful target-source snapshot before acceptance.",
          );
      }
    }
    restaurant.confirmedAt = now();
    restaurant.facts = restaurant.facts.map((fact, index) =>
      indexes.includes(index) ? { ...fact, confirmed: true } : fact,
    );
    const confirmedCuisine = restaurant.facts.find(
      (f) => f.field === "cuisine" && f.confirmed,
    );
    if (confirmedCuisine) restaurant.cuisine = confirmedCuisine.value;
    const source: SourceSnapshot = {
      id: id("source"),
      restaurantId: restaurant.id,
      url: restaurant.website,
      title: "Profile review record",
      sourceKind: "manual",
      fetchedAt: now(),
      contentHash: hash({
        id: restaurant.id,
        indexes,
        facts: restaurant.facts,
      }),
      excerpt: `The local operator reviewed the identity ${restaurant.name}; ${restaurant.location}. Accepted fact indexes: ${indexes.join(", ") || "none"}. Original website/owner provenance and source references remain unchanged. This is a review audit record and does not assert ownership or permission to publish.`,
      status: "succeeded",
      mode: "live",
    };
    store.put("sources", source);
    res.json(store.put("restaurants", restaurant));
  });
  app.post("/api/restaurants/:id/query-banks", (req, res) => {
    const restaurant = requireEntity<Restaurant>(
      store,
      "restaurants",
      req.params.id,
    );
    const raw = req.body?.queries;
    if (
      raw !== undefined &&
      (!Array.isArray(raw) || raw.length < 1 || raw.length > 20)
    )
      throw new ApiError(
        400,
        "A question bank must contain between 1 and 20 questions.",
      );
    const prior = store
      .all<QueryBank>("banks")
      .filter((bank) => bank.restaurantId === restaurant.id);
    const queries: Query[] = raw
      ? raw.map((value: unknown) => {
          const record =
            typeof value === "string"
              ? { text: value }
              : (value as Record<string, unknown>);
          const text = textInput(record?.text, "question text", 700);
          const branded = record.branded === true;
          if (
            !branded &&
            [restaurant.name, ...restaurant.aliases].some((name) =>
              text.toLowerCase().includes(name.toLowerCase()),
            )
          )
            throw new ApiError(
              400,
              "Discovery questions must not contain the restaurant name. Mark a branded question explicitly.",
            );
          const intents = Array.isArray(record.intents)
            ? record.intents
                .slice(0, 6)
                .map((value) => textInput(value, "intent", 50))
            : ["custom"];
          return { id: id("query"), text, intents, branded };
        })
      : generateQuestions(restaurant);
    const normalized = queries.map((query) =>
      query.text.toLowerCase().replace(/[^\p{L}\p{N}]/gu, ""),
    );
    if (new Set(normalized).size !== normalized.length)
      throw new ApiError(
        400,
        "Remove duplicate questions before saving the bank.",
      );
    const bank: QueryBank = {
      id: id("bank"),
      restaurantId: restaurant.id,
      version: Math.max(0, ...prior.map((bank) => bank.version)) + 1,
      createdAt: now(),
      contentHash: hash(queries),
      queries,
    };
    res.status(201).json(store.put("banks", bank));
  });
  function idempotent(
    req: Request,
    operation: string,
    fingerprint: string,
    create: () => Run,
  ): Run {
    const key = requestKey(req);
    const prior = store.request(key);
    if (prior) {
      if (prior.operation !== operation || prior.fingerprint !== fingerprint)
        throw new ApiError(
          409,
          "This idempotency key was already used for a different request.",
        );
      return requireEntity<Run>(store, "runs", prior.entityId);
    }
    return store.transaction(() => {
      const run = create();
      store.saveRequest(key, operation, run.id, fingerprint);
      return run;
    });
  }
  app.post("/api/runs", (req, res) => {
    const bank = requireEntity<QueryBank>(
      store,
      "banks",
      textInput(req.body?.bankId, "bankId"),
    );
    const mode = req.body?.mode ?? "synthetic";
    if (!["synthetic", "live"].includes(mode))
      throw new ApiError(400, "Mode must be synthetic or live.");
    const run = idempotent(
      req,
      "start-run",
      hash({ bankId: bank.id, mode }),
      () => newRun(store, bank, mode),
    );
    res.status(202).json(run);
  });
  app.get("/api/runs/:id", (req, res) =>
    res.json(metrics(store, requireEntity<Run>(store, "runs", req.params.id))),
  );
  app.get("/api/runs/:id/results", (req, res) =>
    res.json(metrics(store, requireEntity<Run>(store, "runs", req.params.id))),
  );
  app.post("/api/runs/:id/rerun", (req, res) => {
    const source = requireEntity<Run>(store, "runs", req.params.id);
    if (["queued", "running"].includes(source.status))
      throw new ApiError(
        409,
        "Wait for the current run to finish before repeating it.",
      );
    const bank = requireEntity<QueryBank>(store, "banks", source.bankId);
    const run = idempotent(req, "rerun", hash({ sourceRunId: source.id }), () =>
      newRun(store, bank, source.mode, source),
    );
    res.status(202).json(run);
  });
  app.post("/api/runs/:id/retry-failed", (req, res) => {
    const run = requireEntity<Run>(store, "runs", req.params.id);
    if (["queued", "running"].includes(run.status))
      throw new ApiError(409, "The run is still active.");
    const settings = requireEntity<ProviderSettings>(store, "settings", run.id);
    const used = run.results.reduce((sum, result) => sum + result.attempts, 0);
    const retryable = run.results.filter(
      (result) => result.status === "failed" && result.attempts < 4,
    );
    if (!retryable.length || used >= settings.maxRequests)
      throw new ApiError(
        409,
        "No observations remain within the retry budget. Start a new run to try again.",
      );
    const retryIds = new Set(retryable.map((result) => result.id));
    for (const result of retryable)
      settings.retryCeilings[result.id] = Math.min(4, result.attempts + 2);
    run.results = run.results.map((result) =>
      retryIds.has(result.id)
        ? { ...result, status: "queued", error: undefined }
        : result,
    );
    run.status = "queued";
    delete run.completedAt;
    store.put("settings", settings);
    res.status(202).json(saveRun(run));
  });
  app.post("/api/runs/:id/collect-competitor-sources", (req, res) => {
    const run = requireEntity<Run>(store, "runs", req.params.id);
    scheduleCompetitorCollection(run);
    res.status(202).json({ status: "collecting" });
  });
  app.post("/api/runs/:id/reparse", (req, res) => {
    const run = requireEntity<Run>(store, "runs", req.params.id);
    if (["queued", "running"].includes(run.status))
      throw new ApiError(
        409,
        "Wait for this run to finish before reviewing extraction.",
      );
    const restaurant = requireEntity<Restaurant>(
      store,
      "restaurants",
      run.restaurantId,
    );
    const before = {
      parserVersion: run.parserVersion || "legacy-v1",
      metrics: run.metrics,
      appearances: run.results.map((r) => ({
        resultId: r.id,
        appearances: r.appearances,
      })),
    };
    run.results = run.results.map((result) =>
      result.status === "succeeded"
        ? { ...result, appearances: parseAnswer(result.rawAnswer, restaurant) }
        : result,
    );
    run.parserVersion = PARSER_VERSION;
    run.analysisRevision = (run.analysisRevision ?? 1) + 1;
    run.parsedAt = now();
    if (!run.sourceSnapshotIds)
      run.sourceSnapshotIds = store
        .all<SourceSnapshot>("sources")
        .filter(
          (s) =>
            s.restaurantId === restaurant.id &&
            s.scope !== "competitor" &&
            s.sourceKind !== "manual" &&
            s.fetchedAt <= run.createdAt,
        )
        .map((s) => s.id);
    const saved = saveRun(run);
    store.put("calls", {
      id: id("audit"),
      kind: "parser-review",
      runId: run.id,
      at: now(),
      before,
      after: {
        parserVersion: run.parserVersion,
        metrics: saved.metrics,
        appearances: saved.results.map((r) => ({
          resultId: r.id,
          appearances: r.appearances,
        })),
      },
      analysisRevision: run.analysisRevision,
    });
    res.json(saved);
  });
  app.get("/api/runs/:id/audit", (req, res) => {
    requireEntity<Run>(store, "runs", req.params.id);
    res.json(
      store
        .all<{ runId?: string; kind?: string }>("calls")
        .filter((record) => record.runId === req.params.id && record.kind),
    );
  });
  app.get("/api/runs/:id/report", (req, res) => {
    const run = requireEntity<Run>(store, "runs", req.params.id);
    const restaurant = requireEntity<Restaurant>(
      store,
      "restaurants",
      run.restaurantId,
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="tablesignal-${run.id}.json"`,
    );
    res.json({
      exportedAt: now(),
      run,
      restaurant,
      bank: requireEntity<QueryBank>(store, "banks", run.bankId),
      opportunities: ensureOpportunities(store, run),
      sources: store
        .all<SourceSnapshot>("sources")
        .filter(
          (s) =>
            s.restaurantId === restaurant.id &&
            (s.runId === run.id || run.sourceSnapshotIds?.includes(s.id)),
        ),
      limitations: [
        "This is a snapshot of the saved provider configuration and tested questions, not a universal ranking.",
        "Mention and recommendation presence are separate; explicit list positions are presentation order.",
        "Public-source review does not imply restaurant ownership or publication permission.",
      ],
    });
  });
  app.get("/api/runs/:id/opportunities", (req, res) =>
    res.json(
      ensureOpportunities(
        store,
        requireEntity<Run>(store, "runs", req.params.id),
      ),
    ),
  );
  app.post("/api/sources/:id/review", (req, res) => {
    const source = requireEntity<SourceSnapshot>(
      store,
      "sources",
      req.params.id,
    );
    if (typeof req.body?.accepted !== "boolean")
      throw new ApiError(400, "accepted must be true or false.");
    const before = source.review;
    source.review = {
      status: req.body.accepted ? "accepted" : "rejected",
      reason: textInput(req.body.reason, "review reason", 1500),
      reviewedAt: now(),
    };
    store.put("sources", source);
    store.put("calls", {
      id: id("audit"),
      kind: "source-review",
      runId: source.runId,
      sourceId: source.id,
      before,
      after: source.review,
      at: now(),
    });
    if (source.runId) {
      const run = store.get<Run>("runs", source.runId);
      if (run) {
        run.analysisRevision = (run.analysisRevision ?? 1) + 1;
        store.put("runs", run);
      }
    }
    res.json(source);
  });
  app.get("/api/sources/:id", (req, res) =>
    res.json(requireEntity<SourceSnapshot>(store, "sources", req.params.id)),
  );
  app.post("/api/opportunities/:id/artifacts", (req, res) => {
    const opportunity = requireEntity<Opportunity>(
      store,
      "opportunities",
      req.params.id,
    );
    const type = req.body?.type as ArtifactType;
    if (!opportunity.artifactTypes.includes(type))
      throw new ApiError(
        400,
        "Select an artifact type supported by this opportunity.",
      );
    res.status(201).json(createArtifact(store, opportunity, type));
  });
  app.patch("/api/artifacts/:id", (req, res) => {
    const artifact = requireEntity<ArtifactVersion>(
      store,
      "artifacts",
      req.params.id,
    );
    const content = textInput(req.body?.content, "content", 50_000);
    const opportunity = requireEntity<Opportunity>(
      store,
      "opportunities",
      artifact.opportunityId,
    );
    res
      .status(201)
      .json(
        createArtifact(store, opportunity, artifact.type, content, artifact),
      );
  });
  app.get("/api/artifacts/:id/export", (req, res) => {
    const artifact = requireEntity<ArtifactVersion>(
      store,
      "artifacts",
      req.params.id,
    );
    if (!artifact.validation.valid)
      throw new ApiError(
        409,
        "Resolve validation issues before exporting this artifact.",
      );
    const extension = artifact.type === "jsonld" ? "json" : "md";
    res.setHeader(
      "Content-Type",
      artifact.type === "jsonld"
        ? "application/ld+json; charset=utf-8"
        : "text/markdown; charset=utf-8",
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="tablesignal-${artifact.type}-v${artifact.version}.${extension}"`,
    );
    res.send(artifact.content);
  });
  app.get("/api/comparisons", (req, res) => {
    const before = requireEntity<Run>(
      store,
      "runs",
      textInput(req.query.before, "before"),
    );
    const after = requireEntity<Run>(
      store,
      "runs",
      textInput(req.query.after, "after"),
    );
    const comparison = compareRuns(
      before,
      after,
      requireEntity<QueryBank>(store, "banks", before.bankId),
      requireEntity<QueryBank>(store, "banks", after.bankId),
    );
    store.put("comparisons", { id: `${before.id}:${after.id}`, ...comparison });
    res.json(comparison);
  });
  app.use("/api", (_req, res) =>
    res.status(404).json({ error: "API endpoint not found." }),
  );
  const dist = resolve("dist");
  if (existsSync(dist)) {
    app.use(express.static(dist));
    app.get("/{*path}", (_req, res) =>
      res.sendFile(resolve(dist, "index.html")),
    );
  }
  app.use(((error, _req, res, _next) => {
    if (error instanceof ApiError)
      res.status(error.status).json({ error: error.message });
    else if (error instanceof SyntaxError)
      res.status(400).json({ error: "Request body must contain valid JSON." });
    else {
      console.error(
        "API request failed",
        error instanceof Error ? error.name : "unknown",
      );
      res.status(500).json({ error: "The request could not be completed." });
    }
  }) as ErrorRequestHandler);
  return {
    app,
    store,
    close: async () => {
      closed = true;
      if (interval) clearInterval(interval);
      await Promise.allSettled([...background]);
      store.close();
    },
  };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const runtime = createApplication();
  const port = boundedEnv("PORT", 3001, 1, 65535);
  const server = runtime.app.listen(port, "127.0.0.1", () =>
    console.log(`TableSignal API listening at http://127.0.0.1:${port}`),
  );
  const shutdown = () => {
    server.close(() => {
      void runtime.close().then(() => process.exit(0));
    });
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}
