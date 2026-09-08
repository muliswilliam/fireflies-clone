import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";

export default function MeetingNotFound() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center px-6 py-20 text-center sm:px-8">
      <h1 className="text-2xl font-semibold tracking-tight">
        Meeting not found
      </h1>
      <p className="text-muted-foreground mt-2 max-w-sm text-sm leading-6">
        This Meeting does not exist or has been deleted.
      </p>
      <Link
        href="/"
        className={buttonVariants({ variant: "outline", className: "mt-6" })}
      >
        Back to meetings
      </Link>
    </main>
  );
}
