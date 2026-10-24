import { AsyncLocalStorage } from "node:async_hooks";
import { Client } from "pg";
import { Store, tables, type Table } from "./store.ts";

export interface SqlConnection {
  query(
    sql: string,
    values?: unknown[],
  ): Promise<{ rows: Record<string, any>[] }>;
  close(): Promise<void>;
}

/** One serialized connection, with re-entrant transactions for atomic domain writes. */
export class RecordStore {
  readonly kind: "sqlite" | "postgres";
  private queue: Promise<unknown> = Promise.resolve();
  private context = new AsyncLocalStorage<boolean>();
  private local?: Store;
  private connection?: SqlConnection;
  private client?: Client;
  private workerLock = false;
  private inTransaction = false;
  private closed = false;
  constructor(options: {
    dbPath?: string;
    connection?: SqlConnection;
    databaseUrl?: string;
  }) {
    this.kind =
      options.databaseUrl || options.connection ? "postgres" : "sqlite";
    this.connection = options.connection;
    if (this.kind === "sqlite") this.local = new Store(options.dbPath!);
    this.databaseUrl = options.databaseUrl;
  }
  private databaseUrl?: string;
  private async sql(sql: string, values: unknown[] = []) {
    if (this.connection) return this.connection.query(sql, values);
    if (!this.client) {
      if (this.inTransaction)
        throw new Error(
          "Database connection interrupted during a transaction.",
        );
      const url = new URL(this.databaseUrl!);
      if (/-pooler\./.test(url.hostname))
        throw new Error(
          "Use a direct PostgreSQL connection for the workspace worker.",
        );
      if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))
        url.searchParams.set("sslmode", "verify-full");
      const client = new Client({
        connectionString: url.href,
        connectionTimeoutMillis: 15_000,
      });
      const disconnected = () => {
        if (this.client === client) {
          this.client = undefined;
          this.workerLock = false;
        }
      };
      client.on("error", disconnected);
      client.on("end", disconnected);
      try {
        await client.connect();
        this.client = client;
      } catch {
        await client.end().catch(() => {});
        throw new Error("Unable to connect to the workspace database.");
      }
    }
    return this.client.query(sql, values);
  }
  private run<T>(fn: () => Promise<T> | T): Promise<T> {
    if (this.context.getStore()) return Promise.resolve().then(fn);
    const task = this.queue.then(() => this.context.run(true, fn));
    this.queue = task.catch(() => {});
    return task;
  }
  private table(table: Table) {
    if (!tables.includes(table)) throw new Error("Unsupported record table.");
    return `tablesignal.${table}`;
  }
  /** Explicit release step for a fresh hosted database; never drops existing data. */
  async migrate() {
    if (this.local) return;
    await this.transaction(async () => {
      if (!this.connection)
        await this.sql("SELECT pg_advisory_xact_lock(142731, 2)");
      await this.sql("CREATE SCHEMA IF NOT EXISTS tablesignal");
      for (const table of tables)
        await this.sql(
          `CREATE TABLE IF NOT EXISTS ${this.table(table)} (id TEXT PRIMARY KEY, data JSONB NOT NULL, sequence BIGSERIAL UNIQUE)`,
        );
      await this.sql(
        "CREATE TABLE IF NOT EXISTS tablesignal.idempotency (key TEXT PRIMARY KEY, operation TEXT NOT NULL, entity_id TEXT NOT NULL, fingerprint TEXT NOT NULL)",
      );
    });
  }
  async ready() {
    if (!this.local)
      await this.run(() =>
        this.sql("SELECT id FROM tablesignal.restaurants LIMIT 1"),
      );
  }
  get hasWorkerLock() {
    return (
      this.kind === "sqlite" || Boolean(this.connection) || this.workerLock
    );
  }
  claimWorker(): Promise<boolean> {
    return this.run(async () => {
      if (this.hasWorkerLock) return true;
      const result = await this.sql(
        "SELECT pg_try_advisory_lock(142731, 1) AS locked",
      );
      return (this.workerLock = result.rows[0]?.locked === true);
    });
  }
  releaseWorker() {
    return this.run(async () => {
      if (this.workerLock && this.client)
        await this.sql("SELECT pg_advisory_unlock(142731, 1)");
      this.workerLock = false;
    });
  }
  get<T>(table: Table, key: string): Promise<T | undefined> {
    return this.run(async () =>
      this.local
        ? this.local.get<T>(table, key)
        : ((
            await this.sql(
              `SELECT data FROM ${this.table(table)} WHERE id=$1`,
              [key],
            )
          ).rows[0]?.data as T | undefined),
    );
  }
  all<T>(table: Table): Promise<T[]> {
    return this.run(async () =>
      this.local
        ? this.local.all<T>(table)
        : (
            await this.sql(
              `SELECT data FROM ${this.table(table)} ORDER BY sequence`,
            )
          ).rows.map((row) => row.data as T),
    );
  }
  put<T extends { id: string }>(table: Table, value: T): Promise<T> {
    // Capture now so callers cannot mutate an in-flight write by reference.
    const saved = JSON.parse(JSON.stringify(value)) as T;
    return this.run(async () => {
      if (this.local) this.local.put(table, saved);
      else
        await this.sql(
          `INSERT INTO ${this.table(table)} (id,data) VALUES ($1,$2::jsonb) ON CONFLICT(id) DO UPDATE SET data=EXCLUDED.data`,
          [saved.id, JSON.stringify(saved)],
        );
      return saved;
    });
  }
  delete(table: Table, key: string) {
    this.table(table);
    return this.run(async () => {
      if (this.local)
        this.local.db.prepare(`DELETE FROM ${table} WHERE id=?`).run(key);
      else
        await this.sql(`DELETE FROM ${this.table(table)} WHERE id=$1`, [key]);
    });
  }
  transaction<T>(fn: () => Promise<T>): Promise<T> {
    if (this.context.getStore()) return fn();
    return this.run(async () => {
      if (this.local) this.local.db.exec("BEGIN IMMEDIATE");
      else await this.sql("BEGIN");
      this.inTransaction = true;
      try {
        if (!this.local && !this.connection)
          await this.sql("SELECT pg_advisory_xact_lock(142731, 3)");
        const result = await fn();
        if (this.local) this.local.db.exec("COMMIT");
        else await this.sql("COMMIT");
        return result;
      } catch (error) {
        if (this.local) this.local.db.exec("ROLLBACK");
        else await this.sql("ROLLBACK").catch(() => {});
        throw error;
      } finally {
        this.inTransaction = false;
      }
    });
  }
  request(key: string) {
    return this.run(async () =>
      this.local
        ? this.local.request(key)
        : ((
            await this.sql(
              'SELECT key, operation, entity_id AS "entityId", fingerprint FROM tablesignal.idempotency WHERE key=$1',
              [key],
            )
          ).rows[0] as
            | {
                key: string;
                operation: string;
                entityId: string;
                fingerprint: string;
              }
            | undefined),
    );
  }
  requests() {
    return this.run(async () =>
      this.local
        ? (this.local.db
            .prepare("SELECT * FROM idempotency ORDER BY key")
            .all() as {
            key: string;
            operation: string;
            entityId: string;
            fingerprint: string;
          }[])
        : ((
            await this.sql(
              'SELECT key, operation, entity_id AS "entityId", fingerprint FROM tablesignal.idempotency ORDER BY key',
            )
          ).rows as {
            key: string;
            operation: string;
            entityId: string;
            fingerprint: string;
          }[]),
    );
  }
  saveRequest(
    key: string,
    operation: string,
    entityId: string,
    fingerprint: string,
  ) {
    return this.run(async () => {
      if (this.local)
        this.local.saveRequest(key, operation, entityId, fingerprint);
      else
        await this.sql(
          "INSERT INTO tablesignal.idempotency (key,operation,entity_id,fingerprint) VALUES ($1,$2,$3,$4)",
          [key, operation, entityId, fingerprint],
        );
    });
  }
  async close() {
    if (this.closed) return;
    this.closed = true;
    await this.run(async () => {
      this.local?.close();
      await this.connection?.close();
      await this.client?.end();
      this.client = undefined;
    });
  }
}
