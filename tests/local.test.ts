import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import type { Bootstrap } from "../shared/types.ts";

const execute = promisify(execFile);
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const script = join(root, "scripts/local.mjs");

async function availablePort() {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  return address.port;
}

test(
  "managed local server starts once, stops fully, and preserves synthetic history across restart",
  {
    timeout: 120_000,
    skip: existsSync(join(root, "dist/index.html"))
      ? false
      : "Run npm run build first to check the built-server lifecycle.",
  },
  async () => {
    const directory = await mkdtemp(join(tmpdir(), "tablesignal local-"));
    const database = join(directory, "test.sqlite");
    const port = await availablePort();
    const url = `http://127.0.0.1:${port}`;
    const env = {
      ...process.env,
      PORT: String(port),
      TABLESIGNAL_DB_PATH: database,
      TABLESIGNAL_RUNTIME_DIR: join(directory, "runtime"),
      OPENAI_API_KEY: "",
      TABLESIGNAL_CODEX_PATH: join(directory, "no-provider-installed"),
    };
    const manager = (command: "up" | "down" | "status") =>
      execute(process.execPath, [script, command], {
        cwd: root,
        env,
        timeout: 25_000,
        windowsHide: true,
      });
    const status = async () => {
      const output = await manager("status");
      return JSON.parse(output.stdout) as {
        healthy: boolean;
        supervisorRunning: boolean;
        supervisorPid?: number;
        database: string;
      };
    };
    const request = (path: string) =>
      fetch(`${url}${path}`, { signal: AbortSignal.timeout(5_000) });
    const snapshot = async () => {
      const response = await request("/api/bootstrap");
      assert.equal(response.status, 200);
      const data = (await response.json()) as Bootstrap;
      assert.equal(data.restaurants.length, 1);
      assert.ok(data.runs.length > 0);
      assert.ok(data.runs.every((run) => run.mode === "synthetic"));
      const history = data.runs
        .map((run) => ({
          id: run.id,
          createdAt: run.createdAt,
          completedAt: run.completedAt,
          answers: run.results.map((result) => ({
            id: result.id,
            hash: createHash("sha256").update(result.rawAnswer).digest("hex"),
          })),
        }))
        .sort((a, b) => a.id.localeCompare(b.id));
      return history;
    };

    try {
      await manager("up");
      const response = await request("/api/health");
      assert.equal(response.status, 200);
      const health = await response.json();
      assert.equal(health.ok, true);
      assert.equal(health.storage, "sqlite");

      const firstStatus = await status();
      assert.equal(firstStatus.healthy, true);
      assert.equal(firstStatus.supervisorRunning, true);
      assert.ok(
        Number.isSafeInteger(firstStatus.supervisorPid) &&
          firstStatus.supervisorPid! > 0,
      );
      assert.equal(firstStatus.database, database);
      const original = await snapshot();

      if (existsSync(join(root, "dist/index.html"))) {
        const page = await request("/");
        assert.equal(page.status, 200);
        assert.match(await page.text(), /<div id="root"><\/div>/);
      }

      await manager("up");
      assert.equal(
        (await status()).supervisorPid,
        firstStatus.supervisorPid,
        "repeated startup must reuse the same supervisor",
      );

      await manager("down");
      const stopped = await status();
      assert.equal(stopped.healthy, false);
      assert.equal(stopped.supervisorRunning, false);
      await assert.rejects(request("/api/health"));

      await manager("up");
      const restarted = await status();
      assert.equal(restarted.healthy, true);
      assert.equal(restarted.supervisorRunning, true);
      assert.equal(restarted.database, database);
      assert.deepEqual(
        await snapshot(),
        original,
        "restart must retain saved timestamps, answer identities, and exact answer hashes",
      );
    } finally {
      await manager("down");
      await rm(directory, { recursive: true, force: true });
    }
  },
);
