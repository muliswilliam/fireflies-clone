"use client";

import { ErrorState } from "@/components/error-state";

import "./globals.css";

/** Only reached when the root layout itself throws, so it has to provide its own document. */
export default function GlobalError(props: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <title>Something went wrong · Firefly Notes</title>
        <ErrorState {...props} />
      </body>
    </html>
  );
}
