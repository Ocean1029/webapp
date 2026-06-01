# AI 已讀不回翻譯機 Implementation Plan

**Goal:** Build an AI-powered LINE chat screenshot analyzer that translates "subtext" and provides reply suggestions for Taiwanese users.

**Architecture:** A single, self-contained **Next.js full-stack app**. The frontend
pages and the backend API live in the same project — the API route handlers under
`src/app/api/` handle image upload, call Google Cloud Vision for OCR, send the
extracted text to the Claude API for analysis, and persist results to a Neon
serverless Postgres database. There is no separate backend service.

> **Architecture note:** An earlier revision of this plan used a separate Go REST
> backend with a local PostgreSQL container. That backend was removed — its logic
> was consolidated into Next.js API route handlers, and the database moved to Neon
> serverless (accessed over HTTP via `@neondatabase/serverless`, so no local DB
> container is needed). This document reflects the current single-app architecture.

**Tech Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 ·
Anthropic SDK (Claude) · Google Cloud Vision API · Neon serverless PostgreSQL ·
Docker Compose for packaging.

---

## Project Structure

```
ai-message-translator/
├── app/                          # Next.js full-stack app (frontend + API)
│   ├── src/
│   │   ├── app/
│   │   │   ├── api/
│   │   │   │   ├── analyze/screenshot/route.ts  # OCR → AI analysis
│   │   │   │   ├── analyze/text/route.ts        # text → AI analysis
│   │   │   │   ├── conversations/route.ts       # list conversations
│   │   │   │   ├── conversations/[id]/route.ts  # one conversation + analyses
│   │   │   │   └── health/route.ts              # health check
│   │   │   ├── history/page.tsx  # history & trend page
│   │   │   ├── layout.tsx
│   │   │   └── page.tsx          # main analyze page
│   │   ├── components/           # React components
│   │   ├── lib/                  # ai.ts, ocr.ts, db.ts, migrate.ts, api.ts
│   │   └── types/                # TypeScript types
│   ├── public/
│   ├── Dockerfile               # standalone Next.js production image
│   ├── .dockerignore
│   ├── .env.example
│   ├── package.json
│   └── tsconfig.json
├── docker-compose.yml           # single `app` service
└── README.md
```

## Database Schema

The schema is created idempotently on first use by `src/lib/migrate.ts`
(`CREATE TABLE IF NOT EXISTS`), running against the Neon database in `DATABASE_URL`.

```sql
-- conversations: groups analyses by contact
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- analyses: each screenshot/text submission
CREATE TABLE analyses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES conversations(id),
    input_type TEXT NOT NULL CHECK (input_type IN ('screenshot', 'text')),
    raw_text TEXT NOT NULL,
    image_url TEXT,
    tone_mode TEXT NOT NULL CHECK (tone_mode IN ('counselor', 'bestfriend')),
    interest_score INT NOT NULL CHECK (interest_score BETWEEN 1 AND 10),
    subtext_translation JSONB NOT NULL,
    reply_suggestions JSONB NOT NULL,
    summary TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

### Task 1: Project Scaffolding

**Files:**
- `app/` (Next.js project, App Router + TypeScript + Tailwind, `src/` dir)
- `app/next.config.ts` (set `output: "standalone"` for Docker)

**Steps:**
1. Scaffold the app: `npx create-next-app@latest app --typescript --tailwind --eslint --app --src-dir`.
2. Enable standalone output in `next.config.ts` so the production build can run as a self-contained Node server.
3. Verify dev server: `cd app && npm run dev`, open `http://localhost:3000`.

---

### Task 2: Database Client & Migrations

**Files:**
- `app/src/lib/db.ts` — lazily-initialized Neon SQL client
- `app/src/lib/migrate.ts` — idempotent schema creation
- `app/src/types/index.ts` — shared domain types

**Steps:**
1. In `db.ts`, expose `getSQL()` that lazily creates `neon(process.env.DATABASE_URL)` (deferred so builds succeed without the env var set).
2. In `migrate.ts`, create the `conversations` and `analyses` tables with `IF NOT EXISTS`.
3. Define TypeScript types: `SubtextEntry`, `ReplySuggestion`, `AnalysisResponse`, `ConversationSummary`, `ConversationWithAnalyses`.

---

### Task 3: Google Cloud Vision OCR Client

**Files:**
- `app/src/lib/ocr.ts`
- `app/scripts/test-ocr.mjs` (manual smoke test)

**Steps:**
1. Read service-account credentials from `process.env.GOOGLE_CREDENTIALS_JSON` (entire JSON, not a file path) and construct the Vision client.
2. Implement an `extractText(imageBuffer)` that runs `TEXT_DETECTION` and returns the recognized full text.
3. Smoke-test with `node scripts/test-ocr.mjs`.

