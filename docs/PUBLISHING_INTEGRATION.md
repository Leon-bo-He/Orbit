# Publishing Integration — Plan & Design

**Status:** Draft, awaiting approval
**Branch:** `feat/publishing-integration`
**Last updated:** 2026-05-05

This document plans automated multi-platform publishing for Orbit. Implementation is a **clean-room rewrite in TypeScript** — informed by the open-source `social-auto-upload` (SAU) project for browser-automation patterns and selectors, but **not** vendoring or subprocessing it. Nothing has been implemented yet — the user must approve this plan first.

---

## 1. Goal

Replace Orbit's manual-assist publishing (Phase 1) with **browser-automation-driven publishing** (Phase 3 in `DESIGN.md`) for nine platforms. Authentication is **manual cookie paste** — Orbit never holds passwords, never automates a login form. Once an account's cookies are stored, Orbit can post to that account on demand.

**User-visible deliverable, M1:** From a Content's Publication card, a creator picks a connected Douyin account, attaches a video + thumbnail, clicks **Publish now**, and within ~3 minutes sees status `Published` with a real `creator.douyin.com/...` URL.

**Non-goals:**

- Official platform APIs (YouTube Data API, X API v2, Meta Graph, TikTok Content Posting). Not used. Pure browser path.
- Distributed/multi-host runner farm. One sidecar runner is enough; horizontal scale-out is later.
- Reverse-engineering platform login (e.g., automating QR scan or 2FA). Cookie paste only.

---

## 2. Target platforms

Nine platforms. Each has a per-platform `PublishAdapter` in the runner.

| # | Platform | Region | Content types | SAU reference impl | Milestone |
|---|----------|--------|---------------|--------------------|-----------|
| 1 | Douyin | CN | Video, Image-text | `uploader/douyin_uploader/main.py` | **M1** |
| 2 | Rednote (Xiaohongshu) | CN | Video, Image-text | `uploader/xiaohongshu_uploader/main.py` | M2 |
| 3 | WeChat Video (视频号) | CN | Video | `uploader/tencent_uploader/main.py` | M3 |
| 4 | Bilibili | CN | Video | `uploader/bilibili_uploader/` | M3 |
| 5 | TikTok (Global) | Global | Video | `uploader/tk_uploader/` (partial) | M4 |
| 6 | YouTube | Global | Video | none — clean-room | M4 |
| 7 | Instagram | Global | Reels, Image posts | none | M5 |
| 8 | Facebook | Global | Page video, Page posts | none | M5 |
| 9 | X (Twitter) | Global | Short text + media | none | M6 |

The first four platforms reuse selectors and flow logic that SAU has already battle-tested; we re-express them in TypeScript. The last five we design ourselves — the adapter interface is identical, only the internal flow differs.

---

## 3. Constraints

1. **All publishing via headless Chromium** through Playwright Node. No platform official APIs.
2. **Authentication = manual cookie paste only.** No password handling, no automated login pages, no QR scraping.
3. **Single Node/TS stack.** No Python in production. SAU is a *reference document*, not a dependency.
4. **Multi-tenant.** Cookies belong to `(user, platform, account_name)`. Never accept a cookie path or account ID from the client.
5. **Cookies expire.** Orbit must surface validity status and prompt re-paste.
6. **Stealth matters.** Port SAU's `utils/stealth.min.js` and inject via `addInitScript()` on every context.
7. **Parallelism is wanted** — multiple jobs run concurrently on the same Chromium binary, in separate `BrowserContext`s. Per-account a Redis mutex serializes jobs (one account = one upload at a time → reduces anti-spam triggers).
8. **Files live in a shared volume** between Orbit API and the runner sidecar.

---

## 4. Strategy

We split into two processes:

### 4.1 Orbit API (existing Fastify server)

- Owns Postgres rows: `platform_accounts`, `upload_jobs`, additions to `publications`.
- Exposes the user-facing HTTP endpoints (cookie paste, publish-now, job status, SSE stream).
- Hosts the BullMQ `publishing` queue and a worker that **dispatches** jobs to the runner.
- Holds the `STORAGE_STATE_ENCRYPTION_KEY`. The runner never sees raw rows — it gets a decrypted `storage_state` payload per job.

### 4.2 `playwright-runner` sidecar (NEW)

