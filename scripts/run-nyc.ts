import { writeFile } from "node:fs/promises";
import type { Bootstrap, QueryBank, Restaurant, Run } from "../shared/types.ts";
const base = process.env.TABLESIGNAL_API_URL || "http://127.0.0.1:3001/api";
async function request<T>(
  path: string,
  body?: unknown,
  method = "POST",
): Promise<T> {
  const response = await fetch(
    base + path,
    body === undefined
      ? undefined
      : {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
  );
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || `HTTP${response.status}`);
  return result as T;
}
const data = await request<Bootstrap>("/bootstrap");
const restaurant = data.restaurants.find(
  (r) =>
    new URL(r.website).hostname.replace(/^www\./, "") === "johnsofbleecker.com",
);
if (!restaurant)
  throw new Error(
    "Run npm run setup:nyc first, then review the actual collected source facts.",
  );
if (restaurant.collectionStatus === "collecting")
  throw new Error(
    "Source collection is still running. Review the saved evidence before starting.",
  );
if (!restaurant.confirmedAt)
  throw new Error(
    "Review the identity and website facts in Restaurant settings before starting.",
  );
const questionTexts: [string, string[]][] = [
  [
    "Where can I get a sit-down pizza dinner in Greenwich Village, New York City?",
    ["cuisine", "locality"],
  ],
  [
    "Which restaurants serve coal-fired pizza in Greenwich Village?",
    ["cuisine"],
  ],
  [
    "Where can a group share whole pizzas near Washington Square Park?",
    ["occasion", "locality"],
  ],
  [
    "What are good pizza restaurants within walking distance of NYU in Manhattan?",
    ["distance", "cuisine"],
  ],
  [
    "Where can I buy a whole pizza for under $30 in Greenwich Village?",
    ["price"],
  ],
  [
    "Where can two people share a pizza dinner in Greenwich Village on a $50 food budget?",
    ["price", "occasion"],
  ],
  [
    "Where can I get lunch for under $20 near Washington Square Park?",
    ["price", "locality"],
  ],
  [
    "What are affordable Italian dinner options near NYU?",
    ["price", "cuisine"],
  ],
  [
    "Which Greenwich Village restaurants would you suggest for a casual dinner with friends?",
    ["occasion"],
  ],
  [
    "Where should a visitor try traditional New York pizza in Greenwich Village?",
    ["cuisine", "occasion"],
  ],
  [
    "Which pizza places in Greenwich Village offer indoor sit-down dining?",
    ["occasion"],
  ],
  [
    "What are relaxed pizza dinner options for a casual date in Greenwich Village?",
    ["occasion"],
  ],
  [
    "Where can a family eat pizza near Washington Square Park?",
    ["occasion", "locality"],
  ],
  [
    "Where can a group with vegetarian diners find pizza in Greenwich Village?",
    ["preference"],
  ],
  [
    "Which Greenwich Village restaurants publish a clear food menu with prices online?",
    ["preference", "price"],
  ],
  [
    "Where can I find a walk-in pizza dinner in Greenwich Village without a reservation?",
    ["preference", "occasion"],
  ],
  [
    "What pizza restaurants in Greenwich Village are open for dinner after 10pm on a Friday?",
    ["hours", "occasion"],
  ],
  [
    "Where can I order pizza for pickup in Greenwich Village?",
    ["preference", "locality"],
  ],
  [
    "Which pizza restaurants near NYU provide clear information about ingredients or dietary questions?",
    ["preference"],
  ],
  [
    "Where can a group find both pizza and pasta for dinner in Greenwich Village?",
    ["cuisine", "occasion"],
  ],
];
let bank = data.banks.find(
  (b) =>
    b.restaurantId === restaurant.id &&
    b.queries.length === 20 &&
    b.queries[0]?.text === questionTexts[0][0],
);
if (!bank)
  bank = await request<QueryBank>(`/restaurants/${restaurant.id}/query-banks`, {
    queries: questionTexts.map(([text, intents]) => ({
      text,
      intents,
      branded: false,
    })),
  });
const rerun = process.argv.includes("--rerun");
const existing = data.runs
  .filter((r) => r.restaurantId === restaurant.id && r.mode === "live")
  .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
let run: Run;
if (rerun) {
  if (!existing.length) throw new Error("No live baseline exists to repeat.");
  run = await request<Run>(`/runs/${existing[0].id}/rerun`, {
    idempotencyKey: "johns-live-followup-v1",
  });
} else
  run = await request<Run>("/runs", {
    bankId: bank.id,
    mode: "live",
    idempotencyKey: "johns-live-baseline-v1",
  });
console.log(
  `Live ${rerun ? "follow-up" : "baseline"} saved: ${run.id}. Provider: ${run.provider}; model: ${run.model}.`,
);
let last = "";
for (;;) {
  run = await request<Run>(`/runs/${run.id}`);
  const status = `${run.status}: ${run.results.filter((r) => r.status === "succeeded").length} valid completions, ${run.results.filter((r) => r.status === "failed").length} failed, ${run.results.filter((r) => r.status === "queued" || r.status === "running").length} pending.`;
  if (status !== last) {
    console.log(status);
    last = status;
    await writeFile("data/nyc-latest-run.json", JSON.stringify(run, null, 2));
  }
  if (!["queued", "running"].includes(run.status)) break;
  await new Promise((resolve) => setTimeout(resolve, 2000));
}
console.log(
  JSON.stringify(
    {
      runId: run.id,
      status: run.status,
      metrics: run.metrics,
      competitors: run.competitors,
      failures: run.results
        .filter((r) => r.status === "failed")
        .map((r) => ({ queryId: r.queryId, error: r.error })),
    },
    null,
    2,
  ),
);
