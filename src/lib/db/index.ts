import "server-only";

import { getEnv } from "@/lib/env";

import { createDb, type Db } from "./client";

const globalForDb = globalThis as typeof globalThis & { __fireflyDb?: Db };

/** Process-wide database handle, created lazily so builds never need a database. */
export function getDb(): Db {
  globalForDb.__fireflyDb ??= createDb(getEnv().DATABASE_URL);
  return globalForDb.__fireflyDb;
}