- Standalone Node service in `apps/playwright-runner/`. Own `package.json`, own Dockerfile.
- HTTP server on an internal port (default `4000`) — only Orbit API calls it; never exposed to the public.
- Auth via a shared `RUNNER_TOKEN` env var.
- Per-platform adapter classes implementing `PublishAdapter`.
- One Playwright `Browser` instance, many short-lived `BrowserContext`s — one per job.
- Stateless across jobs; restart-safe.

This split is what answer F asked for: Chromium is **not** in the API image.

### 4.3 Why a clean-room rewrite (vs. subprocessing SAU)

- **Single language / single artifact** — Node + Playwright everywhere.
- **No Python toolchain in prod.** No `uv`, no `patchright install`, no `biliup` binary fetch at runtime.
- **We can shape adapter ergonomics for our domain** — SAU's CLI was designed for one-shot user runs; we want long-lived adapters that can validate cookies, do dry-runs, and report progress in structured form.
- **SAU's logic is the spec.** For Douyin/Rednote/WeChat-Video/Bilibili the upstream Python files are the canonical reference for selectors and timing. We'll cite them in code comments (e.g., `// per SAU uploader/douyin_uploader/main.py:451-470`) so future drift is easy to track.

---

## 5. Architecture

```
┌──────────────────────────────────────────────────────────┐
│                Orbit Web (React PWA)                      │
│  Settings → Platform Accounts                             │
│  Publication → Publish-Now / Schedule                     │
│  Job-status drawer (SSE-driven)                           │
└──────┬─────────────────────────────────────▲──────────────┘
       │ HTTPS REST                          │ SSE
       ▼                                     │
┌──────────────────────────────────────────────────────────┐
│                Orbit API (Fastify)                        │
│  ┌──────────────────────────────────────────────────┐    │
│  │  PlatformAccountService  UploadJobService        │    │
│  └────────────┬─────────────────────────┬───────────┘    │
│               │                         │                 │
│  ┌────────────▼─────────────────────────▼───────────┐    │
│  │  BullMQ: "publishing"  (concurrency = N)         │    │
│  │  Worker → PublishingDispatcher                   │    │
│  │  Per-account Redis mutex (SETNX EX)              │    │
│  └────────────┬─────────────────────────────────────┘    │
└───────────────┼───────────────────────────────────────────┘
                │ HTTP RPC w/ RUNNER_TOKEN
                ▼
┌──────────────────────────────────────────────────────────┐
│         playwright-runner (sidecar container)             │
│  ┌────────────────────────────────────────────────┐      │
│  │  Fastify HTTP /jobs (internal)                  │      │
│  └──────────┬─────────────────────────────────────┘      │
│             ▼                                             │
│  ┌────────────────────────────────────────────────┐      │
│  │  Per-platform PublishAdapter (TS)               │      │
│  │   • Douyin                                      │      │
│  │   • Rednote                                     │      │
│  │   • WeChatVideo                                 │      │
│  │   • Bilibili                                    │      │
│  │   • TikTok / YouTube / Instagram / Facebook / X │      │
│  └──────────┬─────────────────────────────────────┘      │
│             ▼                                             │
│   playwright.chromium → BrowserContext.with(storageState)│
│   addInitScript(stealth.js)                               │
└─────┬─────────────────────────────────────────────────────┘
      │
      ▼
   creator.douyin.com / x.com / studio.youtube.com / ...
```

### 5.1 Job lifecycle

```
[POST /api/publications/:id/publish]
  → upload_jobs row inserted (status=queued)
  → bullmq.add("publishing", { uploadJobId, scheduledAt? })

[Worker fires]
  → load upload_job + publication + platform_account
  → decrypt storage_state
  → acquire Redis mutex `mutex:upload:account:<platformAccountId>`
       (auto-expires after job timeout + 30s)
  → upload_jobs.status = running, started_at = now
  → POST runner /jobs   { platform, type, payload, mediaPaths }
  → stream progress back via SSE relay (worker ↔ runner long-poll)
  → on success:
      upload_jobs.status = succeeded, result_url, result_post_id, log_excerpt
      publications.status = published, platform_url, published_at, publish_log.append(…)
      persist returned `storageState` (cookies refreshed)
  → on failure:
      upload_jobs.status = failed, failure_reason, log_excerpt
      publications.status = failed, failure_reason
      enqueue Telegram failure notification (existing channel)
  → release mutex
```

