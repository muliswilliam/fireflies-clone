import { seedDatabase } from "../src/lib/sample-meetings/seed";

/**
 * Sample Meetings must be in the database before the e2e specs that browse them run.
 * Locally `DATABASE_URL` comes from `.env`, as it does for the dev server; CI sets it.
 */
export default async function globalSetup() {
  if (!process.env.DATABASE_URL) {
    try {
      process.loadEnvFile(".env");
    } catch {
      // No .env: DATABASE_URL must already be set.
    }
  }
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set; e2e needs the app database");
  }
  await seedDatabase(url);
}
