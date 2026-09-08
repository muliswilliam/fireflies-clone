import { migrate } from "drizzle-orm/node-postgres/migrator";
import path from "node:path";

import type { Db } from "./client";

/** Applies every pending SQL migration from the checked-in `drizzle/` folder. */
export async function runMigrations(db: Db, projectRoot = process.cwd()) {
  await migrate(db, { migrationsFolder: path.join(projectRoot, "drizzle") });
}
