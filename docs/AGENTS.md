# Repository Guidelines

## Project Structure & Module Organization
Orbit is a pnpm monorepo:
- `apps/api`: Fastify + TypeScript backend. Core layers are `src/domain` (business logic), `src/infrastructure` (DB repositories), and `src/interfaces/http` (routes/plugins).
- `apps/web`: React + Vite frontend. Main folders include `src/pages`, `src/components`, `src/api`, `src/store`, and `src/i18n`.
- `packages/shared`: shared TypeScript types and schemas used by both apps.
- `docs`: product and architecture references.

Backend tests live in `apps/api/src/tests/{unit,integration}`. Static assets are under `apps/web/src/assets`.

## Build, Test, and Development Commands
- `pnpm install`: install workspace dependencies.
- `docker compose up -d`: start local Postgres/Redis services.
- `pnpm dev`: run API and web in parallel (`pnpm dev:api` / `pnpm dev:web` for one app).
- `pnpm migrate`: push DB schema changes for API.
- `pnpm seed:demo`: seed demo data.
- `pnpm build`: build all workspace packages.
- `pnpm lint`: run ESLint across the repo.
- `pnpm typecheck`: strict TypeScript checks for all packages.
- `pnpm test`: run workspace tests (currently API Vitest suite).

## Coding Style & Naming Conventions
- Language: TypeScript with strict compiler settings.
- Formatting (Prettier): 2 spaces, single quotes, semicolons, trailing commas, 100-char line width.
- Linting: `eslint.config.js` enforces rules like `no-explicit-any` and consistent type imports.
- Naming: React components use PascalCase (for example, `CreateWorkspaceModal.tsx`); service/repository files use descriptive suffixes (for example, `workspace.service.ts`, `workspace.repository.ts`).
- Keep route handlers thin; place business logic in domain services.

## Testing Guidelines
- Framework: Vitest (`apps/api/vitest.config.ts`).
- Test files: `*.test.ts`, grouped by `unit` and `integration`.
- Integration tests use real local DB/Redis and run serially to avoid shared-state races.
- Add or update tests with each backend behavior change; no enforced coverage threshold is currently configured.

## Commit & Pull Request Guidelines
- Follow Conventional Commit style: `type: short imperative summary` (seen in history: `feat:`, `fix:`, `docs:`, `refactor:`).
- Use feature branches (`feat/*`, `fix/*`, `chore/*`) for meaningful changes; avoid direct commits to `master`.
- PRs should include:
  - concise problem/solution summary,
  - linked issue or context,
  - commands run (`pnpm test`, `pnpm lint`, `pnpm typecheck`),
  - screenshots/GIFs for UI changes.
- Merge only after explicit reviewer approval.

## Security & Configuration Tips
- Copy `.env.example` to `.env` for local setup.
- Never commit secrets or OAuth credentials.
- Treat platform tokens and webhook secrets as sensitive; do not log them.
