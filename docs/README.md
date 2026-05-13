![Orbit](logo.svg)

> Content ops platform for creators managing multiple content verticals across any platform — with AI-powered discovery, planning, and brief generation built in.

Orbit handles everything *around* creation — capturing ideas, RSS-driven topic discovery, AI-assisted brief writing, structured content planning, full production lifecycle tracking, multi-platform publishing coordination, and performance analytics.

**Built for:** creators juggling multiple content areas (comedy shorts, lifestyle posts, long-form tech writing) publishing across any combination of platforms: Douyin, YouTube, Instagram, X, Xiaohongshu, WeChat, TikTok, Bilibili, or a custom channel.

---

## Features

| Feature | Description |
|---------|-------------|
| **Idea capture** | Zero-friction capture from anywhere. Ideas land in a global pool — no forced categorization. Attach notes and source links, then promote to a content item when ready. |
| **RSS Trending News** | Follow any RSS source. Articles are stored incrementally in the DB with deduplication. Paginated, folder-organized, with auto-refresh every 30 min. |
| **AI Topic Discovery** | Select multiple RSS sources and a time period; AI surfaces trending topics, emerging themes, and hidden gems — each with a one-click "Add to Ideas" button. |
| **AI Reports** | Generate daily / weekly / biweekly AI-written reports for any RSS source or all sources at once. Reports are cached 24 h, refreshable, and translatable. |
| **AI Brief Generation** | One-click AI generation for every brief section: audience profile, content goals, hook analysis, title candidates, and outline — all context-aware. |
| **Workspaces** | Each content vertical gets its own isolated workspace with independent Kanban board, calendar, and analytics. |
| **Content Kanban** | Full lifecycle: Idea Captured → Topic Confirmed → In Production → Ready → Published → Reviewed. Stage history auto-logged on every transition. |
| **Content Brief** | Structured creative planning — format config, audience profile, goals & KPIs, hook analysis, title candidates, content outline, and competitive references. |
| **Scheduling Calendar** | Month / week / list views. Schedule by dragging. Color-coded by workspace. Gap alerts when publish goals fall behind. |
| **Publication Management** | One content item → independent per-platform records (copy, hashtags, cover, settings). Manual-assist publishing with push reminders. |
| **Analytics** | Manual metric entry (views, likes, comments, shares, saves, followers gained) with auto-calculated engagement rate. Per-workspace trends and per-post breakdowns. |
| **Notifications** | Telegram bot integration for publish reminders with configurable lead time. |
| **Custom platforms** | Define publishing channels beyond the built-in list. |
| **OPML import / export** | Import and export RSS sources as standard OPML files, with folder support. |
| **Multilingual** | zh-CN · zh-TW · en-US · ja-JP · ko-KR. Browser auto-detect with manual override. |
| **PWA + Offline** | Installable. Offline idea capture and board access. Background Sync flushes queued writes on reconnect. |
| **Data portability** | Full JSON export and import of all workspaces, content, publications, metrics, and ideas. |

---

## Roadmap

| Phase | Focus | Status |
|-------|-------|--------|
| **Phase 1 — MVP** | Idea capture, multi-workspace Kanban, content briefs, scheduling calendar, manual-assist publishing, analytics, 5-locale i18n, PWA/offline, custom platforms | ✅ Done |
| **Phase 2 — AI Skills** | RSS trending news with incremental storage, AI topic discovery, AI-generated daily/weekly reports with caching, AI-assisted brief generation (audience, goals, hooks, titles, outline), title translation | ✅ Done |
| **Phase 3 — Platform Integration** | Multi-platform API auto-publish (Douyin, WeChat, Xiaohongshu, YouTube, etc.), inbound and outbound webhooks | 🔄 In progress |
| **Phase 4 — Advanced Analytics** | Cross-platform performance comparison, trend charts, funnel analysis, audience insights, scheduled report delivery | Planned |
| **Phase 5 — Collaboration** | Multi-user team workspaces, approval workflows, role-based access control, member invites, activity audit logs | Planned |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS |
| State | Zustand + TanStack Query |
| i18n | react-i18next — 5 locales |
| PWA | Workbox, Dexie.js (IndexedDB) |
| Backend | Fastify (Node.js), TypeScript |
| Database | PostgreSQL 16 |
| Cache / Sessions | Redis 7 |
| Job Queue | BullMQ |
| Auth | JWT (access + refresh) + OAuth 2.0 (WeChat / Google) |
| AI | OpenAI-compatible API (configurable base URL + model) |
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

> **AI configuration** is set per-user in the app's Settings → AI page (base URL, API key, model). No server-side env vars required.

---

## Project Structure

```
Orbit/
├── apps/
│   ├── web/              # React PWA client
│   │   └── src/
│   │       ├── api/      # TanStack Query hooks
│   │       ├── components/
│   │       │   ├── brief/    # Brief section components + AI generate button
│   │       │   └── ideas/    # Trending news, reports, topic discovery modals
│   │       ├── pages/
│   │       ├── store/    # Zustand stores (auth, ui, rss)
│   │       └── locales/  # i18n — zh-CN · zh-TW · en-US · ja-JP · ko-KR
│   └── api/              # Fastify server
│       └── src/
│           ├── domain/        # Business logic + repository interfaces
│           │   └── ai/        # AiService (reports, translation, topic discovery) + BriefService
│           ├── infrastructure/# Drizzle ORM repository implementations
│           ├── interfaces/    # Thin HTTP route handlers
│           ├── queue/         # BullMQ queues and workers
│           └── db/            # Drizzle schema + migrations (0000–0017)
├── packages/
│   └── shared/           # Shared TypeScript types
├── docker-compose.yml
└── docs/
    ├── DESIGN.md         # Full product design, data model, API reference
    ├── CLAUDE.md         # AI coding assistant project settings
    └── README.md
```

---

## Friend Links

[LinuxDO](https://linux.do/)

---

## License

MIT
