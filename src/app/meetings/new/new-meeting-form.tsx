"use client";

import { AlertCircle, Plus, X } from "lucide-react";
import { useActionState, useState } from "react";

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
import { MAX_SPEAKERS, MIN_SPEAKERS } from "@/lib/meetings/validation";

import { createMeetingAction } from "./actions";
import {
  INITIAL_CREATE_MEETING_STATE,
  type CreateMeetingFormState,
} from "./form-state";

export type NewMeetingDefaults = {
  title: string;
  speakers: string[];
  agenda: string;
};

export function NewMeetingForm({ defaults }: { defaults: NewMeetingDefaults }) {
  const [state, formAction, pending] = useActionState(
    createMeetingAction,
    INITIAL_CREATE_MEETING_STATE,
  );
  const [title, setTitle] = useState(defaults.title);
  const [speakers, setSpeakers] = useState(defaults.speakers);
  const [agenda, setAgenda] = useState(defaults.agenda);

  const errorFor = (path: string) => issueMessage(state, path);
  const titleError = errorFor("title");
  const speakersError = errorFor("speakers");

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
          <Button type="submit" size="lg" disabled={pending}>
            {pending ? "Starting…" : "Start recording"}
          </Button>
        </div>
      </FieldGroup>
    </form>
  );
}

function issueMessage(state: CreateMeetingFormState, path: string) {
  return state.issues.find((issue) => issue.path === path)?.message ?? null;
}
