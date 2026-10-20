import { competitorDomainMatches } from "./competitive-evidence.ts";
import type {
  Opportunity,
  Query,
  Restaurant,
  Run,
  SourceSnapshot,
} from "../shared/types.ts";
import { id } from "./store.ts";
const manual = (source: SourceSnapshot) =>
  source.sourceKind === "manual" ||
  /^(Owner-|Manually entered|Profile review)/.test(source.title);
export function menuPriceAmbiguities(
  source: SourceSnapshot,
): { name: string; small: number; large: number }[] {
  const lines = source.excerpt.split("\n");
  const entries: {
    name: string;
    price: number;
    size: number;
    promise: boolean;
  }[] = [];
  for (let i = 1; i < lines.length - 1; i++) {
    if (!/^\$\d+(?:\.\d{2})?$/.test(lines[i])) continue;
    const size = /^(14|16)["”]/.exec(lines[i + 1]);
    if (!size) continue;
    entries.push({
      name: lines[i - 1],
      price: Number(lines[i].slice(1)),
      size: Number(size[1]),
      promise: /only\s*\$3\s*more/i.test(lines[i + 1]),
    });
  }
  return entries
    .filter((e) => e.size === 14 && e.promise)
    .flatMap((small) => {
      const large = entries.find((e) => e.name === small.name && e.size === 16);
      return large && Math.abs(large.price - small.price - 3) > 0.005
        ? [{ name: small.name, small: small.price, large: large.price }]
        : [];
    })
    .filter((e, i, a) => a.findIndex((x) => x.name === e.name) === i);
}
export function buildRealOpportunities(
  run: Run,
  restaurant: Restaurant,
  sources: SourceSnapshot[],
  queries: Query[],
): Opportunity[] {
  if (run.mode !== "live" || ["queued", "running"].includes(run.status))
    return [];
  const target = sources.filter(
    (s) =>
      s.restaurantId === restaurant.id &&
      s.mode === "live" &&
      s.status === "succeeded" &&
      s.scope !== "competitor" &&
      s.review?.status !== "rejected" &&
      !manual(s),
  );
  if (!target.length) return [];
  const leading = new Set(
    run.competitors
      .filter((c) => !c.isTarget)
      .slice(0, 3)
      .map((c) => c.entityId),
  );
  const competitor = sources.filter(
    (s) =>
      s.restaurantId === restaurant.id &&
      s.mode === "live" &&
      s.status === "succeeded" &&
      s.scope === "competitor" &&
      s.runId === run.id &&
      leading.has(s.entityId || "") &&
      s.review?.status !== "rejected" &&
      competitorDomainMatches(s.url, s.entityName || ""),
  );
  const menu =
    target.find(
      (s) => s.pageKind === "menu" && !/drink|wine|cocktail/i.test(s.url),
    ) || target.find((s) => /food-menu|\/menus?\/?$/i.test(s.url));
  const home = target.find((s) => s.pageKind === "home") || target[0];
  const limitation =
    "This is a hypothesis about information clarity, not an explanation or prediction of AI visibility. Findings apply only to the cited snapshots, not uninspected pages. Provider responses can change independently of content edits. Public-source review does not grant publication permission.";
  const intents = (labels: string[]) =>
    labels.filter((label) => queries.some((q) => q.intents.includes(label)));
  const missed = (labels: string[]) =>
    run.results.filter(
      (r) =>
        r.status === "succeeded" &&
        queries
          .find((q) => q.id === r.queryId)
          ?.intents.some((t) => labels.includes(t)) &&
        !r.appearances.some(
          (a) => a.entityId === restaurant.id && a.recommended && !a.ambiguous,
        ),
    ).length;
  const opportunities: Opportunity[] = [];
  const add = (
    op: Omit<Opportunity, "id" | "runId" | "priority" | "uncertainty">,
  ) =>
    opportunities.push({
      id: id("opportunity"),
      runId: run.id,
      priority: opportunities.length + 1,
      uncertainty: limitation,
      ...op,
    });
  if (
    menu &&
    !menu.schemaTypes?.some((t) => ["Menu", "MenuItem"].includes(t)) &&
    /No JSON-LD script found/i.test(menu.excerpt)
  ) {
    const structuredCompetitor = competitor.find((s) =>
      s.schemaTypes?.some((t) => ["Menu", "MenuItem"].includes(t)),
    );
    add({
      title: "Make the public menu machine-readable",
      gap: `The inspected menu page (${menu.url}) displays item names and prices, but no JSON-LD script was found in that page’s HTML.${home.schemaTypes?.includes("Restaurant") ? " The homepage already includes Restaurant structured data; this finding is specifically about the menu page." : ""}`,
      sourceIds: [
        menu.id,
        home.id,
        ...(structuredCompetitor ? [structuredCompetitor.id] : []),
      ],
      competitorExample: structuredCompetitor
        ? `${structuredCompetitor.entityName} appears in the observed recommendations, and its cited snapshot contains ${structuredCompetitor.schemaTypes?.filter((t) => ["Menu", "MenuItem"].includes(t)).join("/")} structured data.`
        : undefined,
      intents: intents(["cuisine", "price", "preference"]),
      action:
        "Prepare Restaurant data linked to a Menu with only accepted, source-verified item names and prices. Check that the visible menu and embedded data match before any authorized publication.",
      effort: "medium",
      rationale: `This is directly supported by the saved HTML inspection and is under website-owner control. ${missed(["cuisine", "price", "preference"])} valid answers in these intents did not recommend the target in this run; that observation does not establish a cause.`,
      artifactTypes: ["jsonld", "faq"],
    });
  }
  const conflicts = menu ? menuPriceAmbiguities(menu) : [];
  if (menu && conflicts.length) {
    const example = conflicts[0];
    add({
      title: "Clarify pizza size and price differences",
      gap: `In the inspected menu, “${example.name}” lists a 14-inch pizza at $${example.small.toFixed(2)} and a 16-inch pizza at $${example.large.toFixed(2)}, while the 14-inch description says “Only $3 more” for a 16-inch. ${conflicts.length} size/price pair${conflicts.length === 1 ? " has" : "s have"} this wording mismatch. This needs business review; the application does not choose a corrected price.`,
      sourceIds: [menu.id],
      intents: intents(["price", "occasion"]),
      action:
        "Ask the business to reconcile the size/price wording. In the meantime, prepare a customer FAQ using only unambiguous, accepted base-size prices and link directly to the current menu.",
      effort: "low",
      rationale:
        "The issue is a directly inspectable ambiguity in the restaurant’s own menu. Avoid carrying uncertain specialty prices into structured data or generated copy.",
      artifactTypes: ["faq", "about"],
    });
  }
  const FAQtarget = target.some((s) =>
    /\b(?:frequently asked questions|frequently asked|FAQ)\b/i.test(s.excerpt),
  );
  if (!FAQtarget) {
    const faqCompetitor = competitor.find((s) =>
      /\b(?:frequently asked questions|FAQ)\b/i.test(s.excerpt),
    );
    const pages = target.slice(0, 4);
    add({
      title: "Create a clear, source-linked dining FAQ",
      gap: `The ${pages.length} cited, inspected pages contain restaurant/menu information but no “FAQ” or “frequently asked questions” heading in the saved text. Questions about group dining, hours and dietary needs were tested; unanswered facts remain unknown. This is a text-inspection finding, not proof that no FAQ exists elsewhere.`,
      sourceIds: [
        ...pages.map((s) => s.id),
        ...(faqCompetitor ? [faqCompetitor.id] : []),
      ],
      competitorExample: faqCompetitor
        ? `${faqCompetitor.entityName} was recommended in this run, and the cited page explicitly labels a FAQ. Its content is an example of information presentation, not evidence of why the model selected it.`
        : undefined,
      intents: intents(["occasion", "hours", "preference"]),
      action:
        "Draft a short FAQ from accepted identity, cuisine, posted hours and current menu facts. Direct reservations, allergy, accessibility and other unverified questions to the restaurant rather than guessing.",
      effort: "low",
      rationale: `A factual FAQ is reviewable and easy to export. ${missed(["occasion", "hours", "preference"])} valid answers across these intents did not recommend the target; no uplift is forecast.`,
      artifactTypes: ["faq", "about"],
    });
  }
  return opportunities.slice(0, 3);
}
