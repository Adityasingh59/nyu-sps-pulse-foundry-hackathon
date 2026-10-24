import { writeFile } from "node:fs/promises";
import type { Bootstrap, Restaurant } from "../shared/types.ts";
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
let data = await request<Bootstrap>("/bootstrap");
let restaurant = data.restaurants.find(
  (r) =>
    new URL(r.website).hostname.replace(/^www\./, "") === "johnsofbleecker.com",
);
if (!restaurant)
  restaurant = await request<Restaurant>("/restaurants", {
    name: "John's of Bleecker Street",
    businessType: "restaurant",
    website: "https://johnsofbleecker.com/",
    location: "Greenwich Village, New York City",
    aliases: [
      "John's of Bleecker St.",
      "John’s of Bleecker Street",
      "John’s of Bleecker St.",
    ],
  });
console.log(
  `Restaurant saved: ${restaurant.name} (${restaurant.id}). Collecting official public pages; facts remain unreviewed.`,
);
for (let attempt = 0; attempt < 120; attempt++) {
  data = await request<Bootstrap>("/bootstrap");
  restaurant = data.restaurants.find((r) => r.id === restaurant!.id)!;
  if (restaurant.collectionStatus !== "collecting") break;
  await new Promise((resolve) => setTimeout(resolve, 1000));
}
const sources = data.sources.filter(
  (s) => s.restaurantId === restaurant!.id && s.sourceKind !== "manual",
);
await writeFile(
  "data/nyc-profile-review.json",
  JSON.stringify({ restaurant, sources }, null, 2),
);
console.log(
  JSON.stringify(
    {
      id: restaurant.id,
      status: restaurant.collectionStatus,
      facts: restaurant.facts.map((f, i) => ({
        index: i,
        field: f.field,
        value: f.value,
        sourceId: f.sourceId,
        confirmed: f.confirmed,
      })),
      sources: sources.map((s) => ({
        id: s.id,
        url: s.url,
        status: s.status,
        error: s.error,
        schemaIssues: s.schemaIssues,
        contentTruncated: s.contentTruncated,
      })),
    },
    null,
    2,
  ),
);
