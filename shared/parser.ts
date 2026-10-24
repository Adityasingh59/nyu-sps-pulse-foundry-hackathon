import type { Appearance, Restaurant } from "./types";

export const PARSER_VERSION = "conservative-list-v5";
const normalize = (value: string) =>
  value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
const escapeRegex = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const entityId = (name: string) =>
  `restaurant:${normalize(name).replace(/\s+/g, "-")}`;
const negative =
  /\b(?:not\s+(?:recommend(?:ing|ed)?|a recommendation|suggest(?:ing|ed)?)|(?:do\s+not|don['’]t|wouldn['’]t|cannot|can['’]t)\s+recommend|avoid(?:ing)?|closed(?:\s+permanently)?|permanently closed|not\s+(?:a\s+)?good\s+(?:choice|option|fit))\b/i;
const incidental =
  /\b(?:mentioned|in passing|for comparison|not a recommendation|rather than|instead of)\b/i;
const explicitRecommendation =
  /\b(?:recommend(?:ing|ed)?|suggest(?:ing|ed)?|try|consider|good\s+(?:option|choice)|worth\s+(?:a\s+)?(?:visit|try)|great\s+(?:option|choice))\b/i;

function aliasPattern(alias: string): RegExp {
  // Punctuation and case variations are tolerated, while name substrings are not.
  const words = normalize(alias).split(" ").filter(Boolean);
  return new RegExp(
    `(?<![\\p{L}\\p{N}])${words.map(escapeRegex).join("[^\\p{L}\\p{N}]+")}(?![\\p{L}\\p{N}])`,
    "iu",
  );
}

function locationSupport(span: string, restaurant: Restaurant): boolean {
  let domain = "";
  try {
    domain = new URL(restaurant.website).hostname.replace(/^www\./, "");
  } catch {
    /* Manual profiles may have no URL. */
  }
  if (domain && span.toLocaleLowerCase().includes(domain.toLocaleLowerCase()))
    return true;
  const actual = normalize(restaurant.location);
  if (!actual) return false;
  const text = normalize(span);
  // A locality fragment is useful; a generic token such as "New" or "NY" is not.
  const pieces = restaurant.location
    .split(",")
    .map(normalize)
    .filter((part) => part.length >= 4);
  return text.includes(actual) || pieces.some((part) => text.includes(part));
}

function identityAmbiguous(
  span: string,
  alias: string,
  restaurant: Restaurant,
): boolean {
  const nameMatch = aliasPattern(alias).exec(span);
  const afterName = nameMatch
    ? span
        .slice(nameMatch.index + nameMatch[0].length)
        .replace(/^(?:\*\*|__)?\s*/, "")
    : "";
  // A branch qualifier after a matching name is unresolved when it does not match
  // the confirmed locality. We preserve the mention without silently merging it.
  const qualifier =
    /^(?:\(([^)]+)\)|(?:[-–—,:]\s*)?(?:in|at)\s+([\p{Lu}][\p{L}\s.-]{1,55}))/u.exec(
      afterName,
    );
  if (qualifier) {
    const place = (qualifier[1] || qualifier[2])
      .trim()
      .split(/\s+(?:for|with|which|where|is|has|offers|serves|near)\b/i)[0]
      .trim();
    const normalizedPlace = normalize(place);
    const normalizedLocation = normalize(restaurant.location);
    const isDescriptor =
      /^(?:restaurant|cafe|café|bistro|bar|seasonal|vegetarian|vegan|italian|american|mexican|indian|japanese|chinese|mediterranean|new american)$/i.test(
        place,
      );
    if (
      !isDescriptor &&
      (!normalizedLocation || !normalizedLocation.includes(normalizedPlace)) &&
      (!normalizedLocation || !normalizedPlace.includes(normalizedLocation))
    )
      return true;
  }
  if (locationSupport(span, restaurant)) return false;
  // Short aliases can be common words or other businesses; require corroboration.
  return (
    normalize(alias) !== normalize(restaurant.name) &&
    normalize(alias).split(" ").length < 2
  );
}

function listEntryNegative(body: string): boolean {
  const description = body
    .replace(/^(?:\*\*|__)(?:.+?)(?:\*\*|__)/, "")
    .replace(/^\[[^\]]+\]\(https?:\/\/[^)]+\)/, "")
    .replace(/^\s*[—–:-]\s*/, "");
  return (
    /^(?:not a recommendation|not recommended|avoid\b|permanently closed|closed permanently)/i.test(
      description,
    ) ||
    /\b(?:I|we)\s+(?:do not|don['’]t|would not|wouldn['’]t|cannot|can['’]t)\s+recommend\b/i.test(
      body,
    ) ||
    /\b(?:I am|we are) not recommending\b/i.test(body)
  );
}

function extractHeading(body: string): string | null {
  const bold = /^(?:\*\*|__)(.+?)(?:\*\*|__)/.exec(body);
  const linked = /^\[([^\]]+)\]\(https?:\/\/[^)]+\)/.exec(body);
  let heading = bold?.[1] || linked?.[1];
  if (!heading) {
    const withoutVerb = body.replace(
      /^(?:try|consider|visit|choose|avoid)\s+/i,
      "",
    );
    const pieces = withoutVerb.split(
      /\s+[—–]\s+|\s+-\s+|:\s+|\s+(?=\b(?:offers|serves|is|has|for)\b)/i,
    );
    if (pieces.length > 1) heading = pieces[0];
    else if (/^[\p{Lu}\d][\p{L}\d'’&.,()\s-]{1,75}$/u.test(withoutVerb))
      heading = withoutVerb;
  }
  if (!heading) return null;
  heading = heading
    .replace(/\[([^\]]+)\]\(https?:\/\/[^)]+\)/g, "$1")
    .replace(/^(?:try|consider|visit|choose|avoid)\s+/i, "")
    .replace(/\s*\([^)]*\)\s*$/, "")
    .replace(/[*_`]+/g, "")
    .replace(/[.,:;]+$/, "")
    .trim();
  if (!heading || heading.length > 90 || heading.split(/\s+/).length > 10)
    return null;
  if (
    /^(?:check|look|ask|visit their|make sure|restaurants?|options?|recommendations?|tips?|notes?|sources?|citations?|price|hours|menu|budget|location|vegetarian options|best for|nearby options)\b/i.test(
      heading,
    )
  )
    return null;
  // Descriptive list items are not restaurant identities.
  if (!/[\p{Lu}]/u.test(heading) && !bold && !linked) return null;
  return heading;
}

/**
 * Conservative local extractor: explicit list headings establish competitors.
 * Free prose is inspected for the known target only; unknown prose names may be
 * missed and are never assigned invented positions.
 */
export function parseAnswer(
  rawAnswer: string,
  restaurant: Restaurant,
): Appearance[] {
  const aliases = [
    ...new Set(
      [restaurant.name, ...restaurant.aliases]
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  ].sort((a, b) => b.length - a.length);
  const appearances: Appearance[] = [];
  let negativeSection = false;
  for (const line of rawAnswer.split(/\r?\n/)) {
    // Markdown commonly separates a list from its heading with a blank line.
    // Preserve its meaning until another substantive heading replaces it.
    if (!line.trim()) continue;
    const list = /^\s*(?:(\d{1,3})[.)]\s+|[-*•]\s+)(.*)$/.exec(line);
    if (!list && (/[:：]\s*$/.test(line) || /^\s*#{1,6}\s/.test(line)))
      negativeSection =
        negative.test(line) || /\bnot recommended\b/i.test(line);
    const body = list?.[2]?.trim() ?? line.trim();
    const heading = list ? extractHeading(body) : null;
    const headingAlias =
      heading &&
      aliases.find((alias) => normalize(heading) === normalize(alias));
    const longerHeadingAlias =
      heading &&
      !headingAlias &&
      aliases.find((alias) => aliasPattern(alias).test(heading));
    const listRecommended = Boolean(
      list &&
      heading &&
      !negativeSection &&
      !listEntryNegative(body) &&
      !/\b(?:mentioned (?:only )?in passing|for comparison only|not a recommendation)\b/i.test(
        body,
      ),
    );
    if (heading) {
      const isTarget = Boolean(headingAlias || longerHeadingAlias);
      const ambiguous =
        Boolean(longerHeadingAlias) ||
        (isTarget ? identityAmbiguous(line, headingAlias!, restaurant) : false);
      appearances.push({
        entityId: isTarget ? restaurant.id : entityId(heading),
        name: isTarget ? restaurant.name : heading,
        mention: true,
        recommended: listRecommended,
        position: listRecommended && list?.[1] ? Number(list[1]) : null,
        evidenceSpan: line,
        ambiguous,
      });
    }
    // Mentions in a competitor's description are not promoted into a second
    // recommendation. The exact original line is retained as supporting evidence.
    const targetAlias = aliases.find((alias) => aliasPattern(alias).test(line));
    if (!targetAlias || headingAlias || longerHeadingAlias) continue;
    const recommended =
      !list &&
      !negativeSection &&
      !negative.test(line) &&
      !incidental.test(line) &&
      explicitRecommendation.test(line);
    appearances.push({
      entityId: restaurant.id,
      name: restaurant.name,
      mention: true,
      recommended,
      position: null,
      evidenceSpan: line,
      ambiguous: identityAmbiguous(line, targetAlias, restaurant),
    });
  }
  return appearances;
}
