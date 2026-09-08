"use client";

import { RefreshCw } from "lucide-react";
import { useState, useTransition } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

import { regenerateSummaryAction } from "./actions";

/** Regenerate the Summary, after warning that the Action Items and their done state are replaced. */
export function RegenerateSummaryButton({ meetingId }: { meetingId: string }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function regenerate() {
    startTransition(async () => {
      await regenerateSummaryAction(meetingId);
      setOpen(false);
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        render={<Button type="button" variant="outline" size="sm" />}
      >
        <RefreshCw data-icon="inline-start" aria-hidden="true" />
        Regenerate
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Regenerate the Summary?</AlertDialogTitle>
          <AlertDialogDescription>
            A new Overview, Key Takeaways and Action Items replace the current
            ones. Anything you have marked done is lost.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            type="button"
            onClick={regenerate}
            disabled={pending}
          >
            {pending ? "Regenerating…" : "Regenerate"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
