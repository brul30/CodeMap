# CodeMap — "The Tour Guide"

Turn a GitHub repo your AI agents wrote into an interactive visual map you can click through and **talk to**.

## Run it
```bash
# Web (Next.js 16, App Router) — from web/
cp .env.example .env.local   # fill in keys (names listed in .env.example)
npm install
npm run dev                  # http://localhost:3000
npm run check-env            # (optional) report which env vars are set

# Worker (standalone Node analysis pipeline) — from worker/
cp .env.example .env
npm install
npm run dev                  # picks up queued projects
```

Required env (server/worker-side only — never expose to the client bundle):
`GEMINI_API_KEY`, `CLERK_SECRET_KEY` + `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`,
`PINECONE_API_KEY` + `PINECONE_INDEX`, `NEXT_PUBLIC_SUPABASE_URL` +
`SUPABASE_SERVICE_ROLE_KEY`. The full list lives in `web/.env.example`.

### Preview the UI without auth or the worker
The map renders from a built-in seed (`web/src/lib/data.ts`), so you can see the full
"Tour Guide" UI before Clerk/Supabase/the worker are wired:
- **http://localhost:3000/map** — the full app (canvas + insights + voice bar + terminal).
- **http://localhost:3000/loading** — the analysis/build screen.

(`/` and `/picker` are Clerk-gated and redirect once auth is configured.)

## Demo / access
- Sign in with **GitHub** (Clerk). Pick a **public** repo.
- Wait for analysis (status updates live), then explore: **click a box** for an instant
  narrated tour, or use the **command box / mic** ("how does the database work?").

## How it works (reference)
GitHub auth (Clerk) → a standalone worker runs a Gemini Managed-Agent sandbox to document
the repo into `.md`, then Gemini 3.5 Flash emits a node/edge graph (laid out with dagre),
Gemini 3.1 Flash TTS pre-renders per-node narration, and chunks are embedded into Pinecone.
The Next.js frontend renders it on a **bespoke canvas** (absolute nodes + SVG bezier edges +
custom pan/zoom/fit + programmatic camera focus); a Gemini Live session (function calling)
turns voice commands into camera/explain actions. Everything is keyed by `node_id`.
**Full design: [`architecture.md`](./architecture.md).**

## Main decisions & tradeoffs
- **Bespoke canvas + dagre** (not Mermaid, not React Flow) — the designer shipped a working
  renderer with native camera/highlight/expand; dagre only computes node `x/y` for real repos.
- **Standalone worker** for analysis — avoids serverless timeouts; UI syncs via Supabase realtime.
- **Audio-agnostic voice layer** — a text box drives the same tools as the mic (and is the stage fallback).
- **`node_id` as the universal key** linking diagram ↔ docs ↔ audio ↔ vectors ↔ voice commands.
