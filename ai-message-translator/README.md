# AI Message Translator

An AI-powered LINE chat screenshot analyzer that translates the "subtext" behind messages and provides smart reply suggestions. Built for Taiwanese users who want to decode what their chat partners really mean.

## Table of Contents

- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Environment Variables](#environment-variables)
- [API Endpoints](#api-endpoints)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)

## Tech Stack

| Layer    | Technology                          |
|----------|-------------------------------------|
| Backend  | Go 1.25+, net/http, pgx            |
| Frontend | Next.js 16, React 19, Tailwind CSS |
| Database | PostgreSQL 16                       |
| OCR      | Google Cloud Vision API             |
| AI       | Claude API (Anthropic SDK)          |
| DevOps   | Docker, Docker Compose              |

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and [Docker Compose](https://docs.docker.com/compose/install/)
- An [Anthropic API key](https://console.anthropic.com/) for Claude
- (Optional) [Google Cloud credentials](https://cloud.google.com/vision/docs/setup) for screenshot OCR

## Quick Start

1. Clone the repository and navigate to the project directory:

   ```bash
   cd ai-message-translator
   ```

2. Create a `.env` file with your API keys:

   ```bash
   ANTHROPIC_API_KEY=sk-ant-...
   # Optional: path to Google Cloud service account JSON
   GOOGLE_APPLICATION_CREDENTIALS=/path/to/credentials.json
   ```

3. Start all services:

   ```bash
   docker compose up --build
   ```

4. Open the app:

   - Frontend: <http://localhost:3000>
   - Backend health check: <http://localhost:8080/health>

## Environment Variables

| Variable                         | Service  | Description                          | Default                                                          |
|----------------------------------|----------|--------------------------------------|------------------------------------------------------------------|
| `DATABASE_URL`                   | backend  | PostgreSQL connection string         | `postgres://app:devpassword@db:5432/message_translator?sslmode=disable` |
| `ANTHROPIC_API_KEY`              | backend  | Anthropic API key for Claude         | (required)                                                       |
| `GOOGLE_APPLICATION_CREDENTIALS` | backend  | Path to Google Cloud credentials     | (optional)                                                       |
| `CORS_ORIGIN`                    | backend  | Allowed CORS origin                  | `http://localhost:3000`                                          |
| `LISTEN_ADDR`                    | backend  | Server listen address                | `:8080`                                                          |
| `NEXT_PUBLIC_API_URL`            | frontend | Backend API URL                      | `http://localhost:8080`                                          |
| `POSTGRES_USER`                  | db       | PostgreSQL user                      | `app`                                                            |
| `POSTGRES_PASSWORD`              | db       | PostgreSQL password                  | `devpassword`                                                    |
| `POSTGRES_DB`                    | db       | PostgreSQL database name             | `message_translator`                                             |

## API Endpoints

| Method | Path                        | Description                              |
|--------|-----------------------------|------------------------------------------|
| GET    | `/health`                   | Health check                             |
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

1. **Start PostgreSQL** (e.g., via Docker):

   ```bash
   docker compose up db -d
   ```

2. **Run database migrations** against the local PostgreSQL instance.

3. **Start the backend**:

   ```bash
   cd backend
   export DATABASE_URL="postgres://app:devpassword@localhost:5432/message_translator?sslmode=disable"
   export ANTHROPIC_API_KEY="sk-ant-..."
   go run cmd/server/main.go
   ```

4. **Start the frontend**:

   ```bash
   cd frontend
   npm install
   npm run dev
   ```

5. Open <http://localhost:3000>.

## Project Structure

```
ai-message-translator/
├── backend/
│   ├── cmd/
│   │   └── server/
│   │       └── main.go            # Application entry point
│   ├── internal/
│   │   ├── ai/                    # Claude API client
│   │   ├── handler/               # HTTP handlers
│   │   ├── model/                 # Domain types
│   │   ├── ocr/                   # Google Cloud Vision client
│   │   ├── repository/            # Database access layer
│   │   └── service/               # Business logic
│   ├── migrations/                # SQL migration files
│   ├── Dockerfile
│   ├── go.mod
│   └── go.sum
├── frontend/
│   ├── src/
│   │   ├── app/                   # Next.js App Router pages
│   │   ├── components/            # React components
│   │   ├── lib/                   # API client and utilities
│   │   └── types/                 # TypeScript type definitions
│   ├── Dockerfile
│   ├── package.json
│   └── tsconfig.json
├── docker-compose.yml
└── README.md
```
