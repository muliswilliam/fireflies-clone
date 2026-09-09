"use client";

import { AlertCircle, RotateCcw } from "lucide-react";
import { useEffect } from "react";

import { Button, buttonVariants } from "@/components/ui/button";

/**
 * What a route shows when rendering it threw. Next passes the error and a `retry` that
 * re-fetches and re-renders the segment; the message itself stays server-side in production.
 */
export function ErrorState({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center px-6 py-20 text-center sm:px-8">
      <span className="bg-destructive/10 text-destructive flex size-12 items-center justify-center rounded-full">
        <AlertCircle aria-hidden="true" className="size-5" />
      </span>
      <h1 className="mt-5 text-2xl font-semibold tracking-tight">
        Something went wrong
      </h1>
      <p className="text-muted-foreground mt-2 max-w-sm text-sm leading-6">
        This page could not be loaded. Try again, or go back to your Meetings.
      </p>
      {error.digest && (
        <p className="text-muted-foreground mt-2 font-mono text-xs">
          Reference {error.digest}
        </p>
      )}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Button type="button" onClick={() => retry()}>
          <RotateCcw data-icon="inline-start" aria-hidden="true" />
          Try again
        </Button>
        {/* A full navigation, not a client-side one: the boundary only resets when the pathname
            changes, and an error on the list itself would otherwise keep showing this page. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- the full load is the point */}
        <a href="/" className={buttonVariants({ variant: "outline" })}>
          Back to meetings
        </a>
      </div>
    </main>
  );
}
