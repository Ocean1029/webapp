# AI Message Translator

An AI-powered LINE chat screenshot analyzer that translates the "subtext" behind messages and provides smart reply suggestions. Built for Taiwanese users who want to decode what their chat partners really mean.

## Table of Contents

- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Environment Variables](#environment-variables)
- [API Endpoints](#api-endpoints)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)

## Tech Stack

| Layer    | Technology                                  |
|----------|---------------------------------------------|
| App      | Next.js 16 (App Router), React 19, Tailwind |
| API      | Next.js Route Handlers (`src/app/api`)      |
| Database | Neon serverless PostgreSQL (over HTTP)      |
| OCR      | Google Cloud Vision API                     |
| AI       | Claude API (Anthropic SDK)                  |
| DevOps   | Docker, Docker Compose                      |

## Architecture

This is a **single, self-contained Next.js full-stack app**. The frontend pages
and the backend API live in the same project — the API route handlers under
`src/app/api/` talk directly to:

- **Anthropic** for AI subtext analysis and reply suggestions,
- **Google Cloud Vision** for screenshot OCR,
- **Neon serverless Postgres** for storing conversations and analyses.

There is no separate backend service. The database is **Neon cloud** — the
`@neondatabase/serverless` driver connects over HTTP, so no local Postgres
container is needed. The schema is created automatically on first use
(`src/lib/migrate.ts`).

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and [Docker Compose](https://docs.docker.com/compose/install/)
- An [Anthropic API key](https://console.anthropic.com/) for Claude
- A [Neon](https://neon.tech/) Postgres database (free tier works)
- (Optional) [Google Cloud credentials](https://cloud.google.com/vision/docs/setup) for screenshot OCR

## Quick Start

1. Navigate to the project directory:

   ```bash
   cd ai-message-translator
   ```

2. Create `app/.env.local` from the template and fill in your keys:

   ```bash
   cp app/.env.example app/.env.local
   # then edit app/.env.local
   ```

   Required values:

   ```bash
   ANTHROPIC_API_KEY=sk-ant-...
   DATABASE_URL=postgres://user:password@ep-xxx.region.aws.neon.tech/dbname?sslmode=require
   # Google Cloud Vision service account JSON on a single line, wrapped in single quotes.
   GOOGLE_CREDENTIALS_JSON='{"type":"service_account",...}'
   ```

3. Build and start the app:

   ```bash
   docker compose up --build
   ```

4. Open the app at <http://localhost:3000>.

## Environment Variables

All variables are read from `app/.env.local` and injected into the container via
`env_file` in `docker-compose.yml`.

| Variable                  | Description                                                          | Required                  |
|---------------------------|---------------------------------------------------------------------|---------------------------|
| `ANTHROPIC_API_KEY`       | Anthropic API key for Claude                                        | Yes                       |
| `DATABASE_URL`            | Neon Postgres connection string                                    | Yes                       |
| `GOOGLE_CREDENTIALS_JSON` | Google Cloud Vision service account JSON (entire JSON, not a path)   | For screenshot OCR        |

## API Endpoints

| Method | Path                        | Description                              |
|--------|-----------------------------|------------------------------------------|
| GET    | `/api/health`               | Health check                             |
| POST   | `/api/analyze/screenshot`   | Upload a screenshot for analysis         |
| POST   | `/api/analyze/text`         | Submit chat text for analysis            |
| GET    | `/api/conversations`        | List all conversations                   |
| GET    | `/api/conversations/{id}`   | Get a conversation with its analyses     |

### POST /api/analyze/text

Request body:

```json
{
  "text": "Chat text to analyze",
  "toneMode": "counselor",
  "contactName": "Name"
}
```

`toneMode` accepts `"counselor"` (professional relationship advice) or `"bestfriend"` (casual, humorous analysis).

### POST /api/analyze/screenshot

Multipart form data with fields: `screenshot` (image file), `toneMode`, `contactName`.

## Development Setup

To run without Docker:

```bash
cd app
npm install
cp .env.example .env.local   # then fill in your keys
npm run dev
```

Then open <http://localhost:3000>. The Neon database schema is created
automatically on first request.

## Project Structure

```
ai-message-translator/
├── app/                          # Next.js full-stack app (frontend + API)
│   ├── src/
│   │   ├── app/
│   │   │   ├── api/              # API route handlers (analyze, conversations, health)
│   │   │   ├── history/         # History page
│   │   │   └── page.tsx         # Main page
│   │   ├── components/          # React components
│   │   ├── lib/                 # AI, OCR, DB, migrations, API client
│   │   └── types/               # TypeScript type definitions
│   ├── public/
│   ├── Dockerfile
│   ├── .dockerignore
│   ├── .env.example
│   ├── package.json
│   └── tsconfig.json
├── docker-compose.yml
└── README.md
```
