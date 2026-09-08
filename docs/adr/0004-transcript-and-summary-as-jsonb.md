# Transcript and Summary are JSONB documents; Speakers and Action Items are rows

`CONTEXT.md` names Utterance and Key Takeaway as domain concepts, so a reader may expect `utterances` and `key_takeaways` tables. Instead, `meetings.transcript` holds the ordered Utterance array and `meetings.summary` holds the Overview and Key Takeaways, both as JSONB validated by Zod at the boundary.

Utterances and Key Takeaways are only ever read and written as a whole alongside their Meeting; nothing queries, filters, or mutates one of them independently. Rows would add joins and migrations for no access pattern that exists.

Two things are relational because they are mutated or referenced on their own: `speakers` (Utterances reference `speakerId`, and speaker colouring keys off a stable id) and `action_items` (toggled done/undone individually, with `owner_speaker_id` as a real foreign key so the database enforces that an owner is one of the Meeting's Speakers).

**Considered**: fully relational (cleanest mirror of the glossary, more schema for no query benefit) and fully document-style (loses the FK on Action Item owner and per-item toggling).
