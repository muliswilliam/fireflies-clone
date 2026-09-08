import type { TranscriptionSpeaker } from "./transcription-provider";

/** The Meeting's Speakers as a prompt list, each with the id the model must copy back. */
export function speakerList(speakers: TranscriptionSpeaker[]): string {
  return speakers
    .map((speaker) => `- ${speaker.name} (speakerId: ${speaker.id})`)
    .join("\n");
}
