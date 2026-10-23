import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

// Minimal stand-ins for what a Supabase project provides before migrations run:
// API roles, auth.users and auth.uid() reading the verified JWT claims. They let
// the real migration and RLS policies execute as `authenticated` / `anon`.
const SUPABASE_STUB = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', '')::uuid
  $$;
  grant usage on schema auth to anon, authenticated;
  grant usage on schema public to anon, authenticated;
  -- Mimic Supabase's broad defaults so the migration's revokes are exercised.
  alter default privileges in schema public grant all on tables to anon, authenticated;
`;

async function database() {
  const db = new PGlite();
  await db.exec(SUPABASE_STUB);
  const dir = resolve("supabase/migrations");
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort())
    await db.exec(readFileSync(resolve(dir, file), "utf8"));
  return db;
}

async function user(db: PGlite) {
  const userId = randomUUID();
  await db.query("insert into auth.users (id) values ($1)", [userId]);
  return userId;
}

/** Run statements in one transaction as an API role with the given JWT subject. */
async function as<T = Record<string, unknown>>(
  db: PGlite,
  role: "authenticated" | "anon",
  userId: string | null,
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  return db.transaction(async (tx) => {
    await tx.query("select set_config('request.jwt.claims', $1, true)", [
      JSON.stringify(userId ? { sub: userId, role } : { role }),
    ]);
    await tx.exec(`set local role ${role}`);
    return (await tx.query<T>(sql, params)).rows;
  });
}

const insertRestaurant = `insert into public.restaurants (id, workspace_id, name, location)
  values ($1, $2, $3, $4) returning id`;

test("workspace RLS isolates restaurants between tenants and blocks anonymous access", async () => {
  const db = await database();
  const alice = await user(db);
  const bob = await user(db);

  const [{ ws: aliceWs }] = await as<{ ws: string }>(
    db, "authenticated", alice, "select public.ensure_personal_workspace() as ws",
  );
  const [{ ws: again }] = await as<{ ws: string }>(
    db, "authenticated", alice, "select public.ensure_personal_workspace() as ws",
  );
  assert.equal(again, aliceWs, "personal workspace creation is idempotent");
  const [{ ws: bobWs }] = await as<{ ws: string }>(
    db, "authenticated", bob, "select public.ensure_personal_workspace() as ws",
  );
  assert.notEqual(bobWs, aliceWs);

  const restaurantId = `restaurant_${randomUUID()}`;
  await as(db, "authenticated", alice, insertRestaurant, [
    restaurantId, aliceWs, "Example Cafe", "Example City",
  ]);

  // Owner reads it back; created_by defaulted to the caller.
  const own = await as<{ id: string; created_by: string }>(
    db, "authenticated", alice, "select id, created_by from public.restaurants where id = $1", [restaurantId],
  );
  assert.deepEqual(own, [{ id: restaurantId, created_by: alice }]);

  // Another workspace's member cannot see, update or create into it.
  assert.deepEqual(
    await as(db, "authenticated", bob, "select id from public.restaurants where id = $1", [restaurantId]),
    [],
  );
  assert.deepEqual(
    await as(db, "authenticated", bob,
      "update public.restaurants set name = 'Hijacked' where id = $1 returning id", [restaurantId]),
    [],
  );
  await assert.rejects(
    as(db, "authenticated", bob, insertRestaurant, [
      `restaurant_${randomUUID()}`, aliceWs, "Injected", "Elsewhere",
    ]),
    /row-level security/,
  );
  assert.deepEqual(
    await as(db, "authenticated", bob, "select id from public.workspaces where id = $1", [aliceWs]),
    [],
  );
  assert.deepEqual(
    await as(db, "authenticated", bob,
      "select user_id from public.workspace_members where workspace_id = $1", [aliceWs]),
    [],
  );

  // Clients cannot grant themselves membership or move rows between tenants.
  await assert.rejects(
    as(db, "authenticated", bob,
      "insert into public.workspace_members (workspace_id, user_id, role) values ($1, $2, 'owner')",
      [aliceWs, bob]),
    /permission denied/,
  );
  await assert.rejects(
    as(db, "authenticated", alice,
      "update public.restaurants set workspace_id = $2 where id = $1", [restaurantId, bobWs]),
    /permission denied/,
  );
  await assert.rejects(
    as(db, "authenticated", alice, "delete from public.restaurants where id = $1", [restaurantId]),
    /permission denied/,
  );

  // Anonymous callers get nothing and cannot create workspaces.
  await assert.rejects(
    as(db, "anon", null, "select id from public.restaurants"),
    /permission denied/,
  );
  await assert.rejects(
    as(db, "anon", null, "select public.ensure_personal_workspace()"),
    /permission denied/,
  );

  // Name survived every rejected mutation.
  const [{ name }] = (await db.query<{ name: string }>(
    "select name from public.restaurants where id = $1", [restaurantId],
  )).rows;
  assert.equal(name, "Example Cafe");
  await db.close();
});

test("the SQL-editor isolation check passes and leaves no data behind", async () => {
  const db = await database();
  const results = await db.exec(
    readFileSync(resolve("supabase/verify/m1_rls_check.sql"), "utf8"),
  );
  assert.deepEqual(results.at(-1)?.rows, [{ result: "M1 RLS check passed" }]);
  for (const table of ["auth.users", "public.workspaces", "public.workspace_members", "public.restaurants"]) {
    const [{ n }] = (await db.query<{ n: number }>(`select count(*)::int as n from ${table}`)).rows;
    assert.equal(n, 0, `${table} is empty after the check`);
  }
  await db.close();
});

test("the SQL-editor isolation check fails loudly when isolation is broken", async () => {
  const db = await database();
  await db.exec("create policy leak on public.restaurants for select to authenticated using (true)");
  await assert.rejects(
    db.exec(readFileSync(resolve("supabase/verify/m1_rls_check.sql"), "utf8")),
    /FAIL: other tenant can read the restaurant/,
  );
  const [{ n }] = (await db.query<{ n: number }>("select count(*)::int as n from auth.users")).rows;
  assert.equal(n, 0, "a failed check is rolled back");
  await db.close();
});

test("restaurant rows reject invalid identities and spoofed creators", async () => {
  const db = await database();
  const alice = await user(db);
  const mallory = await user(db);
  const [{ ws }] = await as<{ ws: string }>(
    db, "authenticated", alice, "select public.ensure_personal_workspace() as ws",
  );
  await assert.rejects(
    as(db, "authenticated", alice, insertRestaurant, ["not-an-id", ws, "Cafe", "City"]),
    /check constraint/,
  );
  await assert.rejects(
    as(db, "authenticated", alice, insertRestaurant, [`restaurant_${randomUUID()}`, ws, "", "City"]),
    /check constraint/,
  );
  await assert.rejects(
    as(db, "authenticated", alice,
      "insert into public.restaurants (id, workspace_id, name, location, created_by) values ($1,$2,'Cafe','City',$3)",
      [`restaurant_${randomUUID()}`, ws, mallory]),
    /row-level security/,
  );
  await db.close();
});
