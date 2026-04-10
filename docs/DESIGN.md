# Orbit — Design Document

**Version:** 2.1 | **Last updated:** 2026-04-10

---

## Table of Contents

1. [Product Positioning](#1-product-positioning)
2. [Information Architecture](#2-information-architecture)
3. [Phase 1 Core Features](#3-phase-1-core-features)
   - 3.1 [Idea Capture](#31-idea-capture)
   - 3.2 [Workspaces](#32-workspaces)
   - 3.3 [Content Lifecycle (Kanban)](#33-content-lifecycle-kanban)
   - 3.4 [Content Brief (Planning)](#34-content-brief-planning)
   - 3.5 [Scheduling Calendar](#35-scheduling-calendar)
   - 3.6 [Publication Management](#36-publication-management)
   - 3.7 [Analytics Dashboard](#37-analytics-dashboard)
4. [Multilingual Support](#4-multilingual-support)
5. [PWA & Mobile](#5-pwa--mobile)
6. [Technical Architecture](#6-technical-architecture)
7. [Data Model](#7-data-model)
8. [API Reference](#8-api-reference)
9. [Phase 1 Milestones](#9-phase-1-milestones)

---

## 1. Product Positioning

**One sentence:** Orbit doesn't replace your creative tools — it manages everything around creation: idea capture, scheduling, multi-platform distribution, and performance tracking.

**Core scenario:** A creator running multiple content verticals simultaneously — comedy shorts, lifestyle posts, long-form tech writing — and publishing each across a mix of platforms (Douyin, TikTok, Xiaohongshu, Instagram, WeChat OA, YouTube, X, or a custom channel) needs one place to plan content, manage publishing cadence, and track performance across all channels. Workspaces represent content areas, not platforms; platforms are selected per publication.

### Phase Roadmap

| Phase | Focus | Status |
|-------|-------|--------|
| **Phase 1 — MVP** | Idea capture, multi-workspace Kanban, content briefs, scheduling calendar, manual-assist publishing, analytics dashboard, 5-locale i18n, PWA/offline | **Done** |
| **Phase 2 — Platform Integration** | Multi-platform API auto-publish (Douyin, WeChat, Xiaohongshu, YouTube, etc.), inbound and outbound webhooks | **In progress** |
| **Phase 3 — AI Skills** | Hot topic discovery, AI-assisted titling, translation suggestions, brief generation, content idea expansion | Planned |
| **Phase 4 — Advanced Analytics** | Cross-platform performance comparison, trend charts, funnel analysis, audience insights, scheduled report delivery | Planned |
| **Phase 5 — Collaboration** | Multi-user team workspaces, approval workflows, role-based access control, member invites, activity audit logs | Planned |

---

## 2. Information Architecture

```
Orbit
│
├── Global Dashboard        — cross-workspace overview
├── Global Publish Queue    — cross-workspace timeline
│
├── Workspace A  (e.g. "Comedy" — publishes to Douyin, TikTok, YouTube Shorts)
│   ├── Idea Pool
│   ├── Content Board (Kanban)
│   ├── Content Brief
│   ├── Publication Management
│   ├── Scheduling Calendar
│   └── Analytics Panel
│
├── Workspace B  (e.g. "Lifestyle" — publishes to Xiaohongshu, Instagram)
│   ├── Idea Pool
│   ├── Content Board
│   ├── Scheduling Calendar
│   └── Analytics Panel
│
├── Workspace C  (e.g. "Tech Insights" — publishes to WeChat OA, X, newsletter)
│   └── ...
│
└── Settings  — account bindings, language, notification preferences
```

---

## 3. Phase 1 Core Features

### 3.1 Idea Capture

Capture inspiration anywhere, with zero friction. Categorize later.

**Entry points:**

| Platform | Mechanism |
|----------|-----------|
| Mobile | Persistent floating `+` button; tap → write; voice-to-text supported |
| Desktop | Global shortcut `Cmd/Ctrl + Shift + I` opens a quick-entry overlay |
| Android | PWA notification bar shortcut |

**Idea card fields:**

| Field | Required | Notes |
|-------|----------|-------|
| One-line summary | Yes | |
| Extended note | No | Plain text |
| Tags | No | Free-form |
| Workspace | No | Assignable later; defaults to global pool |
| Attachments | No | Images, links, screenshots |
| Priority | No | Low / Medium / High |

**Key design decisions:**
- Ideas default to the **global idea pool** — no forced workspace selection, lowering capture friction.
- Ideas can be promoted to a full Content item at any time.
- Ideas support cross-workspace assignment (one idea → multiple workspaces).

---

### 3.2 Workspaces

Each content area or vertical has its own isolated workspace. Schedules and data do not bleed between workspaces. Platforms are not bound to a workspace — a single piece of content can be published to any combination of platforms via independent Publication records.

**Workspace configuration:**

| Field | Description |
|-------|-------------|
| Name & icon | e.g. "Comedy", "Lifestyle", "Tech Insights" — the content area, not the platform |
| Content type | Short video / Image-text / Long article / Podcast (determines Kanban fields) |
| Default tag set | Pre-set tags for this vertical |
| Publish frequency goal | e.g. "3 posts/week" — used for calendar gap alerts |
| Timezone | Per-workspace timezone support for international accounts |
| Kanban stages | Configurable; see §3.3 |

**Cross-workspace relationships:**
- One idea can be assigned to multiple workspaces.
- A content item can be marked "cross-platform" and tracked across workspaces.
- The Global Dashboard aggregates data from all workspaces.

---

### 3.3 Content Lifecycle (Kanban)

Every content item moves through well-defined stages, fully tracked from idea to post-mortem.

**Default stage pipeline (Phase 1 — no approval flow):**

```
Idea → Planned → Planning → Creating → Ready → Publishing → Published → Reviewed
```

**Kanban board layout:**

```
┌──────────┬──────────┬──────────┬────────────┬───────────┬──────────┐
│ Planned  │ Creating │  Ready   │ Publishing │ Published │ Reviewed │
├──────────┼──────────┼──────────┼────────────┼───────────┼──────────┤
│ Card 1   │ Card 3   │ Card 5   │            │           │          │
│ Apr 15   │ Filming  │ Sched    │            │           │          │
│          │          │ Apr 12   │            │           │          │
│ Card 2   │ Card 4   │          │            │           │          │
│ Apr 18   │ Editing  │          │            │           │          │
└──────────┴──────────┴──────────┴────────────┴───────────┴──────────┘
```

**Content card fields:**

| Field | Notes |
|-------|-------|
| Title | |
| Stage | Current Kanban column |
| Content type | Short video, image-text, etc. |
| Target platforms | e.g. Douyin, WeChat Video |
| Tags | |
| Planned publish date | |
| Production notes | Free text; tracks progress |
| Source idea | Link to originating Idea |
| Attachments / reference links | |
| Post-publish metrics | Auto-shown once published |
| Post-mortem notes | Filled in Reviewed stage |

**Stage customization:** Workspace settings allow adding/removing stages. Phase 5 can insert "In Review" between Creating and Ready as part of the approval workflow.

---

### 3.4 Content Brief (Planning)

When an idea is confirmed as a topic, it enters the Planning stage and receives a structured **Content Brief** — a production guide covering seven sub-modules.

**Brief structure:**

#### ① Content Type
Select format: Image-text / Short video / Long video / Podcast / Live.  
Type-specific auxiliary fields appear on selection (video duration, aspect ratio, etc.).

#### ② Target Audience Profile

| Field | Example |
|-------|---------|
| Age range | 18–25 |
| Persona tags | University students, early-career, side-hustle seekers |
| Core pain point | Want to do self-media but can't edit; intimidated |
| Reach scenario | Scrolling Douyin during fragmented downtime |

Profiles can be saved as workspace-level templates for reuse.

#### ③ Content Goals
Select one or more: Grow followers / Conversion / Traffic referral / Brand awareness.  
Add a goal description and KPI targets (e.g. Likes ≥ 500, Comments ≥ 50).

#### ④ Hook Analysis

| Element | Description |
|---------|-------------|
| Core hook | e.g. "Learn in 3 days" — time anchor creates urgency |
| Conflict / contrast | "Others pay ¥3,000 for a class; here are 3 free apps" |
| Golden-3-second design | Show before/after editing comparison immediately |
| Memory anchor | "The editing triad: cut, color, caption" |

#### ⑤ Title Candidates

List multiple candidate titles; mark primary / backup.  
After publishing, record which title was actually used per platform.

#### ⑥ Content Outline
Ordered list with time markers and per-section notes. Drag to reorder. Designed for video script use cases.

Example:
```
1. Intro (0–3s):    Before/after edit comparison
2. Pain point (3–8s):  "Want to make videos but can't edit?"
3. Tip 1 (8–25s):   App recommendation — CapCut basics
4. Tip 2 (25–40s):  Transitions + subtitles
5. Tip 3 (40–55s):  Music + thumbnail creation
6. CTA (55–65s):    Follow + WeChat OA resource pack
```

#### ⑦ Competitive References

| Field | Notes |
|-------|-------|
| Author / account name | |
| Content title | |
| Platform | |
| URL | |
| Metrics snapshot | Views, likes, comments at time of reference |
| Takeaway | What's worth borrowing |
| Attachments | Screenshots |

**Template system:** Audience profile + goals can be saved as workspace templates and applied to new briefs in one click. Only differentiated fields (title, outline, hooks) need to be filled each time.

---

### 3.5 Scheduling Calendar

Visualize all content on a publication timeline.

**View modes:**

| Mode | Purpose |
|------|---------|
| Month view | Spot gaps in publishing cadence at a glance |
| Week view | Precise time-slot planning per day |
| List view | Chronological scan, best for quick review |

**Core interactions:**
- Drag content cards onto calendar slots to set publish time.
- Workspace content color-coded on the calendar.
- Gap alerts: "Thursday has no Xiaohongshu post (goal: 3/week)."
- Frequency progress bar: "This week: 2 of 3 posts scheduled."
- Cross-timezone display for international accounts.

**Week view example:**

```
   Mon     Tue      Wed      Thu      Fri     Sat/Sun
            🔴       🟢               🔴
           Douyin  Xiaohongshu       WeChat OA
          "Edit    "Spring            "AI
           Tips"   Fashion"           Opinion"

  ⚠ Thu gap: Xiaohongshu — only 1 post scheduled this week (goal: 3)
```

---

### 3.6 Publication Management

Once content reaches "Ready", Publication Management tracks its complete publish lifecycle across every platform independently.

**Publishing overview panel:**

| Platform | Status | Scheduled | Actions |
|----------|--------|-----------|---------|
| Douyin | Published | Apr 15 18:00 | View · Analytics |
| WeChat Video | Pending | Apr 15 20:00 | Mark Published · Edit |
| Xiaohongshu | Queued | Apr 16 12:00 | Edit · Cancel |

**Per-platform publish configuration:**

| Section | Fields |
|---------|--------|
| Title | Select from brief's title candidates or write platform-specific |
| Copy | Platform-specific text (Douyin conversational vs. WeChat OA formal) |
| Hashtags | Platform-specific tag list |
| Cover | Upload or select from attachments |
| Platform settings | Visibility, comments, location, collection/series |
| Scheduled time | UTC offset shown explicitly |
| Publish result | Status, platform post ID, platform URL, failure reason |
| Publish log | Timestamped action history |

**Publication status flow:**

```
draft → queued → ready → posting → published
                  │                    │
                skipped              failed
```

| Status | Description |
|--------|-------------|
| `draft` | Platform added; configuration incomplete |
| `queued` | Config complete; waiting for scheduled time |
| `ready` | Scheduled time reached; awaiting manual publish (Phase 1) |
| `posting` | Sending via API (Phase 2 auto-publish) |
| `published` | Successfully published; platform URL recorded |
| `failed` | Auto-publish failed; requires manual intervention |
| `skipped` | Intentionally cancelled for this platform |

**Global publish queue (cross-workspace):**

```
Today, Apr 15
  18:00  Douyin        "3-Day Editing Guide"      Published
  20:00  WeChat Video  "3-Day Editing Guide"      Pending
  21:00  X             "AI Tools Thread"          Pending

Tomorrow, Apr 16
  12:00  Xiaohongshu   "3-Day Editing Guide"      Queued
  18:00  Douyin        "Fashion Vol.12"           Queued
```

**Phase 1 vs Phase 2 publishing:**

| Phase 1 (manual-assist) | Phase 2 (auto-publish) |
|------------------------|----------------------|
| Go to each platform manually | API integration handles posting |
| System notifies you when it's time | System posts automatically at scheduled time |
| Return and mark published + paste URL | Auto-captures platform URL and initial metrics |
| Fill per-platform config manually | Smart pre-fill from history |

**Key capabilities:**

| Feature | Description |
|---------|-------------|
| One-content, multi-platform | Each platform gets its own copy, tags, cover, and status |
| Platform copy adaptation | Per-platform text (tone, length, hashtag format varies) |
| Title selection per platform | Pick the most suitable title candidate per platform |
| Publish reminders | PWA push notification when scheduled time arrives |
| One-tap mark-as-published | Paste URL, tap confirm — done |
| Publish audit log | Timestamped record of every status change and action |
| Batch operations | Bulk reschedule or bulk mark-published |

---

### 3.7 Analytics Dashboard

Track content performance via manual entry in Phase 1; migrate to API auto-collection in Phase 2.

**Phase 1 data collection:**
- Manually enter key metrics on the content card after publishing (views, likes, comments, etc.).
- Batch entry mode (spreadsheet-style) for bulk updates.
- System auto-calculates derived metrics: engagement rate, growth trends.

**Dashboard hierarchy:**

```
Global Dashboard
├── Total content count, published count, weekly/monthly cadence
├── Cross-platform aggregated totals (total views, total engagement)
├── Top 10 content by performance
└── Per-workspace health summary

Workspace Analytics Panel
├── Account KPI trend charts (weekly / monthly)
├── Per-post data table (sortable)
├── Publish frequency achievement rate
└── Tag-dimension analysis (which content types perform best)

Single Content Detail
├── Per-platform data comparison (same content: Douyin vs WeChat Video)
├── Metrics-over-time curve
└── Post-mortem notes
```

**Phase 2:** Connect platform Open APIs for automatic metric collection on a scheduled refresh cycle.

---

## 4. Multilingual Support

### UI Internationalization

**Supported locales:** `zh-CN` (default) · `zh-TW` · `en-US` · `ja-JP` · `ko-KR`

- `react-i18next` with async on-demand locale bundle loading.
- Browser language auto-detection; manual override in Settings.
- Dates and numbers formatted via `Intl.DateTimeFormat` / `Intl.NumberFormat`.
- Calendar week start follows locale convention (Mon vs. Sun).
- RTL layout reserved via CSS Logical Properties.

### Content Language Tracking

- Content cards carry a `locale` field ("this video is in English").
- One topic can link to multiple locale variants (zh-CN → en-US → ja-JP versions).
- Workspaces have a default content locale.
- Analytics track performance separately per locale variant.

---

## 5. PWA & Mobile

### Why PWA over Native App

| Aspect | PWA | Native App |
|--------|-----|-----------|
| Development cost | Single codebase | iOS + Android separately |
| Install friction | Install from browser | App store review required |
| Update delivery | Automatic, transparent | Manual user update |
| Offline capability | Service Worker | Native support |
| Push notifications | Web Push (iOS 16.4+) | Native push |
| Stage fit | MVP / early validation | Post-scale |

### Mobile Experience Priorities

**Primary scenario — quick idea capture on phone:**
- Floating `+` FAB at screen bottom; tap → write.
- Voice input via browser Speech API.
- Android notification bar quick-action shortcut.

**Secondary scenario — check schedule and metrics on phone:**
- Calendar defaults to week view on mobile.
- Analytics dashboard responsive layout; key metrics as swipeable cards.
- Push notifications: publish deadline reminders and metric milestones (e.g. "Your video hit 10K views").

### Offline Capabilities

| Available Offline | Requires Network |
|-------------------|-----------------|
| Record ideas | Refresh analytics panel |
| View scheduling calendar | Publish actions |
| View content board | Sync to server |
| Edit content card notes | |
| View cached historical metrics | |

Offline writes queue via **Background Sync** and flush automatically when connectivity returns.

### Service Worker Caching Strategy

| Resource Type | Strategy | Rationale |
|---------------|----------|-----------|
| App Shell | Precache | Cached on first load; instant subsequent opens |
| Locale bundles | CacheFirst | Cache loaded language; serve offline |
| API data | NetworkFirst | Fresh data preferred; cache as fallback |
| Images / covers | StaleWhileRevalidate | Show cached instantly; refresh in background |
| Publish / sync operations | BackgroundSync | Queue offline writes; flush on reconnect |

---

## 6. Technical Architecture

```
┌──────────────────────────────────────────┐
│          PWA Client (React 18)            │
│  Zustand + React Query + react-i18next    │
│  Workbox SW + IndexedDB (Dexie.js)        │
└──────────────────┬───────────────────────┘
                   │ HTTPS / REST
┌──────────────────▼───────────────────────┐
│          Fastify API Server               │
│  ┌──────────────────────────────────────┐ │
│  │  Interfaces (src/interfaces/http/)   │ │
│  │  Thin route handlers — extract       │ │
│  │  params, call services, return       │ │
│  └──────────────┬───────────────────────┘ │
│  ┌──────────────▼───────────────────────┐ │
│  │  Domain (src/domain/)                │ │
│  │  Service classes + repo interfaces   │ │
│  │  Pure business logic; no DB/HTTP     │ │
│  └──────────────┬───────────────────────┘ │
│  ┌──────────────▼───────────────────────┐ │
│  │  Infrastructure (src/infrastructure/)│ │
│  │  Drizzle ORM repo implementations   │ │
│  │  All DB queries live here            │ │
│  └──────────────┬───────────────────────┘ │
└─────────────────┼────────────────────────┘
                  ▼
   PostgreSQL    Redis         BullMQ
   (primary)  (cache/session) (jobs/reminders)
```

### DDD Layer Responsibilities

| Layer | Path | Responsibility |
|-------|------|----------------|
| **Interfaces** | `src/interfaces/http/routes/` | Thin Fastify handlers: extract params → call service → return response. No business logic. |
| **Domain** | `src/domain/` | Service classes and repository interfaces. Pure business logic and domain errors. No DB or HTTP imports. |
| **Infrastructure** | `src/infrastructure/db/repositories/` | Drizzle ORM implementations of domain interfaces. All SQL lives here. |

`src/app.ts` is the **composition root**: instantiates repositories → services → calls `registerRoutes(app, services)`.

Domain errors (`NotFoundError`, `ForbiddenError`, `ConflictError`, `ValidationError`) are thrown from services and mapped to HTTP status codes by the global error handler in `app.ts`.

**Stack summary:**

| Layer | Choice | Notes |
|-------|--------|-------|
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS | |
| State — local | Zustand | UI state, offline queue |
| State — server | React Query (TanStack Query) | Caching, background refetch |
| i18n | react-i18next | Async bundle loading |
| PWA | Workbox + Dexie.js (IndexedDB) | Offline-first |
| Backend | Fastify (Node.js) + TypeScript | High-throughput, low overhead |
| Database | PostgreSQL 16 | Primary data store |
| Cache / sessions | Redis 7 | JWT session store, hot data |
| Job queue | BullMQ | Scheduled reminders, Phase 2 auto-publish |
| Auth | JWT + OAuth 2.0 (WeChat / Google) | |
| Deployment | Docker Compose | Single-host for MVP |

---

## 7. Data Model

```sql
-- Users
users (
  id, email, username, avatar,
  locale,    -- preferred UI language
  timezone,
  created_at
)

-- Workspaces
workspaces (
  id, user_id,
  name, icon, color,
  about,
  publish_goal,       -- JSON: { count: 3, period: 'week' }
  stage_config,       -- JSON: custom Kanban stage list
  created_at
)

-- Ideas
ideas (
  id, user_id,
  workspace_id,       -- nullable — global idea pool when null
  title, note,
  tags[],
  priority,           -- low | medium | high
  attachments,        -- JSON: [{ type, url, name }]
  status,             -- active | converted | archived
  converted_to,       -- FK → contents.id (set when promoted)
  created_at
)

-- Contents  (core entity)
contents (
  id, workspace_id,
  idea_id,            -- source idea (nullable)
  title, description,
  content_type,       -- video_short | video_long | image_text | article | podcast | live
  stage,              -- planned | planning | creating | ready | publishing | published | reviewed
  tags[],
  target_platforms[],
  scheduled_at,
  published_at,
  notes,
  review_notes,
  attachments,        -- JSON: [{ type, url, name }]
  created_at, updated_at
)

-- Content Briefs  (1-to-1 with contents)
content_plans (
  id, content_id,
  format_config,          -- JSON: { duration, aspect_ratio, ... }
  audience,               -- JSON: { age_range, persona_tags[], pain_points, reach_scenario }
  audience_template_id,   -- FK → plan_templates.id (nullable)
  goals[],                -- ['grow_followers', 'convert', 'traffic', 'branding']
  goal_description,
  kpi_targets,            -- JSON: { likes: 500, comments: 50, ... }
  hooks,                  -- JSON: { core_hook, conflict, golden_opening, memory_point }
  title_candidates,       -- JSON: [{ text, is_primary, used_on_platforms[] }]
  outline,                -- JSON: [{ order, section, time_mark, note }]
  created_at, updated_at
)

-- Competitive References  (many-to-1 with contents)
content_references (
  id, content_id,
  author_name,
  content_title,
  platform,
  url,
  metrics_snapshot,   -- JSON: { views, likes, comments }
  takeaway,
  attachments,
  created_at
)

-- Brief Templates  (workspace-level reuse)
plan_templates (
  id, workspace_id,
  name,
  audience,           -- preset audience profile
  goals[],
  goal_description,
  created_at
)

-- Publications  (1 content × 1 platform = 1 publication)
publications (
  id, content_id,
  platform,               -- douyin | xiaohongshu | weixin | bilibili | x | youtube | ...
  platform_title,
  platform_copy,
  platform_tags[],
  cover_url,
  platform_settings,      -- JSON: { visibility, allow_comments, location, collection }
  scheduled_at,
  published_at,
  status,                 -- draft | queued | ready | posting | published | failed | skipped
  platform_post_id,
  platform_url,
  failure_reason,
  publish_log,            -- JSON: [{ action, timestamp, actor, note }]
  created_at, updated_at
)

-- Metrics  (time-series snapshots per publication)
metrics (
  id, publication_id,
  views, likes, comments, shares, saves, followers_gained,
  recorded_at,
  created_at
)
```

---

## 8. API Reference

### Ideas

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/ideas` | Create idea |
| `GET` | `/api/ideas?workspace=&status=&priority=&q=` | List ideas (filtered) |
| `GET` | `/api/ideas/archived/export?workspace=&from=&to=` | Export archived ideas as JSON |
| `DELETE` | `/api/ideas/archived?workspace=&from=&to=` | Bulk-delete archived ideas |
| `PATCH` | `/api/ideas/:id` | Update idea |
| `POST` | `/api/ideas/:id/convert` | Promote idea to Content |

### Workspaces

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/workspaces` | Create workspace |
| `GET` | `/api/workspaces` | List workspaces |
| `PATCH` | `/api/workspaces/:id` | Update workspace config |

### Contents

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/contents` | Create content |
| `GET` | `/api/contents?workspace=&stage=` | List contents (filtered) |
| `PATCH` | `/api/contents/:id` | Update content / advance stage |
| `DELETE` | `/api/contents/:id` | Delete content |
| `GET` | `/api/contents/calendar?from=&to=&workspace=` | Calendar view data |
| `GET` | `/api/contents/archived/export?workspace=&from=&to=` | Export archived contents as JSON |
| `DELETE` | `/api/contents/archived?workspace=&from=&to=` | Bulk-delete archived contents |

### Content Briefs

| Method | Path | Description |
|--------|------|-------------|
| `PUT` | `/api/contents/:id/plan` | Create or update brief |
| `GET` | `/api/contents/:id/plan` | Get brief detail |
| `GET` | `/api/contents/:id/references` | List competitive references |
| `POST` | `/api/contents/:id/references` | Add competitive reference |
| `DELETE` | `/api/contents/:id/references/:refId` | Remove competitive reference |
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
| `POST` | `/api/publications/:id/mark-published` | Mark published + record platform URL |
| `GET` | `/api/publications/queue?status=&from=&to=` | Global publish queue |
| `PATCH` | `/api/publications/batch` | Batch reschedule or status update |

### Analytics

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/metrics` | Record / update metrics snapshot |
| `GET` | `/api/metrics/dashboard?workspace=` | Analytics dashboard data |
| `GET` | `/api/metrics/content/:id` | Single content metrics detail |

### Data Portability

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/export` | Export all user data as a JSON archive |
| `POST` | `/api/import` | Import a JSON archive (v1.0 format) |

### Custom Platforms

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/custom-platforms` | List user-defined custom platforms |
| `POST` | `/api/custom-platforms` | Create custom platform |
| `DELETE` | `/api/custom-platforms/:id` | Delete custom platform |

### General

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/dashboard` | Global dashboard summary |
| `GET` | `/api/health` | Health check |
| `POST` | `/api/auth/login` | Login |
| `POST` | `/api/auth/refresh` | Refresh JWT |
| `POST` | `/api/auth/logout` | Invalidate session |

---

## 9. Phase 1 Milestones

| Sprint | Deliverable |
|--------|-------------|
| **W1–2** | Project scaffold: React + Fastify + PWA baseline + i18n framework + DB schema + Docker Compose |
| **W3–4** | Idea module: quick capture, global idea pool, tag filtering, mobile experience |
| **W5–6** | Workspaces + Content Board: Kanban drag-and-drop, stage transitions, content cards |
| **W7–8** | Content Brief: all 7 sub-modules, audience templates, competitive references |
| **W9–10** | Scheduling Calendar + Publication Management: calendar views, per-platform config, publish queue, status tracking |
| **W11–12** | Analytics Dashboard: manual data entry, global dashboard, workspace panel, trend charts |
| **W13–14** | Polish: offline experience, push notifications, locale QA, performance optimization, launch |
