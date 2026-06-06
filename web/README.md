# CodeMap Web App

Visual + voice map of AI-generated GitHub repos.

## Getting Started

### Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

The UI renders from a built-in seed (`src/lib/data.ts`), so you can preview the full
experience without auth, Supabase, or the worker running:

- **`/map`** — the full "Tour Guide" app (canvas + insights + voice bar + terminal)
- **`/loading`** — the analysis/build screen

`/` (landing) and `/picker` use Clerk and redirect once GitHub auth is configured.

### Environment Variables

Copy `.env.example` to `.env.local` and fill in your credentials:

```bash
cp .env.example .env.local
```

Check which environment variables are set:

```bash
npm run check-env
```

This will report which required variables are present and which are missing.

## Related

See [../README.md](../README.md) for project overview and architecture.
