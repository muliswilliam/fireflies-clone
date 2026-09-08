import { migrate } from "drizzle-orm/node-postgres/migrator";

import { createDb, type Db } from "./client";

/** Applies every pending SQL migration from the checked-in `drizzle/` folder. */
export async function runMigrations(db: Db) {
  await migrate(db, { migrationsFolder: "drizzle" });
}

/** Connects to `url`, applies pending migrations, and releases the connection. */
export async function migrateDatabase(url: string) {
  const db = createDb(url);
  try {
    await runMigrations(db);
  } finally {
    await db.$client.end();
  }
}
