import type {
  Appearance,
  Comparison,
  Competitor,
  Metrics,
  Query,
  QueryBank,
  QueryResult,
  Run,
} from "./types";

const pairKey = (result: QueryResult) =>
  `${result.queryId}\u0000${result.sampleId}`;
const percentage = (numerator: number, denominator: number): number | null =>
  denominator ? (numerator / denominator) * 100 : null;

/** A retried observation is still one question/sample pair. */
function observations(
  results: QueryResult[],
  queries?: Query[],
): QueryResult[] {
  const allowed =
    queries &&
    new Set(queries.filter((query) => !query.branded).map((query) => query.id));
  const unique = new Map<string, QueryResult>();
  for (const result of results) {
    if (allowed && !allowed.has(result.queryId)) continue;
    const previous = unique.get(pairKey(result));
    if (
      !previous ||
      result.status === "succeeded" ||
      previous.status !== "succeeded"
    )
      unique.set(pairKey(result), result);
  }
  return [...unique.values()];
}

function ambiguousTarget(result: QueryResult, targetId: string): boolean {
  return result.appearances.some(
    (appearance) => appearance.entityId === targetId && appearance.ambiguous,
  );
}

function recommendations(result: QueryResult): Appearance[] {
  const entities = new Map<string, Appearance>();
  for (const appearance of result.appearances) {
    if (!appearance.recommended || appearance.ambiguous) continue;
    const previous = entities.get(appearance.entityId);
    if (
      !previous ||
      (appearance.position !== null &&
        (previous.position === null || appearance.position < previous.position))
    ) {
      entities.set(appearance.entityId, appearance);
    }
  }
  return [...entities.values()];
}

export function calculateMetrics(
  results: QueryResult[],
  targetId: string,
  queries?: Query[],
): Metrics {
  const attempted = observations(results, queries);
  const excludedAmbiguous = attempted.filter(
    (result) =>
      result.status === "succeeded" && ambiguousTarget(result, targetId),
  ).length;
  const valid = attempted.filter(
    (result) =>
      result.status === "succeeded" && !ambiguousTarget(result, targetId),
  );
  let mentions = 0;
  let recommendationCount = 0;
  let totalRecommendationAppearances = 0;
  const positions: number[] = [];
  for (const result of valid) {
    if (
      result.appearances.some(
        (appearance) =>
          appearance.entityId === targetId &&
          appearance.mention &&
          !appearance.ambiguous,
      )
    )
      mentions++;
    const recommended = recommendations(result);
    totalRecommendationAppearances += recommended.length;
    const target = recommended.find(
      (appearance) => appearance.entityId === targetId,
    );
    if (target) {
      recommendationCount++;
      if (
        target.position !== null &&
        Number.isFinite(target.position) &&
        target.position > 0
      )
        positions.push(target.position);
    }
  }
  return {
    attempted: attempted.length,
    valid: valid.length,
    excludedAmbiguous,
    mentions,
    recommendations: recommendationCount,
    mentionRate: percentage(mentions, valid.length),
    recommendationRate: percentage(recommendationCount, valid.length),
    averagePosition: positions.length
      ? positions.reduce((sum, position) => sum + position, 0) /
        positions.length
      : null,
    positionSamples: positions.length,
    shareOfVoice: percentage(
      recommendationCount,
      totalRecommendationAppearances,
    ),
    coverage: percentage(valid.length, attempted.length),
    totalRecommendationAppearances,
  };
}

export function rankCompetitors(
  results: QueryResult[],
  targetId: string,
  queries?: Query[],
): Competitor[] {
  const counts = new Map<
    string,
    { name: string; count: number; positions: number[] }
  >();
  let total = 0;
  for (const result of observations(results, queries)) {
    if (result.status !== "succeeded" || ambiguousTarget(result, targetId))
      continue;
    for (const appearance of recommendations(result)) {
      const entry = counts.get(appearance.entityId) ?? {
        name: appearance.name,
        count: 0,
        positions: [],
      };
      entry.count++;
      total++;
      if (
        appearance.position !== null &&
        Number.isFinite(appearance.position) &&
        appearance.position > 0
      )
        entry.positions.push(appearance.position);
      counts.set(appearance.entityId, entry);
    }
  }
  return [...counts]
    .map(([entityId, entry]) => ({
      entityId,
      name: entry.name,
      appearances: entry.count,
      shareOfVoice: (entry.count / total) * 100,
      averagePosition: entry.positions.length
        ? entry.positions.reduce((sum, position) => sum + position, 0) /
          entry.positions.length
        : null,
      isTarget: entityId === targetId,
    }))
    .sort(
      (a, b) => b.appearances - a.appearances || a.name.localeCompare(b.name),
    );
}

