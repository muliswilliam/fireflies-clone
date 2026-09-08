import { migrateDatabase } from "../src/lib/db/migrate";
import { ensureDatabaseExists, testDatabaseUrl } from "./test-database";

export default async function globalSetup() {
  const url = testDatabaseUrl();
  await ensureDatabaseExists(url);
  await migrateDatabase(url);
}
