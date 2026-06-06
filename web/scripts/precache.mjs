/* ============================================================
   CodeMap — PRE-CACHE one famous public repo into src/lib/precached.ts.

   Why: guarantees a working demo even if live generation fails. /map prefers
   the live sessionStorage graph → this precached graph → the seed.

   Run (from web/):
     node --env-file=.env.local scripts/precache.mjs
     node --env-file=.env.local scripts/precache.mjs expressjs express

   This is a SELF-CONTAINED port of the lib/* pipeline (it can't import the TS
   modules without a build step), kept deliberately in lockstep with:
     - lib/codemap-schema.ts  (enums, zod, deterministic checks)
     - lib/github-fetch.ts    (token-free public fetch)
     - lib/generate-map.ts    (prompt, model fallback, dagre layout, assemble)
   If you change the prompt/schema there, mirror it here.
   ============================================================ */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { GoogleGenAI } from "@google/genai";
import dagre from "dagre";
import { z } from "zod";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "src", "lib", "precached.ts");

const DEFAULT_REPO = { owner: "expressjs", name: "express" };
const [, , argOwner, argName] = process.argv;
const REPO = argOwner && argName ? { owner: argOwner, name: argName } : DEFAULT_REPO;

const MODEL_CANDIDATES = ["gemini-3.5-flash", "gemini-2.5-flash", "gemini-2.0-flash"];

/* ---- enums (mirror codemap-schema.ts) ---- */
const NODE_KINDS = ["frontend", "layer", "service", "external"];
const ICON_NAMES = ["browser", "shield", "route", "cpu", "database", "layers", "spark", "file", "folder", "table", "bucket"];
const CHILD_TYPES = ["file", "table", "bucket"];

const stripHtml = (s) =>
  String(s)
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();

const hasHtml = (s) => /<[^>]+>/.test(s);
const plainText = z.string().min(1).refine((s) => !hasHtml(s), { message: "no HTML" });
const kebabId = z.string().min(1).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

const geminiGraphSchema = z
  .object({
    nodes: z
      .array(
        z.object({
          id: kebabId,
          label: z.string().min(1),
          kind: z.enum(NODE_KINDS),
          sub: z.string().min(1),
          icon: z.enum(ICON_NAMES),
          summary: z.string().min(1),
          tech: z.string().min(1),
          files: z
            .array(z.object({ name: z.string().min(1), loc: z.string().min(1), cov: z.number().min(0).max(1) }))
            .default([]),
          children: z.array(z.object({ name: z.string().min(1), type: z.enum(CHILD_TYPES), meta: z.string().min(1) })).optional(),
          narration: z.string().min(1),
        }),
      )
      .min(3),
    edges: z.array(z.object({ from: z.string().min(1), to: z.string().min(1), label: z.string().min(1) })).default([]),
  })
  .superRefine((g, ctx) => {
    const ids = new Set();
    for (const n of g.nodes) {
      if (ids.has(n.id)) ctx.addIssue(`dup id ${n.id}`);
      ids.add(n.id);
    }
    for (const e of g.edges) {
      if (!ids.has(e.from)) ctx.addIssue(`edge.from missing ${e.from}`);
      if (!ids.has(e.to)) ctx.addIssue(`edge.to missing ${e.to}`);
      if (e.from === e.to) ctx.addIssue(`self-loop ${e.from}`);
    }
  });

const geminiResponseSchema = {
  type: "object",
  properties: {
    nodes: {
      type: "array",
      minItems: 3,
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          label: { type: "string" },
          kind: { type: "string", enum: NODE_KINDS },
          sub: { type: "string" },
          icon: { type: "string", enum: ICON_NAMES },
          summary: { type: "string" },
          tech: { type: "string" },
          files: {
            type: "array",
            items: {
              type: "object",
              properties: { name: { type: "string" }, loc: { type: "string" }, cov: { type: "number" } },
              required: ["name", "loc", "cov"],
            },
          },
          children: {
            type: "array",
            items: {
              type: "object",
              properties: { name: { type: "string" }, type: { type: "string", enum: CHILD_TYPES }, meta: { type: "string" } },
              required: ["name", "type", "meta"],
            },
          },
          narration: { type: "string" },
        },
        required: ["id", "label", "kind", "sub", "icon", "summary", "tech", "files", "narration"],
      },
    },
    edges: {
      type: "array",
      items: {
        type: "object",
        properties: { from: { type: "string" }, to: { type: "string" }, label: { type: "string" } },
        required: ["from", "to", "label"],
      },
    },
  },
  required: ["nodes", "edges"],
};

