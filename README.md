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
- `AI_PROVIDER=claude` (the default outside tests) has Claude write the Transcript and the Summary through the official Anthropic SDK: one streamed call per step, adaptive thinking, structured output constrained by a JSON schema derived from the same Zod shapes that guard the database, and Anthropic's default server-side fallback when a request is refused. The Transcript prompt gets the title, agenda, Speakers with ids, duration and target Utterance count; the Summary prompt gets the timestamped Transcript and may only name the Meeting's Speakers as owners. Every answer is re-validated with Zod; a refusal, an invalid answer or an API error fails the Meeting at that step with the reason, ready for Retry. `AI_MODEL` picks the model (default `claude-opus-5`). With the claude provider and no `ANTHROPIC_API_KEY`, the server refuses to start and says which variable is missing.
- `AI_PROVIDER=fake` gives deterministic, instant Transcripts and Summaries; tests and e2e always use it (it is the default under `NODE_ENV=test`).
- A global cap (`MAX_MEETINGS_PER_DAY`, default 50) limits Meetings created in any rolling 24 hours; Sample Meetings are exempt. See ADR-0005.
- If a provider throws, answers with something the Transcript or Summary rules reject, or does not answer within 4 minutes, the Meeting is `failed` at that step with the reason shown on its page. Retry resumes at the failed step: a Meeting that already has a Transcript only summarizes again. Processing is not a durable queue: if the server restarts mid-pipeline the Meeting stays Transcribing or Summarizing, and Retry is only offered once it is `failed`. See ADR-0002.
- An Instant Meeting skips the live Recording: pick 5, 15, 30 (default) or 60 minutes on the form and the Meeting is created with its Recording already ended, dated as if it had just run for that long. It starts at Transcribing with processing scheduled at once, so you land on the detail page watching the stepper. Same validation and daily cap as any other Meeting; the Transcript length follows the chosen duration through the same 8-80 clamp.

Markdown export and Sample Meetings arrive in the following tickets.

## Stack

Next.js (App Router), TypeScript, Tailwind CSS, shadcn/ui, Drizzle ORM over Postgres, Zod, Vitest, Playwright, pnpm, Node 24.

## Setup

Prerequisites: Node 24 (`.nvmrc`), pnpm 11, Docker.

```sh
pnpm install
cp .env.example .env        # then set ANTHROPIC_API_KEY, or AI_PROVIDER=fake
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

Tests use `TEST_DATABASE_URL` (default `postgres://postgres:postgres@localhost:5433/firefly_notes_test`) so they never touch development data. First run: `pnpm exec playwright install chromium`. If something else already listens on port 3000, run e2e with `E2E_PORT=3001 pnpm test:e2e`; locally it reuses a dev server already running on that port, which must then have been started with `E2E_FAULT_INJECTION=1` for the failure tests: that flag lets a Meeting title containing `[fail:transcribing]` or `[fail:summarizing]` make the fake provider fail once, so Retry can be exercised end to end. Never set it outside tests.

Live smoke tests for the Claude providers (`src/lib/ai/anthropic-providers.live.test.ts`) call the real API, so they only run when both `RUN_LIVE=1` and `ANTHROPIC_API_KEY` are set: `RUN_LIVE=1 ANTHROPIC_API_KEY=sk-ant-... pnpm test src/lib/ai/claude-providers.live`. Otherwise they are skipped, and CI never sets them.

GitHub Actions runs all four on every push and pull request, plus a Docker image build.

## Adding another AI vendor

The Transcript and Summary prompts in `src/lib/ai/llm-*-provider.ts` depend only on the `StructuredGenerator` interface (`src/lib/ai/structured-generator.ts`): a system prompt, a user prompt, a Zod schema the answer must satisfy, a token ceiling and an optional effort. `anthropic-structured-generator.ts` is the one implementation. Another vendor is one more implementation of that interface plus a case in `src/lib/ai/index.ts`; the prompts, the pipeline, the schemas and the UI do not change. The fake providers take the other route and replace the whole provider, which is what a real speech-to-text vendor would do (ADR-0001).

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
