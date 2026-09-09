import { seedDatabase } from "../src/lib/sample-meetings/seed";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }
  const seeded = await seedDatabase(url);
  console.log(
    `Seeded ${seeded.length} Sample Meetings: ${seeded.map((meeting) => meeting.title).join(", ")}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
