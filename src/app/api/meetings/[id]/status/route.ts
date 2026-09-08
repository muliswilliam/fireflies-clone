import { getMeetingService } from "@/lib/meetings";

export const dynamic = "force-dynamic";

/** Lightweight Status for clients polling while a Meeting is processing (ADR-0002). */
export async function GET(
  _request: Request,
  { params }: RouteContext<"/api/meetings/[id]/status">,
) {
  const { id } = await params;
  const report = await getMeetingService().getMeetingStatus(id);
  if (!report) {
    return Response.json(
      { error: "Meeting not found" },
      { status: 404, headers: { "cache-control": "no-store" } },
    );
  }
  return Response.json(report, { headers: { "cache-control": "no-store" } });
}
