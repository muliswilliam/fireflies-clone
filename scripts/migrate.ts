import { createDb } from "../src/lib/db/client";
import { runMigrations } from "../src/lib/db/migrate";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }
  const db = createDb(url);
  try {
    await runMigrations(db);
    console.log("Migrations applied");
  } finally {
    await db.$client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
