import type {
  Competitor,
  Restaurant,
  Run,
  SourceSnapshot,
} from "../shared/types.ts";
import { collectSources, validatePublicUrl } from "./collector.ts";
const normalize = (value: string) =>
  value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
const thirdParty =
  /(^|\.)(wikipedia\.org|reddit\.com|facebook\.com|instagram\.com|tripadvisor\.[a-z.]+|timeout\.com|theinfatuation\.com|opentable\.com|yelp\.com|google\.com|doordash\.com|ubereats\.com)$/i;
export function competitorDomainMatches(
  urlString: string,
  nameString: string,
): boolean {
  try {
    const url = validatePublicUrl(urlString);
    if (thirdParty.test(url.hostname)) return false;
    const name = normalize(nameString);
    if (!name) return false;
    const host = normalize(url.hostname.replace(/^www\./, ""));
    const tokens = (
      nameString
        .replace(/['’]/g, "")
        .toLowerCase()
        .match(/[a-z0-9]+/g) || []
    ).filter(
      (w) =>
        w.length >= 4 &&
        ![
          "restaurant",
          "pizza",
          "pizzeria",
          "italian",
          "york",
          "the",
          "and",
        ].includes(w),
    );
    return (
      host.includes(name) ||
      (tokens.length > 0 && tokens.every((token) => host.includes(token)))
    );
  } catch {
    return false;
  }
}
export function citedCompetitorWebsite(
  run: Run,
  competitor: Competitor,
): string | undefined {
  const candidates = run.results
    .flatMap((result) => result.citations)
    .flatMap((citation) => {
      try {
        const url = validatePublicUrl(citation.url);
        if (
          thirdParty.test(url.hostname) ||
          /\.(pdf|jpg|png|zip)$/i.test(url.pathname)
        )
          return [];
        if (!competitorDomainMatches(url.href, competitor.name)) return [];
        return [
          {
            url: url.href,
            score: url.pathname === "/" ? 0 : url.pathname.length,
          },
        ];
      } catch {
        return [];
      }
    })
    .sort((a, b) => a.score - b.score);
  return candidates[0]?.url;
}
export function relevantBranchPage(
  urlString: string,
  locality: string,
): boolean {
  const text = new URL(urlString).pathname.toLowerCase();
  const expected = locality.toLowerCase().replace(/[^a-z]/g, "");
  for (const branch of [
    "upper-west-side",
    "upper-east-side",
    "rutherford",
    "new-jersey",
    "times-square",
    "brooklyn",
    "queens",
    "bronx",
  ]) {
    if (text.includes(branch) && !expected.includes(branch.replace(/-/g, "")))
      return false;
  }
  return true;
}
export async function collectCompetitorEvidence(
  run: Run,
  target: Restaurant,
  save: (source: SourceSnapshot) => unknown,
): Promise<string[]> {
  const leading = run.competitors.filter((c) => !c.isTarget).slice(0, 3);
  const warnings: string[] = [];
  for (const competitor of leading) {
    const website = citedCompetitorWebsite(run, competitor);
    if (!website) {
      warnings.push(
        `No confidently matching provider-cited website was available for ${competitor.name}; its website evidence was not guessed.`,
      );
      continue;
    }
    const candidate: Restaurant = {
      id: target.id,
      name: competitor.name,
      aliases: [],
      website,
      location: target.location,
      businessType: target.businessType,
      category: target.category,
      facts: [],
      createdAt: new Date().toISOString(),
    };
    let successful = 0;
    await collectSources(
      candidate,
      async (source) => {
        if (source.status === "succeeded") successful++;
        await save({
          ...source,
          sourceKind: "website",
          scope: "competitor",
          entityId: competitor.entityId,
          entityName: competitor.name,
          runId: run.id,
          draftFacts: undefined,
        });
      },
      { linkFilter: (link) => relevantBranchPage(link.url, target.location) },
    );
    if (!successful)
      warnings.push(
        `The cited public website for ${competitor.name} could not be inspected; unavailable evidence is not an information gap.`,
      );
  }
  return warnings;
}