---

### Task 4: Claude AI Analysis Client

**Files:**
- `app/src/lib/ai.ts`

**Steps:**
1. Define two system prompts: `counselorSystemPrompt` (professional relationship counselor) and `bestFriendSystemPrompt` (brutally honest best friend, Taiwanese slang).
2. `selectPrompt(toneMode)` returns the best-friend prompt for `"bestfriend"`, otherwise the counselor prompt (counselor is the default).
3. `analyzeConversation(text, toneMode)` calls the Anthropic SDK with the selected system prompt and parses the JSON response (`subtextTranslation`, `interestScore`, `replySuggestions`, `summary`), stripping any markdown code fences.

---

### Task 5: API Route Handlers

**Files:**
- `app/src/app/api/analyze/text/route.ts`
- `app/src/app/api/analyze/screenshot/route.ts`
- `app/src/app/api/conversations/route.ts`
- `app/src/app/api/conversations/[id]/route.ts`
- `app/src/app/api/health/route.ts`

**API surface:**

```
GET    /api/health                — health check
POST   /api/analyze/text          — submit text, get + store analysis
POST   /api/analyze/screenshot    — upload screenshot (OCR → analysis), store
GET    /api/conversations         — list all conversations
GET    /api/conversations/:id     — get one conversation with its analyses
```

**Steps:**
1. Ensure the schema exists (run migrations) before DB access.
2. `analyze/text`: parse `{ text, toneMode, contactName }`, call `analyzeConversation`, upsert the conversation, insert the analysis, return camelCase JSON.
3. `analyze/screenshot`: parse multipart form (`screenshot`, `toneMode`, `contactName`), run OCR, then the same analysis + persistence path.
4. `conversations` / `conversations/[id]`: read rows from Neon and shape them into camelCase JSON for the frontend.

---

### Task 6: Frontend — Analyze Page

**Files:**
- `app/src/app/page.tsx`
- `app/src/components/UploadArea.tsx`
- `app/src/components/AnalysisResult.tsx`
- `app/src/components/ToneModeToggle.tsx`
- `app/src/lib/api.ts` (client calling the relative `/api/...` routes)

**Steps:**
1. `api.ts`: `analyzeScreenshot`, `analyzeText`, `getConversations`, `getConversation` — all fetch relative `/api/...` paths (same origin, no external base URL).
2. `UploadArea`: drag-and-drop screenshot zone + text-paste tab + contact name input + tone toggle.
3. `AnalysisResult`: interest-score gauge, subtext list (original → subtext), reply-suggestion cards, summary.
4. Wire the main page: input → loading → result.

---

### Task 7: Frontend — History & Trend Page

**Files:**
- `app/src/app/history/page.tsx`
- `app/src/components/ConversationList.tsx`
- `app/src/components/TrendChart.tsx`

**Steps:**
1. `ConversationList`: list contacts with latest analysis date; expand to see all analyses.
2. `TrendChart`: interest score over time per contact (recharts), color-coded warming/stable/cooling.
3. Wire the `/history` page to `getConversations` / `getConversation`.

---

### Task 8: Docker Packaging & README

**Files:**
- `app/Dockerfile` (multi-stage standalone Next.js build)
- `app/.dockerignore`
- `app/.env.example`
- `docker-compose.yml` (single `app` service)
- `README.md`

**Steps:**
1. Multi-stage Dockerfile: `deps` (`npm ci`) → `builder` (`npm run build`) → `runner` (copy `.next/standalone`, `.next/static`, `public`; run `node server.js`).
2. `.dockerignore` keeps `node_modules`, `.next`, and `.env*` out of the build context (the Dockerfile uses `COPY . .`).
3. `docker-compose.yml`: one `app` service, secrets injected via `env_file: ./app/.env.local`; no backend service and no local Postgres (DB is Neon cloud).
4. Verify: `docker compose up --build`, then `GET /api/health` → `200 {"status":"ok"}` and `GET /api/conversations` returns live Neon data.

---

## Task Summary

| Task | Description |
|------|-------------|
| 1 | Project scaffolding (Next.js, standalone output) |
| 2 | Neon DB client, migrations, shared types |
| 3 | Google Cloud Vision OCR client |
| 4 | Claude AI analysis client (counselor / bestfriend prompts) |
| 5 | API route handlers (analyze, conversations, health) |
| 6 | Frontend — analyze page |
| 7 | Frontend — history & trend page |
| 8 | Docker packaging & README |
