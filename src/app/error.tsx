"use client";

import { ErrorState } from "@/components/error-state";

/** Error boundary for every route: the list, the New meeting form and a Meeting. The header stays. */
export default function AppError(props: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return <ErrorState {...props} />;
}
