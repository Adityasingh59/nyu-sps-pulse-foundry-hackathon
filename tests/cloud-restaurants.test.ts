import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import type {
  CloudRestaurant,
  Membership,
  TenantRepository,
} from "../src/server/repositories/tenant.ts";
import { assertSameOrigin, readJson } from "../src/server/http.ts";
import {
  createRestaurant,
  getRestaurant,
  listRestaurants,
  listWorkspaces,
} from "../src/server/services/restaurants.ts";
import { ApiError } from "../server/validation.ts";

// In-memory tenant store that scopes reads the way RLS does: a caller sees only
// rows in workspaces where they hold a membership.
function world() {
  const rows: CloudRestaurant[] = [];
  const members: (Membership & { userId: string })[] = [];
  const as = (userId: string): TenantRepository => ({
    async ensurePersonalWorkspace() {
      const own = members.find((m) => m.userId === userId && m.role === "owner");
      if (own) return own.workspaceId;
      const workspaceId = randomUUID();
      members.push({ userId, workspaceId, name: "Personal workspace", role: "owner" });
      return workspaceId;
    },
    async memberships() {
      return members
        .filter((m) => m.userId === userId)
        .map(({ workspaceId, name, role }) => ({ workspaceId, name, role }));
    },
    async listRestaurants(workspaceId, limit) {
      return rows.filter((r) => r.workspaceId === workspaceId).slice(0, limit);
    },
    async getRestaurant(id) {
      const visible = new Set(
        members.filter((m) => m.userId === userId).map((m) => m.workspaceId),
      );
      return rows.find((r) => r.id === id && visible.has(r.workspaceId)) ?? null;
    },
    async insertRestaurant(restaurant) {
      rows.push(restaurant);
      return restaurant;
    },
  });
  return { as, members, rows };
}

const status = (code: number) => (error: unknown) =>
  error instanceof ApiError && error.status === code;

test("a restaurant is created in the caller's workspace and reloads only for its members", async () => {
  const { as } = world();
  const alice = as("alice");
  const bob = as("bob");
  const [aliceWs] = await listWorkspaces(alice);
  const [bobWs] = await listWorkspaces(bob);
  assert.equal((await listWorkspaces(alice)).length, 1, "workspace is not duplicated");

  const created = await createRestaurant(alice, {
    workspaceId: aliceWs.workspaceId,
    name: "  Example Cafe ",
    location: "Example City",
    aliases: ["Example Coffee"],
  });
  assert.match(created.id, /^restaurant_[0-9a-f-]{36}$/);
  assert.equal(created.name, "Example Cafe");
  assert.equal(created.website, undefined, "website is optional");
  assert.equal(created.identitySource, "manual");
  assert.deepEqual(created.facts, []);
  assert.equal(created.confirmedAt, undefined);

  assert.deepEqual(await getRestaurant(alice, created.id), created);
  assert.deepEqual(
    (await listRestaurants(alice, aliceWs.workspaceId)).map((r) => r.id),
    [created.id],
  );

  // Another tenant: not found (not "forbidden", which would leak existence),
  // and cannot list or write into the first workspace.
  await assert.rejects(getRestaurant(bob, created.id), status(404));
  await assert.rejects(listRestaurants(bob, aliceWs.workspaceId), status(403));
  await assert.rejects(
    createRestaurant(bob, { workspaceId: aliceWs.workspaceId, name: "X", location: "Y" }),
    status(403),
  );
  assert.deepEqual(await listRestaurants(bob, bobWs.workspaceId), []);
});

test("restaurant input is validated before storage", async () => {
  const { as, members, rows } = world();
  const alice = as("alice");
  const [{ workspaceId }] = await listWorkspaces(alice);
  const base = { workspaceId, name: "Cafe", location: "City" };

  for (const body of [
    null,
    [],
    { ...base, workspaceId: "not-a-uuid" },
    { ...base, name: "" },
    { ...base, name: "x".repeat(121) },
    { ...base, location: undefined },
    { ...base, website: "http://127.0.0.1/admin" },
    { ...base, website: "file:///etc/passwd" },
    { ...base, website: "https://user:pass@example.com" },
    { ...base, aliases: Array(11).fill("a") },
    { ...base, aliases: "not a list" },
  ])
    await assert.rejects(createRestaurant(alice, body), status(400), JSON.stringify(body));
  assert.equal(rows.length, 0, "nothing invalid was stored");

  const withSite = await createRestaurant(alice, {
    ...base,
    website: "https://example.com/menu",
    confirmed: true,
  });
  assert.equal(withSite.website, "https://example.com/menu");
  assert.ok(withSite.confirmedAt);

  // Viewers can read but not write.
  members.push({ userId: "val", workspaceId, name: "Shared", role: "viewer" });
  const val = as("val");
  assert.equal((await listRestaurants(val, workspaceId)).length, 1);
  await assert.rejects(createRestaurant(val, base), status(403));

  await assert.rejects(getRestaurant(alice, "../etc"), status(404));
});

test("mutations require same-origin JSON within the body limit", async () => {
  const post = (headers: Record<string, string>, body = "{}") =>
    new Request("https://app.example.test/api/restaurants", {
      method: "POST",
      headers,
      body,
    });
  assert.doesNotThrow(() =>
    assertSameOrigin(post({ origin: "https://app.example.test" })),
  );
  // Proxied deployments: request.url names the internal address.
  assert.doesNotThrow(() =>
    assertSameOrigin(
      post({ origin: "https://preview.example.test", "x-forwarded-host": "preview.example.test" }),
    ),
  );
  assert.throws(
    () => assertSameOrigin(post({ origin: "https://evil.example.test", "x-forwarded-host": "preview.example.test" })),
    status(403),
  );
  assert.throws(() => assertSameOrigin(post({ origin: "null" })), status(403));
  assert.throws(() => assertSameOrigin(post({})), status(403));
  assert.throws(
    () => assertSameOrigin(post({ origin: "https://evil.example.test" })),
    status(403),
  );
  await assert.rejects(readJson(post({ "content-type": "text/plain" })), status(415));
  await assert.rejects(
    readJson(post({ "content-type": "application/json" }, "{bad")),
    status(400),
  );
  await assert.rejects(
    readJson(
      post({ "content-type": "application/json" }, JSON.stringify({ a: "x".repeat(20_000) })),
    ),
    status(413),
  );
  assert.deepEqual(
    await readJson(post({ "content-type": "application/json" }, '{"a":1}')),
    { a: 1 },
  );
});
