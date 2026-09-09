import { Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/** Marks a Sample Meeting: seeded with the app so the workspace is never empty, otherwise ordinary. */
export function SampleBadge({ className }: { className?: string }) {
  return (
    <Badge
      variant="outline"
      title="Seeded with the app as an example"
      className={cn("text-muted-foreground", className)}
    >
      <Sparkles data-icon="inline-start" aria-hidden="true" />
      Sample
    </Badge>
  );
}
