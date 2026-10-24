import { DatabaseSync } from "node:sqlite";
import { extname } from "node:path";
import { tables, hash } from "./store.ts";
import type { RecordStore } from "./record-store.ts";

/** Explicit, atomic import into an empty database. The source is always read-only. */
export async function importHistory(path: string, destination: RecordStore) {
  if (extname(path) !== ".sqlite" || destination.kind !== "postgres")
    throw new Error(
      "Choose a SQLite evidence database and a PostgreSQL destination.",
    );
  const source = new DatabaseSync(path, { readOnly: true });
  try {
    // One consistent read snapshot, including WAL records, without copying
    // open database files or touching CLI/authentication configuration.
    source.exec("BEGIN");
    const records = tables.map((table) => ({
      table,
      rows: source
        .prepare(`SELECT data FROM ${table} ORDER BY rowid`)
        .all()
        .map((row) => JSON.parse(row.data as string) as { id: string }),
    }));
    const requests = source
      .prepare("SELECT * FROM idempotency ORDER BY key")
      .all() as {
      key: string;
      operation: string;
      entityId: string;
      fingerprint: string;
    }[];
    const canonical = (value: unknown): unknown =>
      Array.isArray(value)
        ? value.map(canonical)
        : value && typeof value === "object"
          ? Object.fromEntries(
              Object.entries(value)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([key, entry]) => [key, canonical(entry)]),
            )
          : value;
    return await destination.transaction(async () => {
      for (const { table } of records)
        if ((await destination.all(table)).length)
          throw new Error(
            "The destination is populated. No records were imported or overwritten.",
          );
      if ((await destination.requests()).length)
        throw new Error(
          "The destination contains request history. No records were imported.",
        );
      for (const { table, rows } of records)
        for (const row of rows) await destination.put(table, row);
      for (const request of requests)
        await destination.saveRequest(
          request.key,
          request.operation,
          request.entityId,
          request.fingerprint,
        );
      const summary: Record<string, { count: number; sha256: string }> = {};
      for (const { table, rows } of records) {
        const expected = hash(canonical(rows));
        const actual = hash(canonical(await destination.all(table)));
        if (expected !== actual)
          throw new Error(
            "Imported record verification failed; the transaction was rolled back.",
          );
        summary[table] = { count: rows.length, sha256: actual };
      }
      const requestHash = hash(canonical(requests));
      if (requestHash !== hash(canonical(await destination.requests())))
        throw new Error(
          "Request-history verification failed; the transaction was rolled back.",
        );
      summary.idempotency = { count: requests.length, sha256: requestHash };
      return summary;
    });
  } finally {
    source.close();
  }
}
