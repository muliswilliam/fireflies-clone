"use client";

import { CalendarDays } from "lucide-react";
import { useId, useOptimistic, useTransition } from "react";

import { SpeakerNumber } from "@/components/meetings/speaker-number";
import { Checkbox } from "@/components/ui/checkbox";
import type { ActionItem, Speaker } from "@/lib/meetings";
import { cn } from "@/lib/utils";

import { toggleActionItemAction } from "./actions";

/** The Action Items tab body: each item with its owner, due date and a done checkbox. */
export function ActionItemsList({
  meetingId,
  actionItems,
  speakers,
}: {
  meetingId: string;
  actionItems: ActionItem[];
  speakers: Speaker[];
}) {
  if (actionItems.length === 0) {
    return (
      <p className="text-muted-foreground rounded-xl border border-dashed px-6 py-16 text-center text-sm">
        No Action Items came out of this Meeting.
      </p>
    );
  }

  const speakersById = new Map(
    speakers.map((speaker) => [speaker.id, speaker]),
  );
  return (
    <ul aria-label="Action Items" className="divide-y rounded-xl border">
      {actionItems.map((item) => (
        <ActionItemRow
          key={item.id}
          meetingId={meetingId}
          item={item}
          owner={
            item.ownerSpeakerId
              ? (speakersById.get(item.ownerSpeakerId) ?? null)
              : null
          }
        />
      ))}
    </ul>
  );
}

function ActionItemRow({
  meetingId,
  item,
  owner,
}: {
  meetingId: string;
  item: ActionItem;
  owner: Speaker | null;
}) {
  const labelId = useId();
  const [pending, startTransition] = useTransition();
  // Show the flip at once; the server's answer replaces it when the page re-renders.
  const [done, setDone] = useOptimistic(item.done);

  function toggle() {
    startTransition(async () => {
      setDone(!done);
      await toggleActionItemAction(meetingId, item.id);
    });
  }

  return (
    <li
      data-done={done ? "true" : undefined}
      className="flex items-start gap-3 px-4 py-3 first:rounded-t-xl last:rounded-b-xl"
    >
      <Checkbox
        checked={done}
        onCheckedChange={toggle}
        disabled={pending}
        aria-labelledby={labelId}
        className="mt-1"
      />
      <div className="min-w-0 flex-1">
        <p
          id={labelId}
          className={cn(
            "text-sm leading-6",
            done && "text-muted-foreground line-through",
          )}
        >
          {item.text}
        </p>
        <p className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          {owner ? (
            <span className="flex items-center gap-1.5">
              <SpeakerNumber
                position={owner.position}
                className="size-4 text-[10px]"
              />
              {owner.name}
            </span>
          ) : (
            <span>No owner</span>
          )}
          {item.dueDate && (
            <span className="flex items-center gap-1">
              <CalendarDays aria-hidden="true" className="size-3.5" />
              {item.dueDate}
            </span>
          )}
        </p>
      </div>
    </li>
  );
}