### 5.2 Concurrency

- `RUNNER_MAX_BROWSERS` env (default `4`) caps parallel jobs in the runner.
- BullMQ worker concurrency = `RUNNER_MAX_BROWSERS`.
- Per-account mutex prevents two simultaneous jobs on the same account → avoids platform anti-spam.
- Different accounts (even on the same platform) run in parallel up to the cap.

### 5.3 Scheduling

Two tiers:

1. **Platform-native scheduling** when supported (Douyin / Rednote / WeChat Video / Bilibili / YouTube). Adapter fills the platform's "schedule" UI and finishes; the post lives on the platform but isn't visible until the chosen time.
2. **BullMQ `delay`** for platforms without scheduling (TikTok / X / IG / FB at time of writing). The worker doesn't fire until the scheduled time, then publishes immediately.

Default to (1) where supported.

---

## 6. Cookie capture — user-facing instructions

Two paste formats are accepted; Orbit normalizes both to Playwright `storageState` internally:

- **Playwright `storageState` JSON** — raw output from `context.storageState()`. Power users.
- **Browser-extension cookie array** — JSON array as exported by **Cookie-Editor** (recommended, available for Chrome / Edge / Firefox / Safari) or **EditThisCookie** (Chrome). Orbit converts to `storageState`.

Recommended extension: **[Cookie-Editor](https://cookie-editor.com)** — same vendor across all major browsers, straightforward "Export → JSON" button.

### Universal steps

1. Install **Cookie-Editor** in your browser.
2. Open the **login URL** in the table below for the platform you want to connect.
3. Log in normally. Complete any 2FA / captcha / phone verification.
4. Confirm you can see the platform's **creator dashboard** (where you'd normally upload).
5. Click the Cookie-Editor extension icon.
6. Click **Export → JSON** (or "Export as JSON").
7. Paste the JSON into Orbit at **Settings → Platform Accounts → Add account**.

For platforms that span multiple cookie domains (YouTube, X), Cookie-Editor's "Export by domain" mode requires you to **export from each domain and concatenate the arrays** before pasting. Orbit accepts a single combined array.

### Per-platform table

| Platform | Login URL | Cookie domains to export | Login confirm marker |
|---|---|---|---|
| **Douyin** | `https://creator.douyin.com` | `.douyin.com` | Your nickname appears top-right of the creator dashboard. |
| **Rednote** | `https://creator.xiaohongshu.com` | `.xiaohongshu.com` | "发布笔记" button visible on the dashboard. |
| **WeChat Video** | `https://channels.weixin.qq.com` | `.weixin.qq.com`, `.channels.weixin.qq.com` | First scan QR with your WeChat mobile app, then visit the URL. Avatar visible top-right. |
| **Bilibili** | `https://member.bilibili.com` | `.bilibili.com` | Login first at `https://passport.bilibili.com`, then open member URL. UID visible top-right. |
| **TikTok** | `https://www.tiktok.com/upload` | `.tiktok.com` | Upload UI loads instead of redirecting to login. |
| **YouTube** | `https://studio.youtube.com` | `.google.com`, `.youtube.com`, `.studio.youtube.com` | YouTube Studio dashboard loads. **Export from all three domains.** |
| **Instagram** | `https://www.instagram.com` | `.instagram.com` | Profile feed visible. **Must be a Business or Creator account** for posting via web. |
| **Facebook** | `https://www.facebook.com` | `.facebook.com` | News feed visible. To post to a Page, you must be a Page admin. |
| **X (Twitter)** | `https://x.com` | `.x.com`, `.twitter.com` | Home timeline loads. **Export from both domains.** |

The UI for **Settings → Platform Accounts → Add account** displays this table inline (with copy-buttons on the URLs) so the user has the instructions next to the paste field.

---

## 7. Data model

Three migrations (`0018`, `0019`, `0020`).

### 7.1 New: `platform_accounts`

```sql
platform_accounts (
  id                  uuid PK,
  user_id             uuid FK → users CASCADE,
  platform            text NOT NULL,
       -- 'douyin' | 'rednote' | 'wechat_video' | 'bilibili'
       -- | 'tiktok' | 'youtube' | 'instagram' | 'facebook' | 'x'
  account_name        text NOT NULL,                  -- user-chosen label
  display_name        text,                           -- friendly name
  storage_state_enc   text NOT NULL,                  -- AES-GCM-encrypted JSON
  cookie_status       text NOT NULL DEFAULT 'unknown',
       -- 'valid' | 'invalid' | 'unknown' | 'checking'
  cookie_checked_at   timestamptz,
  last_used_at        timestamptz,
  created_at          timestamptz NOT NULL,
  updated_at          timestamptz NOT NULL,
  UNIQUE (user_id, platform, account_name)
)
```

