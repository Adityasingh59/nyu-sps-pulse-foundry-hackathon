import { RecordStore } from "../server/record-store.ts";

if (!process.env.DATABASE_URL) {
  console.error(
    "Configure DATABASE_URL in the host's private environment before migrating.",
  );
  process.exitCode = 1;
} else {
  const store = new RecordStore({ databaseUrl: process.env.DATABASE_URL });
  try {
    await store.migrate();
    console.log(
      "TableSignal PostgreSQL schema ready. Existing records preserved.",
    );
  } catch {
    console.error(
      "Schema preparation failed. Check the private database configuration and connectivity.",
    );
    process.exitCode = 1;
  } finally {
    await store.close();
  }
}
