# Orbit — Claude Code Project Settings

## Project Status

Phase 1 (MVP) is complete and shipped at v0.3.0. Phase 2 is now in active development.

**Phase 1 (done):** Idea capture, multi-workspace Kanban, content briefs, scheduling calendar, manual-assist publishing, analytics dashboard, 5-locale i18n, PWA/offline support.

**Phase 2 (current):** Multi-user collaboration, approval workflows, platform API auto-publish, AI-assisted titling and translation, team permissions, advanced analytics export, webhooks.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS |
| State | Zustand + TanStack Query |
| i18n | react-i18next — locales: zh-CN, zh-TW, en-US, ja-JP, ko-KR |
| PWA | Workbox, Dexie.js (IndexedDB) |
| Backend | Fastify (Node.js), TypeScript |
| Database | PostgreSQL 16 |
| Cache / Sessions | Redis 7 |
| Job Queue | BullMQ — scheduled reminders, auto-publish jobs, webhook delivery |
| Auth | JWT + OAuth 2.0 (WeChat / Google) + platform OAuth (per integration) |
| AI | Anthropic Claude API — title suggestions, translation, brief assistance |
| Real-time | Fastify WebSocket plugin — collaboration presence, live notifications |
| Deploy | Docker Compose (single-host) |

---

## Directory Layout

```
Orbit/
├── apps/
│   ├── web/
│   │   └── src/
│   │       ├── api/          # TanStack Query hooks
│   │       ├── components/
│   │       ├── pages/
│   │       ├── store/        # Zustand stores
│   │       └── locales/      # i18n translation files (5 locales)
│   └── api/
│       └── src/
│           ├── domain/                    # Pure business logic — no DB, no HTTP
│           │   ├── errors.ts              # NotFoundError, ForbiddenError, etc.
│           │   ├── workspace/workspace.service.ts
│           │   ├── content/content.service.ts
│           │   ├── idea/idea.service.ts
│           │   ├── publication/publication.service.ts
│           │   ├── plan/plan.service.ts
│           │   ├── metric/metric.service.ts
│           │   └── user/user.service.ts
│           ├── infrastructure/
│           │   └── db/repositories/       # Drizzle ORM implementations
│           │       ├── workspace.repository.ts
│           │       ├── content.repository.ts
│           │       ├── idea.repository.ts
│           │       ├── publication.repository.ts
│           │       ├── plan.repository.ts
│           │       ├── metric.repository.ts
│           │       └── user.repository.ts
│           ├── interfaces/
│           │   └── http/
│           │       ├── plugins/           # Fastify plugins (auth, cors)
│           │       └── routes/            # Thin HTTP handlers — call services only
│           ├── db/                        # Drizzle schema + migrations
│           ├── queue/                     # BullMQ job definitions
│           ├── redis/                     # Redis client
│           └── app.ts                     # Wires repos → services → routes
├── packages/
│   └── shared/               # Shared TypeScript types and constants
├── docker-compose.yml
└── docs/
    ├── DESIGN.md
    ├── CLAUDE.md
    └── README.md
```

---

## Code Conventions

### General
- **TypeScript strict mode** everywhere; no `any` unless third-party types force it.
- **API routes** follow REST conventions defined in DESIGN.md §8; no ad-hoc endpoints.
- **i18n**: All user-visible strings go through `t()` — no hardcoded display text.
- **Database**: Use Drizzle migrations; never alter schema with raw ad-hoc SQL.

### Backend Architecture (DDD)

The API follows a three-layer architecture:

| Layer | Path | Responsibility |
|-------|------|---------------|
| **Domain** | `src/domain/` | Service classes + repository interfaces. No DB imports, no Fastify imports. Pure business logic and domain errors. |
| **Infrastructure** | `src/infrastructure/db/repositories/` | Drizzle ORM implementations of domain repository interfaces. All DB queries live here. |
| **Interfaces** | `src/interfaces/http/` | Thin Fastify route handlers. Extract params → call service → return response. No business logic. |

**Key rules:**
- Domain services receive repository instances via constructor injection (no DI container).
- `app.ts` is the composition root: instantiates repositories → services → calls `registerRoutes(app, services)`.
- Domain errors (`NotFoundError`, `ForbiddenError`, `ConflictError`, `ValidationError`) are thrown from services and mapped to HTTP codes by the global error handler in `app.ts`.
- Route handlers must not contain DB queries or business logic — if they do, move that logic to a service.
- The `export.ts` and `import.ts` routes are intentional exceptions: they are bulk data-transfer operations with no business logic, so they access the DB directly.

