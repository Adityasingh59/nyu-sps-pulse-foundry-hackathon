import http from "node:http";
import https from "node:https";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import type { SourceSnapshot, Restaurant } from "../shared/types.ts";
import { hash, id, now } from "./ids.ts";
import { inspectPageEvidence, type EvidenceLink } from "./evidence.ts";
export { visibleText } from "./evidence.ts";

// Only globally routable unicast IPs may be contacted. In particular, reject
// IPv4-mapped IPv6 and IPv6 transition ranges rather than attempting tunnelling.
export function isPublicAddress(address: string): boolean {
  if (isIP(address) === 4) {
    const a = address.split(".").map(Number);
    return !(
      a[0] === 0 ||
      a[0] === 10 ||
      a[0] === 127 ||
      a[0] >= 224 ||
      (a[0] === 100 && a[1] >= 64 && a[1] <= 127) ||
      (a[0] === 169 && a[1] === 254) ||
      (a[0] === 172 && a[1] >= 16 && a[1] <= 31) ||
      (a[0] === 192 && (a[1] === 168 || a[1] === 0 || a[1] === 2)) ||
      (a[0] === 198 &&
        (a[1] === 18 || a[1] === 19 || (a[1] === 51 && a[2] === 100))) ||
      (a[0] === 203 && a[1] === 0 && a[2] === 113)
    );
  }
  if (isIP(address) === 6) {
    const lower = address.toLowerCase();
    // Global IPv6 space is 2000::/3. Exclude documentation, transition,
    // benchmarking and ORCHID blocks inside it.
    return (
      /^[23][0-9a-f]{0,3}:/.test(lower) &&
      !lower.startsWith("2001:db8:") &&
      !(
        lower.startsWith("2001:") &&
        parseInt(lower.split(":")[1] || "0", 16) < 0x200
      ) &&
      !lower.startsWith("2002:") &&
      !lower.startsWith("2001:2:") &&
      !/^2001:1[0-9a-f]:/.test(lower) &&
      !/^2001:2[0-9a-f]:/.test(lower)
    );
  }
  return false;
}
export function validatePublicUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Enter a valid public HTTP or HTTPS website URL.");
  }
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    (url.port && !["80", "443"].includes(url.port))
  )
    throw new Error(
      "Only public HTTP(S) websites on ports 80 or 443 are supported.",
    );
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (
    (!host.includes(".") && !isIP(host)) ||
    /(^|\.)(localhost|local|internal|home|lan|test|invalid)$/.test(host) ||
    (isIP(host) && !isPublicAddress(host))
  )
    throw new Error(
      "Private, local, and reserved network destinations are blocked.",
    );
  url.hash = "";
  return url;
}
async function pinnedRequest(url: URL): Promise<{
  status: number;
  headers: http.IncomingHttpHeaders;
  body: string;
}> {
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  const addresses = isIP(hostname)
    ? [{ address: hostname, family: isIP(hostname) }]
    : await Promise.race([
        lookup(hostname, { all: true }),
        new Promise<never>((_resolve, reject) => {
          const deadline = setTimeout(
            () => reject(new Error("Website DNS lookup timed out.")),
            5_000,
          );
          deadline.unref();
        }),
      ]);
  if (
    !addresses.length ||
    addresses.some((address) => !isPublicAddress(address.address))
  )
    throw new Error(
      "Website resolves to a private or reserved network destination.",
    );
  const selected = addresses[0];
  return new Promise((resolve, reject) => {
    const transport = url.protocol === "https:" ? https : http;
    const request = transport.request(
      url,
      {
        method: "GET",
        agent: false,
        headers: {
          "User-Agent":
            "TableSignalDemo/0.1 (bounded public website inspection)",
          Accept: "text/html,text/plain;q=0.8",
        },
        // Pin the checked IP for the connection: no second uncontrolled DNS lookup.
        lookup: ((
          _hostname: string,
          options: { all?: boolean },
          callback: (...args: unknown[]) => void,
        ) => {
          if (options.all)
            callback(null, [
              { address: selected.address, family: selected.family },
            ]);
          else callback(null, selected.address, selected.family);
        }) as never,
      },
      (response) => {
        let size = 0;
        const chunks: Buffer[] = [];
        response.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > 2_000_000) {
            request.destroy(
              new Error("Source exceeded the 2 MB inspection limit."),
            );
            return;
          }
          chunks.push(chunk);
        });
        response.on("end", () =>
          resolve({
            status: response.statusCode ?? 0,
            headers: response.headers,
            body: Buffer.concat(chunks).toString("utf8"),
          }),
        );
        response.on("error", reject);
      },
    );
    request.setTimeout(6_000, () =>
      request.destroy(new Error("Website request timed out.")),
    );
    const deadline = setTimeout(
      () => request.destroy(new Error("Website inspection timed out.")),
      8_000,
    );
    request.on("close", () => clearTimeout(deadline));
    request.on("error", reject);
    request.end();
  });
}
export interface RawPage {
  url: string;
  body: string;
  contentType: string;
}
interface RobotsPolicy {
  rules: { path: string; allow: boolean }[];
  blocked?: string;
}
const robotsCache = new Map<
  string,
  { expires: number; policy: Promise<RobotsPolicy> }
