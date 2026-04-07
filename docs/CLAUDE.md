# ContentFlow — Claude Code Project Settings

## Project Overview

ContentFlow is a multilingual social media content scheduling, distribution, and analytics platform for solo creators managing multiple vertical accounts (e.g. Douyin comedy, Xiaohongshu fashion, WeChat Official Account long-form).

**Phase 1 (MVP):** Manual-assist publishing, full content lifecycle, scheduling calendar, analytics dashboard.
**Phase 2:** Multi-user collaboration, automated API publishing, AI-assisted titling/translation.

## Tech Stack

| Layer | Choice |
|-------|--------|
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS |
| State | Zustand (local) + React Query (server) |
| i18n | react-i18next — locales: zh-CN, zh-TW, en-US, ja-JP, ko-KR |
| PWA | Workbox + IndexedDB via Dexie.js |
| Backend | Fastify (Node.js) + TypeScript |
| Database | PostgreSQL 16 |
| Cache | Redis 7 |
| Queue | BullMQ (scheduled reminders, future auto-publish) |
| Auth | JWT + OAuth 2.0 (WeChat / Google) |
| Deploy | Docker Compose (single-host MVP) |

## Directory Layout (target)

```
content_creator/
├── apps/
│   ├── web/          # React PWA client
│   └── api/          # Fastify server
├── packages/
│   └── shared/       # Types, constants shared between apps
├── docker-compose.yml
├── DESIGN.md
└── README.md
```

## Code Conventions

- **TypeScript strict mode** everywhere; no `any` unless third-party types force it.
- **API routes** follow REST conventions defined in DESIGN.md §8; no ad-hoc endpoints.
- **i18n**: All user-visible strings go through `t()` — no hardcoded display text.
- **Database**: Use migrations (prefer `node-pg-migrate` or Drizzle migrations); never alter schema with raw ad-hoc SQL.
- **Offline-first**: Data mutations must enqueue a BullMQ/BackgroundSync task before returning success; don't assume connectivity.
- **No premature abstraction**: Implement features as described in DESIGN.md Phase 1 scope only.

## Domain Glossary

| Term | Meaning |
|------|---------|
| Workspace | One vertical account/channel (e.g. "Douyin · Comedy") |
| Idea | A raw, unstructured inspiration captured quickly |
| Content | A formal content item promoted from an Idea |
| Plan (Brief) | Structured creative brief attached 1-to-1 with a Content |
| Publication | One platform-specific publish record for a Content |
| Stage | Kanban column: planned → planning → creating → ready → published → reviewed |
| Metric | A single data snapshot for a Publication |

## Key Design Decisions to Respect

1. **Idea entry is zero-friction** — workspace assignment is optional at capture time.
2. **One Content → many Publications** — each Publication has independent copy, tags, cover, and status.
3. **Phase 1 is manual-assist only** — no platform API calls for publishing; system only reminds and records.
4. **Calendar uses color-coded workspaces** — consistent workspace color must be set at creation and not changed silently.
5. **Offline writes queue via BackgroundSync** — do not block the UI waiting for server confirmation.

## Testing

- Unit tests: Vitest
- API integration tests: hit a real test PostgreSQL database (no mocking the DB layer)
- E2E: Playwright

## Running Locally

```bash
docker compose up -d          # start postgres + redis
pnpm install
pnpm --filter api dev         # api on :3000
pnpm --filter web dev         # vite dev on :5173
```
