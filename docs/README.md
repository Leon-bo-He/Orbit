![Orbit](logo.svg)

> Content ops for creators managing multiple content verticals across any platform.

Orbit handles everything *around* creation — capturing ideas before they slip away, planning content with structured briefs, tracking each piece through its full production lifecycle, coordinating multi-platform publishing, and recording performance metrics.

**Built for:** creators juggling multiple content areas — comedy shorts, lifestyle posts, long-form tech writing — publishing across any combination of platforms: Douyin, YouTube, Instagram, X, Xiaohongshu, WeChat, TikTok, or a custom channel of your own.

---

## Features

| Feature | Description |
|---------|-------------|
| **Idea capture** | Zero-friction capture from anywhere. Ideas land in a global pool — no forced categorization. Promote to a content item when ready. |
| **Workspaces** | Each content vertical gets its own isolated workspace with independent Kanban board, calendar, and analytics. |
| **Content Kanban** | Full lifecycle tracking: Planned → Creating → Ready → Published → Reviewed. Stage history auto-logged on every transition. |
| **Content Brief** | Structured creative planning — audience profile, goals & KPIs, hook analysis, title candidates, outline, and competitive references. |
| **Scheduling Calendar** | Month / week / list views. Schedule by dragging. Color-coded by workspace. Gap alerts when publish goals are falling behind. |
| **Publication Management** | One content item → independent per-platform records (copy, hashtags, cover, settings). Manual-assist publishing with push reminders. |
| **Analytics** | Manual metric entry (views, likes, comments, shares, saves, followers gained) with auto-calculated engagement rate. Per-workspace trends and per-post breakdowns. |
| **Custom platforms** | Define publishing channels beyond the built-in list (Douyin, WeChat, Xiaohongshu, YouTube, X, TikTok, Instagram, Bilibili). |
| **Multilingual** | zh-CN · zh-TW · en-US · ja-JP · ko-KR. Browser auto-detect with manual override. |
| **PWA + Offline** | Installable from the browser. Offline idea capture and board access. Background Sync flushes queued writes on reconnect. |
| **Data portability** | Full JSON export of all workspaces, content, publications, metrics, and ideas. Import back from any export file. |

---

## Roadmap

| Phase | Focus | Status |
|-------|-------|--------|
| **Phase 1 — MVP** | Idea capture, Kanban, content briefs, scheduling calendar, manual-assist publishing, analytics, 5-locale i18n, PWA/offline, custom platforms | **Done** |
| **Phase 2 — AI Skills** | Hot topic discovery, AI-assisted titling, translation suggestions, brief generation, content idea expansion | **In progress** |
| **Phase 3 — Advanced Analytics** | Cross-platform performance comparison, trend charts, funnel analysis, audience insights, scheduled reports | Planned |
| **Phase 4 — Platform Integration** | Multi-platform API auto-publish, inbound and outbound webhooks | Planned |
| **Phase 5 — Collaboration** | Multi-user team workspaces, approval workflows, role-based access control, member invites, audit logs | Planned |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS |
| State | Zustand + TanStack Query |
| i18n | react-i18next |
| PWA | Workbox, Dexie.js (IndexedDB) |
| Backend | Fastify, Node.js, TypeScript |
| Database | PostgreSQL 16 |
| Cache / Sessions | Redis 7 |
| Job Queue | BullMQ |
| Auth | JWT (access + refresh) + OAuth 2.0 (WeChat / Google) |
| Deploy | Docker Compose |

---

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 9+
- Docker + Docker Compose

### Quick start

```bash
# Start Postgres + Redis
docker compose up -d

# Install dependencies
pnpm install

# Run database migrations
pnpm migrate

# Start API (port 3000) and web app (port 5173)
pnpm dev
```

Open [http://localhost:5173](http://localhost:5173) and register an account.

### Demo account

Seed the demo account to explore with pre-populated data:

```bash
pnpm seed:demo
```

| Field | Value |
|-------|-------|
| Email | `demo@orbit.app` |
| Password | `demo1234` |

The demo account includes 3 workspaces (Comedy, Lifestyle, Tech Insights), content across all Kanban stages, briefs, publications, and 8 weeks of metric data.

Run `pnpm seed:demo --force` to wipe and re-seed.

### Environment variables

```bash
cp .env.example .env
```

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `REDIS_URL` | Yes | Redis connection string |
| `JWT_SECRET` | Yes | Min 32 chars in production |
| `JWT_ACCESS_TTL` | No | Access token TTL in seconds (default: 900) |
| `JWT_REFRESH_TTL` | No | Refresh token TTL in seconds (default: 2592000) |
| `CORS_ORIGIN` | No | Default: `http://localhost:5173` |
| `WECHAT_APP_ID` / `WECHAT_APP_SECRET` | No | WeChat OAuth |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | No | Google OAuth |

---

## Project Structure

```
Orbit/
├── apps/
│   ├── web/              # React PWA client
│   │   └── src/
│   │       ├── api/      # TanStack Query hooks
│   │       ├── components/
│   │       ├── pages/
│   │       ├── store/    # Zustand stores
│   │       └── locales/  # i18n translation files (5 locales)
│   └── api/              # Fastify server
│       └── src/
│           ├── domain/        # Business logic + repository interfaces
│           ├── infrastructure/# Drizzle ORM repository implementations
│           ├── interfaces/    # Thin HTTP route handlers
│           ├── queue/         # BullMQ queues and workers
│           └── db/            # Drizzle schema + migrations
├── packages/
│   └── shared/           # Shared TypeScript types
├── docker-compose.yml
└── docs/
    ├── DESIGN.md
    ├── CLAUDE.md
    └── README.md
```

---

## Documentation

- **[DESIGN.md](DESIGN.md)** — Full product design, data model, and API reference.
- **[CLAUDE.md](CLAUDE.md)** — Code conventions, architectural rules, and domain glossary.

---

## License

MIT
