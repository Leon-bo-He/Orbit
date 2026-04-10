![Orbit](logo.svg)

> Content ops for creators managing multiple content verticals across any platform.

Orbit handles everything *around* creation — capturing ideas before they slip away, planning content with structured briefs, tracking each piece through its full production lifecycle, coordinating multi-platform publishing, and recording performance metrics. It doesn't replace your creative tools; it connects them.

**Built for:** any creator juggling multiple content areas — comedy shorts, lifestyle posts, long-form tech writing — and publishing across any combination of platforms: Douyin, YouTube, Instagram, X, Xiaohongshu, WeChat, TikTok, or a custom channel of your own. One place to stay on top of it all without letting anything fall through the cracks.

---

## Features

| Feature | Description |
|---------|-------------|
| **Idea capture** | Zero-friction capture from anywhere. Ideas land in a global pool — no forced categorization required. Promote to a content item when ready. |
| **Workspaces** | Each account or vertical gets its own isolated workspace with independent board, calendar, and analytics. |
| **Content Kanban** | Full lifecycle tracking: Planned → Creating → Ready → Published → Reviewed. Drag-and-drop between stages. |
| **Content Brief** | Structured creative planning — audience profile, goals & KPIs, hook analysis, title candidates, outline, and reference links. |
| **Scheduling Calendar** | Month / week / list views. Schedule by dragging. Color-coded by workspace. |
| **Publication Management** | One content item → independent per-platform records (copy, hashtags, cover, settings). Manual-assist publishing with push reminders. |
| **Analytics** | Manual metric entry with auto-calculated engagement rate. Per-workspace trends and per-post breakdowns. |
| **Multilingual** | zh-CN · zh-TW · en-US · ja-JP · ko-KR. Browser auto-detect with manual override. Locale-aware formatting throughout. |
| **PWA + Offline** | Installable from the browser. Offline idea capture and board access. Background Sync flushes queued writes on reconnect. |
| **Data portability** | Full JSON export of all workspaces, content, publications, metrics, and ideas. Import back from any export file. |
| **Custom platforms** | Define custom publishing platforms beyond the built-in list. |

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
| AI | Anthropic Claude API — title suggestions, translation, brief assistance |
| Real-time | WebSocket — collaboration presence, live notifications |
| Infrastructure | Docker Compose |

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

# Start API (port 3000) and web app (port 5173) together
pnpm dev
```

Open [http://localhost:5173](http://localhost:5173) and register an account.

### Environment variables

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

The defaults work out of the box for local development. OAuth credentials are optional — leave them blank to use email/password auth only.

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `JWT_SECRET` | Secret for signing tokens (min 32 chars in production) |
| `WECHAT_APP_ID` / `WECHAT_APP_SECRET` | WeChat OAuth (optional) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth (optional) |

---

## Project Structure

```
Orbit/
├── apps/
│   ├── web/              # React PWA client
│   │   ├── src/
│   │   │   ├── api/      # TanStack Query hooks
│   │   │   ├── components/
│   │   │   ├── pages/
│   │   │   ├── store/    # Zustand stores
│   │   │   └── locales/  # i18n translation files
│   │   └── public/
│   └── api/              # Fastify server
│       └── src/
│           ├── domain/        # Business logic + repository interfaces
│           ├── infrastructure/# Drizzle ORM repository implementations
│           ├── interfaces/    # Thin HTTP route handlers
│           └── db/            # Drizzle schema + migrations
├── docker-compose.yml
├── docs/
│   ├── DESIGN.md         # Full product design and API reference
│   └── CLAUDE.md         # Code conventions and domain glossary
└── .env.example
```

---

## Documentation

- **[DESIGN.md](DESIGN.md)** — Product design, data model, API reference, and domain decisions.
- **[CLAUDE.md](CLAUDE.md)** — Code conventions, architectural rules, and domain glossary.

---

## License

MIT
