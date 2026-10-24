import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { RecordStore, type SqlConnection } from "../server/record-store.ts";
import { createApplication } from "../server/index.ts";
import { hash } from "../server/store.ts";
import { importHistory } from "../server/import-history.ts";
import type { QueryBank, Run } from "../shared/types.ts";

async function openStore(path: string) {
  // Real PostgreSQL SQL/JSONB semantics in an embedded test process. This does
  // not pretend to verify Neon networking/TLS or Render deployment.
  const db = new PGlite(path);
  await db.waitReady;
  const connection: SqlConnection = {
    query: async (sql, values) => ({
      rows: (await db.query(sql, values)).rows as Record<string, any>[],
    }),
    close: () => db.close(),
  };
  const store = new RecordStore({ connection });
  await store.migrate();
  return store;
}

test("PostgreSQL persistence rolls back failed work and resumes saved observations after a full database reopen", async () => {
  const folder = await mkdtemp(join(tmpdir(), "tablesignal-postgres-"));
  const pgPath = join(folder, "cloud");
  const sqlitePath = join(folder, "history.sqlite");
  const local = await createApplication({ dbPath: sqlitePath, worker: false });
  await local.store.saveRequest(
    "saved-history-key",
    "start-run",
    "run_linden_baseline",
    "unchanged-fingerprint",
  );
  await local.close();
  let store = await openStore(pgPath);
  const imported = await importHistory(sqlitePath, store);
  assert.equal(imported.runs.count, 1);
  assert.equal(imported.idempotency.count, 1);
  await assert.rejects(
    importHistory(sqlitePath, store),
    /destination is populated/,
  );
  assert.equal(
    (await store.request("saved-history-key"))?.fingerprint,
    "unchanged-fingerprint",
  );
  let runtime = await createApplication({ recordStore: store, worker: false });
  try {
    const original = (await store.get<Run>("runs", "run_linden_baseline"))!;
    const originalAnswer = original.results[0].rawAnswer;
    await assert.rejects(
      store.transaction(async () => {
        await store.put("restaurants", {
          id: "rolled-back",
          name: "Should not persist",
        });
        await store.saveRequest(
          "rolled-back-key",
          "test",
          "rolled-back",
          "hash",
        );
        throw new Error("Intentional rollback");
      }),
      /Intentional rollback/,
    );
    assert.equal(await store.get("restaurants", "rolled-back"), undefined);
    assert.equal(await store.request("rolled-back-key"), undefined);
    const bank = (await store.get<QueryBank>("banks", original.bankId))!;
    const nextBank = {
      ...bank,
      id: "pg-recovery-bank",
      queries: bank.queries.slice(0, 2),
    };
    nextBank.contentHash = hash(nextBank.queries);
    await store.put("banks", nextBank);
    const interrupted: Run = {
      ...original,
      id: "pg-recovery-run",
      bankId: nextBank.id,
      status: "running",
      completedAt: undefined,
      results: original.results.slice(0, 2).map((r, i) => ({
        ...r,
        id: `pg-result-${i}`,
        status: "running",
        rawAnswer: "",
        appearances: [],
        citations: [],
        attempts: 1,
      })),
    };
    await store.put("runs", interrupted);
    const settings = (await store.get<any>("settings", original.id))!;
    await store.put("settings", { ...settings, id: interrupted.id });
    await runtime.close();
    store = await openStore(pgPath);
    runtime = await createApplication({ recordStore: store });
    const deadline = Date.now() + 10_000;
    let finished = await store.get<Run>("runs", interrupted.id);
    while (
      ["running", "queued"].includes(finished!.status) &&
      Date.now() < deadline
    ) {
      await new Promise((resolve) => setTimeout(resolve, 50));
      finished = await store.get<Run>("runs", interrupted.id);
    }
    assert.equal(finished?.status, "completed");
    assert.equal(finished?.results.length, 2);
    assert.ok(
      finished?.results.every(
        (r) =>
          r.status === "succeeded" &&
          r.attempts === 2 &&
          r.rawAnswer.length > 0,
      ),
    );
    assert.equal(finished?.metrics?.valid, 2);
    assert.equal(
      (await store.get<Run>("runs", original.id))?.results[0].rawAnswer,
      originalAnswer,
    );
    await runtime.close();
    store = await openStore(pgPath);
    runtime = await createApplication({ recordStore: store, worker: false });
    const reopened = await store.get<Run>("runs", interrupted.id);
    assert.deepEqual(reopened, finished);
  } finally {
    await runtime.close();
    await rm(folder, { recursive: true, force: true });
  }
});
