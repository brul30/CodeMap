"use client";
/* ============================================================
   CodeMap — full app shell (the "Tour Guide" screen).

   Orchestrates the bespoke canvas + insights + voice bar. Renders the
   graph resolved from: live Gemini result (sessionStorage) → precached → seed.
   ============================================================ */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Header, type RepoMeta } from "@/components/Header";
import { Canvas, type CameraTarget } from "@/components/Canvas";
import { Sidebar } from "@/components/Sidebar";
import { VoiceBar } from "@/components/VoiceBar";
import { CODEMAP, type CodeMapGraph, type GraphNode } from "@/lib/data";
import { PRECACHED } from "@/lib/precached";
import { codeMapGraphSchema } from "@/lib/codemap-schema";
import { useNarration } from "@/lib/useNarration";

/**
 * Resolve the graph to render, in priority order:
 *   1. sessionStorage 'cm_graph' — the live Gemini result for the chosen repo
 *      (set by the loading screen). Re-validated so a corrupt blob can't crash.
 *   2. PRECACHED — a real Gemini-generated graph baked in (guarantees a demo).
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
  const [repo, setRepo] = useState<RepoMeta>(data.repo);
  const nonce = useRef(0);
  // preload this graph's node audio so clicks fire instantly
  const { narrate } = useNarration(data.nodes.map((n) => n.id));

  // After mount, prefer the live Gemini graph from the loading screen.
  useEffect(() => {
    const resolved = resolveGraph();
    if (resolved !== data) {
      setData(resolved);
      const def = resolved.nodes.find((n) => n.selectedDefault)?.id ?? resolved.nodes[0]?.id ?? null;
      setSelectedId(def);
      setRepo(resolved.repo);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedNode: GraphNode | undefined =
    data.nodes.find((n) => n.id === selectedId) ?? data.nodes[0];

  // select + center + expand + speak — shared by click, voice, and text commands.
  const focus = useCallback(
    (id: string) => {
      nonce.current += 1;
      setSelectedId(id);
      setCameraTarget({ id, nonce: nonce.current });
      const node = data.nodes.find((n) => n.id === id);
      narrate(id, node?.narration ?? "");
    },
    [data.nodes, narrate],
  );

  const onAskAbout = useCallback((node: GraphNode) => focus(node.id), [focus]);

  // If we fell back to the precached/seed graph (no live result), at least show
  // the repo the user picked. A live graph's repo is authoritative — leave it.
  useEffect(() => {
    try {
      if (sessionStorage.getItem("cm_graph")) return;
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

  return (
    <div className="app">
      <Header repo={repo} />
      <div className="body">
        <Canvas data={data} selectedId={selectedId} onSelect={focus} cameraTarget={cameraTarget} />
        {selectedNode && <Sidebar data={data} node={selectedNode} onAskAbout={onAskAbout} />}
        <VoiceBar data={data} onNavigate={focus} />
      </div>
    </div>
  );
}