Storage strategy: **encrypted column, not file on disk**. SAU stored cookie JSON files; we encrypt and put it in the DB column. Reasons: (a) stateless runners can pull by job, (b) backups go with the DB, (c) machine moves / DR are trivial. Encryption: AES-256-GCM with `STORAGE_STATE_ENCRYPTION_KEY` env (32-byte key, base64). Key rotation is a future concern; M1 ships with single-key.

### 7.2 New: `upload_jobs`

```sql
upload_jobs (
  id                    uuid PK,
  publication_id        uuid FK → publications CASCADE,
  platform_account_id   uuid FK → platform_accounts SET NULL,
  status                text NOT NULL DEFAULT 'queued',
       -- 'queued' | 'running' | 'succeeded' | 'failed' | 'canceled'
  scheduled_at          timestamptz,
  started_at            timestamptz,
  finished_at           timestamptz,
  attempt               integer NOT NULL DEFAULT 1,
  bullmq_job_id         text,                  -- for cancellation
  runner_job_id         text,                  -- runner's internal id
  result_url            text,
  result_post_id        text,
  failure_reason        text,
  log_excerpt           text,                  -- last ~4 KB of runner stdout/stderr
  created_at            timestamptz NOT NULL,
  updated_at            timestamptz NOT NULL
)
```

### 7.3 Modify: `publications`

```sql
ALTER TABLE publications
  ADD COLUMN platform_account_id uuid
    REFERENCES platform_accounts(id) ON DELETE SET NULL;
```

The same publication can be retried via different jobs; this column says which account is currently configured for it.

---

## 8. Code organization

```
apps/api/src/
├── domain/
│   ├── platform-account/
│   │   └── platform-account.service.ts       # CRUD + cookie validation orchestration
│   └── upload-job/
│       └── upload-job.service.ts             # lifecycle, retry, cancel
├── infrastructure/
│   ├── db/repositories/
│   │   ├── platform-account.repository.ts
│   │   └── upload-job.repository.ts
│   └── publishing/
│       ├── runner-client.ts                  # HTTP client to playwright-runner
│       ├── cookie-import.ts                  # extension-array → storageState
│       ├── crypto.ts                         # AES-GCM wrap/unwrap
│       └── account-mutex.ts                  # Redis SETNX mutex helper
├── interfaces/http/routes/
│   ├── platform-accounts.ts                  # /api/platform-accounts/...
│   └── upload-jobs.ts                        # /api/upload-jobs/... + /publish endpoint
└── queue/
    ├── queues.ts                             # add publishingQueue
    └── workers.ts                            # add publishingWorker

apps/playwright-runner/                       # NEW package
├── package.json
├── Dockerfile                                # mcr.microsoft.com/playwright base
├── tsconfig.json
└── src/
    ├── server.ts                             # Fastify, /jobs, /health
    ├── browser/
    │   ├── launch.ts                         # chromium.launch + sane defaults
    │   ├── context.ts                        # newContext with storageState + stealth
    │   └── stealth.js                        # ported from SAU utils/stealth.min.js
    ├── adapters/
    │   ├── base.ts                           # PublishAdapter interface
    │   ├── registry.ts                       # platform → adapter map
    │   ├── douyin.ts                         # M1
    │   ├── rednote.ts                        # M2
    │   ├── wechat-video.ts                   # M3
    │   ├── bilibili.ts                       # M3
    │   ├── tiktok.ts                         # M4
    │   ├── youtube.ts                        # M4
    │   ├── instagram.ts                      # M5
    │   ├── facebook.ts                       # M5
    │   └── x.ts                              # M6
    └── lib/
        ├── progress.ts                       # progress event emitter for SSE relay
        ├── retry.ts
        └── log-buffer.ts                     # 4KB ring buffer

apps/web/src/
├── pages/
│   └── PlatformAccounts.tsx                  # NEW: under Settings
├── components/
│   ├── publications/
│   │   ├── PublishNowDialog.tsx              # account picker + confirm
│   │   ├── ScheduleDialog.tsx
│   │   └── UploadJobBadge.tsx
│   └── platform-accounts/
│       ├── AddAccountModal.tsx               # cookie-paste UI w/ instructions
│       └── CookieInstructionsTable.tsx
└── api/
    ├── platformAccounts.ts                   # TanStack Query hooks
    └── uploadJobs.ts
```

