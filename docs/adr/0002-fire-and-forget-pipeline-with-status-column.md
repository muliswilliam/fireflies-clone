# The processing pipeline is fire-and-forget with a status column, not a job queue

Stopping a Recording triggers two Claude calls (transcription, then summarization) that take 10-25 seconds together. The request that stops the Recording returns immediately; the pipeline continues on the server via Next.js `after()`, advancing `meetings.status` through `transcribing`, `summarizing`, `ready`, or `failed`. The client polls status while processing. Each step is idempotent, so a `failed` Meeting can be retried from the step that failed.

This is deliberately not a durable job queue. If the process restarts mid-pipeline the Meeting stays in its in-flight status until a user presses Retry. That is an accepted limitation for a demo with a ten-hour budget, and the README says so.

**Upgrade path**: pg-boss on the same Postgres, with the existing step functions as job handlers. The status column and idempotent steps already match what a queue needs.

**Considered**: awaiting the pipeline synchronously in the stop request (simplest, but a 20-second request risks proxy and browser timeouts), and pg-boss now (restart-proof, but a worker process and roughly 1.5 hours the budget cannot spare).
