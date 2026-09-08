"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import type { MeetingStatus } from "@/lib/db/schema";
import type { MeetingStatusReport } from "@/lib/meetings";

export const STATUS_POLL_INTERVAL_MS = 2_000;

const TERMINAL: ReadonlySet<MeetingStatus> = new Set(["ready", "failed"]);

/**
 * While a Meeting is in flight, asks the status route every 2 seconds and re-renders
 * the page from the server as soon as the Status changes (ADR-0002). Renders nothing.
 */
export function StatusPoller({
  meetingId,
  status,
}: {
  meetingId: string;
  status: MeetingStatus;
}) {
  const router = useRouter();

  useEffect(() => {
    if (TERMINAL.has(status)) return;

    let cancelled = false;
    let inFlight = false;

    const poll = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const response = await fetch(`/api/meetings/${meetingId}/status`, {
          cache: "no-store",
        });
        if (response.status === 404) {
          // The Meeting is gone; let the page render its not-found state.
          cancelled = true;
          clearInterval(interval);
          router.refresh();
          return;
        }
        if (!response.ok) return;
        const report = (await response.json()) as MeetingStatusReport;
        if (!cancelled && report.status !== status) router.refresh();
      } catch {
        // A missed poll is harmless; the next one will catch up.
      } finally {
        inFlight = false;
      }
    };

    const interval = setInterval(poll, STATUS_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [meetingId, status, router]);

  return null;
}