---

## 9. PublishAdapter interface

```ts
// apps/playwright-runner/src/adapters/base.ts

export interface PublishPayload {
  storageState: object;                  // Playwright storageState JSON
  contentType: 'video' | 'note';
  title: string;
  description: string;
  tags: string[];
  videoPath?: string;                    // absolute path inside shared volume
  imagePaths?: string[];
  thumbnailPath?: string;
  scheduledAt?: string;                  // ISO 8601; null = publish now
  locale?: string;                       // optional, default 'en' / native CN
  productLink?: string;                  // Douyin-specific, etc.
  productTitle?: string;
}

export interface PublishResult {
  success: boolean;
  postUrl?: string;
  postId?: string;
  failureReason?: string;
  logExcerpt: string;                    // last ~4 KB
  finalStorageState: object;             // refreshed cookies for persistence
}

export interface ValidateResult {
  valid: boolean;
  reason?: string;
  finalStorageState?: object;            // some platforms refresh tokens on visit
}

export interface PublishAdapter {
  readonly platform: string;
  readonly supportsVideo: boolean;
  readonly supportsNote: boolean;
  readonly supportsScheduling: boolean;

  validateCookie(storageState: object): Promise<ValidateResult>;
  publishVideo(payload: PublishPayload, onProgress: (e: ProgressEvent) => void): Promise<PublishResult>;
  publishNote?(payload: PublishPayload, onProgress: (e: ProgressEvent) => void): Promise<PublishResult>;
}

export interface ProgressEvent {
  step: string;                          // e.g. 'uploading_video' | 'filling_metadata' | 'submitting'
  percent?: number;
  message?: string;
}
```

Adapters are pure functions of `(payload, browser) → result`. They open a context, run the flow, close the context. No shared state across calls.

---

## 10. API surface

All routes auth-required. Workspace ownership verified via publication → content → workspace.

### 10.1 Platform accounts

| Method | Path | Description |
|--------|------|-------------|
| `GET`    | `/api/platform-accounts?platform=` | List the user's connected accounts. `storage_state_enc` never returned. |
| `POST`   | `/api/platform-accounts` | Create. Body: `{platform, accountName, displayName?, cookies}`. `cookies` is either a Playwright `storageState` object **or** a Cookie-Editor-style array. |
| `POST`   | `/api/platform-accounts/:id/check` | Re-validate via runner; updates `cookie_status`. Returns `{valid, reason?}`. |
| `PATCH`  | `/api/platform-accounts/:id/cookies` | Re-paste — replaces `storage_state_enc`. |
| `PATCH`  | `/api/platform-accounts/:id` | Rename `accountName` / `displayName`. |
| `DELETE` | `/api/platform-accounts/:id` | Remove. |

### 10.2 Publishing

| Method | Path | Description |
|--------|------|-------------|
| `POST`   | `/api/publications/:id/publish` | Enqueue. Body: `{platformAccountId, scheduledAt?}`. `202 {jobId, status:'queued'}`. |
| `GET`    | `/api/upload-jobs/:id` | Status snapshot. |
| `GET`    | `/api/upload-jobs/:id/stream` | SSE — events: `progress`, `succeeded`, `failed`, `canceled`. |
| `POST`   | `/api/upload-jobs/:id/cancel` | Cancel. |
| `POST`   | `/api/upload-jobs/:id/retry` | Clone failed → new queued. |
| `GET`    | `/api/publications/:id/jobs` | History. |

### 10.3 Existing route additions

| Method | Path | Change |
|--------|------|--------|
| `PATCH`  | `/api/publications/:id` | Accept `platformAccountId`. |
| `POST`   | `/api/upload/video` | NEW. Up to 500 MB, MIME `video/*`. Saves to `apps/api/uploads/publications/videos/<uuid>.<ext>`. |
| `POST`   | `/api/upload/note-images` | NEW. Up to 9 images, ≤10 MB each. Saves to `apps/api/uploads/publications/note-images/`. |

