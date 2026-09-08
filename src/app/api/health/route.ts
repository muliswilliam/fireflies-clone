import { getDb } from "@/lib/db";
import { healthResponse } from "@/lib/health";

export const dynamic = "force-dynamic";

export async function GET() {
  return healthResponse(getDb());
}