export function compareRuns(
  before: Run,
  after: Run,
  beforeBank: QueryBank,
  afterBank: QueryBank,
): Comparison {
  const reasons: string[] = [];
  if (before.restaurantId !== after.restaurantId)
    reasons.push("Restaurant identities differ.");
  if (before.bankId !== beforeBank.id || after.bankId !== afterBank.id)
    reasons.push("A supplied question bank does not belong to its run.");
  if (
    beforeBank.restaurantId !== before.restaurantId ||
    afterBank.restaurantId !== after.restaurantId
  )
    reasons.push("A supplied question bank belongs to a different restaurant.");
  if (beforeBank.contentHash !== afterBank.contentHash)
    reasons.push("Question bank content changed.");
  for (const [field, label] of [
    ["mode", "Evidence mode"],
    ["provider", "Provider"],
    ["model", "Model"],
    ["settingsHash", "Model settings"],
    ["promptVersion", "Prompt template"],
    ["retrieval", "Retrieval configuration"],
  ] as const) {
    if (before[field] !== after[field]) reasons.push(`${label} changed.`);
  }
  if (
    (before.parserVersion || "legacy-v1") !==
    (after.parserVersion || "legacy-v1")
  )
    reasons.push(
      "Answer parser version changed; review both runs under the same parser before comparing.",
    );
  const first = observations(before.results, beforeBank.queries);
  const second = observations(after.results, afterBank.queries);
  const secondMap = new Map(second.map((result) => [pairKey(result), result]));
  const beforeQueries = new Map(
    beforeBank.queries.map((query) => [query.id, query]),
  );
  const afterQueries = new Map(
    afterBank.queries.map((query) => [query.id, query]),
  );
  const union = new Set([...first, ...second].map(pairKey));
  const matchedBefore: QueryResult[] = [];
  const matchedAfter: QueryResult[] = [];
  for (const result of first) {
    const counterpart = secondMap.get(pairKey(result));
    if (
      !counterpart ||
      result.status !== "succeeded" ||
      counterpart.status !== "succeeded"
    )
      continue;
    if (
      ambiguousTarget(result, before.restaurantId) ||
      ambiguousTarget(counterpart, after.restaurantId)
    )
      continue;
    if (
      beforeQueries.get(result.queryId)?.text !==
      afterQueries.get(result.queryId)?.text
    )
      continue;
    matchedBefore.push(result);
    matchedAfter.push(counterpart);
  }
  const compatible = reasons.length === 0;
  const beforeMetrics = compatible
    ? calculateMetrics(matchedBefore, before.restaurantId)
    : null;
  const afterMetrics = compatible
    ? calculateMetrics(matchedAfter, after.restaurantId)
    : null;
  const difference = (
    left: number | null | undefined,
    right: number | null | undefined,
  ) => (left == null || right == null ? null : right - left);
  const excluded = union.size - matchedBefore.length;
  const sampleCounts = (results: QueryResult[]) => {
    const counts = new Map<string, number>();
    for (const result of results)
      counts.set(result.queryId, (counts.get(result.queryId) ?? 0) + 1);
    return counts;
  };
  const beforeSamples = sampleCounts(first);
  const afterSamples = sampleCounts(second);
  const unevenSamples = [
    ...new Set([...beforeSamples.keys(), ...afterSamples.keys()]),
  ].some((id) => beforeSamples.get(id) !== afterSamples.get(id));
  const limitations = [
    "Results describe these question/sample pairs and saved provider settings; changes do not establish causation.",
    "Observed positions apply only to explicit recommendation lists.",
  ];
  if (excluded)
    limitations.push(
      `${excluded} observation pair${excluded === 1 ? " was" : "s were"} excluded because of a missing, failed, unresolved, or unmatched result.`,
    );
  if (unevenSamples)
    limitations.push(
      "Sample counts differ; only sample IDs completed validly in both runs are included.",
    );
  if (!matchedBefore.length)
    limitations.push("No matched valid observations are available.");
  return {
    beforeRunId: before.id,
    afterRunId: after.id,
    compatible,
    reasons,
    matched: matchedBefore.length,
    excluded,
    beforeMetrics,
    afterMetrics,
    mentionRateChange: difference(
      beforeMetrics?.mentionRate,
      afterMetrics?.mentionRate,
    ),
    recommendationRateChange: difference(
      beforeMetrics?.recommendationRate,
      afterMetrics?.recommendationRate,
    ),
    pairs: matchedBefore.map((result, index) => ({
      queryId: result.queryId,
      beforeMention: result.appearances.some(
        (appearance) =>
          appearance.entityId === before.restaurantId &&
          appearance.mention &&
          !appearance.ambiguous,
      ),
      afterMention: matchedAfter[index].appearances.some(
        (appearance) =>
          appearance.entityId === after.restaurantId &&
          appearance.mention &&
          !appearance.ambiguous,
      ),
    })),
    limitations,
  };
}
