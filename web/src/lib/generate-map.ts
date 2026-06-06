/* ============================================================
   CodeMap — the core pipeline: repo → Gemini → validated graph.

     githubFetch(owner,name)
       → build a HIGH-LEVEL architecture prompt (5-9 layered nodes + edges)
       → Gemini (JSON mode + responseSchema) with model fallback
       → zod-validate (geminiGraphSchema) + deterministic checks
       → ONE repair retry if the first attempt is invalid
       → dagre layout → x/y/w + stage{w,h}
       → assemble the FULL CodeMapGraph (kinds, voiceScript, logs)
       → final zod-validate (codeMapGraphSchema) before returning.

   All Gemini output is UNTRUSTED — nothing is returned until it passes the
   schema. summary/narration are stripped to plain text (XSS guard).

   The model id is configurable + auto-falls-back: gemini-3.5-flash →
   gemini-2.5-flash → gemini-2.0-flash. The first one that responds wins and
   is reused for the (possible) repair retry.
   ============================================================ */
import { GoogleGenAI } from "@google/genai";
import dagre from "dagre";
import { githubFetch, type GitHubFetchResult } from "./github-fetch";
import {
  geminiGraphSchema,
  geminiResponseSchema,
  codeMapGraphSchema,
  stripHtml,
  type GeminiGraph,
} from "./codemap-schema";
import type { CodeMapGraph } from "./data";

/** Model id preference order. Override the first with CODEMAP_GEMINI_MODEL. */
export const MODEL_CANDIDATES = [
  process.env.CODEMAP_GEMINI_MODEL ?? "gemini-3.5-flash",
  "gemini-2.5-flash",
  "gemini-2.0-flash",
].filter((m, i, a) => a.indexOf(m) === i);

const GEMINI_TIMEOUT_MS = 45_000;

/* ---- prompt ---- */

function buildTreeSummary(tree: string[]): string {
  // Keep the tree compact: cap to ~400 paths so the prompt stays cheap.
  const capped = tree.slice(0, 400);
  const more = tree.length - capped.length;
  return capped.join("\n") + (more > 0 ? `\n… (+${more} more paths)` : "");
}

function buildFilesSection(files: GitHubFetchResult["files"]): string {
  return files
    .map((f) => `--- FILE: ${f.path} ---\n${f.content.slice(0, 16_000)}`)
    .join("\n\n");
}

function buildPrompt(repo: { owner: string; name: string }, fetched: GitHubFetchResult): string {
  return `You are an expert software architect. Analyze the PUBLIC GitHub repository "${repo.owner}/${repo.name}" and produce a HIGH-LEVEL architecture map a NON-TECHNICAL person could understand.

Return between 5 and 9 nodes total. Each node is a major architectural component or layer (NOT individual files). Think in layers: a frontend/entry layer, core application/business layers, services, and external dependencies (databases, third-party APIs, queues, etc.).

For EACH node set:
- id: short kebab-case, unique (e.g. "http-server", "core-engine", "data-store").
- label: human title (e.g. "HTTP Server").
- kind: EXACTLY one of: "frontend" (UI / client entry), "layer" (internal app layer), "service" (internal worker/process/job), "external" (datastore / third-party / external dependency).
- sub: short tech subtitle (e.g. "Express · Router").
- icon: EXACTLY one of: browser, shield, route, cpu, database, layers, spark, file, folder, table, bucket. Pick the most fitting (browser=UI, shield=auth, route=router/api, cpu=compute/engine, database=db, layers=middleware/stack, spark=AI/special, folder=module group, file/table/bucket for data shapes).
- summary: 1-3 sentences of PLAIN TEXT (absolutely NO HTML tags, no <b>, no <code>). What this part does and why it matters.
- tech: the primary technology (e.g. "Node.js").
- files: 2-4 REAL representative file paths from the repo for this component, each with { name, loc (a plausible label like "180 LOC"), cov (a number 0..1 estimating test coverage) }. Use actual paths seen in the tree when possible.
- children: OPTIONAL, only for datastore-like nodes; 2-5 items of { name, type ("file"|"table"|"bucket"), meta (short label) }.
- narration: 2-4 spoken sentences of PLAIN TEXT (NO HTML) explaining this component conversationally to a non-technical listener.

For edges: between 4 and 12 directed edges { from (existing node id), to (existing node id), label (1-2 words like "requests"/"queries"/"reads") } describing how data/control flows. NO self-loops. Every from/to MUST be an existing node id.

Base everything ONLY on the evidence below. Do NOT invent technologies not present.

=== REPOSITORY TREE (paths) ===
${buildTreeSummary(fetched.tree)}

=== KEY FILE CONTENTS ===
${buildFilesSection(fetched.files)}
`;
}

