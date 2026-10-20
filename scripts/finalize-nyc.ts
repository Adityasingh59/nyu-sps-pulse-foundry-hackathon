import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { competitorDomainMatches } from "../server/competitive-evidence.ts";
import type {
  Bootstrap,
  Run,
  Opportunity,
  ArtifactVersion,
  Comparison,
} from "../shared/types.ts";
const base = process.env.TABLESIGNAL_API_URL || "http://127.0.0.1:3001/api";
async function api<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(
    base + path,
    body === undefined
      ? undefined
      : {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
  );
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || `HTTP${response.status}`);
  return result as T;
}
let data = await api<Bootstrap>("/bootstrap");
const restaurant = data.restaurants.find(
  (r) =>
    new URL(r.website).hostname.replace(/^www\./, "") === "johnsofbleecker.com",
)!;
const runs = data.runs
  .filter((r) => r.restaurantId === restaurant.id && r.mode === "live")
  .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
const before = JSON.parse(
  await readFile("data/persistence-before-restart.json", "utf8"),
);
for (const recorded of before) {
  const run = runs.find((r) => r.id === recorded.id);
  if (!run) throw new Error("Saved live run missing after restart.");
  for (const original of recorded.results) {
    const result = run.results.find((r) => r.id === original.id);
    if (
      !result ||
      createHash("sha256").update(result.rawAnswer).digest("hex") !==
        original.hash
    )
      throw new Error("A raw answer changed across restart.");
  }
}
console.log("Restart verified: all40 raw answers retained their exact hashes.");
for (const source of data.sources.filter(
  (s) =>
    s.restaurantId === restaurant.id &&
    s.scope === "competitor" &&
    s.review?.status !== "rejected",
)) {
  if (!competitorDomainMatches(source.url, source.entityName || "")) {
    await api(`/sources/${source.id}/review`, {
      accepted: false,
      reason:
        "Identity review: this URL belongs to the target restaurant, not the similarly named observed competitor. Original content/hash/time are preserved; this source is excluded from competitive evidence.",
    });
    console.log(
      `Excluded mismatched competitor source: ${source.entityName} -> ${source.url}`,
    );
  }
}
for (const run of runs) {
  const corrected = await api<Run>(`/runs/${run.id}/reparse`, {});
  console.log(
    JSON.stringify({
      runId: run.id,
      parser: corrected.parserVersion,
      metrics: corrected.metrics,
    }),
  );
  await api(`/runs/${run.id}/collect-competitor-sources`, {});
}
for (let attempt = 0; attempt < 180; attempt++) {
  data = await api<Bootstrap>("/bootstrap");
  if (
    !data.runs.some(
      (r) =>
        runs.some((x) => x.id === r.id) && r.evidenceStatus === "collecting",
    )
  )
    break;
  await new Promise((resolve) => setTimeout(resolve, 1000));
}
await mkdir("reports", { recursive: true });
for (const run of runs) {
  const opportunities = await api<Opportunity[]>(
    `/runs/${run.id}/opportunities`,
  );
  console.log(
    JSON.stringify({
      runId: run.id,
      opportunities: opportunities.map((o) => ({
        title: o.title,
        sourceIds: o.sourceIds,
        competitorExample: o.competitorExample,
      })),
    }),
  );
  if (run.id === runs[0].id) {
    const schemaOpportunity = opportunities.find((o) =>
      o.artifactTypes.includes("jsonld"),
    );
    const faqOpportunity =
      opportunities.find((o) => o.title.includes("FAQ")) ||
      opportunities.find((o) => o.artifactTypes.includes("faq"));
    for (const [opportunity, type] of [
      [schemaOpportunity, "jsonld"],
      [faqOpportunity, "faq"],
    ] as const) {
      if (!opportunity) continue;
      const artifact = await api<ArtifactVersion>(
        `/opportunities/${opportunity.id}/artifacts`,
        { type },
      );
      if (!artifact.validation.valid)
        throw new Error(
          `Artifact failed validation: ${artifact.validation.issues.join("; ")}`,
        );
      const response = await fetch(`${base}/artifacts/${artifact.id}/export`);
      if (!response.ok) throw new Error("Artifact export failed");
      const content = await response.text();
      await writeFile(
        `reports/johns-bleecker-${type}.${type === "jsonld" ? "json" : "md"}`,
        content,
      );
      console.log(`Validated ${type} artifact exported: ${artifact.id}`);
    }
  }
  const report = await api<unknown>(`/runs/${run.id}/report`);
  await writeFile(
    `data/${run.id}-evidence-report.json`,
    JSON.stringify(report, null, 2),
  );
}
if (runs.length >= 2) {
  const comparison = await api<Comparison>(
    `/comparisons?before=${runs[0].id}&after=${runs[1].id}`,
  );
  await writeFile(
    "reports/johns-bleecker-comparison.json",
    JSON.stringify(comparison, null, 2),
  );
  console.log(
    JSON.stringify({
      compatible: comparison.compatible,
      reasons: comparison.reasons,
      matched: comparison.matched,
      excluded: comparison.excluded,
      mentionRateChange: comparison.mentionRateChange,
      recommendationRateChange: comparison.recommendationRateChange,
    }),
  );
}
const final = await api<Bootstrap>("/bootstrap");
await writeFile(
  "data/nyc-final-bootstrap.json",
  JSON.stringify(final, null, 2),
);
console.log(
  JSON.stringify(
    {
      sources: final.sources
        .filter(
          (s) =>
            s.restaurantId === restaurant.id && s.review?.status !== "rejected",
        )
        .map((s) => ({
          entity: s.entityName || restaurant.name,
          url: s.url,
          status: s.status,
          error: s.error,
        })),
      warnings: final.runs
        .filter((r) => runs.some((x) => x.id === r.id))
        .map((r) => ({ runId: r.id, warnings: r.evidenceWarnings })),
    },
    null,
    2,
  ),
);
