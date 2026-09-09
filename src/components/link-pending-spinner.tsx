"use client";

import { Loader2 } from "lucide-react";
import { useLinkStatus } from "next/link";

import { cn } from "@/lib/utils";

/**
 * A spinner that fades in while the Link around it is navigating. Used on Meeting rows: the
 * Meeting page is dynamic and has no `loading.tsx` on purpose: a route-level skeleton streams a 200 shell before
 * `notFound()` can answer 404 for a missing Meeting. Always rendered at a fixed size so
 * nothing shifts when it appears.
 */
export function LinkPendingSpinner({ className }: { className?: string }) {
  const { pending } = useLinkStatus();
  return (
    <Loader2
      aria-hidden="true"
      className={cn(
        "text-muted-foreground size-4 shrink-0 animate-spin transition-opacity",
        pending ? "opacity-100" : "opacity-0",
        className,
      )}
    />
  );
}