/* ---- Gemini call with model fallback + timeout ---- */

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    p.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

interface GeminiCall {
  text: string;
  model: string;
}

async function callGemini(ai: GoogleGenAI, prompt: string, pinnedModel?: string): Promise<GeminiCall> {
  const candidates = pinnedModel ? [pinnedModel] : MODEL_CANDIDATES;
  let lastErr: unknown;
  for (const model of candidates) {
    try {
      const res = await withTimeout(
        ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            // geminiResponseSchema is a standard JSON-Schema object → use the
            // documented responseJsonSchema field (typed `unknown`). We STILL
            // re-validate every response with zod afterward (untrusted output).
            responseJsonSchema: geminiResponseSchema,
            temperature: 0.4,
            maxOutputTokens: 8192,
          },
        }),
        GEMINI_TIMEOUT_MS,
        `Gemini (${model})`,
      );
      const text = res.text ?? "";
      if (!text.trim()) throw new Error(`empty response from ${model}`);
      return { text, model };
    } catch (e) {
      lastErr = e;
      // try the next model id (e.g. 3.5 not available → 2.5 → 2.0)
    }
  }
  throw new Error(`All Gemini models failed: ${String(lastErr).slice(0, 200)}`);
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    // tolerate stray prose / code fences around the JSON
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

/** Sanitize model output → plain text on summary/narration before zod. */
function sanitizeGeminiGraph(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const g = raw as { nodes?: unknown[] };
  if (Array.isArray(g.nodes)) {
    for (const n of g.nodes) {
      if (n && typeof n === "object") {
        const node = n as Record<string, unknown>;
        if (typeof node.summary === "string") node.summary = stripHtml(node.summary);
        if (typeof node.narration === "string") node.narration = stripHtml(node.narration);
      }
    }
  }
  return raw;
}

/* ---- dagre layout ---- */

const NODE_W = 240;
const NODE_H = 120;
const STAGE_PAD = 60;

function layoutGraph(g: GeminiGraph): { nodes: CodeMapGraph["nodes"]; stage: { w: number; h: number } } {
  const dg = new dagre.graphlib.Graph();
  dg.setGraph({ rankdir: "TB", nodesep: 70, ranksep: 110, marginx: STAGE_PAD, marginy: STAGE_PAD });
  dg.setDefaultEdgeLabel(() => ({}));

  for (const n of g.nodes) dg.setNode(n.id, { width: NODE_W, height: NODE_H });
  for (const e of g.edges) dg.setEdge(e.from, e.to);

  dagre.layout(dg);

  let maxX = 0;
  let maxY = 0;
  const laidOut = g.nodes.map((n) => {
    const pos = dg.node(n.id);
    // dagre gives CENTER coords; Canvas uses top-left (left: node.x).
    const x = Math.round((pos?.x ?? STAGE_PAD) - NODE_W / 2);
    const y = Math.round((pos?.y ?? STAGE_PAD) - NODE_H / 2);
    maxX = Math.max(maxX, x + NODE_W);
    maxY = Math.max(maxY, y + NODE_H);
    return {
      ...n,
      summary: stripHtml(n.summary),
      narration: stripHtml(n.narration),
      x,
      y,
      w: NODE_W,
    };
  });

  return {
    nodes: laidOut,
    stage: { w: Math.max(900, maxX + STAGE_PAD), h: Math.max(600, maxY + STAGE_PAD) },
  };
}

/* ---- assemble the FULL graph (kinds, voiceScript, logs) ---- */

