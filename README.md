# CodeMap — "The Tour Guide"

Turn a GitHub repo your AI agents wrote into an interactive visual map you can click through and **talk to**.

## Run it
```bash
# Web (Next.js, App Router) — from web/
cp .env.example .env.local   # fill in keys (see below)
npm install
npm run dev                  # http://localhost:3000

# Worker (standalone Node analysis pipeline) — from worker/
cp .env.example .env
npm install
npm run dev                  # picks up queued projects
```

Required env (server/worker-side only — never expose to the client bundle):
`GEMINI_API_KEY`, `CLERK_SECRET_KEY` + `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`,
`PINECONE_API_KEY`, `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`.

## Demo / access
- Sign in with **GitHub** (Clerk). Pick a **public** repo.
- Wait for analysis (status updates live), then explore: **click a box** for an instant
  narrated tour, or use the **command box / mic** ("how does the database work?").

## How it works (reference)
GitHub auth (Clerk) → a standalone worker runs a Gemini Managed-Agent sandbox to document
the repo into `.md`, then Gemini 3.5 Flash emits a node/edge graph (laid out with dagre),
Gemini 3.1 Flash TTS pre-renders per-node narration, and chunks are embedded into Pinecone.
The Next.js frontend renders it with React Flow; a Gemini Live session (function calling)
turns voice commands into camera/explain actions. Everything is keyed by `node_id`.
**Full design: [`architecture.md`](./architecture.md).**

## Main decisions & tradeoffs
- **React Flow + dagre** (not Mermaid) — native camera/highlight/expand; `node.id === node_id`.
- **Standalone worker** for analysis — avoids serverless timeouts; UI syncs via Supabase realtime.
- **Audio-agnostic voice layer** — a text box drives the same tools as the mic (and is the stage fallback).
- **`node_id` as the universal key** linking diagram ↔ docs ↔ audio ↔ vectors ↔ voice commands.
