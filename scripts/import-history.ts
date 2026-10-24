import { resolve } from "node:path";
import { importHistory } from "../server/import-history.ts";
import { RecordStore } from "../server/record-store.ts";

if (!process.env.DATABASE_URL) {
  console.error(
    "Configure a private DATABASE_URL pointing to an empty TableSignal database.",
  );
  process.exitCode = 1;
} else {
  const store = new RecordStore({ databaseUrl: process.env.DATABASE_URL });
  try {
    await store.ready();
    const summary = await importHistory(
      resolve(process.argv[2] || "data/tablesignal.sqlite"),
      store,
    );
    console.log(
      JSON.stringify({ imported: true, verifiedTables: summary }, null, 2),
    );
  } catch {
    console.error(
      "Import did not complete. The destination must be empty and migrated; existing records and the source database are preserved.",
    );
    process.exitCode = 1;
  } finally {
    await store.close();
  }
}
