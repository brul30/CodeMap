/**
 * POST /api/analyze
 *
 * Body: { owner: string, name: string } — a PUBLIC GitHub repo.
 * Returns: a fully-validated CodeMapGraph (matches lib/data.ts contract).
 *
 * Pipeline: githubFetch (token-free public API) → Gemini (JSON mode +
 * responseSchema, model fallback) → zod-validate + deterministic checks →
 * one repair retry → dagre layout → final zod gate.
 *
 * Security:
 *  - auth()-gated: rejects 401 if there is no Clerk userId. Never trust a
 *    client claim as the boundary.
 *  - GEMINI_API_KEY stays server-side; never returned to the client.
 *  - All Gemini + GitHub output is zod-validated before it leaves here.
 *
 * Reliability:
 *  - generateMap hard-times-out the Gemini call (~45s). We never hang: on any
 *    failure we return { error } with a status, so the loading screen can fall
 *    back to the seed/precached graph instead of dead-ending.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { generateMap } from "@/lib/generate-map";

// This route does live network work — never statically cache it.
export const dynamic = "force-dynamic";
export const maxDuration = 60; // seconds (gives headroom over the 45s Gemini cap)

const bodySchema = z.object({
  owner: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/, "invalid owner"),
  name: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[A-Za-z0-9._-]+$/, "invalid repo name"),
});

export async function POST(request: Request) {
  // Public, token-free: anyone can paste a public repo URL. (Demo runs locally;
  // analysis only reads public GitHub data and never touches user secrets.)

  // 1. Validate the request body.
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((i) => i.message).join("; ") },
      { status: 400 },
    );
  }
  const { owner, name } = parsed.data;

  // 3. Run the pipeline. generateMap hard-times-out Gemini internally; we wrap
  //    the whole thing so a stuck GitHub fetch can't hang the request forever.
  try {
    const graph = await generateMap(owner, name);
    return NextResponse.json(graph);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Analysis failed";
    // 502 — upstream (Gemini / GitHub) produced an error or invalid output.
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
