# ContentFlow

> One place to manage all your social media accounts — from spark to publish, tracking every piece of content through its full lifecycle.

ContentFlow is a multilingual content scheduling, distribution, and analytics platform built for solo creators running multiple vertical accounts. It handles everything *around* creation — idea capture, production planning, multi-platform publishing, and performance tracking — without replacing your creative tools.

---

## Features

### Phase 1 — MVP (in scope)

| Feature | Description |
|---------|-------------|
| **Rapid Idea Capture** | Zero-friction capture from mobile FAB, desktop shortcut (`⌘⇧I`), or voice input. Global idea pool — no forced categorization at capture time. |
| **Multi-Workspace** | Each account/vertical gets an isolated workspace with its own Kanban, calendar, and analytics. |
| **Content Lifecycle (Kanban)** | Track every content item from Idea → Planned → Creating → Ready → Published → Reviewed. Stages are configurable per workspace. |
| **Content Brief** | Structured creative brief: audience profile, goals & KPIs, hook analysis, title candidates, outline, and competitive references. Reusable templates per workspace. |
| **Scheduling Calendar** | Month / week / list views. Drag-to-schedule. Color-coded workspaces. Gap alerts and frequency-goal tracking. |
| **Publication Management** | One content → independent config per platform (copy, hashtags, cover, settings). Manual-assist publish with PWA push reminders. Publish queue, audit log, batch operations. |
| **Analytics Dashboard** | Manual metric entry + auto-calculated engagement rate. Global dashboard, per-workspace trends, per-post data, tag-dimension analysis. |
| **Multilingual UI** | zh-CN · zh-TW · en-US · ja-JP · ko-KR. Browser auto-detect + manual override. Locale-aware date/number formatting. |
| **PWA + Offline** | Installable from browser. Offline idea capture, board viewing, and calendar access. Background Sync flushes queued writes on reconnect. |

### Phase 2 — Planned

- Multi-user collaboration and approval workflows
- Platform API integration for automatic publishing
- AI-assisted title generation and translation
- Team permissions and role management
- Advanced analytics export and scheduled reports
- Plugin / Webhook ecosystem

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS |
| State | Zustand (local) + TanStack Query (server) |
| i18n | react-i18next |
| PWA | Workbox, Dexie.js (IndexedDB) |
| Backend | Fastify (Node.js), TypeScript |
| Database | PostgreSQL 16 |
| Cache | Redis 7 |
| Job Queue | BullMQ |
| Auth | JWT + OAuth 2.0 (WeChat / Google) |
| Deployment | Docker Compose |

---

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 9+
- Docker + Docker Compose

### Run locally

```bash
# 1. Clone the repository
git clone <repo-url>
cd content_creator

# 2. Start infrastructure (Postgres + Redis)
docker compose up -d

# 3. Install dependencies
pnpm install

# 4. Run database migrations
pnpm --filter api migrate

# 5. Start dev servers
pnpm --filter api dev    # API on http://localhost:3000
pnpm --filter web dev    # Web app on http://localhost:5173
```

### Environment variables

Copy `.env.example` to `.env` and fill in the values:

```env
# Database
DATABASE_URL=postgres://contentflow:secret@localhost:5432/contentflow

# Redis
REDIS_URL=redis://localhost:6379

# Auth
JWT_SECRET=your-jwt-secret

# OAuth (optional for local dev)
WECHAT_APP_ID=
WECHAT_APP_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

---

## Project Structure

```
content_creator/
├── apps/
│   ├── web/              # React PWA client
│   │   ├── src/
│   │   │   ├── features/ # Feature modules (ideas, workspace, kanban, ...)
│   │   │   ├── locales/  # i18n translation files
│   │   │   └── sw/       # Service Worker (Workbox)
│   │   └── vite.config.ts
│   └── api/              # Fastify server
│       ├── src/
│       │   ├── routes/   # API route handlers
│       │   ├── services/ # Business logic
│       │   └── db/       # Schema + migrations
│       └── tsconfig.json
├── packages/
│   └── shared/           # Shared TypeScript types and constants
├── docker-compose.yml
├── CLAUDE.md             # Claude Code project settings
├── DESIGN.md             # Full product design document
└── README.md
```

---

## Documentation

- **[DESIGN.md](DESIGN.md)** — Full product design: features, data model, API reference, milestones.
- **[CLAUDE.md](CLAUDE.md)** — Claude Code project settings, conventions, and domain glossary.

---

## Development Phases

### Phase 1 Milestones (14 weeks)

| Sprint | Deliverable |
|--------|-------------|
| W1–2 | Project scaffold: React + Fastify + PWA baseline + i18n + DB schema |
| W3–4 | Idea module: capture, pool, tags, mobile UX |
| W5–6 | Workspaces + Content Kanban: drag-and-drop, stage transitions |
| W7–8 | Content Brief: 7 sub-modules, templates, competitive refs |
| W9–10 | Scheduling Calendar + Publication Management |
| W11–12 | Analytics Dashboard: manual entry, trends, tag analysis |
| W13–14 | Polish: offline, push notifications, locale QA, performance, launch |

---

## License

MIT