### Multi-tenancy
- Every DB query that touches workspace data must be scoped to the authenticated user's workspace membership. Never trust a workspace ID from the request body alone — always verify the user is a member of that workspace.
- Team-level queries must enforce role checks before returning data.

### Permissions (RBAC)
Roles: `owner > admin > editor > viewer`.
- Enforce permissions in route handlers via a shared `requireRole(role)` middleware, not in individual business logic.
- Owners can do everything. Admins manage members. Editors create/edit content. Viewers are read-only.
- Phase 1 routes assumed a single user per workspace — audit and add role guards when extending them for multi-user.

### Platform API integrations
- All platform API calls must be dispatched as BullMQ jobs, never called synchronously in a request handler.
- Jobs must be idempotent (safe to retry). Use BullMQ's built-in retry with exponential backoff.
- Store platform credentials encrypted at rest; never log them.
- Each integration lives in `apps/api/src/integrations/<platform>/` and exports a standard interface.

### AI features
- Use the Anthropic Claude API for all AI-assisted features (titling, translation, brief suggestions).
- AI-generated content is always a suggestion — never auto-save without explicit user confirmation.
- Stream responses where latency matters (title generation, translation). Use non-streaming for batch jobs.
- Keep AI prompt templates close to their feature — no global prompt registry.

### Webhooks
- Verify platform webhook signatures before processing any payload.
- Handlers must be idempotent — platforms may deliver the same event more than once.
- Acknowledge immediately (2xx) and process asynchronously via BullMQ.

### Offline-first
- Data mutations must enqueue a BackgroundSync task before returning success.
- Do not block the UI waiting for server confirmation.

---

## Domain Glossary

| Term | Meaning |
|------|---------|
| Workspace | One vertical account/channel (e.g. "Douyin · Comedy") |
| Idea | A raw, unstructured inspiration captured quickly |
| Content | A formal content item promoted from an Idea |
| Brief | Structured creative brief attached 1-to-1 with a Content |
| Publication | One platform-specific publish record for a Content |
| Stage | Kanban column: planned → creating → ready → published → reviewed |
| Metric | A single performance data snapshot for a Publication |
| Team | A group of users sharing one or more workspaces |
| Member | A user who belongs to a Team with an assigned Role |
| Role | `owner`, `admin`, `editor`, or `viewer` — defines what a Member can do |
| PlatformConnection | An OAuth-authorized link between a Workspace and a social platform account |
| ApprovalRequest | A Phase 2 workflow step where content requires sign-off before publishing |
| Job | A BullMQ background task (auto-publish, webhook delivery, AI generation, reminders) |

---

## Key Design Decisions

1. **Idea entry is zero-friction** — workspace assignment is optional at capture time.
2. **One Content → many Publications** — each Publication has independent copy, tags, cover, and status.
3. **Platform API calls are always async** — dispatched via BullMQ; the UI never waits on a platform response.
4. **AI suggestions, never auto-actions** — AI output requires user confirmation before being saved.
5. **RBAC is workspace-scoped** — a user can be an owner in one workspace and a viewer in another.
6. **Calendar uses color-coded workspaces** — workspace color is set at creation and never changed silently.
7. **Webhook handlers are idempotent** — platforms can redeliver; duplicate events must not cause duplicate actions.

---

## Git Workflow

- **Never commit directly to `master`** for any meaningful change.
- For every feature, fix, or improvement: create a branch (`feat/...`, `fix/...`, `chore/...`), do all work there, then wait for the user to explicitly approve before merging.
- Branch naming: `feat/<short-description>`, `fix/<short-description>`, `chore/<short-description>`.
- Only merge to `master` after the user says something like "looks good", "merge it", or "LGTM".
- Minor single-line fixes may be committed directly to master only when the user asks for a quick fix in the same message.
- Do not squash or rebase without being asked.
- Do not include `Co-Authored-By` lines in commit messages.
- **After each major change, commit and push to the current branch automatically** — no need for the user to ask. A "major change" is any edit that fixes a bug, adds a feature, or meaningfully refactors logic. Minor clarifying edits (typos, comment tweaks) do not require a commit.

---

## Testing

- Unit tests: Vitest
- API integration tests: always hit a real test PostgreSQL database — do not mock the DB layer
- E2E: Playwright
- Platform integrations: use sandbox/test credentials in CI; never call live platform APIs in tests

---

## Running Locally

```bash
docker compose up -d    # Postgres + Redis
pnpm install
pnpm migrate            # run DB migrations
pnpm dev                # API on :3000, web on :5173
```

Copy `.env.example` to `.env`. OAuth and platform credentials are optional for local dev — email/password auth works without them.
