"use client";
/* ============================================================
   CodeMap — full app shell (the "Tour Guide" screen).

   Orchestrates the bespoke canvas + insights + terminal + voice bar.
   Renders purely from lib/data.ts (the locked CODEMAP seed) for now.
   Step 3-wire: replace the CODEMAP import with a Supabase fetch +
   realtime subscription on projects.status / projects.graph. The single
   `graph` object flows down unchanged, so only the source swaps.
   ============================================================ */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Header, type RepoMeta } from "@/components/Header";
import { Canvas, type CameraTarget } from "@/components/Canvas";
import { Terminal } from "@/components/Terminal";
import { Sidebar } from "@/components/Sidebar";
import { VoiceBar } from "@/components/VoiceBar";
import { CODEMAP, type CodeMapGraph, type GraphNode, type LogLine } from "@/lib/data";
import { PRECACHED } from "@/lib/precached";
import { codeMapGraphSchema } from "@/lib/codemap-schema";
import { useNarration } from "@/lib/useNarration";

const MAX_LOGS = 40;

/**
 * Resolve the graph to render, in priority order:
 *   1. sessionStorage 'cm_graph' — the live Gemini result for the chosen repo
 *      (set by the loading screen). Re-validated here so a corrupt blob can't
 *      crash the canvas.
 *   2. PRECACHED — a real Gemini-generated graph baked at build time (guarantees
 *      a working demo even if live generation failed).
 *   3. CODEMAP seed — the design's placeholder.
 */
function resolveGraph(): CodeMapGraph {
  if (typeof window !== "undefined") {
    try {
      const raw = sessionStorage.getItem("cm_graph");
      if (raw) {
        const parsed = codeMapGraphSchema.safeParse(JSON.parse(raw));
        if (parsed.success) return parsed.data as CodeMapGraph;
      }
    } catch {
      /* ignore — fall through to precached/seed */
    }
  }
  if (PRECACHED) return PRECACHED;
  return CODEMAP;
}

function nowts() {
  const d = new Date();
  return (
    String(d.getHours()).padStart(2, "0") +
    ":" +
    String(d.getMinutes()).padStart(2, "0") +
    ":" +
    String(d.getSeconds()).padStart(2, "0")
  );
}

export default function MapPage() {
  // SSR-stable initial graph (precached → seed); the live sessionStorage graph
  // is swapped in after mount to avoid a hydration mismatch.
  const initialGraph = PRECACHED ?? CODEMAP;
  const [data, setData] = useState<CodeMapGraph>(initialGraph);

  const defaultId = useMemo(
    () => data.nodes.find((n) => n.selectedDefault)?.id ?? data.nodes[0]?.id ?? null,
    [data.nodes],
  );

  const [selectedId, setSelectedId] = useState<string | null>(defaultId);
  const [cameraTarget, setCameraTarget] = useState<CameraTarget | null>(null);
  const [logs, setLogs] = useState<LogLine[]>(data.logSeed);
  const [termOpen, setTermOpen] = useState(true);
  const [repo, setRepo] = useState<RepoMeta>(data.repo);
  const nonce = useRef(0);
  const { narrate } = useNarration(); // pre-rendered Gemini TTS per node (Web Speech fallback)

  // After mount, prefer the live Gemini graph from the loading screen.
  useEffect(() => {
    const resolved = resolveGraph();
    if (resolved !== data) {
      setData(resolved);
      const def = resolved.nodes.find((n) => n.selectedDefault)?.id ?? resolved.nodes[0]?.id ?? null;
      setSelectedId(def);
      setLogs(resolved.logSeed);
      setRepo(resolved.repo);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedNode: GraphNode | undefined =
    data.nodes.find((n) => n.id === selectedId) ?? data.nodes[0];

  const pushLog = useCallback((tag: LogLine["tag"], msg: string) => {
    setLogs((prev) => {
      const next = [...prev, { t: nowts(), tag, msg }];
      return next.length > MAX_LOGS ? next.slice(next.length - MAX_LOGS) : next;
    });
  }, []);

  const focus = useCallback(
    (id: string) => {
      nonce.current += 1;
      setSelectedId(id);
      setCameraTarget({ id, nonce: nonce.current });
      // The tour guide speaks: pre-rendered Gemini TTS for this node (click OR voice).
      const node = data.nodes.find((n) => n.id === id);
      narrate(id, node?.narration ?? "");
    },
    [data.nodes, narrate],
  );

  // node click → select + center + expand
  const onSelect = useCallback(
    (id: string) => {
      focus(id);
      const label = data.nodes.find((n) => n.id === id)?.label ?? id;
      pushLog("system", `Camera focus → node <span class='hl'>${id}</span> · ${label}`);
    },
    [data.nodes, focus, pushLog],
  );

  // voice/text command → same navigation path
  const onNavigate = useCallback(
    (id: string, query?: string) => {
      if (query) pushLog("voice", `Heard “${query}” → calling <span class='hl'>navigate_to_node(${id})</span>`);
      focus(id);
    },
    [focus, pushLog],
  );

  const onAskAbout = useCallback(
    (node: GraphNode) => {
      pushLog("voice", `<span class='hl'>ask_codebase()</span> · grounding on ${node.label}`);
      focus(node.id);
    },
    [focus, pushLog],
  );

  // If we fell back to the precached/seed graph (no live result), at least show
  // the repo the user picked. When a live graph loaded, its repo is authoritative
  // and we leave it alone.
  useEffect(() => {
    try {
      const hasLive = sessionStorage.getItem("cm_graph");
      if (hasLive) return;
      const raw = localStorage.getItem("cm_repo");
      if (raw) {
        const r = JSON.parse(raw);
        if (r && r.owner && r.name) {
          setRepo((prev) => ({ ...prev, owner: r.owner, name: r.name }));
        }
      }
    } catch {
      /* ignore */
    }
  }, []);

  // ambient agent log stream (mimics the worker emitting status via realtime)
  useEffect(() => {
    let i = 0;
    const t = setInterval(() => {
      const line = data.logStream[i % data.logStream.length];
      i += 1;
      pushLog(line.tag, line.msg);
    }, 4200);
    return () => clearInterval(t);
  }, [data.logStream, pushLog]);

  return (
    <div className="app">
      <Header repo={repo} />
      <div className="body">
        <Canvas data={data} selectedId={selectedId} onSelect={onSelect} cameraTarget={cameraTarget} />
        {selectedNode && <Sidebar data={data} node={selectedNode} onAskAbout={onAskAbout} />}

        <Terminal
          logs={logs}
          open={termOpen}
          onToggle={() => setTermOpen((o) => !o)}
          ready
          nodeCount={data.nodes.length}
        />
        <VoiceBar data={data} onNavigate={onNavigate} />
      </div>
    </div>
  );
}
