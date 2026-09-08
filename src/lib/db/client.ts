import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "./schema";

export type Db = NodePgDatabase<typeof schema> & { $client: Pool };

/**
 * Creates a typed Drizzle handle over a node-postgres pool.
 * Call `db.$client.end()` to release the pool when you own its lifetime.
 */
export function createDb(connectionString: string): Db {
  const pool = new Pool({ connectionString, connectionTimeoutMillis: 5_000 });
  return drizzle(pool, { schema });
}
