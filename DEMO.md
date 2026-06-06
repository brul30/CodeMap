# CodeMap — Demo Script & Pitch

> Category: **Best use of Google / Gemini.** ~2-minute live demo + 30s setup.
> One-liner: **"Google Maps for the codebase your AI agents wrote — with a voice tour guide."**

---

## The hook (15s — say this first, before touching anything)
> "Vibe coders ship entire codebases through AI agents — and then they're **blind to their own code**. They can't see the structure, the layers, how anything connects. CodeMap fixes that: connect a repo, and Gemini reverse-engineers a live architecture map you can **click through and talk to**."

---

## The live demo (target ~2 min)

**1. Sign in (15s)** — Landing page → **Connect GitHub**.
> "Auth is Clerk — GitHub sign-in in seconds."

**2. Pick the repo (15s)** — Picker shows your real public repos → select **brul30/getCovered** → **Generate Visual Map**.
> "This is a repo I built with AI agents. I'm going to have CodeMap explain it back to me."

**3. The build (15s — the loading screen)** — point at the terminal log streaming.
> "Behind the scenes: Gemini reads the repo, writes documentation, and emits the architecture graph. [If using sandbox: a Gemini managed-agent does this in an isolated Linux sandbox.]"

**4. The map renders (15s)** — the bespoke canvas, nodes + edges.
> "There it is — the whole architecture as a map. Frontend, API, services, data, external. Each box is a real part of my codebase."

**5. 🌟 THE HERO MOMENT — click the Database box (30s)**
- Click "Database Layer" → it centers, highlights, expands its children → narration plays.
> "I click the database layer — and CodeMap **walks me through it**: *'This is the database layer. The agent spun up a Postgres schema here handling auth and sessions…'* That's Gemini text-to-speech, pre-rendered so it's instant."

**6. 🌟 VOICE — talk to it (30s)**
- Use the voice bar / command box: **"How does the API connect to the database?"** (or "Take me to the Gemini services.")
> "And I can just **ask** it. *[speak]* — it understands, navigates to that part of the map, and explains. That's Gemini Live calling UI functions from my voice."

**7. Close (10s)**
> "Built on four sponsors doing real work: **Clerk** for auth, **Gemini** for the agent sandbox, the map, the voice, and the narration, **Pinecone** for the retrieval layer, **LangGraph** orchestrating. CodeMap — see your codebase before you read it."

---

## Sponsor talking points (for Q&A — Sponsor Tech = 15pts, penalizes superficial use)
- **Gemini (the star, 4 surfaces):** ① managed-agent Linux sandbox documents the repo, ② 3.5 Flash emits the graph + answers questions, ③ 3.1 Flash TTS pre-renders narration, ④ 3.1 Flash **Live** turns voice into UI function-calls.
- **Clerk:** GitHub OAuth sign-in; lists the user's public repos.
- **Pinecone:** serverless index over the repo's docs/code; powers "ask the codebase" and steers the camera to the right node via `node_id` metadata.
- **LangGraph:** supervisor orchestrating the analysis steps.

## Scorecard alignment (what to emphasize)
- **Problem Clarity (15):** one sharp problem, one clear user (vibe coders blind to AI-written code).
- **Innovation (10):** a *voice-guided visual map* of a codebase — not another chatbot.
- **Category (20):** four distinct Gemini surfaces, used for real.
- **Execution (20):** it generates a real map from a real repo, live.
- **UX (15):** click to explore + talk to navigate + clear feedback.

## The universal key (if asked "how does it all connect?")
> "Every box has a stable `node_id`. That one id links the diagram box, its documentation, its pre-rendered audio, its Pinecone vectors, and the voice function-call target. That's why saying 'show me the database' reliably lands on the right box and plays the right narration."

---

## ⚠️ Stage safety / fallbacks (rehearse these)
- **Pre-cached repo:** one repo is generated ahead of time and renders instantly — use it if wifi/API is flaky. (Live generation of your own repo is the hero; pre-cache is the safety net.)
- **Voice fails / loud room:** the **text command box** does the EXACT same thing as the mic — type the question instead. Same wow, zero audio risk.
- **Live generation hangs:** it falls back to the pre-cached/seed map; keep talking, click through that one.
- **Auth hiccup:** the `/map` route renders the pre-cached map directly — you can open it without signing in if needed.
- Have the demo repo **already chosen and known to work** before you walk up.

## Pre-demo checklist
- [ ] `npm run dev` running; signed in once already (warm session).
- [ ] Demo repo confirmed public + generates a clean map.
- [ ] Pre-cached map verified rendering at `/map`.
- [ ] One voice command rehearsed + its text-box equivalent.
- [ ] Volume up for TTS narration.
