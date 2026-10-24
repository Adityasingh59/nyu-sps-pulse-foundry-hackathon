import test from "node:test";
import assert from "node:assert/strict";
import {
  isPublicAddress,
  validatePublicUrl,
  visibleText,
} from "../server/collector.ts";
import { validateArtifact } from "../server/content.ts";

test("public source URLs block loopback, private IPs, credentials and non-web schemes", () => {
  for (const url of [
    "http://localhost",
    "http://127.0.0.1",
    "http://2130706433",
    "http://10.1.2.3",
    "http://172.16.0.1",
    "http://169.254.169.254",
    "http://[::1]",
    "http://[::ffff:127.0.0.1]",
    "file:///etc/passwd",
    "https://name:secret@example.com",
    "https://example.com:3001",
    "http://service.internal",
  ]) {
    assert.throws(() => validatePublicUrl(url), url);
  }
  assert.equal(
    validatePublicUrl("https://restaurant.example/menu#section").href,
    "https://restaurant.example/menu",
  );
  assert.equal(
    validatePublicUrl("https://example.com").hostname,
    "example.com",
  );
});

test("public-address checker rejects reserved and transition ranges", () => {
  for (const address of [
    "127.0.0.1",
    "0.0.0.0",
    "10.0.0.1",
    "100.64.0.1",
    "172.31.255.255",
    "192.168.2.1",
    "192.0.2.1",
    "198.51.100.5",
    "203.0.113.3",
    "224.0.0.1",
    "255.255.255.255",
    "::1",
    "::ffff:8.8.8.8",
    "fc00::1",
    "fe80::1",
    "2001:db8::1",
    "2001::1",
    "2002:0808:0808::1",
  ])
    assert.equal(isPublicAddress(address), false, address);
  assert.equal(isPublicAddress("8.8.8.8"), true);
  assert.equal(isPublicAddress("2606:4700:4700::1111"), true);
});

test("external page text extraction removes scripts and styles", () => {
  assert.equal(
    visibleText(
      "<h1>Menu &amp; details</h1><script>stealSecret()</script><style>body{display:none}</style>One &#38; two",
    ),
    "Menu & details One & two",
  );
  assert.doesNotThrow(() => visibleText("Out of range &#999999999999;"));
});

test("structured artifacts require intended schema field types and valid URLs", () => {
  const valid = {
    "@context": "https://schema.org",
    "@type": "Restaurant",
    name: "Demo",
    url: "https://demo.example",
    address: "New York",
  };
  assert.equal(validateArtifact("jsonld", JSON.stringify(valid)).valid, true);
  for (const patch of [
    { address: [] },
    { address: { "@type": "Thing" } },
    { address: { "@type": "PostalAddress", postalCode: 10001 } },
    { url: "javascript:alert(1)" },
    { openingHours: 23 },
    { aggregateRating: { ratingValue: 5 } },
  ]) {
    assert.equal(
      validateArtifact("jsonld", JSON.stringify({ ...valid, ...patch })).valid,
      false,
      JSON.stringify(patch),
    );
  }
  assert.equal(validateArtifact("jsonld", "{broken").valid, false);
});

test("persisted interrupted observations resume without discarding their attempt count", async () => {
  const [
    { mkdtemp, rm },
    { tmpdir },
    { join },
    { createApplication },
    { hash },
  ] = await Promise.all([
    import("node:fs/promises"),
    import("node:os"),
    import("node:path"),
    import("../server/index.ts"),
    import("../server/store.ts"),
  ]);
  const directory = await mkdtemp(join(tmpdir(), "tablesignal-recovery-"));
  const path = join(directory, "recovery.sqlite");
  let runtime = await createApplication({ dbPath: path, worker: false });
  try {
    const original = (await runtime.store.get<import("../shared/types.ts").Run>(
      "runs",
      "run_linden_baseline",
    ))!;
    const originalBank = (await runtime.store.get<
      import("../shared/types.ts").QueryBank
    >("banks", original.bankId))!;
    const bank = {
      ...originalBank,
      id: "bank_recovery",
      queries: originalBank.queries.slice(0, 1),
    };
    bank.contentHash = hash(bank.queries);
    await runtime.store.put("banks", bank);
    const result = {
      ...original.results[0],
      id: "result_interrupted",
      status: "running" as const,
      rawAnswer: "",
      appearances: [],
      attempts: 1,
    };
    const interrupted = {
      ...original,
      id: "run_interrupted",
      bankId: bank.id,
      status: "running" as const,
      completedAt: undefined,
      results: [result],
    };
    await runtime.store.put("runs", interrupted);
    const settings = (await runtime.store.get<
      import("../server/providers.ts").ProviderSettings
    >("settings", original.id))!;
    await runtime.store.put("settings", { ...settings, id: interrupted.id });
    await runtime.close();
    runtime = await createApplication({ dbPath: path });
    const deadline = Date.now() + 3000;
    let resumed = (await runtime.store.get<import("../shared/types.ts").Run>(
      "runs",
      interrupted.id,
    ))!;
    while (
      ["queued", "running"].includes(resumed.status) &&
      Date.now() < deadline
    ) {
      await new Promise((resolve) => setTimeout(resolve, 30));
      resumed = (await runtime.store.get("runs", interrupted.id))!;
    }
    assert.equal(resumed.status, "completed");
    assert.equal(resumed.results[0].status, "succeeded");
    assert.equal(resumed.results[0].attempts, 2);
    assert.equal(resumed.metrics?.valid, 1);
  } finally {
    await runtime.close();
    await rm(directory, { recursive: true, force: true });
  }
});
