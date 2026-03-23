# AI 已讀不回翻譯機 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build an AI-powered LINE chat screenshot analyzer that translates "subtext" and provides reply suggestions for Taiwanese users.

**Architecture:** Go backend (REST API) + Next.js frontend (React SPA). The backend handles image upload, calls Google Cloud Vision for OCR, sends extracted text to Claude API for analysis, and stores results in PostgreSQL. The frontend provides the upload UI, displays analysis results, and manages conversation history.

**Tech Stack:** Go 1.26+, Next.js 14+ (App Router), PostgreSQL, Google Cloud Vision API, Claude API (Anthropic SDK), Docker Compose for local dev.

---

## Project Structure

```
ai-message-translator/
├── backend/
│   ├── cmd/
│   │   └── server/
│   │       └── main.go
│   ├── internal/
│   │   ├── handler/        # HTTP handlers
│   │   ├── service/        # Business logic
│   │   ├── repository/     # DB access
│   │   ├── ocr/            # Google Cloud Vision client
│   │   ├── ai/             # Claude API client
│   │   └── model/          # Domain types
│   ├── migrations/         # SQL migrations
│   ├── go.mod
│   └── go.sum
├── frontend/
│   ├── src/
│   │   ├── app/            # Next.js App Router pages
│   │   ├── components/     # React components
│   │   ├── lib/            # API client, utils
│   │   └── types/          # TypeScript types
│   ├── package.json
│   └── tsconfig.json
├── docker-compose.yml
└── README.md
```

## Database Schema

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

### Task 1: Project Scaffolding & Docker Compose

**Files:**
- Create: `ai-message-translator/docker-compose.yml`
- Create: `ai-message-translator/backend/cmd/server/main.go`
- Create: `ai-message-translator/backend/go.mod`
- Create: `ai-message-translator/frontend/package.json`

**Step 1: Create project root and docker-compose.yml**

```yaml
# docker-compose.yml
services:
  db:
    image: postgres:16
    environment:
      POSTGRES_USER: app
      POSTGRES_PASSWORD: devpassword
      POSTGRES_DB: message_translator
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
```

**Step 2: Initialize Go module**

Run: `cd ai-message-translator/backend && go mod init github.com/user/ai-message-translator/backend`

**Step 3: Create minimal main.go**

```go
package main

import (
	"fmt"
	"log"
	"net/http"
)

func main() {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprintln(w, `{"status":"ok"}`)
	})

	log.Println("Server starting on :8080")
	log.Fatal(http.ListenAndServe(":8080", mux))
}
```

**Step 4: Initialize Next.js frontend**

Run: `cd ai-message-translator && npx create-next-app@latest frontend --typescript --tailwind --eslint --app --src-dir --no-import-alias`

**Step 5: Verify everything starts**

Run: `docker compose up -d` (PostgreSQL)
Run: `cd backend && go run cmd/server/main.go &` then `curl http://localhost:8080/health`
Expected: `{"status":"ok"}`

**Step 6: Commit**

```bash
git add docker-compose.yml backend/ frontend/
git commit -m "feat: scaffold project with Go backend, Next.js frontend, and PostgreSQL"
```

---

### Task 2: Database Migrations & Repository Layer

**Files:**
- Create: `backend/migrations/001_init.up.sql`
- Create: `backend/migrations/001_init.down.sql`
- Create: `backend/internal/model/model.go`
- Create: `backend/internal/repository/repository.go`
- Test: `backend/internal/repository/repository_test.go`

**Step 1: Write migration SQL**

```sql
-- 001_init.up.sql
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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

```sql
-- 001_init.down.sql
DROP TABLE IF EXISTS analyses;
DROP TABLE IF EXISTS conversations;
```

**Step 2: Write domain models**

```go
// internal/model/model.go
package model

import (
	"time"

	"github.com/google/uuid"
)

