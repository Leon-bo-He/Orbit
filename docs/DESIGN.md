# Orbit — Design Document

**Version:** 4.0 | **Last updated:** 2026-04-29

---

## Table of Contents

1. [Product Positioning](#1-product-positioning)
2. [Information Architecture](#2-information-architecture)
3. [Core Features](#3-core-features)
   - 3.1 [Idea Capture](#31-idea-capture)
   - 3.2 [Workspaces](#32-workspaces)
   - 3.3 [Content Lifecycle (Kanban)](#33-content-lifecycle-kanban)
   - 3.4 [Content Brief](#34-content-brief)
   - 3.5 [Scheduling Calendar](#35-scheduling-calendar)
   - 3.6 [Publication Management](#36-publication-management)
   - 3.7 [Analytics Dashboard](#37-analytics-dashboard)
4. [AI Features (Phase 2)](#4-ai-features-phase-2)
   - 4.1 [RSS Trending News](#41-rss-trending-news)
   - 4.2 [AI Topic Discovery](#42-ai-topic-discovery)
   - 4.3 [AI Reports](#43-ai-reports)
   - 4.4 [AI Brief Generation](#44-ai-brief-generation)
5. [Multilingual Support](#5-multilingual-support)
6. [PWA & Mobile](#6-pwa--mobile)
7. [Technical Architecture](#7-technical-architecture)
8. [Data Model](#8-data-model)
9. [API Reference](#9-api-reference)

---

## 1. Product Positioning

**One sentence:** Orbit manages everything *around* creation — idea capture, RSS-driven topic discovery, AI-assisted planning, structured content briefs, production lifecycle tracking, multi-platform publishing, and performance analytics.

**Core scenario:** A creator running multiple content verticals simultaneously — comedy shorts, lifestyle posts, long-form tech writing — needs one place to monitor trending topics from RSS feeds, capture ideas before they slip away, plan content with structured AI-assisted briefs, track each piece through its full production lifecycle, and coordinate multi-platform publishing.

### Phase Roadmap

| Phase | Focus | Status |
|-------|-------|--------|
| **Phase 1 — MVP** | Idea capture, multi-workspace Kanban, content briefs, scheduling calendar, manual-assist publishing, analytics, 5-locale i18n, PWA/offline, custom platforms | ✅ Done |
| **Phase 2 — AI Skills** | RSS trending news with incremental storage, AI topic discovery, AI-generated reports (daily/weekly/biweekly) with caching, AI-assisted brief generation (audience, goals, hooks, titles, outline), title/article translation | ✅ Done |
| **Phase 3 — Advanced Analytics** | Cross-platform performance comparison, trend charts, funnel analysis, audience insights, scheduled report delivery | 🔄 In progress |
| **Phase 4 — Platform Integration** | Multi-platform API auto-publish (Douyin, WeChat, Xiaohongshu, YouTube, etc.), inbound and outbound webhooks | Planned |
| **Phase 5 — Collaboration** | Multi-user team workspaces, approval workflows, role-based access control, member invites, activity audit logs | Planned |

---

## 2. Information Architecture

```
Orbit
│
├── Global Dashboard        — cross-workspace overview
├── Global Publish Queue    — cross-workspace timeline
├── Ideas                   — global idea pool + Trending News (RSS + AI)
│
├── Workspace A  (e.g. "Comedy")
│   ├── Content Board (Kanban)
│   ├── Scheduling Calendar
│   ├── Analytics Panel
│   └── Archive
│
├── Workspace B  (e.g. "Lifestyle")
│   └── ...
│
└── Settings  — account, appearance, language, AI config, RSS sources, custom platforms
```

---

## 3. Core Features

### 3.1 Idea Capture

Capture inspiration anywhere with zero friction. Categorize later.

**Entry points:**

| Platform | Mechanism |
|----------|-----------|
| Mobile | Persistent floating `+` button; tap → write |
| Desktop | Global shortcut `Cmd/Ctrl + Shift + I` opens quick-entry overlay |
| AI Topic Discovery | One-click "Add to Ideas" on any discovered topic, pre-filled with title, description, and source links |

**Idea fields:**

| Field | Required | Notes |
|-------|----------|-------|
| Title | Yes | One-line summary |
| Note | No | Extended plain text; source links appended when created from AI discovery |
| Tags | No | Free-form |
| Workspace | No | Assignable later; defaults to global pool |
| Attachments | No | Images, links, screenshots |
| Priority | No | low / medium / high |

**Key decisions:**
- Ideas default to the **global idea pool** — no forced workspace selection.
- Ideas can be promoted to a full Content item at any time.
- When promoted, the idea's `note` is carried into the content's `notes` field.
- Promoted ideas retain a back-link (`converted_to`) for traceability.

---

### 3.2 Workspaces

Each content vertical has its own isolated workspace. Platforms are not bound to a workspace — any content can publish to any combination of platforms via independent Publication records.

**Workspace fields:**

| Field | Description |
|-------|-------------|
| Name & icon | e.g. "Comedy", "Lifestyle" — the content area, not the platform |
| Color | Workspace accent color, used in calendar and labels |
| About | Optional description |
| Publish goal | e.g. `{ count: 3, period: "week" }` — drives calendar gap alerts |
| Stage config | Custom Kanban stage list (JSON) |

---

### 3.3 Content Lifecycle (Kanban)

Every content item moves through well-defined stages with a full `stage_history` audit trail.

**Default stage pipeline:**

```
Idea Captured → Topic Confirmed → In Production → Ready → Publishing → Published → Reviewed
```

**Content fields:**

| Field | Notes |
|-------|-------|
| Title | |
| Stage | Current Kanban column |
| Content type | short_video, image_text, long_video, podcast, live, article |
| Target platforms | e.g. Douyin, WeChat Video, custom platforms |
| Tags | |
| Scheduled publish date | |
| Notes | Production progress notes (carries idea note on conversion) |
| Review notes | Filled in the Reviewed stage |
| Source idea | Link to originating Idea |
| Attachments | |
| Stage history | Auto-logged on every stage transition |

---

### 3.4 Content Brief

Every content item has a structured **Brief** — a production guide with seven sub-modules, all with AI generation support.

#### ① Format Config
Select format and type-specific fields (duration, aspect ratio, etc.).

#### ② Target Audience Profile
AI-generated or manually filled. Fields: age range, persona tags, core pain point, reach scenario.
Profiles can be saved as workspace-level templates for reuse.

#### ③ Content Goals
Select one or more: Grow followers / Conversion / Traffic referral / Brand awareness.
Add goal description and KPI targets. AI suggests goals based on title and audience.

#### ④ Hook Analysis
| Element | Description |
|---------|-------------|
| Core hook | e.g. "Learn in 3 days" — time anchor creates urgency |
| Conflict / contrast | "Others pay ¥3,000; here are 3 free apps" |
| Golden opening | First 10–15 words designed to stop the scroll |
| Memory anchor | The one thing viewers should remember |

AI generates all four fields from the content title and audience context.

#### ⑤ Title Candidates
List multiple candidates; mark primary/backup. AI generates 5 candidates.
When AI-generated titles are applied, user chooses **Add to existing** or **Replace all**.

#### ⑥ Content Outline
Ordered list with time markers. AI generates a full 5–8 section outline with time marks and notes.

#### ⑦ Competitive References
Manual entry: author, title, platform, URL, metrics snapshot, takeaway, attachments.

---

### 3.5 Scheduling Calendar

Visualize all content on a publication timeline.

**View modes:** Month · Week · List

**Core interactions:**
- Drag content cards onto calendar slots to set publish time.
- Workspaces color-coded on the calendar.
- Gap alerts and publish frequency tracking.

---

### 3.6 Publication Management

One content item → independent per-platform publication records.

**Publication status flow:**

```
draft → queued → ready → posting → published
                  │                    │
                skipped              failed
```

**Phase 1 (manual-assist):** System notifies when it's time to publish; user publishes manually and records the URL.
**Phase 4 (auto-publish):** API integration handles posting automatically.

---

### 3.7 Analytics Dashboard

Track content performance via manual metric entry.

**Hierarchy:**
```
Global Dashboard
├── Total content count, published count, weekly/monthly cadence
├── Cross-platform aggregated totals
├── Top 10 content by performance
└── Per-workspace summary

Workspace Analytics
├── Account KPI trend charts (weekly / monthly)
├── Per-post data table (sortable)
└── Publish frequency achievement rate

Single Content Detail
├── Per-platform data comparison
└── Metrics-over-time curve
```

**Metrics per publication:** views, likes, comments, shares, saves, followers_gained.

---

## 4. AI Features (Phase 2)

All AI features use a user-configurable OpenAI-compatible API (base URL + API key + model — set in Settings → AI). No server-side AI keys required.

### 4.1 RSS Trending News

**Sources:** Users add any number of RSS sources in Settings → Data, organized by folders. Sources can be bulk-imported/exported as OPML (with folder metadata preserved).

**Storage:** Articles are fetched server-side and stored incrementally in PostgreSQL:
- `rss_feeds` — tracks last fetch time per URL
- `rss_articles` — one row per unique `(feed_url, link)` pair; deduplication by title using `DISTINCT ON`; articles expire after 3 months
- Fetch interval: 30 min (server-side, no CORS proxy)
- Ordering: `COALESCE(pub_date_ts, first_seen_at) DESC`

**Display:** Paginated cards per source, with folder labels. Per-source report buttons (Daily / Weekly / Biweekly).

### 4.2 AI Topic Discovery

Users select any combination of RSS sources or folders, choose a time period (daily/weekly/biweekly), optionally add custom requirements, and receive:

- **🔥 Trending Topics** — most significant topics with bold title + description + inline source citations
- **🌱 Emerging Themes** — patterns across sources with citations
- **💎 Hidden Gems** — underreported stories worth following

Each topic has a `+ Idea` button that pre-fills the IdeaCaptureModal with the topic title, description, and source links (in `[title](url)` format).

### 4.3 AI Reports

Reports are generated per RSS source or for all sources at once.

**Periods:** Daily (24h) · Weekly (7 days) · Biweekly (14 days)

**Caching:** Reports are cached in `rss_reports` table for 24 h. Concurrent generation requests for the same (user, feed, period) are deduplicated via Redis lock (`SET NX EX`). Force-refresh (`force: true`) runs in background via `setImmediate` — HTTP returns 202 immediately, client polls for result.

**Report sections:**
- Overview (2–3 paragraphs)
- Key Developments (per-story paragraphs with inline source links)
- Trends & Analysis (2–3 patterns with citations)
- Summary (one paragraph)

Reports are rendered as Markdown with clickable source links. Translatable via the same AI config.

### 4.4 AI Brief Generation

Each brief section has an **AI Generate** button in its accordion header. Clicking it calls `POST /api/ai-brief` with the section name and current brief context (title, content type, audience, goals, hooks).

| Section | AI output |
|---------|-----------|
| Audience | `{ ageRange, personaTags[], painPoints, reachScenario }` |
| Goals | `{ goals[], goalDescription, kpiTargets }` |
| Hooks | `{ coreHook, conflict, goldenOpening, memoryPoint }` |
| Titles | Array of `{ text, isPrimary, usedOnPlatforms }` — user chooses Add or Replace |
| Outline | Array of `{ order, section, timeMark, note }` |

All prompts are context-aware: later sections receive earlier section outputs (e.g., titles generation receives audience + goals + hooks).

---

## 5. Multilingual Support

**Supported locales:** `zh-CN` · `zh-TW` · `en-US` · `ja-JP` · `ko-KR`

- `react-i18next` with all locale bundles bundled at build time (no async loading).
- Browser language auto-detection; manual override in Settings.
- All AI-generated content is produced in the user's active locale language.

---

## 6. PWA & Mobile

**Primary scenario — quick idea capture on phone:**
- Floating `+` FAB; tap → write.

**Offline capabilities:**

| Available Offline | Requires Network |
|-------------------|-----------------|
| Record ideas | Refresh RSS feeds |
| View scheduling calendar | AI generation |
| View content board | Publish actions |
| View cached metrics | Sync to server |

Offline writes queue via **Background Sync** and flush automatically on reconnect.

---

## 7. Technical Architecture

```
┌──────────────────────────────────────────┐
│          PWA Client (React 18)            │
│  Zustand + TanStack Query + react-i18next │
│  Workbox SW + IndexedDB (Dexie.js)        │
└──────────────────┬───────────────────────┘
                   │ HTTPS / REST
┌──────────────────▼───────────────────────┐
│          Fastify API Server               │
│  ┌─────────────────────────────────────┐  │
│  │  Interfaces (src/interfaces/http/)  │  │
│  │  Thin route handlers                │  │
│  └──────────────┬──────────────────────┘  │
│  ┌──────────────▼──────────────────────┐  │
│  │  Domain (src/domain/)               │  │
│  │  Services: AI, Brief, RSS, Idea,    │  │
│  │  Content, Publication, Metric, User │  │
│  └──────────────┬──────────────────────┘  │
│  ┌──────────────▼──────────────────────┐  │
│  │  Infrastructure                     │  │
│  │  (src/infrastructure/db/repos/)     │  │
│  │  Drizzle ORM implementations        │  │
│  └──────────────┬──────────────────────┘  │
└─────────────────┼─────────────────────────┘
                  ▼
   PostgreSQL    Redis         BullMQ      AI API
   (primary)  (cache/lock)   (jobs)   (user-configured)
```

**Stack:**

| Layer | Choice |
|-------|--------|
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS |
| State (local) | Zustand (persisted to localStorage) |
| State (server) | TanStack Query |
| i18n | react-i18next |
| PWA | Workbox + Dexie.js (IndexedDB) |
| Backend | Fastify (Node.js) + TypeScript |
| ORM | Drizzle ORM |
| Database | PostgreSQL 16 |
| Cache / sessions | Redis 7 |
| Job queue | BullMQ |
| Auth | JWT (access + refresh) + silent token refresh on 401 |
| AI | OpenAI-compatible API (SSE streaming; user-configured) |
| Deploy | Docker Compose |

---

## 8. Data Model

```sql
-- Users
users (
  id uuid PK,
  email text UNIQUE NOT NULL,
  username text NOT NULL,
  avatar text,
  locale text NOT NULL DEFAULT 'en-US',
  timezone text NOT NULL DEFAULT 'America/Los_Angeles',
  password_hash text,
  notification_lead_time integer NOT NULL DEFAULT 15,
  created_at timestamptz NOT NULL
)

-- Workspaces
workspaces (
  id uuid PK,
  user_id uuid FK→users CASCADE,
  name text NOT NULL,
  icon text NOT NULL,
  color text NOT NULL,
  about text,
  publish_goal jsonb,
  stage_config jsonb NOT NULL,
  created_at timestamptz NOT NULL
)

-- Ideas
ideas (
  id uuid PK,
  user_id uuid FK→users CASCADE,
  workspace_id uuid FK→workspaces SET NULL,
  title text NOT NULL,
  note text,
  tags jsonb NOT NULL DEFAULT [],
  priority text NOT NULL DEFAULT 'medium',
  attachments jsonb NOT NULL DEFAULT [],
  status text NOT NULL DEFAULT 'active',   -- active | converted | archived
  converted_to uuid FK→contents SET NULL,
  created_at timestamptz NOT NULL
)

-- Contents
contents (
  id uuid PK,
  workspace_id uuid FK→workspaces CASCADE,
  idea_id uuid,
  title text NOT NULL,
  content_type text NOT NULL,
  stage text NOT NULL DEFAULT 'planned',
  tags jsonb NOT NULL DEFAULT [],
  target_platforms jsonb NOT NULL DEFAULT [],
  scheduled_at timestamptz,
  notes text,                              -- carries idea note on conversion
  review_notes text,
  attachments jsonb NOT NULL DEFAULT [],
  stage_history jsonb NOT NULL DEFAULT [],
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
)

-- Content Briefs  (1-to-1 with contents)
content_plans (
  id uuid PK,
  content_id uuid FK→contents CASCADE UNIQUE,
  format_config jsonb NOT NULL DEFAULT {},
  audience jsonb,
  audience_template_id uuid,
  goals jsonb NOT NULL DEFAULT [],
  goal_description text,
  kpi_targets jsonb NOT NULL DEFAULT {},
  hooks jsonb,
  title_candidates jsonb NOT NULL DEFAULT [],
  outline jsonb NOT NULL DEFAULT [],
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
)

-- Competitive References
content_references (
  id uuid PK,
  content_id uuid FK→contents CASCADE,
  author_name text NOT NULL,
  content_title text NOT NULL,
  platform text NOT NULL,
  url text NOT NULL,
  metrics_snapshot jsonb NOT NULL DEFAULT {},
  takeaway text NOT NULL,
  attachments jsonb NOT NULL DEFAULT [],
  created_at timestamptz NOT NULL
)

-- Brief Templates
plan_templates (
  id uuid PK,
  workspace_id uuid FK→workspaces CASCADE,
  name text NOT NULL,
  audience jsonb,
  goals jsonb NOT NULL DEFAULT [],
  goal_description text,
  created_at timestamptz NOT NULL
)

-- Publications
publications (
  id uuid PK,
  content_id uuid FK→contents CASCADE,
  platform text NOT NULL,
  platform_title text,
  platform_copy text,
  platform_tags jsonb NOT NULL DEFAULT [],
  cover_url text,
  platform_settings jsonb NOT NULL DEFAULT {},
  scheduled_at timestamptz,
  published_at timestamptz,
  status text NOT NULL DEFAULT 'draft',
  platform_post_id text,
  platform_url text,
  failure_reason text,
  publish_log jsonb NOT NULL DEFAULT [],
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
)

-- Metrics
metrics (
  id uuid PK,
  publication_id uuid FK→publications CASCADE,
  views integer NOT NULL DEFAULT 0,
  likes integer NOT NULL DEFAULT 0,
  comments integer NOT NULL DEFAULT 0,
  shares integer NOT NULL DEFAULT 0,
  saves integer NOT NULL DEFAULT 0,
  followers_gained integer NOT NULL DEFAULT 0,
  recorded_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL
)

-- Notification Channels
notification_channels (
  id uuid PK,
  user_id uuid FK→users CASCADE,
  type text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  config jsonb NOT NULL DEFAULT {},
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  UNIQUE (user_id, type)
)

-- Custom Platforms
custom_platforms (
  id text PK,
  user_id uuid FK→users CASCADE,
  name text NOT NULL,
  icon text NOT NULL DEFAULT '📌',
  created_at timestamptz NOT NULL
)

-- AI Configuration (per user)
ai_configs (
  user_id uuid PK FK→users CASCADE,
  base_url text NOT NULL,
  api_key text NOT NULL,
  model text NOT NULL DEFAULT 'gpt-5.4',
  updated_at timestamptz NOT NULL
)

-- RSS Feeds (fetch tracking)
rss_feeds (
  url text PK,
  last_fetched_at timestamptz NOT NULL
)

-- RSS Articles (incremental storage)
rss_articles (
  id uuid PK,
  feed_url text NOT NULL,
  link text NOT NULL,
  title text NOT NULL,
  pub_date text NOT NULL DEFAULT '',
  pub_date_ts timestamptz,            -- parsed for ordering and date-range queries
  first_seen_at timestamptz NOT NULL,
  UNIQUE (feed_url, link)
)

-- RSS Reports (AI-generated, cached 24h)
rss_reports (
  id uuid PK,
  user_id uuid FK→users CASCADE,
  feed_url text NOT NULL,
  report_type text NOT NULL,          -- daily | weekly | biweekly
  content text NOT NULL,
  created_at timestamptz NOT NULL
)
```

---

## 9. API Reference

All endpoints require `Authorization: Bearer <token>` unless noted.

### Auth

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/auth/register` | No | Register new user |
| `POST` | `/api/auth/login` | No | Login, returns access token |
| `POST` | `/api/auth/refresh` | Cookie | Refresh access token |
| `POST` | `/api/auth/logout` | Yes | Invalidate session |
| `GET` | `/api/auth/me` | Yes | Get current user profile |
| `PATCH` | `/api/auth/profile` | Yes | Update username, email, locale, timezone |
| `PATCH` | `/api/auth/password` | Yes | Change password |
| `DELETE` | `/api/auth/account` | Yes | Delete account |

### Workspaces

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/workspaces` | Create workspace |
| `GET` | `/api/workspaces` | List workspaces |
| `PATCH` | `/api/workspaces/:id` | Update workspace |
| `POST` | `/api/upload/workspace-icon` | Upload workspace icon |
| `POST` | `/api/upload/avatar` | Upload user avatar |

### Ideas

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/ideas` | Create idea |
| `GET` | `/api/ideas?workspace=&status=&priority=&q=` | List ideas |
| `PATCH` | `/api/ideas/:id` | Update idea |
| `POST` | `/api/ideas/:id/convert` | Promote idea to Content (carries note) |
| `GET` | `/api/ideas/archived/export` | Export archived ideas |
| `DELETE` | `/api/ideas/archived` | Bulk-delete archived ideas |

### Contents

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/contents` | Create content |
| `GET` | `/api/contents?workspace=&stage=` | List contents |
| `PATCH` | `/api/contents/:id` | Update content / advance stage |
| `DELETE` | `/api/contents/:id` | Delete content |
| `GET` | `/api/contents/calendar?from=&to=&workspace=` | Calendar view data |
| `GET` | `/api/contents/archived/export` | Export archived contents |
| `DELETE` | `/api/contents/archived` | Bulk-delete archived contents |

### Content Briefs

| Method | Path | Description |
|--------|------|-------------|
| `PUT` | `/api/contents/:id/plan` | Upsert brief |
| `GET` | `/api/contents/:id/plan` | Get brief |
| `GET` | `/api/contents/:id/references` | List competitive references |
| `POST` | `/api/contents/:id/references` | Add reference |
| `DELETE` | `/api/contents/:id/references/:refId` | Remove reference |
| `POST` | `/api/workspaces/:id/plan-templates` | Save audience template |
| `GET` | `/api/workspaces/:id/plan-templates` | List templates |
| `PATCH` | `/api/workspaces/:id/plan-templates/:templateId` | Rename template |
| `DELETE` | `/api/workspaces/:id/plan-templates/:templateId` | Delete template |

### Publication Management

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/contents/:id/publications` | Add platform to content |
| `GET` | `/api/contents/:id/publications` | List publications for content |
| `PATCH` | `/api/publications/:id` | Update publication config / status |
| `DELETE` | `/api/publications/:id` | Delete publication |
| `POST` | `/api/publications/:id/mark-published` | Mark published + record URL |
| `GET` | `/api/publications/queue?status=&from=&to=` | Global publish queue |
| `PATCH` | `/api/publications/batch` | Batch reschedule or status update |

### Analytics

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/metrics` | Record metric snapshot |
| `GET` | `/api/metrics/dashboard?workspace=` | Workspace analytics |
| `GET` | `/api/metrics/content/:id` | Single content metrics |
| `GET` | `/api/dashboard` | Global dashboard summary |

### RSS & AI

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/rss?url=&page=&pageSize=` | Fetch/serve RSS articles (paginated) |
| `DELETE` | `/api/rss?url=` | Delete all cached data for a feed |
| `POST` | `/api/rss-reports` | Generate or retrieve AI report (`{ feedUrl, feedName, reportType, force? }`) |
| `POST` | `/api/ai-topic-discover` | Discover topics across multiple feeds (`{ feeds[], reportType, additionalRequirements? }`) |
| `POST` | `/api/ai-brief` | Generate a brief section (`{ section, context }`) |
| `POST` | `/api/ai-translate` | Translate an array of titles (`{ titles[], targetLanguage }`) |
| `POST` | `/api/ai-translate-text` | Translate a full text document (`{ text, targetLanguage }`) |
| `GET` | `/api/ai-config` | Get AI configuration (key masked) |
| `PUT` | `/api/ai-config` | Save AI configuration |
| `POST` | `/api/ai-config/test` | Test AI connection |

### Notifications

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/notifications/telegram` | Get Telegram config |
| `PATCH` | `/api/notifications/telegram` | Save / clear Telegram config |
| `POST` | `/api/notifications/telegram/fetch-chat-id` | Auto-detect Chat ID |
| `POST` | `/api/notifications/telegram/test` | Send test message |

### Custom Platforms

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/custom-platforms` | List custom platforms |
| `POST` | `/api/custom-platforms` | Create custom platform |
| `DELETE` | `/api/custom-platforms/:id` | Delete custom platform |

### Data Portability

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/export` | Export all user data as JSON archive |
| `POST` | `/api/import` | Import a JSON archive |

### System

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/health` | No | Health check (Postgres + Redis) |
