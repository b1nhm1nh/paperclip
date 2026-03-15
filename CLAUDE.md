# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Quick Start

```bash
pnpm install
pnpm dev                      # Start API + UI with file watching (http://localhost:3100)
pnpm dev:once                 # Start without file watching
pnpm dev:server               # API server only
pnpm dev:ui                   # UI only (with HMR on http://localhost:5173)
```

## Testing

```bash
pnpm test:run                 # Run all unit tests (Vitest)
pnpm test                     # Watch mode for tests
pnpm test:e2e                 # Playwright e2e tests (headless)
pnpm test:e2e:headed         # Playwright e2e tests (with browser visible)
```

Run tests for a single package: `pnpm --filter @paperclipai/server test:run`

## Build & Type Checking

```bash
pnpm build                    # Build all packages
pnpm typecheck                # Type checking across all workspaces
```

## Database

```bash
pnpm db:generate              # Generate DB migration from schema changes
pnpm db:migrate               # Apply pending migrations
pnpm db:backup                # Manual backup of embedded PostgreSQL
```

Local dev uses embedded PostgreSQL (auto-persisted to `~/.paperclip/instances/default/db`). Set `DATABASE_URL` to use external Postgres.

## Architecture

**Monorepo structure** (pnpm workspaces):
- `server/` — Node.js API server (Express, WebSockets, better-auth, Drizzle ORM)
- `ui/` — React 19 frontend (Vite, TailwindCSS, React Router, TanStack Query)
- `cli/` — CLI tool (control plane operations and local setup/onboarding)
- `packages/` — Shared code:
  - `adapter-utils/` — Common utilities for agent adapters
  - `adapters/` — Agent type plugins (Claude, OpenClaw, Codex, Cursor, Gemini, etc.)
  - `db/` — Drizzle ORM schema and migrations
  - `plugins/` — Plugin system for extending Paperclip
  - `shared/` — Shared types and utilities

**Key architectural points:**
- **Adapters** are extensible plugins for different agent runtimes. The server loads these at startup.
- **Database layer** uses Drizzle ORM with TypeScript for type-safe queries. Migrations are generated and live in `packages/db`.
- **Dev server** runs both API and serves the UI (built to `ui/dist` at startup) via Express middleware in local_trusted mode.
- **CLI** (`pnpm paperclipai`) handles both setup (onboarding) and control plane operations (create issues, approve agents, etc.).
- **Better-auth** handles auth in dev. For production, configure authentication mode via `doc/DEPLOYMENT-MODES.md`.
- **WebSockets** stream real-time updates to the UI from the server.

## Important Notes

- **pnpm-lock.yaml** is managed by GitHub Actions. Don't commit it in PRs; CI validates resolution.
- **UI served from API** — In dev, the UI is built once at startup and served from `server/ui-dist`. Changes to UI require a server restart.
- **Embedded Postgres** runs as part of the server process locally. For multi-worktree dev, use `pnpm paperclipai worktree init` to isolate instances.
- **Plugin SDK** (`packages/plugin-sdk`) is published and lets external developers build Paperclip plugins.
- **Adapters require agent binaries** to be installed. The CLI's onboarding ensures required adapters are available.

## Development Hints

- **Rapid iteration:** `pnpm dev` watches server code and restarts automatically. For UI-only changes within a dev session, restart the server to rebuild the UI.
- **Database schema changes:** Modify `packages/db/schema.ts`, run `pnpm db:generate` (creates migration), then `pnpm db:migrate`.
- **Add a new adapter:** Copy an existing adapter in `packages/adapters/`, update the schema in `packages/db`, and register it in `server/src/adapters.ts`.
- **Testing single packages:** Use `pnpm --filter @paperclipai/<package-name> <script>` (e.g., `pnpm --filter @paperclipai/db test:run`).
- **E2E test debugging:** Use `--headed` flag to watch Playwright browser during tests.

## Linting & Code Quality

The repo uses TypeScript strict mode across all packages. No ESLint config is present; rely on `pnpm typecheck` to catch issues.

## Relevant Docs

- `doc/DEVELOPING.md` — Full development guide (worktree setup, Docker, secrets, CLI reference)
- `doc/DEPLOYMENT-MODES.md` — Auth modes (local_trusted vs authenticated/private)
- `doc/CLI.md` — Full CLI command reference
- `AGENTS.md` — Info about agent integration and adapter setup
- `README.md` — Product overview and feature list