type Conversation struct {
	ID          uuid.UUID `json:"id"`
	ContactName string    `json:"contactName"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
}

type SubtextEntry struct {
	Original string `json:"original"`
	Subtext  string `json:"subtext"`
}

type ReplySuggestion struct {
	Text           string `json:"text"`
	ExpectedEffect string `json:"expectedEffect"`
}

type Analysis struct {
	ID                  uuid.UUID         `json:"id"`
	ConversationID      uuid.UUID         `json:"conversationId"`
	InputType           string            `json:"inputType"`
	RawText             string            `json:"rawText"`
	ImageURL            string            `json:"imageUrl,omitempty"`
	ToneMode            string            `json:"toneMode"`
	InterestScore       int               `json:"interestScore"`
	SubtextTranslation  []SubtextEntry    `json:"subtextTranslation"`
	ReplySuggestions    []ReplySuggestion `json:"replySuggestions"`
	Summary             string            `json:"summary"`
	CreatedAt           time.Time         `json:"createdAt"`
}
```

**Step 3: Write failing repository tests**

```go
// internal/repository/repository_test.go
package repository_test

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	// imports for repository and model
)

func TestCreateConversation(t *testing.T) {
	repo := setupTestDB(t)
	ctx := context.Background()

	conv, err := repo.CreateConversation(ctx, "小明")
	require.NoError(t, err)
	assert.Equal(t, "小明", conv.ContactName)
	assert.NotZero(t, conv.ID)
}

func TestCreateAndGetAnalysis(t *testing.T) {
	repo := setupTestDB(t)
	ctx := context.Background()

	conv, err := repo.CreateConversation(ctx, "小美")
	require.NoError(t, err)

	analysis, err := repo.CreateAnalysis(ctx, CreateAnalysisParams{
		ConversationID: conv.ID,
		InputType:      "text",
		RawText:        "嗨～你在幹嘛",
		ToneMode:       "bestfriend",
		InterestScore:  7,
		SubtextTranslation: []model.SubtextEntry{
			{Original: "嗨～你在幹嘛", Subtext: "我想找你聊天但不想太主動"},
		},
		ReplySuggestions: []model.ReplySuggestion{
			{Text: "剛下班～你呢？", ExpectedEffect: "自然延續對話"},
		},
		Summary: "對方主動開啟對話，興趣程度中高",
	})
	require.NoError(t, err)
	assert.Equal(t, 7, analysis.InterestScore)

	got, err := repo.GetAnalysis(ctx, analysis.ID)
	require.NoError(t, err)
	assert.Equal(t, analysis.ID, got.ID)
}
```

**Step 4: Run tests to verify they fail**

Run: `cd backend && go test ./internal/repository/... -v`
Expected: FAIL (repository not implemented)

**Step 5: Implement repository**

```go
// internal/repository/repository.go
package repository

import (
	"context"
	"encoding/json"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	// model import
)

type Repository struct {
	pool *pgxpool.Pool
}

func New(pool *pgxpool.Pool) *Repository {
	return &Repository{pool: pool}
}

func (r *Repository) CreateConversation(ctx context.Context, contactName string) (*model.Conversation, error) {
	var conv model.Conversation
	err := r.pool.QueryRow(ctx,
		`INSERT INTO conversations (contact_name) VALUES ($1)
		 RETURNING id, contact_name, created_at, updated_at`,
		contactName,
	).Scan(&conv.ID, &conv.ContactName, &conv.CreatedAt, &conv.UpdatedAt)
	return &conv, err
}

// CreateAnalysis, GetAnalysis, ListByConversation, etc.
```

**Step 6: Run tests to verify they pass**

Run: `cd backend && go test ./internal/repository/... -v`
Expected: PASS

**Step 7: Commit**

```bash
git add backend/migrations/ backend/internal/model/ backend/internal/repository/
git commit -m "feat: add database migrations, domain models, and repository layer"
```

---

### Task 3: Google Cloud Vision OCR Client

**Files:**
- Create: `backend/internal/ocr/ocr.go`
- Test: `backend/internal/ocr/ocr_test.go`

**Step 1: Write OCR client interface and struct**

```go
// internal/ocr/ocr.go
package ocr

import (
	"context"

	vision "cloud.google.com/go/vision/apiv1"
)

type Client struct {
	visionClient *vision.ImageAnnotatorClient
}

type Result struct {
	FullText string   `json:"fullText"`
	Lines    []string `json:"lines"`
}

func New(ctx context.Context) (*Client, error) {
	vc, err := vision.NewImageAnnotatorClient(ctx)
	if err != nil {
		return nil, err
	}
	return &Client{visionClient: vc}, nil
}

func (c *Client) ExtractText(ctx context.Context, imageData []byte) (*Result, error) {
	// Call Vision API TEXT_DETECTION
	// Parse response into Result
}
```

**Step 2: Write test with mock (unit test)**

```go
// internal/ocr/ocr_test.go
package ocr_test

func TestExtractTextParseResponse(t *testing.T) {
	// Test that the response parsing logic correctly
	// extracts lines from Vision API response format
}
```

**Step 3: Implement ExtractText**

Use `vision.NewImageFromReader` → `client.DetectTexts` → parse annotations into `Result`.

**Step 4: Run test**

Run: `cd backend && go test ./internal/ocr/... -v`
Expected: PASS

**Step 5: Commit**

```bash
git add backend/internal/ocr/
git commit -m "feat: add Google Cloud Vision OCR client for screenshot text extraction"
```

---

### Task 4: Claude AI Analysis Client

**Files:**
- Create: `backend/internal/ai/ai.go`
- Create: `backend/internal/ai/prompt.go`
- Test: `backend/internal/ai/ai_test.go`

**Step 1: Define the analysis prompt templates**

```go
// internal/ai/prompt.go
package ai

const counselorSystemPrompt = `You are a professional relationship counselor analyzing LINE chat conversations.
Analyze the conversation and respond in Traditional Chinese (Taiwan).
For each message from the other person, provide:
1. The subtext (what they likely mean)
2. An overall interest score (1-10)
3. 2-3 reply suggestions with expected effects
Respond in JSON format.`

const bestFriendSystemPrompt = `You are the user's brutally honest best friend analyzing LINE chat conversations.
Be funny, use casual Taiwanese slang, and don't sugarcoat.
For each message from the other person, provide:
1. The subtext (roast-style translation of what they really mean)
2. An overall interest score (1-10)
3. 2-3 reply suggestions (ranging from bold to safe) with expected effects
Respond in JSON format.`
```

**Step 2: Define response schema**

```go
// internal/ai/ai.go
package ai

type AnalysisRequest struct {
	ConversationText string
	ToneMode         string // "counselor" or "bestfriend"
}

type AnalysisResponse struct {
	SubtextTranslation []SubtextEntry    `json:"subtextTranslation"`
	InterestScore      int               `json:"interestScore"`
	ReplySuggestions   []ReplySuggestion `json:"replySuggestions"`
	Summary            string            `json:"summary"`
}
```

**Step 3: Write failing test**

```go
// internal/ai/ai_test.go
func TestAnalyzeConversation(t *testing.T) {
	// Use a mock HTTP client to verify:
	// - Correct prompt is selected based on toneMode
	// - Response JSON is parsed correctly into AnalysisResponse
}
```

**Step 4: Run test to verify it fails**

Run: `cd backend && go test ./internal/ai/... -v`
Expected: FAIL

**Step 5: Implement Claude API client**

```go
func (c *Client) Analyze(ctx context.Context, req AnalysisRequest) (*AnalysisResponse, error) {
	systemPrompt := counselorSystemPrompt
	if req.ToneMode == "bestfriend" {
		systemPrompt = bestFriendSystemPrompt
	}

	// Call Claude API with anthropic-sdk-go
	// Parse JSON response into AnalysisResponse
}
```

**Step 6: Run test to verify it passes**

Run: `cd backend && go test ./internal/ai/... -v`
Expected: PASS

**Step 7: Commit**

```bash
git add backend/internal/ai/
git commit -m "feat: add Claude API client with counselor and bestfriend prompt modes"
```

---

### Task 5: HTTP Handlers & API Routes

**Files:**
- Create: `backend/internal/handler/handler.go`
- Create: `backend/internal/handler/analyze.go`
- Create: `backend/internal/handler/conversation.go`
- Test: `backend/internal/handler/handler_test.go`

**Step 1: Define API routes**

```
POST   /api/analyze/screenshot   — Upload screenshot, get analysis
POST   /api/analyze/text         — Submit text, get analysis
GET    /api/conversations        — List all conversations
GET    /api/conversations/:id    — Get conversation with analyses
```

**Step 2: Write failing handler tests**

```go
func TestAnalyzeTextHandler(t *testing.T) {
	// POST /api/analyze/text with JSON body
	// Expect 200 with analysis result
}

func TestAnalyzeScreenshotHandler(t *testing.T) {
	// POST /api/analyze/screenshot with multipart form
	// Expect 200 with analysis result
}

func TestListConversationsHandler(t *testing.T) {
	// GET /api/conversations
	// Expect 200 with array
}
```

**Step 3: Run tests to verify they fail**

Run: `cd backend && go test ./internal/handler/... -v`
Expected: FAIL

**Step 4: Implement handlers**

Wire together: handler → OCR (if screenshot) → AI analysis → repository save → return response.

**Step 5: Run tests to verify they pass**

Run: `cd backend && go test ./internal/handler/... -v`
Expected: PASS

**Step 6: Wire routes in main.go**

Update `cmd/server/main.go` to register all routes with dependency injection.

**Step 7: Commit**

```bash
git add backend/internal/handler/ backend/cmd/server/main.go
git commit -m "feat: add REST API handlers for analysis and conversation endpoints"
```

---

### Task 6: Frontend — Upload & Analysis Page

**Files:**
- Create: `frontend/src/app/page.tsx` (main page)
- Create: `frontend/src/components/UploadArea.tsx`
- Create: `frontend/src/components/AnalysisResult.tsx`
- Create: `frontend/src/components/ToneModeToggle.tsx`
- Create: `frontend/src/lib/api.ts`
- Create: `frontend/src/types/index.ts`

**Step 1: Define TypeScript types**

```typescript
// src/types/index.ts
export interface SubtextEntry {
  original: string;
  subtext: string;
}

export interface ReplySuggestion {
  text: string;
  expectedEffect: string;
}

export interface AnalysisResponse {
  id: string;
  interestScore: number;
  subtextTranslation: SubtextEntry[];
  replySuggestions: ReplySuggestion[];
  summary: string;
  toneMode: "counselor" | "bestfriend";
  createdAt: string;
}
```

**Step 2: Build API client**

```typescript
// src/lib/api.ts
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

export async function analyzeScreenshot(file: File, toneMode: string, contactName: string) {
  const formData = new FormData();
  formData.append("screenshot", file);
  formData.append("toneMode", toneMode);
  formData.append("contactName", contactName);
  const res = await fetch(`${API_BASE}/api/analyze/screenshot`, { method: "POST", body: formData });
  return res.json();
}

export async function analyzeText(text: string, toneMode: string, contactName: string) {
  const res = await fetch(`${API_BASE}/api/analyze/text`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, toneMode, contactName }),
  });
  return res.json();
}
```

**Step 3: Build UploadArea component**

- Drag-and-drop zone for screenshots
- Text area tab for pasting text
- Contact name input field
- ToneMode toggle (諮詢師 / 好友模式)

**Step 4: Build AnalysisResult component**

- Interest score gauge (1-10 with color coding)
- Subtext translation list (original → subtext side by side)
- Reply suggestion cards
- Summary section

**Step 5: Wire main page**

```tsx
// src/app/page.tsx
export default function Home() {
  // State: input mode, analysis result, loading
  // Flow: upload → loading → show result
}
```

**Step 6: Verify UI renders**

Run: `cd frontend && npm run dev`
Open: `http://localhost:3000`
Expected: Upload area renders, can toggle modes

**Step 7: Commit**

```bash
git add frontend/src/
git commit -m "feat: add frontend upload UI and analysis result display"
```

---

### Task 7: Frontend — History & Trend Page

**Files:**
- Create: `frontend/src/app/history/page.tsx`
- Create: `frontend/src/components/ConversationList.tsx`
- Create: `frontend/src/components/TrendChart.tsx`

**Step 1: Add API client methods**

```typescript
export async function getConversations() { /* GET /api/conversations */ }
export async function getConversation(id: string) { /* GET /api/conversations/:id */ }
```

**Step 2: Build ConversationList**

- List contacts with latest analysis date
- Click to expand and see all analyses

**Step 3: Build TrendChart**

- Show interest score over time per contact
- Use a lightweight chart library (e.g., recharts)
- Color-coded: green (warming), yellow (stable), red (cooling)

**Step 4: Wire history page**

**Step 5: Verify**

Run: `cd frontend && npm run dev`
Navigate to `/history`, verify list and chart render.

**Step 6: Commit**

```bash
git add frontend/src/app/history/ frontend/src/components/ConversationList.tsx frontend/src/components/TrendChart.tsx frontend/src/lib/api.ts
git commit -m "feat: add conversation history page with trend visualization"
```

---

### Task 8: End-to-End Integration Test

**Files:**
- Create: `backend/internal/handler/integration_test.go`

**Step 1: Write E2E test**

```go
func TestFullAnalysisFlow(t *testing.T) {
	// 1. Start test server with real DB (test container)
	// 2. POST /api/analyze/text with sample conversation
	// 3. Verify response has subtext, score, suggestions
	// 4. GET /api/conversations — verify conversation created
	// 5. GET /api/conversations/:id — verify analysis linked
}
```

**Step 2: Run test**

Run: `cd backend && go test ./internal/handler/ -run TestFullAnalysisFlow -v`
Expected: PASS

**Step 3: Commit**

```bash
git add backend/internal/handler/integration_test.go
git commit -m "test: add end-to-end integration test for full analysis flow"
```

---

### Task 9: Docker Compose Full Stack & README

**Files:**
- Modify: `docker-compose.yml` (add backend + frontend services)
- Create: `backend/Dockerfile`
- Create: `frontend/Dockerfile`
- Create: `README.md`

**Step 1: Add Dockerfiles**

Backend: multi-stage Go build.
Frontend: Next.js standalone build.

**Step 2: Update docker-compose.yml**

Add `backend` and `frontend` services with env vars for DB, Google Cloud Vision, and Claude API keys.

**Step 3: Write README**

Project overview, setup instructions, env vars, how to run.

**Step 4: Verify full stack**

Run: `docker compose up --build`
Expected: All 3 services healthy, can upload and analyze.

**Step 5: Commit**

```bash
git add docker-compose.yml backend/Dockerfile frontend/Dockerfile README.md
git commit -m "feat: add Docker setup and README for full-stack local development"
```

---

## Task Summary

| Task | Description | Estimated Steps |
|------|-------------|-----------------|
| 1 | Project scaffolding & Docker Compose | 6 |
| 2 | Database migrations & repository | 7 |
| 3 | Google Cloud Vision OCR client | 5 |
| 4 | Claude AI analysis client | 7 |
| 5 | HTTP handlers & API routes | 7 |
| 6 | Frontend — upload & analysis page | 7 |
| 7 | Frontend — history & trend page | 6 |
| 8 | End-to-end integration test | 3 |
| 9 | Docker Compose full stack & README | 5 |

**Total: 9 tasks, 53 steps**