>();
const USER_AGENT = "TableSignal";

export function robotsAllows(
  contents: string,
  path: string,
  agent = USER_AGENT,
): boolean {
  const groups: {
    agents: string[];
    rules: { path: string; allow: boolean }[];
  }[] = [];
  let group:
    | { agents: string[]; rules: { path: string; allow: boolean }[] }
    | undefined;
  let directives = false;
  for (const raw of contents.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, "").trim();
    const separator = line.indexOf(":");
    if (separator < 0) continue;
    const key = line.slice(0, separator).trim().toLowerCase(),
      value = line.slice(separator + 1).trim();
    if (key === "user-agent") {
      if (!value) continue;
      if (!group || directives) {
        group = { agents: [], rules: [] };
        groups.push(group);
        directives = false;
      }
      group.agents.push(value.toLowerCase());
    } else if (group && ["allow", "disallow"].includes(key)) {
      directives = true;
      if (value)
        group.rules.push({
          path: value.slice(0, 1000),
          allow: key === "allow",
        });
    }
  }
  const named = groups.filter((group) =>
    group.agents.some(
      (name) => name !== "*" && agent.toLowerCase().includes(name),
    ),
  );
  const selected = named.length
    ? named
    : groups.filter((group) => group.agents.includes("*"));
  const paths = [path];
  try {
    const decoded = decodeURIComponent(path);
    if (decoded !== path) paths.push(decoded);
  } catch {
    /* malformed escaped path stays literal */
  }
  let best: { length: number; allow: boolean } | undefined;
  for (const rule of selected.flatMap((group) => group.rules)) {
    const terminal = rule.path.endsWith("$");
    const rawPattern = (terminal ? rule.path.slice(0, -1) : rule.path).replace(
      /\*+/g,
      "*",
    );
    const pattern =
      "^" +
      rawPattern
        .split("*")
        .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
        .join(".*") +
      (terminal ? "$" : "");
    if (!paths.some((value) => new RegExp(pattern).test(value))) continue;
    const length = rule.path.replace(/[\*$]/g, "").length;
    if (!best || length > best.length || (length === best.length && rule.allow))
      best = { length, allow: rule.allow };
  }
  return best?.allow ?? true;
}
async function loadRobots(origin: string): Promise<RobotsPolicy> {
  try {
    let url = validatePublicUrl(new URL("/robots.txt", origin).href);
    for (let attempt = 0; attempt < 4; attempt++) {
      const response = await pinnedRequest(url);
      if (
        [301, 302, 303, 307, 308].includes(response.status) &&
        response.headers.location
      ) {
        if (attempt >= 3)
          return { rules: [], blocked: "robots.txt redirect limit reached." };
        url = validatePublicUrl(new URL(response.headers.location, url).href);
        continue;
      }
      if ([404, 410].includes(response.status)) return { rules: [] };
      if (response.status !== 200)
        return {
          rules: [],
          blocked: `robots.txt returned HTTP ${response.status}; inspection stopped without bypass.`,
        };
      // Keep raw directives, since each requested path must be checked separately.
      return { rules: [{ path: response.body, allow: true }] };
    }
  } catch {
    return {
      rules: [],
      blocked:
        "robots.txt could not be checked; inspection stopped without bypass.",
    };
  }
  return { rules: [], blocked: "robots.txt inspection failed." };
}
async function assertRobotsAllowed(url: URL): Promise<void> {
  let cached = robotsCache.get(url.origin);
  if (!cached || cached.expires < Date.now()) {
    cached = { expires: Date.now() + 300_000, policy: loadRobots(url.origin) };
    robotsCache.set(url.origin, cached);
  }
  const policy = await cached.policy;
  if (policy.blocked) throw new Error(policy.blocked);
  if (
    policy.rules[0] &&
    !robotsAllows(policy.rules[0].path, url.pathname + url.search)
  )
    throw new Error(
      "robots.txt disallows inspection of this page; no access workaround attempted.",
    );
}
export async function fetchPublicPage(
  value: string,
  redirects = 0,
): Promise<RawPage> {
  const url = validatePublicUrl(value);
  await assertRobotsAllowed(url);
  const response = await pinnedRequest(url);
  if ([301, 302, 303, 307, 308].includes(response.status)) {
    if (redirects >= 3 || !response.headers.location)
      throw new Error("Website redirect limit reached.");
    return fetchPublicPage(
      new URL(response.headers.location, url).href,
      redirects + 1,
    );
  }
  if (response.status !== 200)
    throw new Error(
      `Website returned HTTP ${response.status}; content could not be inspected.`,
    );
  const contentType = String(response.headers["content-type"] ?? "");
  if (!/text\/(html|plain)/i.test(contentType))
    throw new Error(
      "Only HTML or plain text pages can be inspected. Linked PDFs and images require manual review.",
    );
  return { url: url.href, body: response.body, contentType };
}
function pageKind(
  url: string,
  label = "",
): NonNullable<SourceSnapshot["pageKind"]> {
  const path = new URL(url).pathname;
  if (/menu|food|dinner|lunch/i.test(`${path} ${label}`)) return "menu";
  if (/about|story|history/i.test(`${path} ${label}`)) return "about";
  if (/visit|contact|location|hours/i.test(`${path} ${label}`)) return "visit";
  return path === "/" ? "home" : "other";
}
export function snapshotFromPage(
  restaurant: Restaurant,
  page: RawPage,
  label = "",
): SourceSnapshot {
  const sourceId = id("source");
  const evidence = inspectPageEvidence(
    page.body,
    page.url,
    sourceId,
    restaurant,
  );
  const structured = evidence.draftFacts
    .map(
      (fact) =>
        `${fact.field}: ${fact.value}\nExact evidence: ${fact.evidenceSpan ?? ""}`,
    )
    .join("\n\n");
  const content =
    evidence.text +
    (structured
      ? `\n\nUnconfirmed website-observed fact excerpts:\n${structured}`
      : "");
  return {
    id: sourceId,
    restaurantId: restaurant.id,
    url: page.url,
    title: evidence.title,
    fetchedAt: now(),
    contentHash: hash(page.body),
    excerpt: content.slice(0, 50_000),
    status: "succeeded",
    mode: "live",
    contentType: page.contentType,
    contentTruncated: content.length > 50_000,
    pageKind: pageKind(page.url, label),
    draftFacts: evidence.draftFacts,
    schemaTypes: evidence.schemaTypes,
    schemaIssues: evidence.issues,
    entityName: evidence.entityName,
  };
}
function failedSnapshot(
  restaurant: Restaurant,
  url: string,
  error: unknown,
): SourceSnapshot {
  return {
    id: id("source"),
    restaurantId: restaurant.id,
    url,
    title: "Website inspection unavailable",
    fetchedAt: now(),
    contentHash: hash(""),
    excerpt: "",
    status: "failed",
    mode: "live",
    error: error instanceof Error ? error.message : "Page inspection failed.",
  };
}
function sameSite(url: string, home: string): boolean {
  const canonical = (host: string) => host.toLowerCase().replace(/^www\./, "");
  const left = new URL(url),
    right = new URL(home);
  return (
    canonical(left.hostname) === canonical(right.hostname) &&
    ["http:", "https:"].includes(left.protocol)
  );
}
export function selectUsefulLinks(
  links: EvidenceLink[],
  home: string,
): EvidenceLink[] {
  const ranked = links
    .flatMap((link) => {
      try {
        const url = validatePublicUrl(link.url);
        url.hash = "";
        const root = new URL(home);
        if (
          url.pathname.replace(/\/$/, "") ===
            root.pathname.replace(/\/$/, "") &&
          url.hostname.replace(/^www\./, "") ===
            root.hostname.replace(/^www\./, "")
        )
          return [];
        if (
          !sameSite(url.href, home) ||
          url.search ||
          /\.(pdf|png|jpe?g|gif|svg|zip|mp4|webp)$/i.test(url.pathname)
        )
          return [];
        const kind = pageKind(url.href, link.text);
        if (
          kind === "home" ||
          kind === "other" ||
          /privacy|terms|accessibility|gift|order|delivery|reserve|reservation|catering/i.test(
            `${url.pathname} ${link.text}`,
          )
        )
          return [];
        return [
          {
            ...link,
            url: url.href,
            priority: kind === "menu" ? 1 : kind === "visit" ? 2 : 3,
          },
        ];
      } catch {
        return [];
      }
    })
    .sort((a, b) => a.priority - b.priority);
  return ranked
    .filter(
      (link, index) =>
        ranked.findIndex((other) => other.url === link.url) === index,
    )
    .slice(0, 12)
    .map(({ url, text }) => ({ url, text }));
}
export async function collectSources(
  restaurant: Restaurant,
  save: (source: SourceSnapshot) => void,
  options: { linkFilter?: (link: EvidenceLink) => boolean } = {},
): Promise<void> {
  const queue: EvidenceLink[] = [{ url: restaurant.website, text: "Homepage" }];
  const visited = new Set<string>();
  let attempts = 0;
  let home = restaurant.website;
  while (queue.length && attempts < 5) {
    const next = queue.shift()!;
    if (visited.has(next.url)) continue;
    visited.add(next.url);
    attempts++;
    try {
      const page = await fetchPublicPage(next.url);
      if (visited.has(page.url) && page.url !== next.url) continue;
      if (attempts === 1) home = page.url;
      if (!sameSite(page.url, home))
        throw new Error(
          "Linked page redirected to another site; manual review required.",
        );
      visited.add(page.url);
      save(snapshotFromPage(restaurant, page, next.text));
      const evidence = inspectPageEvidence(
        page.body,
        page.url,
        "discovery",
        restaurant,
      );
      const useful = selectUsefulLinks(evidence.links, home)
        .filter((link) => !options.linkFilter || options.linkFilter(link))
        .filter(
          (link) =>
            !visited.has(link.url) &&
            !queue.some((queued) => queued.url === link.url),
        );
      queue.push(...useful);
    } catch (error) {
      save(failedSnapshot(restaurant, next.url, error));
    }
  }
}
export async function collectSourcePage(
  restaurant: Restaurant,
  url: string,
  label = "",
): Promise<SourceSnapshot> {
  try {
    return snapshotFromPage(restaurant, await fetchPublicPage(url), label);
  } catch (error) {
    return failedSnapshot(restaurant, url, error);
  }
}
