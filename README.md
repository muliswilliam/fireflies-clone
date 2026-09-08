# Firefly Notes

[![CI](https://github.com/muliswilliam/fireflies-clone/actions/workflows/ci.yml/badge.svg)](https://github.com/muliswilliam/fireflies-clone/actions/workflows/ci.yml)

A simplified Fireflies.ai clone: record a Meeting, read its Transcript, and get a Summary with Action Items.

Vocabulary follows [`CONTEXT.md`](CONTEXT.md). Architecture decisions live in [`docs/adr/`](docs/adr/).

## What it does today

- `/` lists Meetings newest first with title, date, duration (once the Recording has ended), Speaker count and Status, plus a title search.
- `/meetings/new` creates a Meeting from a prefilled form: title, 2 to 6 Speakers with unique names, optional agenda. Validation errors show inline.
- `/meetings/[id]` shows the Meeting, its Speakers and a Status stepper (Recording, Transcribing, Summarizing, Ready). While the Recording runs it shows a live timer, a pulsing indicator and a Stop button.
- Stopping the Recording ends it and schedules processing after the response (ADR-0002). The page polls `GET /api/meetings/[id]/status` every 2 seconds and re-renders as the Status changes.
- Processing asks the configured `TranscriptionProvider` (ADR-0001) for a Transcript sized to the Recording: one Utterance per 12 seconds, clamped to 8-80. The Transcript tab shows each Utterance with its Speaker (one colour per Speaker), an mm:ss timestamp that highlights the Utterance when clicked, and the text.
- Once the Transcript exists, processing continues into Summarizing: the configured `SummarizationProvider` returns an Overview, 3 to 7 Key Takeaways and up to 10 Action Items, each owned by one of the Meeting's Speakers or nobody, with an optional free-form due date. The Summary is JSONB on the Meeting; Action Items are rows (ADR-0004). The Summary tab shows the Overview and Key Takeaways; the Action Items tab lets you tick items done. Regenerate (with a warning that done state is lost) sends the Meeting back to Summarizing and replaces the Summary and Action Items atomically.
- `AI_PROVIDER=fake` gives deterministic, instant Transcripts and Summaries; tests and e2e always use it. The Claude providers arrive in #8, so until then `AI_PROVIDER=claude` leaves a stopped Meeting in `failed` with a message saying so.
- A global cap (`MAX_MEETINGS_PER_DAY`, default 50) limits Meetings created in any rolling 24 hours; Sample Meetings are exempt. See ADR-0005.

Failure retry, Instant Meetings, Markdown export and Sample Meetings arrive in the following tickets.

## Stack

Next.js (App Router), TypeScript, Tailwind CSS, shadcn/ui, Drizzle ORM over Postgres, Zod, Vitest, Playwright, pnpm, Node 24.

## Setup

Prerequisites: Node 24 (`.nvmrc`), pnpm 11, Docker.

```sh
pnpm install
cp .env.example .env
docker compose up -d        # Postgres on localhost:5433
pnpm db:migrate
pnpm dev                    # http://localhost:3000
```

The compose Postgres is published on host port 5433 so it never collides with a Postgres already running on 5432. Every setting is an environment variable; `.env.example` documents each one.

## Run

| Command           | What it does                                        |
| ----------------- | --------------------------------------------------- |
| `pnpm dev`        | Development server with hot reload                  |
| `pnpm build`      | Production build (Next standalone output)           |
| `pnpm start`      | Serve the production build                          |
| `pnpm db:migrate` | Apply Drizzle SQL migrations from `drizzle/`        |
| `pnpm db:generate` | Generate a migration from `src/lib/db/schema.ts`   |

Health: `GET /api/health` returns `200 {"status":"ok","database":"ok"}` when the database answers, `503` otherwise.

## Test

| Command          | What it does                                                          |
| ---------------- | --------------------------------------------------------------------- |
| `pnpm lint`      | ESLint (Next preset) and Prettier check                               |
| `pnpm typecheck` | `next typegen` then `tsc --noEmit`                                    |
| `pnpm test`      | Vitest against a real Postgres (`firefly_notes_test`, created for you); service tests run one file at a time |
| `pnpm test:e2e`  | Playwright smoke test; starts the app itself                          |

Tests use `TEST_DATABASE_URL` (default `postgres://postgres:postgres@localhost:5433/firefly_notes_test`) so they never touch development data. First run: `pnpm exec playwright install chromium`. If something else already listens on port 3000, run e2e with `E2E_PORT=3001 pnpm test:e2e`; locally it reuses a dev server already running on that port.

GitHub Actions runs all four on every push and pull request, plus a Docker image build.

## Docker

```sh
docker build -t firefly-notes .
docker run --rm -p 3000:3000 -e PORT=3000 \
  -e DATABASE_URL=postgres://postgres:postgres@host.docker.internal:5433/firefly_notes \
  firefly-notes
```

The multi-stage image runs migrations on start, then the Next standalone server. `PORT` is respected.

## Deploy

Dokploy at `fireflies.williammuli.dev`, auto-deploying from `main`. Deployment is set up in #11 and documented in `docs/submission.md` in #12.

## Third-party tools

Next.js, React, Drizzle ORM, node-postgres, Zod, Tailwind CSS, shadcn/ui, lucide-react, Vitest, Playwright, ESLint, Prettier, Dokploy, and Claude Code (used to build this).

## Assumptions

See `docs/adr/` for the decisions behind the simulated Recording, the fire-and-forget pipeline, the single shared workspace, JSONB Transcript and Summary, and the global daily Meeting cap.
