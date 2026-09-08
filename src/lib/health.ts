import { sql } from "drizzle-orm";

import type { Db } from "@/lib/db/client";

export type HealthReport =
  | { status: "ok"; database: "ok" }
  | { status: "unavailable"; database: "unreachable" };

/** Answers whether the app can reach its database. Never throws. */
export async function checkHealth(db: Db): Promise<HealthReport> {
  try {
    await db.execute(sql`select 1`);
    return { status: "ok", database: "ok" };
  } catch (error) {
    console.error("Health check: database unreachable", error);
    return { status: "unavailable", database: "unreachable" };
  }
}

/** HTTP view of the health report: 200 when healthy, 503 otherwise. */
export async function healthResponse(db: Db): Promise<Response> {
  const report = await checkHealth(db);
  return Response.json(report, {
    status: report.status === "ok" ? 200 : 503,
    headers: { "cache-control": "no-store" },
  });
}
