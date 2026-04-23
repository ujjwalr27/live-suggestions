# TwinMind Live Suggestions

TwinMind-style meeting copilot built with React + TypeScript + Vite.
Captures microphone audio, appends transcript chunks via Whisper, surfaces live AI suggestion batches, supports click-to-expand detailed answers and typed chat, and exports full session data as JSON.

## Stack

| Layer | Choice |
|---|---|
| Frontend | React 18, TypeScript, Vite |
| Transcription | Groq Whisper Large V3 |
| Suggestions + Chat | Groq `openai/gpt-oss-120b` |
| Audio capture | MediaRecorder API + Web Speech API (live preview) |
| State | React Context + `useReducer` |
| Persistence | `localStorage` for API key + settings only |

## Run locally

```bash
npm install
npm run dev
```

Open the app, then paste your Groq API key in **Settings** (top-right ⚙).

## Features

### Mic + Transcript (left column)
- Start/stop recording via mic button
- **Dual-source transcription**: Web Speech API drives a live interim text preview (low latency), while MediaRecorder chunks are sent to Whisper every ~30s for accurate, committed transcript chunks
- Auto-scrolls to the latest line

### Live Suggestions (middle column)
- Auto-refreshes every **~30s** while recording; countdown visible in toolbar
- Manual **Reload** button flushes the current audio chunk to Whisper first, then regenerates suggestions — ensuring suggestions are always grounded in the freshest transcript
- Each refresh produces exactly **3 fresh suggestions** (enforced with a 2-attempt retry; error shown in panel on failure)
- Newest batch pinned to top; all prior batches preserved below
- Freshness guard: suggestions are deduplicated against the last ~9 suggestions to prevent repeats

### Chat + Detailed Answers (right column)
- Clicking a suggestion card fires a **separate detailed-answer prompt** with full transcript context — longer, richer output than the preview
- Users can also **type questions** directly; chat uses a concise assistant prompt grounded in transcript
- Continuous in-session chat; no persistence on reload

### Export
- One-click JSON download: transcript chunks + every suggestion batch + full chat history, all with timestamps

## Settings

| Setting | Default | Notes |
|---|---|---|
| Groq API key | — | Stored in localStorage, never hard-coded |
| Live suggestions prompt | See below | Fully editable |
| Detailed answer prompt | See below | Fully editable |
| Chat prompt | See below | Fully editable |
| Suggestion context window | **600 words** | See rationale below |
| Detailed answer context | **0 (full transcript)** | See rationale below |
| Chat context window | **2000 words** | See rationale below |

Model is locked to `openai/gpt-oss-120b` per assignment constraints.

## Prompt & Context Strategy

### Live suggestions prompt
The system prompt instructs the model to act as a meeting copilot that surfaces exactly 3 suggestions *right now*, chosen from five typed categories: `question_to_ask`, `talking_point`, `direct_answer`, `fact_check`, or `clarification`. Key design decisions:

- **Typed suggestions with explicit definitions** so the model picks the categories that genuinely fit the moment rather than always defaulting to questions.
- **Preview must stand alone** — the instruction requires the preview (1–2 sentences) to deliver value even if never clicked. This makes the middle column useful at a glance, not just a prompt for more clicking.
- **Detail expands, not repeats** — detail (3–5 sentences) must go beyond the preview, giving the chat panel something substantive.
- **Specificity rule** — the model is told to reference names, numbers, and topics from the transcript, avoiding generic observations.
- **Honest fallback** — if the transcript is too short to generate useful suggestions, the model is instructed to say so rather than hallucinate.

### Suggestion context window: 600 words
600 words captures roughly the last 3–5 minutes of speech at a natural speaking pace (~120–150 wpm). This is enough context for the model to understand the thread of conversation without being overwhelmed by the full session history, which could dilute recency. Earlier turns are already reflected in prior suggestion batches.

### Detailed answer prompt + full transcript context
When a card is clicked, the user wants depth. The detailed-answer prompt is deliberately separate and longer-form (150–300 words target). It gets the **full transcript** (`detailedContextWords = 0`) because the user may click a card about something said much earlier in the session. Truncating context here would produce shallow or wrong answers.

### Chat prompt + 2000-word context
The chat assistant is meant to be a "smart colleague who was in the room." 2000 words gives it enough recent history to answer follow-up questions accurately without hitting token limits on long sessions. The system prompt explicitly tells it to say "this wasn't discussed" rather than speculate, reducing hallucination risk.

### Freshness deduplication
The last 9 suggestions (3 batches × 3) are passed to the model as a memory list and also checked post-parse with normalized string matching. This two-layer guard (prompt + code) prevents the model from circling back to the same topics after a long session.

## Tradeoffs

| Decision | Rationale |
|---|---|
| Manual refresh flushes audio first | Ensures suggestions are based on the freshest transcript, not stale audio. Adds ~1–2s latency vs. instant regeneration from old context. |
| Retry on bad format, not silent fallback | Two attempts with an error feedback loop produce better JSON compliance than accepting partial/bad output. On final failure, an error banner is shown — no silent degradation. |
| Dual-source transcription (Web Speech + Whisper) | Web Speech gives sub-second live text with zero API cost; Whisper provides accurate, committed chunks. Combined, users see something immediately while accuracy builds up in the background. |
| Session-scoped state, no backend | Matches assignment scope; avoids auth/DB complexity that would distract from the core prompt-engineering challenge. |
| `localStorage` for settings only | API key and prompts survive a page refresh (saves copy-paste friction). Transcript and chat remain ephemeral per session. |

## Known Limitations

- **Chrome / Edge only** for Web Speech API interim preview. Firefox shows Whisper-only committed chunks (still works, just no live preview).
- Suggestion generation requires at least a few seconds of speech — if the transcript is empty, refresh is a no-op.
- No backend; all API calls go directly from the browser, so the Groq API key is visible in browser network tools.

## Deployment

Deployable on Vercel, Netlify, Replit, or any static host with HTTPS (required for microphone access).

- **Public app URL**: `<add deployed URL here>`
- **GitHub repository**: `<add repository URL here>`