/* ---- token-free GitHub fetch (mirror github-fetch.ts) ---- */
const GH = "https://api.github.com";
const RAW = "https://raw.githubusercontent.com";
const HEADERS = { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "CodeMap-Hackathon" };
const PRIORITY = new Set([
  "README.md", "readme.md", "package.json", "pyproject.toml", "setup.py", "requirements.txt",
  "go.mod", "Cargo.toml", "composer.json", "Gemfile", "pom.xml", "build.gradle", "tsconfig.json",
  "docker-compose.yml", "Dockerfile", "index.js", "index.ts", "lib/express.js", "lib/application.js",
]);
const SOURCE_EXT = /\.(ts|tsx|js|jsx|py|go|rs|rb|java|php|c|cc|cpp|cs)$/i;
const SKIP = /(^|\/)(node_modules|dist|build|out|\.next|vendor|venv|target|\.git|coverage|test|tests|__tests__|benchmarks|examples|docs)(\/|$)/i;

async function safeFetch(url, headers = HEADERS) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), 10_000);
  try {
    return await fetch(url, { headers, signal: c.signal });
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}
async function safeJson(url) {
  const r = await safeFetch(url);
  if (!r || !r.ok) return null;
  try {
    return await r.json();
  } catch {
    return null;
  }
}

async function githubFetch(owner, name) {
  const meta = await safeJson(`${GH}/repos/${owner}/${name}`);
  if (!meta?.default_branch) throw new Error(`repo ${owner}/${name} unreachable`);
  const branch = meta.default_branch;

  let commit = "HEAD";
  const c = await safeJson(`${GH}/repos/${owner}/${name}/commits?per_page=1&sha=${branch}`);
  if (Array.isArray(c) && c[0]?.sha) commit = c[0].sha.slice(0, 7);

  const treeRaw = await safeJson(`${GH}/repos/${owner}/${name}/git/trees/${branch}?recursive=1`);
  const blobs = Array.isArray(treeRaw?.tree) ? treeRaw.tree.filter((t) => t.type === "blob").map((t) => t.path) : [];
  const tree = Array.isArray(treeRaw?.tree) ? treeRaw.tree.map((t) => t.path) : [];

  const depth = (p) => p.split("/").length;
  const chosen = [];
  const seen = new Set();
  const add = (p) => {
    if (!seen.has(p) && chosen.length < 14) {
      seen.add(p);
      chosen.push(p);
    }
  };
  blobs.filter((p) => PRIORITY.has(p.split("/").pop())).sort((a, b) => depth(a) - depth(b)).forEach(add);
  blobs.filter((p) => SOURCE_EXT.test(p) && !SKIP.test(p)).sort((a, b) => depth(a) - depth(b) || a.localeCompare(b)).forEach(add);

  const files = [];
  let total = 0;
  for (const path of chosen) {
    if (total >= 200_000) break;
    const r = await safeFetch(`${RAW}/${owner}/${name}/${branch}/${path.split("/").map(encodeURIComponent).join("/")}`, {
      "User-Agent": HEADERS["User-Agent"],
    });
    if (!r || !r.ok) continue;
    let txt = "";
    try {
      txt = await r.text();
    } catch {
      continue;
    }
    const budget = 200_000 - total;
    const sliced = txt.length > budget ? txt.slice(0, budget) : txt;
    files.push({ path, content: sliced });
    total += sliced.length;
  }
  return { tree, files, meta: { owner, name, branch, commit } };
}

