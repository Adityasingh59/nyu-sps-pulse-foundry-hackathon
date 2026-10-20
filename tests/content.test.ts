import test from "node:test";
import assert from "node:assert/strict";
import {
  buildRealOpportunities,
  menuPriceAmbiguities,
} from "../server/real-analysis.ts";
import type { Restaurant, Run, SourceSnapshot } from "../shared/types.ts";
const restaurant = {
  id: "real",
  name: "John's of Bleecker Street",
  website: "https://johnsofbleecker.com/",
  location: "Greenwich Village",
  aliases: [],
  facts: [],
  createdAt: "2026-10-20T00:00:00Z",
} as Restaurant;
const run = {
  id: "live",
  restaurantId: "real",
  mode: "live",
  status: "completed",
  results: [],
  competitors: [],
} as unknown as Run;
const source = (
  id: string,
  fields: Partial<SourceSnapshot>,
): SourceSnapshot => ({
  id,
  restaurantId: "real",
  url: "https://johnsofbleecker.com/",
  title: "Public page",
  excerpt: "",
  mode: "live",
  status: "succeeded",
  fetchedAt: "2026-10-20T00:00:00Z",
  contentHash: "hash",
  sourceKind: "website",
  scope: "target",
  ...fields,
});
test("menu absence findings remain scoped to actual menu snapshots when homepage already contains Restaurant schema", () => {
  const home = source("home", {
    pageKind: "home",
    schemaTypes: ["Restaurant"],
  });
  const menu = source("menu", {
    url: "https://johnsofbleecker.com/food-menu",
    pageKind: "menu",
    schemaTypes: [],
    excerpt:
      "14-inch Pizza\n$22.00\nInspection metadata: No JSON-LD script found in inspected page HTML.",
  });
  const findings = buildRealOpportunities(run, restaurant, [home, menu], []);
  assert.match(findings[0].gap, /homepage already includes Restaurant/);
  assert.match(findings[0].gap, /specifically about the menu/);
  assert.ok(findings[0].sourceIds.includes("menu"));
  assert.match(findings[0].uncertainty, /not an explanation or prediction/);
});
test("manual review records and unobserved competitor sources never support website or competitor claims", () => {
  const manual = source("manual", {
    sourceKind: "manual",
    title: "Profile review record",
    excerpt: "No JSON-LD script found",
  });
  assert.deepEqual(buildRealOpportunities(run, restaurant, [manual], []), []);
  const fake = source("not-observed", {
    scope: "competitor",
    entityId: "not-observed",
    entityName: "Not observed",
    runId: "live",
    excerpt: "Frequently asked questions",
    schemaTypes: ["Menu"],
  });
  const menu = source("menu", {
    pageKind: "menu",
    excerpt: "Menu prices. No JSON-LD script found in inspected page HTML.",
  });
  const findings = buildRealOpportunities(run, restaurant, [menu, fake], []);
  assert.ok(
    findings.every(
      (f) => !f.sourceIds.includes("not-observed") && !f.competitorExample,
    ),
  );
});
test("price findings report the exact visible mismatch without choosing a replacement price", () => {
  const menu = source("menu", {
    pageKind: "menu",
    excerpt:
      'The Sasso\n$26.00\n14" Pizza. Only $3 more for a 16"\nThe Sasso\n$26.00\n16" Pizza',
  });
  assert.deepEqual(menuPriceAmbiguities(menu), [
    { name: "The Sasso", small: 26, large: 26 },
  ]);
  const finding = buildRealOpportunities(run, restaurant, [menu], []).find(
    (f) => f.title.includes("price differences"),
  )!;
  assert.match(finding.gap, /does not choose a corrected price/);
  assert.ok(finding.sourceIds.includes("menu"));
});

test("menu JSON-LD validates actual nested item and offer field types", async () => {
  const { validateArtifact } = await import("../server/content.ts");
  const data = {
    "@context": "https://schema.org",
    "@type": "Restaurant",
    name: "Example",
    hasMenu: {
      "@type": "Menu",
      url: "https://example.org/menu",
      hasMenuSection: [
        {
          "@type": "MenuSection",
          hasMenuItem: [
            {
              "@type": "MenuItem",
              name: "Pizza",
              offers: {
                "@type": "Offer",
                price: "22.00",
                priceCurrency: "USD",
              },
            },
          ],
        },
      ],
    },
  };
  assert.equal(validateArtifact("jsonld", JSON.stringify(data)).valid, true);
  data.hasMenu.hasMenuSection[0].hasMenuItem[0].offers.price = "not a price";
  assert.equal(validateArtifact("jsonld", JSON.stringify(data)).valid, false);
});
