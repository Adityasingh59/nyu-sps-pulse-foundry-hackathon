import { buildRealOpportunities } from "./real-analysis.ts";
import type {
  ArtifactType,
  ArtifactVersion,
  Opportunity,
  Restaurant,
  Run,
  SourceSnapshot,
  QueryBank,
} from "../shared/types.ts";
import { hash, id, now } from "./store.ts";

import type { RecordStore as Store } from "./record-store.ts";

async function sourcesFor(store: Store, restaurantId: string) {
  return (await store.all<SourceSnapshot>("sources")).filter(
    (source) => source.restaurantId === restaurantId,
  );
}
export async function ensureOpportunities(
  store: Store,
  run: Run,
): Promise<Opportunity[]> {
  return store.transaction(() => buildOpportunities(store, run));
}
async function buildOpportunities(
  store: Store,
  run: Run,
): Promise<Opportunity[]> {
  const saved = (await store.all<Opportunity>("opportunities")).filter(
    (opportunity) =>
      opportunity.runId === run.id &&
      (opportunity.revision ?? 1) === (run.analysisRevision ?? 1),
  );
  if (saved.length) return saved;
  if (
    ["queued", "running"].includes(run.status) ||
    run.evidenceStatus === "collecting"
  )
    return [];
  const restaurant = (await store.get<Restaurant>(
    "restaurants",
    run.restaurantId,
  ))!;
  const sources = (await sourcesFor(store, restaurant.id)).filter((source) =>
    source.scope === "competitor"
      ? source.runId === run.id
      : !run.sourceSnapshotIds || run.sourceSnapshotIds.includes(source.id),
  );
  if (run.mode === "live" || restaurant.businessType === "business") {
    const bank = await store.get<QueryBank>("banks", run.bankId);
    const findings = buildRealOpportunities(
      run,
      restaurant,
      sources,
      bank?.queries || [],
    );
    if (findings.length) {
      for (const finding of findings)
        await store.put("opportunities", {
          ...finding,
          revision: run.analysisRevision ?? 1,
        });
      return findings;
    }
    if (restaurant.businessType === "business") return [];
  }
  const successful = sources.filter(
    (source) =>
      source.status === "succeeded" &&
      source.sourceKind !== "manual" &&
      !/^(Owner-|Manually entered|Profile review)/.test(source.title),
  );
  const sourceIds = successful.slice(0, 2).map((source) => source.id);
  const competitorSource = successful.find(
    (source) =>
      source.mode === "synthetic" && source.title.includes("Village Hearth"),
  );
  // Answer mode does not describe source provenance. A real restaurant can use
  // synthetic answers while retaining independently collected website evidence.
  const fictionalFixture =
    restaurant.id === "restaurant_linden" &&
    successful.some(
      (source) =>
        source.mode === "synthetic" && source.id === "source_linden_home",
    ) &&
    successful.some(
      (source) =>
        source.mode === "synthetic" && source.id === "source_linden_menu",
    );
  const syntheticEvidence = sources.some(
    (source) => source.mode === "synthetic",
  );
  const evidenceLimitation =
    "This finding is limited to the cited source snapshots. Missing or inaccessible evidence does not prove information is absent elsewhere. Content changes have no predicted or demonstrated causal effect on public AI recommendations.";
  const uncertainty = syntheticEvidence
    ? `The cited evidence includes explicitly labeled synthetic source fixtures. These illustrate a review workflow and do not explain real AI visibility. ${evidenceLimitation}`
    : run.mode === "synthetic"
      ? `The recommendation answers in this run are synthetic examples, not measurements of a live provider. Source snapshots retain their recorded provenance and collection times. ${evidenceLimitation}`
      : `${evidenceLimitation} A single provider run does not establish causation.`;
  const opportunities: Opportunity[] = [];
  if (successful.length) {
    const relevant =
      successful.find((source) => /menu|price|\$|FAQ/i.test(source.excerpt)) ??
      successful[0];
    opportunities.push({
      id: id("opportunity"),
      runId: run.id,
      title: "Make dining details easier to find",
      gap: fictionalFixture
        ? "The fictional homepage introduces the restaurant, while the separate menu snapshot contains the actual dish details. The inspected homepage has no direct dining FAQ."
        : `The inspected pages provide material for a concise, source-linked dining profile. Review which details a customer still needs for the tested questions; no automated absence claim has been made.`,
      sourceIds: [
        ...new Set([
          ...sourceIds,
          relevant.id,
          ...(competitorSource ? [competitorSource.id] : []),
        ]),
      ],
      competitorExample:
        fictionalFixture && competitorSource
          ? "Village Hearth’s fictional menu snapshot presents example dishes and prices together. This is an illustration, not a verified real competitor advantage."
          : undefined,
      intents: ["price", "cuisine", "locality"],
      action:
        "Prepare a short FAQ from confirmed facts, with a clear link to the menu and direct confirmation for unknown details.",
      effort: "low",
      priority: 1,
      rationale:
        "Clear customer answers are under the owner’s control and can be reviewed against the saved evidence.",
      uncertainty,
      artifactTypes: ["faq", "about"],
    });
    opportunities.push({
      id: id("opportunity"),
      runId: run.id,
      title: "Give your restaurant a consistent introduction",
      gap: fictionalFixture
        ? "The fictional homepage says “seasonal neighborhood kitchen” without connecting the name, locality, cuisine, and menu in one concise passage."
        : "A consistent introduction can make the confirmed identity and known facts easier for customers to understand. The collected snapshots require owner review before they become profile facts.",
      sourceIds,
      intents: ["cuisine", "locality", "occasion"],
      action:
        "Draft a concise about section using confirmed identity and profile facts. Keep unverified suitability, hours, and dietary claims out of the copy.",
      effort: "low",
      priority: 2,
      rationale:
        "A small, reviewable content improvement is feasible without inventing business claims.",
      uncertainty,
      artifactTypes: ["about", "faq"],
    });
    const schemaSource = successful.find((source) =>
      /No JSON-LD script found/i.test(source.excerpt),
    );
    if (schemaSource)
      opportunities.push({
        id: id("opportunity"),
        runId: run.id,
        title: "Describe verified facts with structured data",
        gap: `No JSON-LD script was found in the inspected snapshot: ${schemaSource.title}. This says nothing about uninspected pages or other schema formats.`,
        sourceIds: [schemaSource.id],
        intents: ["cuisine", "locality"],
        action:
          "Prepare Restaurant JSON-LD from confirmed facts, then check it matches the visible page before publication.",
        effort: "medium",
        priority: 3,
        rationale:
          "Machine-readable identity is straightforward to validate, while discoverability impact remains unproven.",
        uncertainty,
        artifactTypes: ["jsonld"],
      });
  } else if (sources.length || restaurant.facts.some((f) => f.confirmed)) {
    const manualSource = sources[0];
    if (manualSource)
      opportunities.push({
        id: id("opportunity"),
        runId: run.id,
        title: "Establish a verifiable information baseline",
        gap: "No usable public website snapshot is available. This is an evidence limitation, not evidence that information is missing from the website.",
        sourceIds: sources.slice(0, 3).map((source) => source.id),
        intents: ["locality", "cuisine"],
        action:
          "Use confirmed owner facts to prepare a draft, then check the website manually before publication.",
        effort: "low",
        priority: 1,
        rationale:
          "Reliable facts are needed before diagnosing information gaps.",
        uncertainty,
        artifactTypes: ["about", "faq", "jsonld"],
      });
  }
  for (const opportunity of opportunities)
    await store.put("opportunities", opportunity);
  return opportunities;
}

