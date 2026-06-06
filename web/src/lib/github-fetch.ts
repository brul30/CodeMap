/* ============================================================
   CodeMap — token-free public GitHub fetch.

   Given { owner, name }, pulls just enough of a PUBLIC repo for Gemini to
   reason about its architecture:
     - default branch + latest commit sha
     - the full recursive tree (paths only)
     - a CURATED set of file contents (manifests, top-level config, a sampling
       of source files), capped to ~200 KB total.

   Constraints (per project rules):
     - PUBLIC API only, NO OAuth token (unauthenticated).
     - Hard 10s timeout per request; tolerate 404 / empty.
     - All GitHub payloads validated with zod before use.

   Note: unauthenticated GitHub has a low rate limit (~60 req/hr/IP). We keep
   request count small (1 repo meta + 1 tree + ~12 contents) and fail soft.
   ============================================================ */
import { z } from "zod";

const GH_API = "https://api.github.com";
const RAW = "https://raw.githubusercontent.com";
const PER_REQ_TIMEOUT_MS = 10_000;
const TOTAL_CONTENT_CAP = 200_000; // ~200 KB across all fetched files
const MAX_FILES = 14;

export interface RepoFile {
  path: string;
  content: string;
}

export interface GitHubFetchResult {
  tree: string[];
  files: RepoFile[];
  meta: { owner: string; name: string; branch: string; commit: string };
}

const repoMetaSchema = z.object({
  default_branch: z.string().min(1),
});

const commitSchema = z.array(z.object({ sha: z.string().min(1) })).min(1);

const treeSchema = z.object({
  tree: z.array(
    z.object({
      path: z.string(),
      type: z.string(), // "blob" | "tree" | "commit"
    }),
  ),
  truncated: z.boolean().optional(),
});

const COMMON_HEADERS = {
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  // GitHub asks unauthenticated clients to send a UA.
  "User-Agent": "CodeMap-Hackathon",
};

/** fetch + hard timeout. Returns null on any failure (404, network, abort). */
async function safeFetch(url: string, headers: Record<string, string> = COMMON_HEADERS): Promise<Response | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PER_REQ_TIMEOUT_MS);
  try {
    const res = await fetch(url, { headers, signal: controller.signal });
    return res;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function safeJson(url: string): Promise<unknown | null> {
  const res = await safeFetch(url);
  if (!res || !res.ok) return null;
  try {
    return await res.json();
  } catch {
    return null;
  }
}

/* ---- curation: which files matter for an architecture overview ---- */

// Exact basenames worth their weight (manifests + entry points + config).
const PRIORITY_BASENAMES = new Set(
  [
    "README.md",
    "readme.md",
    "package.json",
    "pyproject.toml",
    "setup.py",
    "requirements.txt",
    "go.mod",
    "Cargo.toml",
    "composer.json",
    "Gemfile",
    "pom.xml",
    "build.gradle",
    "tsconfig.json",
    "docker-compose.yml",
    "docker-compose.yaml",
    "Dockerfile",
    "next.config.js",
    "next.config.mjs",
    "next.config.ts",
    "vite.config.ts",
    "vite.config.js",
  ].map((s) => s),
);

// Source-ish extensions we'll sample if priority files leave budget.
const SOURCE_EXT = /\.(ts|tsx|js|jsx|py|go|rs|rb|java|php|c|cc|cpp|cs)$/i;

// Skip noise.
const SKIP_DIR =
  /(^|\/)(node_modules|dist|build|out|\.next|vendor|venv|\.venv|target|\.git|coverage|test|tests|__tests__|fixtures|examples|docs)(\/|$)/i;

function depth(p: string): number {
  return p.split("/").length;
}

/**
 * Choose up to MAX_FILES paths: every priority manifest first, then a shallow
 * sampling of source files (entry points near the root rank highest).
 */
function curatePaths(blobPaths: string[]): string[] {
  const chosen: string[] = [];
  const seen = new Set<string>();

  const add = (p: string) => {
    if (!seen.has(p) && chosen.length < MAX_FILES) {
      seen.add(p);
      chosen.push(p);
    }
  };

  // 1. priority manifests / config (anywhere, but prefer shallow)
  const priority = blobPaths
    .filter((p) => PRIORITY_BASENAMES.has(p.split("/").pop() ?? ""))
    .sort((a, b) => depth(a) - depth(b));
  priority.forEach(add);

  // 2. a shallow sampling of source files (skip noise, prefer near-root)
  const sources = blobPaths
    .filter((p) => SOURCE_EXT.test(p) && !SKIP_DIR.test(p))
    .sort((a, b) => depth(a) - depth(b) || a.localeCompare(b));
  sources.forEach(add);

  return chosen;
}

/* ---- file content fetch (raw.githubusercontent, no auth) ---- */

async function fetchContent(owner: string, name: string, branch: string, path: string): Promise<string | null> {
  const url = `${RAW}/${owner}/${name}/${branch}/${path
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;
  const res = await safeFetch(url, { "User-Agent": COMMON_HEADERS["User-Agent"] });
  if (!res || !res.ok) return null;
  try {
    return await res.text();
  } catch {
    return null;
  }
}

/**
 * Fetch a curated slice of a PUBLIC repo. Throws only if the repo itself is
 * unreachable (so callers can surface a clean error); otherwise fails soft.
 */
export async function githubFetch(owner: string, name: string): Promise<GitHubFetchResult> {
  owner = owner.trim();
  name = name.trim();
  if (!owner || !name) throw new Error("owner and name are required");

  // 1. repo meta (default branch). Hard requirement — repo must exist.
  const rawMeta = await safeJson(`${GH_API}/repos/${owner}/${name}`);
  const meta = repoMetaSchema.safeParse(rawMeta);
  if (!meta.success) {
    throw new Error(`Repository ${owner}/${name} not found or unreachable (public API).`);
  }
  const branch = meta.data.default_branch;

  // 2. latest commit sha (soft — fall back to a short label).
  let commit = "HEAD";
  const rawCommit = await safeJson(`${GH_API}/repos/${owner}/${name}/commits?per_page=1&sha=${encodeURIComponent(branch)}`);
  const commitParsed = commitSchema.safeParse(rawCommit);
  if (commitParsed.success) commit = commitParsed.data[0].sha.slice(0, 7);

  // 3. recursive tree (paths only).
  let tree: string[] = [];
  const rawTree = await safeJson(`${GH_API}/repos/${owner}/${name}/git/trees/${encodeURIComponent(branch)}?recursive=1`);
  const treeParsed = treeSchema.safeParse(rawTree);
  let blobPaths: string[] = [];
  if (treeParsed.success) {
    blobPaths = treeParsed.data.tree.filter((t) => t.type === "blob").map((t) => t.path);
    tree = treeParsed.data.tree.map((t) => t.path);
  }

  // 4. fetch curated file contents, capped by total bytes.
  const wanted = curatePaths(blobPaths);
  const files: RepoFile[] = [];
  let total = 0;
  for (const path of wanted) {
    if (total >= TOTAL_CONTENT_CAP) break;
    const content = await fetchContent(owner, name, branch, path);
    if (content == null) continue;
    const budget = TOTAL_CONTENT_CAP - total;
    const sliced = content.length > budget ? content.slice(0, budget) : content;
    files.push({ path, content: sliced });
    total += sliced.length;
  }

  return { tree, files, meta: { owner, name, branch, commit } };
}
