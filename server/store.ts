import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { createHash, randomUUID } from "node:crypto";

export const id = (prefix: string) => `${prefix}_${randomUUID()}`;
export const hash = (value: unknown) =>
  createHash("sha256")
    .update(typeof value === "string" ? value : JSON.stringify(value))
    .digest("hex");
export const now = () => new Date().toISOString();
export type Table =
  | "restaurants"
  | "banks"
  | "runs"
  | "sources"
  | "opportunities"
  | "artifacts"
  | "settings"
  | "calls"
  | "comparisons";
const tables: Table[] = [
  "restaurants",
  "banks",
  "runs",
  "sources",
  "opportunities",
  "artifacts",
  "settings",
  "calls",
  "comparisons",
];

export class Store {
  db: DatabaseSync;
  constructor(path: string) {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec("PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;");
    for (const table of tables)
      this.db.exec(
        `CREATE TABLE IF NOT EXISTS ${table} (id TEXT PRIMARY KEY, data TEXT NOT NULL)`,
      );
    this.db.exec(
      "CREATE TABLE IF NOT EXISTS idempotency (key TEXT PRIMARY KEY, operation TEXT NOT NULL, entityId TEXT NOT NULL, fingerprint TEXT NOT NULL)",
    );
  }
  get<T>(table: Table, key: string): T | undefined {
    const row = this.db
      .prepare(`SELECT data FROM ${table} WHERE id = ?`)
      .get(key) as { data: string } | undefined;
    return row ? (JSON.parse(row.data) as T) : undefined;
  }
  all<T>(table: Table): T[] {
    return (
      this.db.prepare(`SELECT data FROM ${table} ORDER BY rowid`).all() as {
        data: string;
      }[]
    ).map((row) => JSON.parse(row.data) as T);
  }
  put<T extends { id: string }>(table: Table, value: T): T {
    this.db
      .prepare(
        `INSERT INTO ${table}(id,data) VALUES (?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data`,
      )
      .run(value.id, JSON.stringify(value));
    return value;
  }
  transaction<T>(fn: () => T): T {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const result = fn();
      this.db.exec("COMMIT");
      return result;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }
  request(key: string) {
    return this.db.prepare("SELECT * FROM idempotency WHERE key=?").get(key) as
      | {
          key: string;
          operation: string;
          entityId: string;
          fingerprint: string;
        }
      | undefined;
  }
  saveRequest(
    key: string,
    operation: string,
    entityId: string,
    fingerprint: string,
  ) {
    this.db
      .prepare("INSERT INTO idempotency VALUES (?,?,?,?)")
      .run(key, operation, entityId, fingerprint);
  }
  close() {
    this.db.close();
  }
}