---

## 11. Runner RPC

Internal HTTP between Orbit API worker and runner. Auth: `Authorization: Bearer ${RUNNER_TOKEN}`.

### 11.1 Endpoints

```
POST /jobs               # start an upload job
GET  /jobs/:id           # snapshot
GET  /jobs/:id/stream    # SSE progress
POST /jobs/:id/cancel    # graceful kill
POST /validate           # cookie validity check (sync, no job row)
GET  /health             # browser pool status
```

### 11.2 Request shape

```json
POST /jobs
{
  "platform": "douyin",
  "type": "video",
  "uploadJobId": "uuid",
  "payload": { ...PublishPayload..., "videoPath": "/shared/uploads/.../foo.mp4" },
  "callbackUrl": "http://api:3000/internal/runner/callback"
}
→ 202 { "runnerJobId": "..." }
```

### 11.3 Files

A shared Docker volume is mounted at `/shared/uploads` in **both** containers. Orbit API writes files there; the runner reads. No file body crosses the RPC boundary.

### 11.4 Security

- Runner is on the internal Docker network only.
- `RUNNER_TOKEN` is required on every request; rejected with 401 otherwise.
- `storage_state` decrypted by Orbit API (which has the key) and passed to runner per job. Runner never persists; it returns the updated state, Orbit API re-encrypts and stores.

---

## 12. Deployment

### 12.1 Local dev

```bash
docker compose up -d           # postgres + redis
pnpm dev                       # api + web (existing)
pnpm --filter playwright-runner dev   # NEW: runner on :4000 with Chromium installed locally
```

`.env` additions:

```
RUNNER_URL=http://localhost:4000
RUNNER_TOKEN=<generated>
STORAGE_STATE_ENCRYPTION_KEY=<base64-32-bytes>
RUNNER_MAX_BROWSERS=4
PUBLISHING_JOB_TIMEOUT_MS=300000
PUBLISHING_HEADED=false
```

### 12.2 Production (`docker-compose.yml` additions)

```yaml
playwright_runner:
  build:
    context: ./apps/playwright-runner
  environment:
    PORT: 4000
    RUNNER_TOKEN: ${RUNNER_TOKEN}
    RUNNER_MAX_BROWSERS: 4
  volumes:
    - shared_uploads:/shared/uploads:ro

api:
  # add to existing
  environment:
    RUNNER_URL: http://playwright_runner:4000
    RUNNER_TOKEN: ${RUNNER_TOKEN}
    STORAGE_STATE_ENCRYPTION_KEY: ${STORAGE_STATE_ENCRYPTION_KEY}
  volumes:
    - shared_uploads:/shared/uploads
    # api writes; runner reads

volumes:
  shared_uploads:
```

### 12.3 Image notes

- Base image for runner: `mcr.microsoft.com/playwright:v1.x-jammy` — Chromium pre-installed, fonts present.
- Locale fonts: install `fonts-noto-cjk` for CN platforms.
- Final runner image ≈ 1.5 GB.

---

## 13. Phasing

| M | Scope | Adds | Notes |
|---|-------|------|-------|
| **M0** | Plan approved | — | (this) |
| **M1** | Douyin video + image-text. Foundational: `platform_accounts`, `upload_jobs`, `publications.platform_account_id`, runner sidecar, adapter interface, all UI plumbing. End-to-end "publish a real video to a real Douyin account." | Migrations 0018–0020; routes; runner pkg; Settings → Platform Accounts page; Publish-Now / Job-status UI; Douyin adapter | The big one. |
| **M2** | Rednote video + image-text. | Rednote adapter only. | Should be ≤1 day after M1. |
| **M3** | WeChat Video + Bilibili (video). Native scheduled publishing. | Two adapters; `scheduledAt` plumbing. | |
| **M4** | TikTok Global + YouTube (video). | Two adapters. | First Western platforms; selectors are clean-room. |
| **M5** | Instagram + Facebook. | Two adapters. | Meta web UI quirks expected. |
| **M6** | X (Twitter). | One adapter. | |
| **M7** | Polish: cookie-expiry detection on every job, automatic re-validation cadence (daily cron), retry/cancel hardening, Telegram failure notifications, log viewer in UI. | — | |

Each milestone is its own PR. M1 is the only one that creates infrastructure; M2–M6 are purely adapter additions. M7 is cross-cutting cleanup.

