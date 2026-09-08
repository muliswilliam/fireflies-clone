import type { Metadata } from "next";

import { BackToMeetingsLink } from "@/components/back-to-meetings-link";

import { NewMeetingForm, type NewMeetingDefaults } from "./new-meeting-form";

export const metadata: Metadata = { title: "New meeting" };

/** A plausible example so one click yields a Meeting worth reading. */
const EXAMPLE: NewMeetingDefaults = {
  title: "Q3 roadmap sync",
  speakers: ["Amara Okafor", "Ben Liu", "Chloe Martin"],
  agenda:
    "Confirm Q3 priorities, agree owners for the onboarding redesign, and pick a launch date for the reporting API.",
};

export default function NewMeetingPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-6 py-10 sm:px-8">
      <BackToMeetingsLink />
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">
        New meeting
      </h1>
      <p className="text-muted-foreground mt-2 text-sm leading-6">
        Name the Meeting and list who is in the room. Then start a live
        Recording, or create an Instant Meeting that skips straight to
        Transcribing.
      </p>
      <NewMeetingForm defaults={EXAMPLE} />
    </main>
  );
}
