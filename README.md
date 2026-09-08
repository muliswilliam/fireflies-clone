# Firefly Notes

[![CI](https://github.com/muliswilliam/fireflies-clone/actions/workflows/ci.yml/badge.svg)](https://github.com/muliswilliam/fireflies-clone/actions/workflows/ci.yml)

A simplified Fireflies.ai clone: record a Meeting, read its Transcript, and get a Summary with Action Items.

Vocabulary follows [`CONTEXT.md`](CONTEXT.md). Architecture decisions live in [`docs/adr/`](docs/adr/).

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
| `pnpm db:generate`| Generate a migration from `src/lib/db/schema.ts`    |

Health: `GET /api/health` returns `200 {"status":"ok","database":"ok"}` when the database answers, `503` otherwise.

## Test

| Command          | What it does                                                          |
| ---------------- | --------------------------------------------------------------------- |
| `pnpm lint`      | ESLint (Next preset) and Prettier check                               |
| `pnpm typecheck` | `next typegen` then `tsc --noEmit`                                    |
| `pnpm test`      | Vitest against a real Postgres (`firefly_notes_test`, created for you) |
| `pnpm test:e2e`  | Playwright smoke test; starts the app itself                          |

Tests use `TEST_DATABASE_URL` (default `postgres://postgres:postgres@localhost:5433/firefly_notes_test`) so they never touch development data. First run: `pnpm exec playwright install chromium`.

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

Dokploy at `fireflies.williammuli.dev`, auto-deploying from `main`. Details in `docs/submission.md` (to come).

## Third-party tools

Next.js, React, Drizzle ORM, node-postgres, Zod, Tailwind CSS, shadcn/ui, lucide-react, Vitest, Playwright, ESLint, Prettier, Dokploy, and Claude Code (used to build this).

## Assumptions

See `docs/adr/` for the decisions behind the simulated Recording, the fire-and-forget pipeline, the single shared workspace, JSONB Transcript and Summary, and the global daily Meeting cap.
