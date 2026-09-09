"use client";

import { Pencil } from "lucide-react";
import { useId, useRef, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MEETING_TITLE_REQUIRED_MESSAGE } from "@/lib/meetings/validation";

import { renameMeetingAction } from "./actions";

/**
 * The Meeting title as a heading with a Rename control. Renaming swaps the heading for an
 * input with Save and Cancel; Enter saves, Escape cancels, and a blank title is refused inline.
 */
export function MeetingTitle({
  meetingId,
  title,
}: {
  meetingId: string;
  title: string;
}) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const errorId = useId();

  function cancel() {
    setEditing(false);
    setError(null);
  }

  function save() {
    const next = inputRef.current?.value ?? "";
    if (next.trim().length === 0) {
      setError(MEETING_TITLE_REQUIRED_MESSAGE);
      inputRef.current?.focus();
      return;
    }
    if (next.trim() === title) {
      cancel();
      return;
    }
    startTransition(async () => {
      const result = await renameMeetingAction(meetingId, next);
      if (result.ok) {
        cancel();
      } else {
        setError(result.error);
      }
    });
  }

  if (!editing) {
    return (
      <div className="flex min-w-0 items-start gap-1.5">
        <h1 className="min-w-0 text-2xl font-semibold tracking-tight">
          {title}
        </h1>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Rename meeting"
          title="Rename"
          className="text-muted-foreground hover:text-foreground mt-0.5 shrink-0"
          onClick={() => setEditing(true)}
        >
          <Pencil aria-hidden="true" />
        </Button>
      </div>
    );
  }

  return (
    <form
      aria-label="Rename meeting"
      className="flex min-w-0 flex-wrap items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
    >
      <div className="min-w-0 flex-1 basis-64">
        <Input
          ref={inputRef}
          name="title"
          defaultValue={title}
          aria-label="Meeting title"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          autoFocus
          autoComplete="off"
          disabled={pending}
          // Sized and offset so the text sits exactly where the heading was: no layout shift.
          className="-my-0.5 -ml-2.5 h-9 w-[calc(100%+0.625rem)] px-2 text-2xl font-semibold tracking-tight md:text-2xl"
          onFocus={(event) => event.currentTarget.select()}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              cancel();
            }
          }}
          onChange={() => setError(null)}
        />
        {error && (
          <p
            id={errorId}
            role="alert"
            className="text-destructive mt-1.5 text-sm"
          >
            {error}
          </p>
        )}
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={cancel}
          disabled={pending}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
