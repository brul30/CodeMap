/* ============================================================
   voiceCommand — pure matcher that maps a free-text command
   ("how does the database work?") to a node id + intent.
   Audio-agnostic: the text box AND the mic both feed this.
   Deterministic + dependency-free so it's reliable on stage.
   ============================================================ */

export interface MatchNode {
  id: string;
  label: string;
  sub?: string;
  kind?: string;
  summary?: string;
}

export interface VoiceResult {
  intent: "navigate" | "reset" | "unknown";
  nodeId?: string;
}

// Concept → regex over the query, plus the keyword we expect in the node.
const SYNONYMS: { key: string; re: RegExp }[] = [
  { key: "database", re: /\b(database|db|data layer|postgres|sql|storage|persistence|tables?|supabase)\b/ },
  { key: "auth", re: /\b(auth|login|sign[- ]?in|identity|clerk|oauth|security|gateway)\b/ },
  { key: "api", re: /\b(api|route|router|endpoint|backend|server)\b/ },
  { key: "frontend", re: /\b(frontend|front end|client|ui|interface|browser|react|next)\b/ },
  { key: "vector", re: /\b(vector|pinecone|embedding|rag|retrieval|semantic|search)\b/ },
  { key: "gemini", re: /\b(gemini|ai|llm|model|flash|tts|narration)\b/ },
  { key: "analysis", re: /\b(analysis|worker|job|pipeline|orchestrat|langgraph|agent|sandbox)\b/ },
];

const RESET_RE = /\b(overview|reset|start over|home|whole thing|everything|zoom out|big picture|the map)\b/i;

export function matchCommand(query: string, nodes: MatchNode[]): VoiceResult {
  const q = query.toLowerCase().trim();
  if (!q || nodes.length === 0) return { intent: "unknown" };

  // "take me back to the overview" — only if it's not actually asking for a layer
  if (RESET_RE.test(q) && !SYNONYMS.some((s) => s.re.test(q))) {
    return { intent: "reset", nodeId: nodes[0]?.id };
  }

  let best: { id: string; score: number } | null = null;
  for (const n of nodes) {
    const hay = `${n.id} ${n.label} ${n.sub ?? ""} ${n.kind ?? ""}`.toLowerCase();
    let score = 0;

    // direct label-word hits (strongest signal)
    for (const word of n.label.toLowerCase().split(/\s+/)) {
      if (word.length > 2 && q.includes(word)) score += 3;
    }
    // concept/synonym matches: query mentions a concept AND the node embodies it
    for (const { key, re } of SYNONYMS) {
      if (re.test(q) && (hay.includes(key) || re.test(hay))) score += 4;
    }
    // loose sub/kind word overlap
    for (const word of `${n.sub ?? ""} ${n.kind ?? ""}`.toLowerCase().split(/\s+/)) {
      if (word.length > 3 && q.includes(word)) score += 1;
    }

    if (!best || score > best.score) best = { id: n.id, score };
  }

  if (best && best.score >= 3) return { intent: "navigate", nodeId: best.id };
  return { intent: "unknown" };
}
