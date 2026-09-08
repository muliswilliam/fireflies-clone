"use client";

import { AlertCircle, Mic, Plus, X, Zap } from "lucide-react";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { SpeakerNumber } from "@/components/meetings/speaker-number";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
// Client code reads the rules module directly: the Meeting service index is server-only.
import {
  DEFAULT_INSTANT_MEETING_DURATION_MINUTES,
  INSTANT_MEETING_DURATION_OPTIONS_MINUTES,
  MAX_SPEAKERS,
  MIN_SPEAKERS,
} from "@/lib/meetings/validation";
import { cn } from "@/lib/utils";

import { createMeetingAction } from "./actions";
import {
  INITIAL_CREATE_MEETING_STATE,
  type CreateIntent,
  type CreateMeetingFormState,
} from "./form-state";

export type NewMeetingDefaults = {
  title: string;
  speakers: string[];
  agenda: string;
};

export function NewMeetingForm({ defaults }: { defaults: NewMeetingDefaults }) {
  const [state, formAction] = useActionState(
    createMeetingAction,
    INITIAL_CREATE_MEETING_STATE,
  );
  const [title, setTitle] = useState(defaults.title);
  const [speakers, setSpeakers] = useState(defaults.speakers);
  const [agenda, setAgenda] = useState(defaults.agenda);

  const errorFor = (path: string) => issueMessage(state, path);
  const titleError = errorFor("title");
  const speakersError = errorFor("speakers");
  const durationError = errorFor("durationMinutes");

  function updateSpeaker(index: number, name: string) {
    setSpeakers((current) =>
      current.map((existing, i) => (i === index ? name : existing)),
    );
  }

  function removeSpeaker(index: number) {
    setSpeakers((current) => current.filter((_, i) => i !== index));
  }

  function addSpeaker() {
    setSpeakers((current) => [...current, ""]);
  }

  return (
    <form action={formAction} noValidate className="mt-8">
      <FieldGroup>
        {state.formError && (
          <div
            role="alert"
            className="border-destructive/30 bg-destructive/5 text-destructive flex items-start gap-3 rounded-lg border px-4 py-3 text-sm"
          >
            <AlertCircle
              aria-hidden="true"
              className="mt-0.5 size-4 shrink-0"
            />
            <p>{state.formError}</p>
          </div>
        )}

        <Field data-invalid={titleError ? true : undefined}>
          <FieldLabel htmlFor="title">Title</FieldLabel>
          <Input
            id="title"
            name="title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            aria-invalid={titleError ? true : undefined}
            autoComplete="off"
            className="h-10"
          />
          <FieldError>{titleError}</FieldError>
        </Field>

        <FieldSet data-invalid={speakersError ? true : undefined}>
          <FieldLegend variant="label">Speakers</FieldLegend>
          <FieldDescription>
            {MIN_SPEAKERS} to {MAX_SPEAKERS} people, each with a unique name.
            The Transcript attributes every Utterance to one of them.
          </FieldDescription>
          <FieldGroup className="gap-3">
            {speakers.map((name, index) => {
              const speakerError = errorFor(`speakers.${index}`);
              const id = `speaker-${index}`;
              return (
                <Field
                  key={index}
                  data-invalid={speakerError ? true : undefined}
                >
                  <FieldLabel htmlFor={id} className="sr-only">
                    Speaker {index + 1}
                  </FieldLabel>
                  <div className="flex items-center gap-2">
                    <SpeakerNumber position={index} />
                    <Input
                      id={id}
                      name="speakers"
                      value={name}
                      onChange={(event) =>
                        updateSpeaker(index, event.target.value)
                      }
                      aria-invalid={speakerError ? true : undefined}
                      autoComplete="off"
                      placeholder="Speaker name"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove Speaker ${index + 1}`}
                      disabled={speakers.length <= MIN_SPEAKERS}
                      onClick={() => removeSpeaker(index)}
                    >
                      <X aria-hidden="true" />
                    </Button>
                  </div>
                  <FieldError className="ml-10">{speakerError}</FieldError>
                </Field>
              );
            })}
          </FieldGroup>
          <FieldError>{speakersError}</FieldError>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-fit"
            disabled={speakers.length >= MAX_SPEAKERS}
            onClick={addSpeaker}
          >
            <Plus data-icon="inline-start" aria-hidden="true" />
            Add Speaker
          </Button>
        </FieldSet>

        <Field>
          <FieldLabel htmlFor="agenda">
            Agenda{" "}
            <span className="text-muted-foreground font-normal">
              (optional)
            </span>
          </FieldLabel>
          <Textarea
            id="agenda"
            name="agenda"
            value={agenda}
            onChange={(event) => setAgenda(event.target.value)}
            rows={3}
          />
          <FieldDescription>
            What the Meeting is about. It steers the generated Transcript.
          </FieldDescription>
        </Field>

        <div className="flex items-center gap-3">
          <SubmitButton intent="start" size="lg">
            <Mic data-icon="inline-start" aria-hidden="true" />
            Start recording
          </SubmitButton>
        </div>

        <InstantMeetingSection durationError={durationError} />
      </FieldGroup>
    </form>
  );
}

/**
 * The other way in: skip the live Recording, say how long it ran, and go straight to
 * Transcribing. Its own submit button carries the intent to the action.
 */
function InstantMeetingSection({
  durationError,
}: {
  durationError: string | null;
}) {
  return (
    <section
      aria-labelledby="instant-meeting-title"
      className="bg-muted/30 rounded-xl border p-5"
    >
      <div className="flex items-start gap-3">
        <span className="bg-background flex size-8 shrink-0 items-center justify-center rounded-full border">
          <Zap aria-hidden="true" className="size-4" />
        </span>
        <div className="min-w-0">
          <h2 id="instant-meeting-title" className="text-sm font-medium">
            Instant Meeting
          </h2>
          <p className="text-muted-foreground mt-1 text-sm leading-6">
            No time to sit through a Recording? Choose how long the Meeting ran
            and it goes straight to Transcribing. The Transcript length follows
            the duration.
          </p>
        </div>
      </div>
      <FieldSet
        data-invalid={durationError ? true : undefined}
        className="mt-4 gap-3"
      >
        <FieldLegend variant="label" className="sr-only">
          Duration
        </FieldLegend>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <DurationOptions invalid={durationError !== null} />
          <SubmitButton intent="instant" variant="outline" size="lg">
            <Zap data-icon="inline-start" aria-hidden="true" />
            Create Instant Meeting
          </SubmitButton>
        </div>
        <FieldError>{durationError}</FieldError>
      </FieldSet>
    </section>
  );
}

/** A segmented control over the offered durations, built on native radios so the form carries the value. */
function DurationOptions({ invalid }: { invalid: boolean }) {
  return (
    <div
      role="radiogroup"
      aria-label="Duration"
      aria-invalid={invalid || undefined}
      className={cn(
        "bg-background inline-flex rounded-lg border p-0.5",
        invalid && "border-destructive",
      )}
    >
      {INSTANT_MEETING_DURATION_OPTIONS_MINUTES.map((minutes) => (
        <label
          key={minutes}
          className="text-muted-foreground has-checked:bg-foreground has-checked:text-background has-focus-visible:ring-ring/50 relative cursor-pointer rounded-md px-3 py-1.5 text-sm font-medium tabular-nums select-none has-focus-visible:ring-3"
        >
          <input
            type="radio"
            name="durationMinutes"
            value={minutes}
            defaultChecked={
              minutes === DEFAULT_INSTANT_MEETING_DURATION_MINUTES
            }
            className="absolute inset-0 size-full cursor-pointer appearance-none opacity-0"
          />
          {minutes} min
        </label>
      ))}
    </div>
  );
}

/**
 * One of the two submit buttons. Its `intent` value travels in the form data so the action
 * knows which was pressed, and only the pressed one shows its busy label while the form is pending.
 */
function SubmitButton({
  intent,
  children,
  ...props
}: Omit<React.ComponentProps<typeof Button>, "type" | "name" | "value"> & {
  intent: CreateIntent;
}) {
  const { pending, data } = useFormStatus();
  const busy = pending && data?.get("intent") === intent;
  return (
    <Button
      type="submit"
      name="intent"
      value={intent}
      disabled={pending}
      {...props}
    >
      {busy ? BUSY_LABELS[intent] : children}
    </Button>
  );
}

const BUSY_LABELS: Record<CreateIntent, string> = {
  start: "Starting…",
  instant: "Creating…",
};

function issueMessage(state: CreateMeetingFormState, path: string) {
  return state.issues.find((issue) => issue.path === path)?.message ?? null;
}
