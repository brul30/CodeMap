# CodeMap Worker

Standalone Node.js worker that runs the repo-analysis pipeline for CodeMap.
Runs on Railway / Render / Fly — anywhere with a persistent process (no serverless timeout).

## Setup

```bash
cd worker
cp .env.example .env   # fill in all values
npm install
```

## Running

| Command | What it does |
|---|---|
| `npm run dev` | Start with live-reload via tsx watch (development) |
| `npm run build` | Compile TypeScript to dist/ |
| `npm start` | Run compiled dist/index.js (production) |

## Env / infra checks

Run these after filling in `.env` to confirm connectivity before starting the worker.

```bash
# Check all required env vars are set (exits 1 + lists missing if not)
npm run check-env

# Create the Pinecone vector index (idempotent — safe to re-run)
npm run create-index

# Smoke-test Supabase connectivity and confirm migration is applied
npm run check-supabase
```

## Database migration

Location: `supabase/migrations/0001_init.sql`

**To apply:**

Option A — Supabase Dashboard (recommended for hackathon):
1. Open your Supabase project → SQL Editor.
2. Paste the contents of `supabase/migrations/0001_init.sql`.
3. Click Run.

Option B — Supabase CLI:
```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

The migration is idempotent (`IF NOT EXISTS` / `ON CONFLICT DO NOTHING`) so it is safe to run more than once.

## Project structure

```
worker/
  src/
    index.ts          # Entry point — boot, poll loop, graceful shutdown
    lib/
      timeout.ts      # withTimeout() — wraps every external call with a hard deadline
  scripts/
    check-env.mjs     # Validate required env vars (dependency-free)
    create-pinecone-index.mjs   # Bootstrap Pinecone serverless index
    check-supabase.mjs          # Smoke-test Supabase connection
  supabase/
    migrations/
      0001_init.sql   # Full schema: projects, nodes, realtime, narration bucket
  .env.example        # Key names + comments (no secrets)
  tsconfig.json
  package.json
```
