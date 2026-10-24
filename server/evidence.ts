import type {
  ProfileFact,
  Restaurant,
  SourceSnapshot,
} from "../shared/types.ts";

export interface EvidenceLink {
  url: string;
  text: string;
}
export interface PageEvidence {
  title: string;
  text: string;
  draftFacts: ProfileFact[];
  schemaTypes: string[];
  issues: string[];
  links: EvidenceLink[];
  entityName?: string;
}

// Fetched HTML is inert data. Scripts are never executed and JSON-LD is parsed
// strictly as JSON, including when an external page contains prompt-like text.
export function decodeHtml(value: string): string {
  const entities: Record<string, string> = {
    amp: "&",
    lt: "<",
    gt: ">",
    quot: '"',
    apos: "'",
    nbsp: " ",
    rsquo: "’",
    lsquo: "‘",
    ldquo: "“",
    rdquo: "”",
    ndash: "–",
    mdash: "—",
    bull: "•",
    copy: "©",
  };
  return value.replace(
    /&(#x[\da-f]+|#\d+|[a-z]+);/gi,
    (match, entity: string) => {
      if (!entity.startsWith("#"))
        return entities[entity.toLowerCase()] ?? match;
      const number = entity.toLowerCase().startsWith("#x")
        ? parseInt(entity.slice(2), 16)
        : Number(entity.slice(1));
      return Number.isInteger(number) &&
        number > 0 &&
        number <= 0x10ffff &&
        !(number >= 0xd800 && number <= 0xdfff)
        ? String.fromCodePoint(number)
        : " ";
    },
  );
}
export function visibleText(html: string): string {
  return decodeHtml(
    html
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<(script|style|noscript|template)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
      .replace(/<[^>]*>/g, " "),
  )
    .replace(/\s+/g, " ")
    .trim();
}
export function readableText(html: string): string {
  const text = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(
      /<(script|style|noscript|template|svg)\b[^>]*>[\s\S]*?<\/\1>/gi,
      " ",
    )
    .replace(/<\s*(?:br|hr)\b[^>]*>/gi, "\n")
    .replace(
      /<\/(?:p|div|section|article|header|footer|main|aside|nav|li|h[1-6]|tr|address|ul|ol|table)>/gi,
      "\n",
    )
    .replace(/<[^>]*>/g, " ");
  return decodeHtml(text)
    .split(/\n/)
    .map((line) => line.replace(/[ \t\r\f]+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}
function attribute(tag: string, name: string): string | undefined {
  const match = new RegExp(
    `\\b${name}\\s*=\\s*(?:"([^"<>]*)"|'([^'<>]*)'|([^\\s<>]+))`,
    "i",
  ).exec(tag);
  return match ? decodeHtml(match[1] ?? match[2] ?? match[3]) : undefined;
}
function absoluteWebUrl(value: unknown, base: string): string | undefined {
  const record = object(value);
  const raw =
    typeof value === "string" ? value : (record?.url ?? record?.["@id"]);
  if (typeof raw !== "string" || !raw.trim()) return undefined;
  try {
    const url = new URL(raw, base);
    url.hash = "";
    return ["http:", "https:"].includes(url.protocol) &&
      !url.username &&
      !url.password
      ? url.href
      : undefined;
  } catch {
    return undefined;
  }
}
function object(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}
function text(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim())
    return visibleText(value).slice(0, 2000);
  if (Array.isArray(value)) {
    const strings = value.map(text).filter((s): s is string => Boolean(s));
    if (strings.length) return strings.join("; ");
  }
  return undefined;
}
const normalize = (value: string) =>
  value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "");
const restaurantTypes = new Set([
  "Restaurant",
  "FoodEstablishment",
  "CafeOrCoffeeShop",
  "Bakery",
  "BarOrPub",
  "FastFoodRestaurant",
  "IceCreamShop",
]);
const businessTypes = new Set([
  ...restaurantTypes,
  "Organization",
  "Corporation",
  "LocalBusiness",
  "Store",
  "OnlineStore",
  "ProfessionalService",
  "SoftwareApplication",
  "EducationalOrganization",
  "MedicalBusiness",
  "HomeAndConstructionBusiness",
  "LegalService",
  "FinancialService",
  "RealEstateAgent",
  "TravelAgency",
  "LodgingBusiness",
  "Hotel",
  "AutoRepair",
  "HealthAndBeautyBusiness",
  "Dentist",
  "HairSalon",
  "SportsActivityLocation",
  "NGO",
  "Library",
  "BookStore",
  "ClothingStore",
  "HardwareStore",
  "ShoppingCenter",
]);
const typeName = (value: string) =>
  value.replace(/^https?:\/\/schema\.org\//, "");
function flattenJson(
  value: unknown,
  output: Record<string, unknown>[],
  depth = 0,
): void {
  if (depth > 12 || output.length >= 400) return;
  if (Array.isArray(value)) {
    for (const entry of value) flattenJson(entry, output, depth + 1);
    return;
  }
  const item = object(value);
  if (!item) return;
  output.push(item);
  for (const [key, entry] of Object.entries(item))
    if (key !== "@context" && entry !== null && typeof entry === "object")
      flattenJson(entry, output, depth + 1);
}
function schemaTypes(item: Record<string, unknown>): string[] {
  const value = item["@type"];
  return (Array.isArray(value) ? value : [value])
    .filter((v): v is string => typeof v === "string")
    .map(typeName);
}
function formatAddress(value: unknown): string | undefined {
  if (typeof value === "string") return text(value);
  const address = object(value);
  if (!address) return undefined;
  const country =
    object(address.addressCountry)?.name ?? address.addressCountry;
  const parts = [
    address.streetAddress,
    address.addressLocality,
    address.addressRegion,
    address.postalCode,
    country,
  ]
    .map(text)
    .filter(Boolean);
  return parts.length >= 2 ? parts.join(", ") : undefined;
}
function formatHours(value: unknown): string | undefined {
  const items = Array.isArray(value) ? value : [value];
  const values: string[] = [];
  for (const item of items) {
    if (typeof item === "string" && item.trim()) {
      values.push(item.trim());
      continue;
    }
    const hours = object(item);
    if (!hours) continue;
    const days = text(hours.dayOfWeek)?.replace(
      /https?:\/\/schema\.org\//g,
      "",
    );
    const opens = text(hours.opens),
      closes = text(hours.closes);
    if (
      days &&
      opens &&
      closes &&
      /^\d{2}:\d{2}(?::\d{2})?$/.test(opens) &&
      /^\d{2}:\d{2}(?::\d{2})?$/.test(closes)
    )
      values.push(
        `${days}: ${opens}–${closes}${text(hours.validFrom) ? `; valid from ${text(hours.validFrom)}` : ""}${text(hours.validThrough) ? `; valid through ${text(hours.validThrough)}` : ""}`,
      );
  }
  return values.length ? values.join("; ") : undefined;
}
function menuItemDescription(
  item: Record<string, unknown>,
): string | undefined {
  const name = text(item.name);
  if (!name) return undefined;
  const offers = Array.isArray(item.offers)
    ? item.offers.map(object).filter(Boolean)
    : [object(item.offers)].filter(Boolean);
  const priced = offers
    .map((offer) => {
      const price = offer!.price,
        currency = text(offer!.priceCurrency);
      return (typeof price === "number" ||
        (typeof price === "string" && /^\d+(?:\.\d{1,2})?$/.test(price))) &&
        currency &&
        /^[A-Z]{3}$/.test(currency)
        ? `${currency} ${price}`
        : undefined;
    })
    .filter(Boolean);
  // A price without a currency, multiple variants, or prices embedded in prose
  // cannot be associated unambiguously and is left out.
  return `${name}${priced.length === 1 ? ` (${priced[0]})` : ""}`;
}
function targetMatches(
  item: Record<string, unknown>,
  restaurant?: Restaurant,
): boolean {
  if (!restaurant) return true;
  const candidate = text(item.name);
  if (
    candidate &&
    [restaurant.name, ...restaurant.aliases].some(
      (name) => normalize(name) === normalize(candidate),
    )
  )
    return true;
  const schemaUrl = absoluteWebUrl(item.url, restaurant.website);
  // A name conflict is never resolved by domain alone: multi-location sites can
  // embed more than one restaurant. Aliases must be supplied explicitly.
  return (
    !candidate &&
    Boolean(
      schemaUrl &&
      new URL(schemaUrl).origin === new URL(restaurant.website).origin,
    )
  );
}
export function inspectPageEvidence(
  html: string,
  url: string,
  sourceId: string,
  restaurant?: Restaurant,
): PageEvidence {
  const title =
    visibleText(/<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? "") ||
    new URL(url).hostname;
  const readable = readableText(html);
  const issues: string[] = [];
  const objects: Record<string, unknown>[] = [];
  let jsonScripts = 0;
  for (const match of html.matchAll(
    /<script\b([^>]*)>([\s\S]*?)<\/script>/gi,
  )) {
    if (
      attribute(match[1], "type")?.trim().toLowerCase() !==
      "application/ld+json"
    )
      continue;
    jsonScripts++;
    try {
      flattenJson(
        JSON.parse(match[2].replace(/^\s*<!--|-->\s*$/g, "").trim()),
        objects,
      );
    } catch {
      issues.push(
        "A JSON-LD script could not be parsed as JSON; its claims were not extracted.",
      );
    }
  }
  const types = [...new Set(objects.flatMap(schemaTypes))];
  const candidates = objects.filter((item) =>
    schemaTypes(item).some((type) =>
      (restaurant?.businessType === "business"
        ? businessTypes
        : restaurantTypes
      ).has(type),
    ),
  );
  const matches = candidates.filter((item) => targetMatches(item, restaurant));
  if (candidates.length && !matches.length)
    issues.push(
      "Business schema identity did not match the requested name or aliases; no facts were extracted from it.",
    );
  if (matches.length > 1)
    issues.push(
      "Multiple matching restaurant schema entities were found. Conflicting values remain separate draft facts for review.",
    );
  const facts: ProfileFact[] = [];
  const add = (field: string, value: string | undefined, evidence: string) => {
    if (
      !value ||
      facts.some((fact) => fact.field === field && fact.value === value)
    )
      return;
    facts.push({
      field,
      value,
      sourceId,
      provenance: "website",
      confirmed: false,
      evidenceSpan: evidence.slice(0, 3000),
    });
  };
  for (const entity of matches) {
    const evidence = JSON.stringify(entity);
    add("name", text(entity.name), evidence);
    add("address", formatAddress(entity.address), evidence);
    if (restaurant?.businessType !== "business")
      add("cuisine", text(entity.servesCuisine), evidence);
    add("phone", text(entity.telephone), evidence);
    add(
      "hours",
      formatHours(entity.openingHoursSpecification ?? entity.openingHours),
      evidence,
    );
    add("description", text(entity.description), evidence);
    add("priceRange", text(entity.priceRange), evidence);
    if (restaurant?.businessType === "business") continue;
    const menu = absoluteWebUrl(entity.hasMenu ?? entity.menu, url);
    add("menuUrl", menu, evidence);
    // Extract items only from the matched restaurant's own menu tree, rather
    // than unrelated Product/MenuItem data elsewhere in the page.
    const menuObjects: Record<string, unknown>[] = [];
    flattenJson(entity.hasMenu ?? entity.menu, menuObjects);
    const items = menuObjects
      .filter((item) => schemaTypes(item).includes("MenuItem"))
      .map(menuItemDescription)
      .filter((item): item is string => Boolean(item));
    if (items.length)
      add(
        "menuItems",
        [...new Set(items)].slice(0, 30).join("; "),
        JSON.stringify(menuObjects),
      );
  }
  const inertHtml = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|template)\b[^>]*>[\s\S]*?<\/\1>/gi, " ");
  const links: EvidenceLink[] = [];
  for (const match of inertHtml.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const href = attribute(match[1], "href");
    const destination = absoluteWebUrl(href, url);
    if (!destination) continue;
    const linkText =
      visibleText(match[2]) || attribute(match[1], "aria-label") || "";
    if (!links.some((link) => link.url === destination))
      links.push({ url: destination, text: linkText.slice(0, 250) });
  }
  // Explicit contact anchors are useful even when the site has no JSON-LD.
  for (const match of inertHtml.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const href = attribute(match[1], "href");
    if (href?.toLowerCase().startsWith("tel:")) {
      const phone = href.slice(4).trim();
      if (/^\+?[\d(). -]{7,25}$/.test(phone))
        add(
          "phone",
          phone,
          `Telephone link: ${href}; visible text: ${visibleText(match[2])}`,
        );
    }
  }
  const menuLink = links.find(
    (link) =>
      /\b(menu|menus)\b/i.test(link.text) &&
      !/private|catering|drinks|wine|bar\s+menu/i.test(
        `${link.text} ${new URL(link.url).pathname}`,
      ) &&
      new URL(link.url).pathname !== new URL(url).pathname,
  );
  if (menuLink && restaurant?.businessType !== "business")
    add(
      "menuUrl",
      menuLink.url,
      `Visible menu link: ${menuLink.text} → ${menuLink.url}`,
    );
  const addressElement = /<address\b[^>]*>([\s\S]*?)<\/address>/i.exec(html);
  const addressText = addressElement
    ? visibleText(addressElement[1])
    : undefined;
  if (
    addressText &&
    /\b\d{1,6}\s+\S+/.test(addressText) &&
    addressText.length < 350
  )
    add("address", addressText, `Address element: ${addressText}`);
  if (
    restaurant?.businessType !== "business" &&
    /menu|food|dinner|lunch/i.test(new URL(url).pathname)
  ) {
    const lines = readable.split("\n");
    const pairs: { name: string; price: string; span: string }[] = [];
    for (let index = 1; index < lines.length; index++) {
      const price = lines[index],
        name = lines[index - 1];
      if (
        !/^\$\d{1,4}(?:\.\d{2})?$/.test(price) ||
        name.length > 110 ||
        name.length < 2 ||
        !/[a-z]/i.test(name) ||
        /[+$|]|add |topping|delivery|minimum/i.test(name)
      )
        continue;
      pairs.push({ name, price, span: `${name}\n${price}` });
    }
    const unambiguous = pairs
      .filter(
        (pair) =>
          pairs.filter(
            (other) => normalize(other.name) === normalize(pair.name),
          ).length === 1,
      )
      .slice(0, 30);
    if (unambiguous.length)
      add(
        "menuItems",
        unambiguous.map((pair) => `${pair.name} — ${pair.price}`).join("; "),
        unambiguous.map((pair) => pair.span).join("\n\n"),
      );
  }
  const metadata = jsonScripts
    ? `JSON-LD scripts inspected: ${jsonScripts}. Schema types observed: ${types.join(", ") || "unrecognized"}.`
    : "No JSON-LD script found in inspected page HTML.";
  return {
    title,
    text: `${readable}\n\nInspection metadata: ${metadata}${issues.length ? ` ${issues.join(" ")}` : ""}`,
    draftFacts: facts,
    schemaTypes: types,
    issues,
    links,
    entityName: text(matches[0]?.name),
  };
}
export function extractProfileFactsFromSnapshots(
  sources: SourceSnapshot[],
): ProfileFact[] {
  const facts: ProfileFact[] = [];
  for (const source of sources.filter(
    (source) => source.status === "succeeded" && source.mode === "live",
  ))
    for (const fact of source.draftFacts ?? []) {
      if (fact.sourceId !== source.id || fact.provenance !== "website")
        continue;
      if (
        !facts.some(
          (value) => value.field === fact.field && value.value === fact.value,
        )
      )
        facts.push({ ...fact, confirmed: false });
    }
  return facts;
}
