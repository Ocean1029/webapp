# app — AI Message Translator (Next.js full-stack)

This folder is the entire application: a self-contained Next.js project where the
frontend pages and the backend API live together. The API route handlers under
`src/app/api/` talk directly to Anthropic (AI), Google Cloud Vision (OCR), and a
Neon serverless Postgres database — there is no separate backend service.

For the full project overview, environment variables, and Docker instructions,
see the [parent README](../README.md).

## Getting Started (local dev)

```bash
npm install
cp .env.example .env.local   # then fill in your keys
npm run dev
```

Open <http://localhost:3000>. The Neon database schema is created automatically
on the first request (see `src/lib/migrate.ts`).

### Required environment variables (`.env.local`)

| Variable                  | Purpose                                              |
|---------------------------|------------------------------------------------------|
| `ANTHROPIC_API_KEY`       | Claude AI analysis                                   |
| `DATABASE_URL`            | Neon Postgres connection string                      |
| `GOOGLE_CREDENTIALS_JSON` | Google Cloud Vision service account JSON (screenshot OCR) |

## Folder Structure

```
app/
├── src/
│   ├── app/
│   │   ├── api/                # API route handlers
│   │   │   ├── analyze/screenshot/route.ts   # OCR → AI analysis
│   │   │   ├── analyze/text/route.ts         # text → AI analysis
│   │   │   ├── conversations/route.ts        # list conversations
│   │   │   ├── conversations/[id]/route.ts   # one conversation + analyses
│   │   │   └── health/route.ts               # health check
│   │   ├── history/page.tsx   # history & trend page
│   │   ├── layout.tsx
│   │   └── page.tsx           # main analyze page
│   ├── components/            # React UI components
│   ├── lib/                   # ai.ts, ocr.ts, db.ts, migrate.ts, api.ts
│   └── types/                 # shared TypeScript types
├── public/
├── Dockerfile                 # standalone Next.js production image
├── .dockerignore
└── .env.example
```

## Scripts

| Command         | Description                          |
|-----------------|--------------------------------------|
| `npm run dev`   | Start the dev server                 |
| `npm run build` | Production build (`output: standalone`) |
| `npm run start` | Run the production build             |
| `npm run lint`  | Lint with ESLint                     |
