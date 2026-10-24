import test from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { createApplication } from "../server/index.ts";

test("online workspace gates data, assets and mutations while health stays public", async () => {
  const password = "test-fixture-only-password";
  await assert.rejects(
    createApplication({
      dbPath: ":memory:",
      access: { publicOrigin: "https://demo.example" },
    }),
    /requires TABLESIGNAL_ACCESS_PASSWORD/,
  );
  const runtime = await createApplication({
    dbPath: ":memory:",
    worker: false,
    access: { publicOrigin: "https://demo.example", password },
  });
  const server = runtime.app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const headers = {
    Authorization: `Basic ${Buffer.from(`operator:${password}`).toString("base64")}`,
    Origin: "https://demo.example",
  };
  try {
    assert.equal((await fetch(base + "/api/health")).status, 200);
    for (const path of [
      "/",
      "/api/bootstrap",
      "/api/artifacts/anything/export",
      "/assets/anything.js",
    ])
      assert.equal((await fetch(base + path)).status, 401, path);
    assert.equal(
      (await fetch(base + "/api/bootstrap", { headers })).status,
      200,
    );
    assert.equal(
      (
        await fetch(base + "/api/bootstrap", {
          headers: { ...headers, Origin: "https://attacker.example" },
        })
      ).status,
      403,
    );
    const response = await fetch(
      base + "/api/restaurants/restaurant_linden/query-banks",
      {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: "{}",
      },
    );
    assert.equal(response.status, 201);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await runtime.close();
  }
});