/* ---- prompt (mirror generate-map.ts) ---- */
function buildPrompt(owner, name, f) {
  const tree = f.tree.slice(0, 400).join("\n") + (f.tree.length > 400 ? `\n… (+${f.tree.length - 400} more)` : "");
  const fileBlock = f.files.map((x) => `--- FILE: ${x.path} ---\n${x.content.slice(0, 16_000)}`).join("\n\n");
  return `You are an expert software architect. Analyze the PUBLIC GitHub repository "${owner}/${name}" and produce a HIGH-LEVEL architecture map a NON-TECHNICAL person could understand.

Return between 5 and 9 nodes total. Each node is a major architectural component or layer (NOT individual files). Think in layers: a frontend/entry layer, core application/business layers, services, and external dependencies.

For EACH node set:
- id: short kebab-case, unique.
- label: human title.
- kind: EXACTLY one of: "frontend", "layer", "service", "external".
- sub: short tech subtitle.
- icon: EXACTLY one of: browser, shield, route, cpu, database, layers, spark, file, folder, table, bucket.
- summary: 1-3 sentences PLAIN TEXT (NO HTML tags).
- tech: primary technology.
- files: 2-4 REAL representative file paths from the repo, each { name, loc (e.g. "180 LOC"), cov (0..1) }.
- children: OPTIONAL, only for datastore-like nodes; 2-5 { name, type ("file"|"table"|"bucket"), meta }.
- narration: 2-4 spoken sentences PLAIN TEXT (NO HTML) for a non-technical listener.

Edges: 4-12 directed { from (existing id), to (existing id), label (1-2 words) }. NO self-loops. Valid ids only.

Base everything ONLY on the evidence below. Do NOT invent technologies not present.

=== REPOSITORY TREE (paths) ===
${tree}

=== KEY FILE CONTENTS ===
${fileBlock}
`;
}

function withTimeout(p, ms, label) {
  return new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error(`${label} timeout ${ms}ms`)), ms);
    p.then((v) => { clearTimeout(t); res(v); }, (e) => { clearTimeout(t); rej(e); });
  });
}

async function callGemini(ai, prompt, pinned) {
  const cands = pinned ? [pinned] : MODEL_CANDIDATES;
  let lastErr;
  for (const model of cands) {
    try {
      const r = await withTimeout(
        ai.models.generateContent({
          model,
          contents: prompt,
          config: { responseMimeType: "application/json", responseJsonSchema: geminiResponseSchema, temperature: 0.4, maxOutputTokens: 8192 },
        }),
        45_000,
        `Gemini ${model}`,
      );
      const text = r.text ?? "";
      if (!text.trim()) throw new Error(`empty ${model}`);
      console.log(`  model OK: ${model}`);
      return { text, model };
    } catch (e) {
      console.log(`  model ERR ${model}: ${String(e).slice(0, 120)}`);
      lastErr = e;
    }
  }
  throw new Error(`all models failed: ${String(lastErr).slice(0, 160)}`);
}

function jsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    const a = text.indexOf("{"), b = text.lastIndexOf("}");
    if (a >= 0 && b > a) {
      try {
        return JSON.parse(text.slice(a, b + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

function sanitize(raw) {
  if (raw?.nodes && Array.isArray(raw.nodes)) {
    for (const n of raw.nodes) {
      if (typeof n.summary === "string") n.summary = stripHtml(n.summary);
      if (typeof n.narration === "string") n.narration = stripHtml(n.narration);
    }
  }
  return raw;
}

/* ---- dagre layout + assemble (mirror generate-map.ts) ---- */
const NODE_W = 240, NODE_H = 120, PAD = 60;
function assemble(model, meta) {
  const dg = new dagre.graphlib.Graph();
  dg.setGraph({ rankdir: "TB", nodesep: 70, ranksep: 110, marginx: PAD, marginy: PAD });
  dg.setDefaultEdgeLabel(() => ({}));
  for (const n of model.nodes) dg.setNode(n.id, { width: NODE_W, height: NODE_H });
  for (const e of model.edges) dg.setEdge(e.from, e.to);
  dagre.layout(dg);

  let maxX = 0, maxY = 0;
  const nodes = model.nodes.map((n) => {
    const p = dg.node(n.id);
    const x = Math.round((p?.x ?? PAD) - NODE_W / 2);
    const y = Math.round((p?.y ?? PAD) - NODE_H / 2);
    maxX = Math.max(maxX, x + NODE_W);
    maxY = Math.max(maxY, y + NODE_H);
    return { ...n, summary: stripHtml(n.summary), narration: stripHtml(n.narration), x, y, w: NODE_W };
  });
  const stage = { w: Math.max(900, maxX + PAD), h: Math.max(600, maxY + PAD) };

  const fi = nodes.findIndex((n) => n.kind === "frontend");
  const di = fi >= 0 ? fi : 0;
  if (nodes[di]) nodes[di].selectedDefault = true;

  const voiceScript = nodes.slice(0, 5).map((n) => ({ query: `How does the ${n.label.toLowerCase()} work?`, node: n.id }));
  const repoStr = `${meta.owner}/${meta.name}`;
  return {
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
    logSeed: [
      { tag: "system", msg: `Repository <span class='hl'>${repoStr}</span> cloned · ${model.nodes.length} components` },
      { tag: "agent", msg: `Walking tree · branch <span class='hl'>${meta.branch}</span> @ ${meta.commit}` },
      { tag: "ok", msg: `Gemini emitted map · <span class='hl'>${model.nodes.length}</span> nodes · ${model.edges.length} edges` },
    ],
    logStream: [
      { tag: "agent", msg: `Watching <span class='hl'>${meta.branch}</span> · no drift since ${meta.commit}` },
      { tag: "ok", msg: `Analysis complete · project status → <span class='hl'>ready</span>` },
      { tag: "voice", msg: `Voice layer armed · say "show me the ${nodes[0]?.label.toLowerCase() ?? "overview"}"` },
    ],
  };
}

/* ---- run ---- */
async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not set (run with: node --env-file=.env.local scripts/precache.mjs)");

  console.log(`Pre-caching ${REPO.owner}/${REPO.name} …`);
  const fetched = await githubFetch(REPO.owner, REPO.name);
  console.log(`  tree: ${fetched.tree.length} paths · curated files: ${fetched.files.length} · branch ${fetched.meta.branch}@${fetched.meta.commit}`);

  const ai = new GoogleGenAI({ apiKey });
  const prompt = buildPrompt(REPO.owner, REPO.name, fetched);

  const first = await callGemini(ai, prompt);
  let parsed = geminiGraphSchema.safeParse(sanitize(jsonParse(first.text)));
  if (!parsed.success) {
    console.log("  first attempt invalid, repairing …");
    const issues = parsed.error.issues.map((i) => `- ${i.path.join(".")}: ${i.message}`).slice(0, 12).join("\n");
    const second = await callGemini(ai, `${prompt}\n\n=== PREVIOUS OUTPUT INVALID ===\nFix and return corrected JSON only:\n${issues}`, first.model);
    parsed = geminiGraphSchema.safeParse(sanitize(jsonParse(second.text)));
    if (!parsed.success) throw new Error(`invalid after repair: ${parsed.error.issues.map((i) => i.message).slice(0, 5).join("; ")}`);
  }

  const graph = assemble(parsed.data, fetched.meta);
  console.log(`  graph: ${graph.nodes.length} nodes · ${graph.edges.length} edges · stage ${graph.stage.w}x${graph.stage.h}`);

  const banner = `/* ============================================================
   CodeMap — PRE-CACHED graph (auto-generated by scripts/precache.mjs).

   A REAL Gemini-generated architecture map for ${graph.repo.owner}/${graph.repo.name}.
   Guarantees a working demo even if live /api/analyze fails: /map prefers
   the live sessionStorage graph → this → the seed (lib/data.ts).

   DO NOT EDIT BY HAND — re-run: node --env-file=.env.local scripts/precache.mjs
   ============================================================ */
import type { CodeMapGraph } from "./data";

export const PRECACHED: CodeMapGraph = `;

  writeFileSync(OUT, `${banner}${JSON.stringify(graph, null, 2)};\n\nexport default PRECACHED;\n`, "utf8");
  console.log(`Wrote ${OUT}`);
}

main().catch((e) => {
  console.error("precache failed:", e);
  process.exit(1);
});