---

## 14. Risks & open questions

| # | Item | Mitigation |
|---|------|-----------|
| R1 | Selectors break when a platform updates its UI | Adapter fails loud (`failure_reason`, `log_excerpt`). Surface in UI. User retries after we patch the selector. |
| R2 | Cookies are high-value secrets | AES-256-GCM at rest with `STORAGE_STATE_ENCRYPTION_KEY`. Never logged. Never returned in API responses (only metadata). Runner gets per-job decrypted copies; doesn't persist. |
| R3 | Headless Chromium detection | Port SAU's `stealth.min.js` exactly; inject via `addInitScript` on every context. If platforms still detect, runner supports `PUBLISHING_HEADED=true` mode (visible Chromium, only useful in dev). |
| R4 | Two jobs for the same account run concurrently → anti-spam trigger | Redis SETNX mutex per `platform_account_id` (auto-expire = job timeout + 30s). Tested in M1. |
| R5 | Runner crash mid-job | API worker has `PUBLISHING_JOB_TIMEOUT_MS` (default 5 min); on timeout, mark job `failed`, release mutex. |
| R6 | Cookie-format heterogeneity (Cookie-Editor vs EditThisCookie vs raw `storageState`) | `cookie-import.ts` accepts both shapes; rejects malformed with a clear error pointing to the paste-instructions doc. |
| R7 | Multi-domain cookie exports (YouTube, X) — user only exports one domain | UI clearly states "export from each domain"; cookie-import detects missing domains and surfaces a warning before save. |
| R8 | Locale-dependent selectors on Western platforms | M1–M3 are CN-locale; M4+ adapters assume the platform UI is in English. If the user's account is in another language, we surface a "switch to English" hint. |
| R9 | Disk-pressure: large videos accumulate | M1 doesn't auto-clean. `apps/api/uploads/publications/` should be bind-mounted with retention policy in M7 (e.g., delete files >30 days after the corresponding `upload_jobs.finished_at`). |
| R10 | Bilibili requires `biliup` for actual upload mechanics in SAU | We re-implement the web upload path directly via Playwright instead of shelling out to the `biliup` binary. Slower but stays in our stack. |
| Q1 | What's the expected end-to-end runtime per platform? | Spike during M1 (Douyin baseline). Inform default `PUBLISHING_JOB_TIMEOUT_MS`. |
| Q2 | Do platforms allow concurrent uploads from the same IP across accounts? | M1 risk-only; we'll cap `RUNNER_MAX_BROWSERS=4` and watch for blocks. |
| Q3 | How do we structure adapter tests without a real account? | M1 includes a recorded-fixture mode using Playwright's HAR replay for each adapter's golden path. |

---

## 15. Out of scope

- WeChat OA (公众号) — explicitly excluded.
- Official platform APIs (YouTube Data API, X API v2, Meta Graph, TikTok Content Posting). Pure browser path only.
- Distributed runner farm — one sidecar in M1.
- Auto-thumbnail generation from video — user supplies thumbnail.
- Webhook delivery on publish success (separate Phase 3 deliverable).
- AI features touching publications (separate concern).

---

## 16. Success criteria for this branch (M1)

When `feat/publishing-integration` merges to `master`, the following user story works against a real Douyin account:

1. User logs into Orbit, opens **Settings → Platform Accounts**.
2. Picks **Douyin → Add account**, sees inline cookie-capture instructions.
3. Logs into Douyin in their own browser, exports cookies via Cookie-Editor, pastes JSON, clicks Save.
4. Account appears with status **Valid** within ~10 s (cookie-validation runner call).
5. Opens a Content with a Douyin Publication; sees a new **Account** dropdown and picks the connected account.
6. Uploads a `.mp4` and a thumbnail through the Publication editor.
7. Clicks **Publish now**.
8. UI shows progress in a job drawer (SSE-driven): "uploading video → filling metadata → submitting → done."
9. Within ~3 min, the Publication card shows **Published** with a working `creator.douyin.com/...` URL.
10. Two parallel publish-now requests on **different** Douyin accounts both succeed concurrently. Two parallel requests on the **same** account serialize.

Failures are also handled cleanly: bad cookie → friendly error before queueing. Selector mismatch mid-job → `failed` status with a readable `failure_reason` and a working **Retry** button.

That's M1 done.
