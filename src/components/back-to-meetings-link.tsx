import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export function BackToMeetingsLink() {
  return (
    <Link
      href="/"
      className="text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-1.5 text-sm"
    >
      <ArrowLeft aria-hidden="true" className="size-4" />
      Meetings
    </Link>
  );
}