export function validateArtifact(
  type: ArtifactType,
  content: string,
): ArtifactVersion["validation"] {
  const issues: string[] = [];
  if (!content.trim()) issues.push("Content cannot be empty.");
  if (content.length > 50_000)
    issues.push("Content exceeds the 50,000 character limit.");
  if (type === "jsonld") {
    try {
      const data = JSON.parse(content) as Record<string, unknown>;
      if (!data || Array.isArray(data) || typeof data !== "object")
        issues.push("JSON-LD must be an object.");
      else {
        if (data["@context"] !== "https://schema.org")
          issues.push("@context must be https://schema.org.");
        if (!["Restaurant", "Organization"].includes(String(data["@type"])))
          issues.push("@type must be Restaurant or Organization.");
        if (
          data["@type"] === "Organization" &&
          ["hasMenu", "menu", "servesCuisine"].some((field) => field in data)
        )
          issues.push(
            "Organization drafts must not include restaurant menu or cuisine fields.",
          );
        if (typeof data.name !== "string" || !data.name.trim())
          issues.push("name must be a non-empty string.");
        for (const field of [
          "url",
          "address",
          "servesCuisine",
          "description",
          "menu",
          "priceRange",
          "openingHours",
          "telephone",
        ])
          if (
            field in data &&
            typeof data[field] !== "string" &&
            !(
              field === "address" &&
              typeof data[field] === "object" &&
              data[field] !== null &&
              !Array.isArray(data[field])
            )
          )
            issues.push(
              `${field} must have the intended string value${field === "address" ? " or PostalAddress object" : ""}.`,
            );
        if (
          data.address &&
          typeof data.address === "object" &&
          !Array.isArray(data.address)
        ) {
          const address = data.address as Record<string, unknown>;
          if (address["@type"] !== "PostalAddress")
            issues.push("address object must have @type PostalAddress.");
          for (const field of [
            "streetAddress",
            "addressLocality",
            "addressRegion",
            "postalCode",
            "addressCountry",
          ])
            if (field in address && typeof address[field] !== "string")
              issues.push(`address.${field} must be a string.`);
        }
        if (typeof data.url === "string") {
          try {
            if (!["https:", "http:"].includes(new URL(data.url).protocol))
              issues.push("url must use HTTP(S).");
          } catch {
            issues.push("url must be valid.");
          }
        }
        if ("hasMenu" in data) {
          const menu = data.hasMenu as Record<string, unknown>;
          if (
            !menu ||
            typeof menu !== "object" ||
            Array.isArray(menu) ||
            menu["@type"] !== "Menu"
          )
            issues.push("hasMenu must be a Menu object.");
          else {
            if (typeof menu.url !== "string" || !/^https?:\/\//i.test(menu.url))
              issues.push("hasMenu.url must be an HTTP(S) URL.");
            if (
              !Array.isArray(menu.hasMenuSection) ||
              !menu.hasMenuSection.length
            )
              issues.push("hasMenu.hasMenuSection must be a non-empty array.");
            else
              for (const section of menu.hasMenuSection) {
                if (
                  !section ||
                  typeof section !== "object" ||
                  section["@type"] !== "MenuSection" ||
                  !Array.isArray(section.hasMenuItem) ||
                  !section.hasMenuItem.length
                ) {
                  issues.push(
                    "Each menu section must contain MenuItem entries.",
                  );
                  continue;
                }
                for (const item of section.hasMenuItem) {
                  if (
                    !item ||
                    typeof item !== "object" ||
                    item["@type"] !== "MenuItem" ||
                    typeof item.name !== "string" ||
                    !item.name.trim()
                  ) {
                    issues.push(
                      "Each menu item needs @type MenuItem and a name.",
                    );
                    continue;
                  }
                  const offer = item.offers;
                  if (
                    !offer ||
                    typeof offer !== "object" ||
                    offer["@type"] !== "Offer" ||
                    !["string", "number"].includes(typeof offer.price) ||
                    !Number.isFinite(Number(offer.price)) ||
                    Number(offer.price) < 0 ||
                    typeof offer.priceCurrency !== "string" ||
                    !/^[A-Z]{3}$/.test(offer.priceCurrency)
                  )
                    issues.push(
                      "Menu item offers need a finite nonnegative price and a three-letter currency.",
                    );
                }
              }
          }
        }
        if ("aggregateRating" in data || "review" in data)
          issues.push(
            "Ratings and reviews require independently verified provenance and are not supported.",
          );
      }
    } catch {
      issues.push("Content is not valid JSON.");
    }
  }
  return { valid: issues.length === 0, issues };
}
export async function createArtifact(
  store: Store,
  opportunity: Opportunity,
  type: ArtifactType,
  edited?: string,
  previous?: ArtifactVersion,
): Promise<ArtifactVersion> {
  return store.transaction(() =>
    buildArtifact(store, opportunity, type, edited, previous),
  );
}
async function buildArtifact(
  store: Store,
  opportunity: Opportunity,
  type: ArtifactType,
  edited?: string,
  previous?: ArtifactVersion,
): Promise<ArtifactVersion> {
  const run = (await store.get<Run>("runs", opportunity.runId))!;
  const restaurant = (await store.get<Restaurant>(
    "restaurants",
    run.restaurantId,
  ))!;
  const generic = restaurant.businessType === "business";
  const sourceRecords = await store.all<SourceSnapshot>("sources");
  const verified = restaurant.facts.filter(
    (fact) =>
      fact.confirmed &&
      (!fact.sourceId ||
        sourceRecords.find((s) => s.id === fact.sourceId)?.review?.status !==
          "rejected"),
  );
  const fact = (field: string) =>
    verified.find((value) => value.field === field)?.value;
  const cuisine =
    fact("cuisine") ||
    (verified.some((f) => f.provenance === "synthetic")
      ? restaurant.cuisine
      : undefined);
  const ownerIdentitySource = (await store.all<SourceSnapshot>("sources"))
    .filter(
      (source) =>
        source.restaurantId === restaurant.id &&
        (source.title === "Owner-confirmed profile" ||
          source.title === "Profile review record"),
    )
    .at(-1);
  const sources = [
    ...new Set([
      ...opportunity.sourceIds,
      ...(ownerIdentitySource ? [ownerIdentitySource.id] : []),
      ...verified.flatMap((value) => (value.sourceId ? [value.sourceId] : [])),
    ]),
  ];
  const menuItems = verified
    .filter((f) => f.field === "menuItems")
    .flatMap((f) => f.value.split(/;\s*/))
    .flatMap((value) => {
      const explicit = /^(.+?)\s+\(([A-Z]{3})\s+(\d+(?:\.\d{1,2})?)\)$/.exec(
        value,
      );
      const dollar = /^(.+?)\s+[—–]\s+\$(\d+(?:\.\d{1,2})?)$/.exec(value);
      const currency = explicit?.[2] || fact("currency");
      const name = explicit?.[1] || dollar?.[1];
      const price = explicit?.[3] || dollar?.[2];
      return name && price && currency && /^[A-Z]{3}$/.test(currency)
        ? [
            {
              "@type": "MenuItem",
              name,
              offers: {
                "@type": "Offer",
                price: Number(price).toFixed(2),
                priceCurrency: currency,
              },
            },
          ]
        : [];
    });
  let content = edited;
  if (content === undefined) {
    if (type === "about")
      content = [
        fact("address") || restaurant.location
          ? `${restaurant.name} is located at ${fact("address") || restaurant.location}.`
          : `${restaurant.name}: ${restaurant.website}`,
        !generic && cuisine && restaurant.confirmedAt
          ? `The restaurant serves ${cuisine!.toLowerCase()} cuisine.`
          : "",
        ...verified
          .filter(
            (value) =>
              !["name", "website", "location", "cuisine", "menuUrl"].includes(
                value.field,
              ),
          )
          .map(
            (value) =>
              `${value.field.replace(/([a-z])([A-Z])/g, "$1 $2")}: ${value.value}.`,
          ),
        `Explore the current details: ${restaurant.website}`,
      ]
        .filter(Boolean)
        .join("\n\n");
    if (type === "faq") {
      const pairs = [
        [
          generic
            ? "Where can I find this business?"
            : "Where is the restaurant?",
          fact("address") || restaurant.location
            ? `${restaurant.name} is located at ${fact("address") || restaurant.location}.`
            : `Visit ${restaurant.website}. A physical location has not been confirmed.`,
        ],
        [
          "Where can I find current information?",
          `Visit ${restaurant.website}. Confirm hours, availability, and special requirements directly before visiting.`,
        ],
      ];
      if (!generic && cuisine && restaurant.confirmedAt)
        pairs.push([
          "What kind of food do you serve?",
          `${restaurant.name} serves ${cuisine!.toLowerCase()} cuisine, according to the reviewed public profile.`,
        ]);
      for (const value of verified.filter((value) =>
        [
          "menu",
          "menuItems",
          "menuUrl",
          "hours",
          "priceRange",
          "dietary",
        ].includes(value.field),
      ))
        pairs.push([
          (
            {
              menu: "What is on the menu?",
              menuItems: "What is on the menu?",
              menuUrl: "Where can I see the menu?",
              hours: "When are you open?",
              priceRange: "How much should I expect to spend?",
              dietary: "What should I know about dietary requirements?",
            } as Record<string, string>
          )[value.field] ??
            `What should I know about ${value.field.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase()}?`,
          value.field === "menuItems"
            ? value.value
                .split(/;\s*/)
                .filter((item) => /pizza/i.test(item))
                .slice(0, 4)
                .join("; ") || value.value.split(/;\s*/).slice(0, 4).join("; ")
            : value.value,
        ]);
      content = pairs.map(([q, a]) => `Q: ${q}\nA: ${a}`).join("\n\n");
    }
    if (type === "jsonld")
      content = JSON.stringify(
        {
          "@context": "https://schema.org",
          "@type": generic ? "Organization" : "Restaurant",
          name: restaurant.name,
          url: restaurant.website,
          ...(fact("address") || restaurant.location
            ? { address: fact("address") || restaurant.location }
            : {}),
          ...(!generic && cuisine && restaurant.confirmedAt
            ? { servesCuisine: cuisine }
            : {}),
          ...(!generic && fact("menuUrl") ? { menu: fact("menuUrl") } : {}),
          ...(fact("description") ? { description: fact("description") } : {}),
          ...(fact("phone") ? { telephone: fact("phone") } : {}),
          ...(!generic && fact("menuUrl") && menuItems.length
            ? {
                hasMenu: {
                  "@type": "Menu",
                  url: fact("menuUrl"),
                  hasMenuSection: [
                    {
                      "@type": "MenuSection",
                      name: "Reviewed menu items",
                      hasMenuItem: menuItems,
                    },
                  ],
                },
              }
            : {}),
        },
        null,
        2,
      );
  }
  const versions = (await store.all<ArtifactVersion>("artifacts")).filter(
    (artifact) =>
      artifact.opportunityId === opportunity.id && artifact.type === type,
  );
  const artifact: ArtifactVersion = {
    runId: run.id,
    id: id("artifact"),
    opportunityId: opportunity.id,
    restaurantId: restaurant.id,
    type,
    content: content!,
    version: Math.max(0, ...versions.map((value) => value.version)) + 1,
    contentHash: hash(content!),
    createdAt: now(),
    validation: validateArtifact(type, content!),
    sourceIds: sources,
    requiresConfirmation: true,
  };
  // Edits are immutable new versions, never updates to the original record.
  await store.put("artifacts", artifact);
  return artifact;
}
