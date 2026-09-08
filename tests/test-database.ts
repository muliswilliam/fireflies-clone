import { Client } from "pg";

export const DEFAULT_TEST_DATABASE_URL =
  "postgres://postgres:postgres@localhost:5433/firefly_notes_test";

/** Tests always use their own database so they can never touch development data. */
export function testDatabaseUrl(): string {
  return process.env.TEST_DATABASE_URL ?? DEFAULT_TEST_DATABASE_URL;
}

/** Creates the database named in `url` on its server when it does not exist yet. */
export async function ensureDatabaseExists(url: string): Promise<void> {
  const target = new URL(url);
  const databaseName = target.pathname.replace(/^\//, "");
  const maintenance = new URL(url);
  maintenance.pathname = "/postgres";

  const client = new Client({ connectionString: maintenance.toString() });
  await client.connect();
  try {
    const existing = await client.query(
      "select 1 from pg_database where datname = $1",
      [databaseName],
    );
    if (existing.rowCount === 0) {
      await client.query(
        `create database "${databaseName.replaceAll('"', '""')}"`,
      );
    }
  } finally {
    await client.end();
  }
}
