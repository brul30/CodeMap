/* ============================================================
   CodeMap — graph data model (typed port of componentsUI/assets/data.js)

   This is the LOCKED data contract. `node_id` (the `id` field) is the
   universal key joining diagram box ↔ .md ↔ narration audio ↔ Pinecone
   chunk ↔ voice function-call target. The worker emits this exact shape;
   Step 3-wire swaps this seed for a Supabase fetch + realtime.

   Keep the shape EXACTLY in sync with the worker output. Positions are in
   stage coordinate space; for real repos dagre fills x/y/w.
   ============================================================ */

export type NodeKind = "frontend" | "layer" | "service" | "external";

/** Icon keys understood by <Icon n=… /> (see components/Icon.tsx). */
export type IconName =
  | "browser"
  | "shield"
  | "route"
  | "cpu"
  | "database"
  | "layers"
  | "spark"
  // also valid node/child icons in components.jsx / Icon.tsx; the generated
  // map may use these for data-shaped or grouped components.
  | "file"
  | "folder"
  | "table"
  | "bucket";

export interface CodeFile {
  name: string;
  /** e.g. "142 LOC" / "11 files" — free-form label rendered as-is. */
  loc: string;
  /** test-coverage 0..1, drives the little bar in the file row. */
  cov: number;
}

export interface NodeChild {
  name: string;
  type: "file" | "table" | "bucket";
  meta: string;
}

export interface NodeDep {
  from: string;
  rel: string;
  dir: "in" | "out";
}

export interface GraphNode {
  /** stable key — joins everything; === the diagram box id. */
  id: string;
  label: string;
  kind: NodeKind;
  /** short tech subtitle, e.g. "Supabase · PostgreSQL". */
  sub: string;
  icon: IconName;
  /** stage-space layout (dagre fills these for real repos). */
  x: number;
  y: number;
  w: number;
  /** HTML summary (sanitized server-authored markup; rendered via the design system). */
  summary: string;
  tech: string;
  files: CodeFile[];
  /** expanded children shown inside the selected node + insights. */
  children?: NodeChild[];
  /** narration text — Step 3-wire points the tour at the pre-rendered MP3 (audio_url). */
  narration: string;
  /** explicit dependency rows for the insights panel (optional; else derived from edges). */
  deps?: NodeDep[];
  /** the node selected on first render. */
  selectedDefault?: boolean;
}

export interface GraphEdge {
  from: string;
  to: string;
  label: string;
}

export interface KindMeta {
  label: string;
  /** swatch colour for the legend + node-kind chips. */
  sw: string;
}

export interface VoiceScriptItem {
  query: string;
  /** node_id the command should navigate the camera to. */
  node: string;
}

export interface LogLine {
  /** timestamp "HH:MM:SS" — optional; the live stream stamps its own. */
  t?: string;
  tag: "system" | "agent" | "voice" | "tts" | "ok" | "vector" | "scan" | "warn";
  /** may contain <span class="hl"> … </span> markup. */
  msg: string;
}

export interface CodeMapGraph {
  repo: { owner: string; name: string; branch: string; commit: string };
  stage: { w: number; h: number };
  nodes: GraphNode[];
  edges: GraphEdge[];
  kinds: Record<NodeKind, KindMeta>;
  voiceScript: VoiceScriptItem[];
  logSeed: LogLine[];
  logStream: LogLine[];
}

