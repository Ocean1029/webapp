# AI 已讀不回翻譯機 — Design Document

## Product Overview

An AI-powered chat analysis tool targeting Taiwanese users, primarily for LINE conversation screenshots. The service analyzes the tone and intent behind ambiguous messages and provides reply suggestions.

**Target Users:** General consumers (Taiwan market)
**Business Model:** Free + contextual advertising

## Core Features

### 1. Conversation Input

Two input methods:

- **Screenshot Upload** — Users upload LINE chat screenshots; OCR extracts conversation content including timestamps, stickers, and emoji
- **Text Paste** — Users manually paste conversation text

### 2. AI Analysis Engine

- **Reply Cadence Analysis** — Infer engagement level from timestamps (response time patterns)
- **Tone & Wording Analysis** — Interpret word choice, emoji, sticker usage, and punctuation style
- **Interest Level Scoring** — Rate from high interest → polite deflection → ghosting warning
- **Subtext Translation** — Generate the likely "real meaning" behind each message

### 3. Reply Suggestions

- Provide 2-3 reply options per analysis
- Each option includes expected outcome description
- Suggestions adapt to the detected relationship dynamic

### 4. Tone Modes (User Toggle)

- **Counselor Mode** — Professional, structured analysis with actionable advice
- **Best Friend Mode** — Casual, humorous roasts and meme-style commentary

### 5. History & Trend Tracking

- Archive conversations by contact/person
- Track relationship "temperature" over time (warming up / cooling down / stable)
- Timeline visualization of interaction frequency and sentiment trends

## User Flow

```
User uploads screenshot or pastes text
        │
        ▼
   OCR recognition (screenshot path)
        │
        ▼
  AI analyzes conversation
  (tone, frequency, intent)
        │
        ▼
  Generate analysis report
  ├── Subtext translation
  ├── Interest level score
  └── Reply suggestions ×3
        │
        ▼
  Save to history
  Update relationship trend
```

## Monetization

- Free to use with contextual native ads
- Ad placements on analysis result pages
- Contextually relevant ads (e.g., date restaurant recommendations, styling tips)

## Scope

### MVP (Phase 1)

- Screenshot upload + OCR for LINE
- Text paste input
- AI analysis with subtext translation and interest scoring
- Reply suggestions (2-3 options)
- Counselor / Best Friend mode toggle
- Per-contact history and trend tracking

### Future Considerations (Out of MVP Scope)

- Multi-platform support (Instagram DM, dating apps)
- Community features (anonymous sharing, voting)
- Push notifications for follow-up advice
