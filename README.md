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
- `AI_PROVIDER=claude` (the default outside tests) has Claude write the Transcript and the Summary through the official Anthropic SDK: one streamed call per step, adaptive thinking, structured output constrained by a JSON schema derived from the same Zod shapes that guard the database, and, on the models that run safety classifiers (Opus 5, Fable 5 and 5.1, Mythos 5 and 5.1), Anthropic's default server-side fallback when a request is refused; other models such as Sonnet 5 reject the `fallbacks` parameter, so the adapter leaves it out for them. The Transcript prompt gets the title, agenda, Speakers with ids, duration and target Utterance count; the Summary prompt gets the timestamped Transcript and may only name the Meeting's Speakers as owners. Every answer is re-validated with Zod; a refusal, an invalid answer or an API error fails the Meeting at that step with the reason, ready for Retry. `AI_MODEL` picks the model (default `claude-opus-5`). With the claude provider and no `ANTHROPIC_API_KEY`, the server refuses to start and says which variable is missing.
- `AI_PROVIDER=fake` gives deterministic, instant Transcripts and Summaries; tests and e2e always use it (it is the default under `NODE_ENV=test`).
- A global cap (`MAX_MEETINGS_PER_DAY`, default 50) limits Meetings created in any rolling 24 hours; Sample Meetings are exempt. See ADR-0005.
- If a provider throws, answers with something the Transcript or Summary rules reject, or does not answer within 4 minutes, the Meeting is `failed` at that step with the reason shown on its page. Retry resumes at the failed step: a Meeting that already has a Transcript only summarizes again. Processing is not a durable queue: if the server restarts mid-pipeline the Meeting stays Transcribing or Summarizing, and Retry is only offered once it is `failed`. See ADR-0002.
- An Instant Meeting skips the live Recording: pick 5, 15, 30 (default) or 60 minutes on the form and the Meeting is created with its Recording already ended, dated as if it had just run for that long. It starts at Transcribing with processing scheduled at once, so you land on the detail page watching the stepper. Same validation and daily cap as any other Meeting; the Transcript length follows the chosen duration through the same 8-80 clamp.

- From the detail page a Meeting can be renamed inline (the title rule applies: non-empty), deleted after a confirmation (its Speakers, Transcript, Summary and Action Items go with it, and the list is shown), and exported once the Summary is ready: the Export menu copies the Summary as Markdown to the clipboard (with a toast) or downloads it as a `.md` file named after the title. The document has the title, a meta line, then Overview, Key Takeaways and Action Items as a task list with owner, due date and done state.

- Three Sample Meetings are seeded so the list is never empty: checked-in JSON fixtures (`src/lib/sample-meetings/fixtures/`, written once with Claude and hand-checked) with Speakers, Transcript, Summary and Action Items, each marked with a Sample badge on the list and the detail page. The seeder upserts by fixture id, so it runs on every container start after migrations (and as `pnpm db:seed`) without duplicating anything; a deleted Sample Meeting comes back on the next run, and one that was renamed or ticked is reset to its fixture. Sample Meetings are otherwise ordinary (renamable, deletable, exportable) and do not count toward the daily cap.

## Stack

Next.js (App Router), TypeScript, Tailwind CSS, shadcn/ui, Drizzle ORM over Postgres, Zod, Vitest, Playwright, pnpm, Node 24.

## Setup

Prerequisites: Node 24 (`.nvmrc`), pnpm 11, Docker.

```sh
pnpm install
cp .env.example .env        # then set ANTHROPIC_API_KEY, or AI_PROVIDER=fake
docker compose up -d        # Postgres on localhost:5433
pnpm db:migrate
pnpm db:seed                # Sample Meetings
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
| `pnpm db:seed`    | Seed the Sample Meetings (idempotent)               |
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

The multi-stage image runs migrations on start, then seeds the Sample Meetings, then the Next standalone server. `PORT` is respected.

## Deploy

Production runs at [fireflies.williammuli.dev](https://fireflies.williammuli.dev) on a self-hosted [Dokploy](https://dokploy.com). Every push to `main` deploys; there is no manual release step.

### Topology

- **Dokploy project `fireflies`, environment `production`**, on the Dokploy server named `eprocurement prod server`. Two services live in it:
  - **Application `app`**: source is this GitHub repository, branch `main`, built from the `Dockerfile` (multi-stage, Next standalone output), one replica listening on port 3000. Trigger type is push, so a GitHub webhook from the Dokploy GitHub App starts a build for every commit on `main`; the new container replaces the old one once it is up.
  - **Postgres `db`**: `postgres:18` with its data on a named Docker volume. It has no external port; the app reaches it over Dokploy's internal Docker network, which is what `DATABASE_URL` points at.
- **Environment** is set on the application in Dokploy: `DATABASE_URL` (internal hostname of `db`), `ANTHROPIC_API_KEY`, `AI_PROVIDER=claude`, `AI_MODEL` and `MAX_MEETINGS_PER_DAY`. `.env.example` documents each one. Nothing is baked into the image.
- **Container start** is the entrypoint described under Docker above (migrate, seed, serve). Both steps are idempotent, so a redeploy or restart is safe. The image's `HEALTHCHECK` polls `GET /api/health`.
- **Domain** `fireflies.williammuli.dev` is attached to `app` in Dokploy with a Let's Encrypt certificate; Dokploy's Traefik terminates TLS and redirects HTTP to HTTPS. DNS is a proxied Cloudflare A record for the server, so Cloudflare sits in front of Traefik.

Check a deployment landed: the Dokploy deployments list shows the commit title and `done`, the health route on the live URL returns 200, and the application logs in Dokploy show the three entrypoint steps.

### The two human steps

Everything above is created through the Dokploy API except two steps that need a browser session with GitHub and Cloudflare credentials. Repeat them when re-creating the deployment.

1. **Install the GitHub App.** Dokploy creates a GitHub App per project (here `fireflies-github`) and hands you an installation link. Open it, pick the account that owns `fireflies-clone`, grant the App access to that repository, and finish on GitHub. Dokploy stores the installation id; from then on it can clone the repository and receive push webhooks. Until this is done the application has no source and auto-deploy never fires.
2. **Add the DNS record.** In the Cloudflare dashboard for `williammuli.dev`, add an A record `fireflies` pointing at the server's public IP with the proxy (orange cloud) enabled. Once it resolves, the first HTTPS request lets Traefik obtain the Let's Encrypt certificate.

## Third-party tools

Next.js, React, Drizzle ORM, node-postgres, Zod, Tailwind CSS, shadcn/ui, lucide-react, Vitest, Playwright, ESLint, Prettier, Dokploy, and Claude Code (used to build this).

## Assumptions

See `docs/adr/` for the decisions behind the simulated Recording, the fire-and-forget pipeline, the single shared workspace, JSONB Transcript and Summary, and the global daily Meeting cap.