function assembleGraph(
  model: GeminiGraph,
  meta: GitHubFetchResult["meta"],
): CodeMapGraph {
  const { nodes, stage } = layoutGraph(model);

  // mark a sensible default selection (prefer the entry/frontend node)
  const defaultIdx =
    nodes.findIndex((n) => n.kind === "frontend") >= 0
      ? nodes.findIndex((n) => n.kind === "frontend")
      : 0;
  if (nodes[defaultIdx]) nodes[defaultIdx].selectedDefault = true;

  // generate a short voice script from the actual nodes
  const voiceScript = nodes.slice(0, 5).map((n) => ({
    query: `How does the ${n.label.toLowerCase()} work?`,
    node: n.id,
  }));

  const repoStr = `${meta.owner}/${meta.name}`;
  const logSeed: CodeMapGraph["logSeed"] = [
    { tag: "system", msg: `Repository <span class='hl'>${repoStr}</span> cloned · ${model.nodes.length} components` },
    { tag: "agent", msg: `Walking tree · branch <span class='hl'>${meta.branch}</span> @ ${meta.commit}` },
    { tag: "ok", msg: `Gemini emitted map · <span class='hl'>${model.nodes.length}</span> nodes · ${model.edges.length} edges` },
  ];
  const logStream: CodeMapGraph["logStream"] = [
    { tag: "agent", msg: `Watching <span class='hl'>${meta.branch}</span> · no drift since ${meta.commit}` },
    { tag: "ok", msg: `Analysis complete · project status → <span class='hl'>ready</span>` },
    { tag: "voice", msg: `Voice layer armed · say "show me the ${nodes[0]?.label.toLowerCase() ?? "overview"}"` },
  ];

  const graph: CodeMapGraph = {
    repo: { owner: meta.owner, name: meta.name, branch: meta.branch, commit: meta.commit },
    stage,
    nodes,
    edges: model.edges,
    kinds: {
      frontend: { label: "Frontend", sw: "#7aa2ff" },
      layer: { label: "App layer", sw: "#3ee0c4" },
      service: { label: "Service", sw: "#c792ea" },
      external: { label: "External", sw: "#ffb86b" },
    },
    voiceScript,
    logSeed,
    logStream,
  };

  // FINAL trust gate: re-validate the assembled graph (shape + invariants).
  const validated = codeMapGraphSchema.parse(graph);
  return validated as CodeMapGraph;
}

/* ---- public entry ---- */

export interface GenerateMapOptions {
  /** pass a pre-fetched result (e.g. tests / precache) to skip the network. */
  fetched?: GitHubFetchResult;
  apiKey?: string;
}

/**
 * Full pipeline. Throws on unrecoverable failure (no key, repo unreachable,
 * model unusable, output invalid after one repair). Callers (route / script)
 * decide how to surface or fall back.
 */
export async function generateMap(
  owner: string,
  name: string,
  opts: GenerateMapOptions = {},
): Promise<CodeMapGraph> {
  const apiKey = opts.apiKey ?? process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");

  const fetched = opts.fetched ?? (await githubFetch(owner, name));
  if (fetched.files.length === 0 && fetched.tree.length === 0) {
    throw new Error(`No analyzable content fetched for ${owner}/${name}`);
  }

  const ai = new GoogleGenAI({ apiKey });
  const prompt = buildPrompt({ owner, name }, fetched);

  // attempt 1
  const first = await callGemini(ai, prompt);
  let parsed = geminiGraphSchema.safeParse(sanitizeGeminiGraph(safeJsonParse(first.text)));

  // ONE repair retry (pin the model that responded the first time)
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `- ${i.path.join(".")}: ${i.message}`)
      .slice(0, 12)
      .join("\n");
    const repairPrompt = `${prompt}

=== YOUR PREVIOUS OUTPUT WAS INVALID ===
Fix these problems and return CORRECTED JSON only (same schema, plain-text summary/narration, valid kind/icon enums, edges referencing existing node ids, no self-loops):
${issues}`;
    const second = await callGemini(ai, repairPrompt, first.model);
    parsed = geminiGraphSchema.safeParse(sanitizeGeminiGraph(safeJsonParse(second.text)));
    if (!parsed.success) {
      throw new Error(
        `Gemini output invalid after repair retry: ${parsed.error.issues
          .map((i) => i.message)
          .slice(0, 5)
          .join("; ")}`,
      );
    }
  }

  return assembleGraph(parsed.data, fetched.meta);
}
