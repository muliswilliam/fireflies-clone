import { createDb } from "../src/lib/db/client";
import { runMigrations } from "../src/lib/db/migrate";
import { ensureDatabaseExists, testDatabaseUrl } from "./test-database";

export default async function globalSetup() {
  const url = testDatabaseUrl();
  await ensureDatabaseExists(url);
  const db = createDb(url);
  try {
    await runMigrations(db);
  } finally {
    await db.$client.end();
  }
}