export const CODEMAP: CodeMapGraph = {
  repo: { owner: "lumen-labs", name: "atlas-api", branch: "main", commit: "a3f9c2e" },

  // stage canvas logical size
  stage: { w: 1180, h: 820 },

  nodes: [
    {
      id: "client",
      label: "Client App",
      kind: "frontend",
      sub: "Next.js · App Router",
      icon: "browser",
      x: 470,
      y: 40,
      w: 250,
      summary:
        'The <b>Next.js App Router</b> frontend. Server components stream the dashboard shell while client islands handle the interactive map and the live voice session. Renders <code>/app</code> routes and mounts the Gemini Live socket.',
      tech: "TypeScript",
      files: [
        { name: "app/layout.tsx", loc: "142 LOC", cov: 0.9 },
        { name: "app/(map)/page.tsx", loc: "318 LOC", cov: 0.7 },
        { name: "lib/live-session.ts", loc: "204 LOC", cov: 0.5 },
      ],
      narration:
        "This is the Client App — the Next.js App Router frontend. It streams the dashboard shell using server components, then hydrates two interactive islands: the architecture map you're looking at now, and the live voice session that's listening for your commands. Everything you click flows through this layer first.",
    },
    {
      id: "auth",
      label: "Auth Gateway",
      kind: "service",
      sub: "Clerk · GitHub OAuth",
      icon: "shield",
      x: 150,
      y: 250,
      w: 232,
      summary:
        'Handles identity with <b>Clerk</b>. Exchanges the GitHub social connection for a scoped access token via <code>getUserOauthAccessToken</code>, then lists and clones the user\'s repositories.',
      tech: "Clerk SDK",
      files: [
        { name: "middleware.ts", loc: "61 LOC", cov: 1.0 },
        { name: "lib/clerk.ts", loc: "88 LOC", cov: 0.8 },
        { name: "lib/github.ts", loc: "147 LOC", cov: 0.6 },
      ],
      narration:
        "The Auth Gateway is powered by Clerk. When you sign in with GitHub, it exchanges your social connection for a scoped access token, which it uses to list and clone your repositories. No passwords are ever stored here.",
    },
    {
      id: "api",
      label: "API Router",
      kind: "layer",
      sub: "Route Handlers",
      icon: "route",
      x: 488,
      y: 248,
      w: 214,
      summary:
        'The <b>route-handler layer</b> under <code>/app/api</code>. Validates sessions, fans requests out to the database, vector store, and Gemini services, and brokers the ephemeral token used by the browser to connect to Gemini Live.',
      tech: "Edge Runtime",
      files: [
        { name: "api/analyze/route.ts", loc: "176 LOC", cov: 0.7 },
        { name: "api/token/route.ts", loc: "54 LOC", cov: 0.9 },
        { name: "api/ask/route.ts", loc: "132 LOC", cov: 0.6 },
      ],
      narration:
        "The API Router is the brokerage layer. It validates your session, then fans requests out to the database, the vector store, and the Gemini services. It also mints the short-lived ephemeral token that lets your browser talk directly to Gemini Live.",
    },
    {
      id: "analysis",
      label: "Analysis Job",
      kind: "service",
      sub: "LangGraph Supervisor",
      icon: "cpu",
      x: 838,
      y: 250,
      w: 244,
      summary:
        'A background <b>LangGraph supervisor</b> that orchestrates the heavy lift: a Gemini sandbox clones the repo and writes <code>.md</code> docs, Flash emits the map, TTS pre-renders narration, and chunks are embedded into Pinecone.',
      tech: "LangGraph",
      files: [
        { name: "jobs/supervisor.ts", loc: "289 LOC", cov: 0.5 },
        { name: "jobs/document.ts", loc: "211 LOC", cov: 0.4 },
        { name: "jobs/embed.ts", loc: "96 LOC", cov: 0.7 },
      ],
      narration:
        "The Analysis Job is where the magic happens in the background. A LangGraph supervisor coordinates a Gemini sandbox that clones your repo and writes documentation, then Flash generates this very map, text-to-speech pre-renders the narration, and everything gets embedded for retrieval.",
    },
    {
      id: "db",
      label: "Database Layer",
      kind: "layer",
      sub: "Supabase · PostgreSQL",
      icon: "database",
      x: 188,
      y: 500,
      w: 270,
      selectedDefault: true,
      summary:
        'The <b>persistence core</b>, built on <b>Supabase Postgres</b>. Stores projects, the generated diagram, every node record, and analysis job state. Pre-rendered narration MP3s live in a Storage bucket, referenced by <code>audio_url</code> on each node.',
      tech: "PostgreSQL 15",
      children: [
        { name: "schema.sql", type: "file", meta: "8 tables" },
        { name: "client.ts", type: "file", meta: "pooled" },
        { name: "projects", type: "table", meta: "rows · 1.2k" },
        { name: "nodes", type: "table", meta: "rows · 14.8k" },
        { name: "storage/narration", type: "bucket", meta: "342 MP3" },
      ],
      files: [
        { name: "db/schema.sql", loc: "214 LOC", cov: 1.0 },
        { name: "db/client.ts", loc: "73 LOC", cov: 0.9 },
        { name: "db/queries/nodes.ts", loc: "168 LOC", cov: 0.8 },
        { name: "db/migrations/", loc: "11 files", cov: 1.0 },
      ],
      narration:
        "This is the Database Layer — the persistence core of the entire application, built on Supabase Postgres. It holds eight tables: your projects, the generated diagram, and a record for every single node you see on this map. Crucially, the pre-rendered narration audio — the voice you're hearing right now — is stored in a Supabase Storage bucket and linked to each node by its audio URL. That's the secret to the zero-latency playback. The schema is fully migrated and connection pooling keeps reads fast even under load.",
      deps: [
        { from: "API Router", rel: "queries", dir: "in" },
        { from: "Analysis Job", rel: "writes", dir: "in" },
        { from: "Storage", rel: "audio_url", dir: "out" },
      ],
    },
    {
      id: "vector",
      label: "Vector Store",
      kind: "external",
      sub: "Pinecone Index",
      icon: "layers",
      x: 540,
      y: 522,
      w: 224,
      summary:
        'A serverless <b>Pinecone</b> index. Each <code>.md</code> and code chunk is embedded and tagged with <code>{ node_id, file }</code> metadata, powering the ask-the-codebase RAG and letting any answer steer the camera back to its node.',
      tech: "Pinecone",
      files: [
        { name: "vector/index.ts", loc: "84 LOC", cov: 0.8 },
        { name: "vector/query.ts", loc: "119 LOC", cov: 0.6 },
      ],
      narration:
        "The Vector Store is a serverless Pinecone index. Every documentation file and code chunk is embedded and tagged with its node ID. This is what powers ask-the-codebase — and because each chunk remembers which node it belongs to, an answer can steer this camera right back to the relevant box.",
    },
    {
      id: "gemini",
      label: "Gemini Services",
      kind: "external",
      sub: "Flash · TTS · Live",
      icon: "spark",
      x: 838,
      y: 510,
      w: 244,
      summary:
        'Four <b>Gemini</b> surfaces: the managed-agent sandbox that writes docs, <b>3.5 Flash</b> for the map and RAG answers, <b>3.1 Flash TTS</b> for narration, and <b>Flash Live</b> — the voice brain that calls UI functions from your speech.',
      tech: "Gemini API",
      files: [
        { name: "gemini/flash.ts", loc: "142 LOC", cov: 0.7 },
        { name: "gemini/tts.ts", loc: "97 LOC", cov: 0.6 },
        { name: "gemini/live.ts", loc: "188 LOC", cov: 0.5 },
      ],
      narration:
        "Gemini Services is the brain of CodeMap, spanning four surfaces. A managed-agent sandbox writes the documentation, 3.5 Flash generates the map and answers your questions, text-to-speech pre-renders narration, and Flash Live is the voice model that's interpreting your commands and calling these UI functions in real time.",
    },
  ],

  edges: [
    { from: "client", to: "auth", label: "sign in" },
    { from: "client", to: "api", label: "requests" },
    { from: "auth", to: "api", label: "token" },
    { from: "api", to: "db", label: "queries" },
    { from: "api", to: "vector", label: "similarity" },
    { from: "api", to: "gemini", label: "generate" },
    { from: "analysis", to: "db", label: "writes" },
    { from: "analysis", to: "vector", label: "embeds" },
    { from: "analysis", to: "gemini", label: "orchestrates" },
  ],

  kinds: {
    frontend: { label: "Frontend", sw: "#7aa2ff" },
    layer: { label: "App layer", sw: "#3ee0c4" },
    service: { label: "Service", sw: "#c792ea" },
    external: { label: "External", sw: "#ffb86b" },
  },

  // scripted voice interactions for the Command-with-Voice demo
  voiceScript: [
    { query: "How does the database layer work?", node: "db" },
    { query: "Where does the voice audio come from?", node: "db" },
    { query: "Show me the Gemini services", node: "gemini" },
    { query: "Why did it pick Pinecone?", node: "vector" },
    { query: "Take me back to the overview", node: "client" },
  ],

  // terminal log seed + stream
  logSeed: [
    { t: "12:04:01", tag: "system", msg: "Repository <span class='hl'>lumen-labs/atlas-api</span> cloned · 1,284 files" },
    { t: "12:04:09", tag: "agent", msg: "Sandbox up · walking tree · writing <span class='hl'>overview.md</span>" },
    { t: "12:04:22", tag: "agent", msg: "Documented 7 layers → <span class='hl'>db-layer.md</span>, auth.md, api.md …" },
    { t: "12:04:31", tag: "ok", msg: "Gemini 3.5 Flash emitted map · 7 nodes · 9 edges" },
  ],
  logStream: [
    { tag: "tts", msg: "Pre-rendering narration · node <span class='hl'>db-layer</span> → 14.2s mp3" },
    { tag: "vector", msg: "Upserted 312 chunks to Pinecone · metadata { node_id }" },
    { tag: "voice", msg: "Gemini Live socket open · ephemeral token valid 60s" },
    { tag: "ok", msg: "Analysis complete · project status → <span class='hl'>ready</span>" },
    { tag: "voice", msg: "Heard intent · calling <span class='hl'>navigate_to_node()</span>" },
    { tag: "system", msg: "Camera focus → node <span class='hl'>db-layer</span> · playing audio" },
    { tag: "tts", msg: "Streaming narration buffer · 0ms latency (cached)" },
    { tag: "agent", msg: "Watching <span class='hl'>main</span> · no drift since a3f9c2e" },
  ],
};

export default CODEMAP;
