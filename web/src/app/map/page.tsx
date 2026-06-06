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
import { codeMapGraphSchema } from "@/lib/codemap-schema";
import { useNarration } from "@/lib/useNarration";

/**
 * Resolve the graph to render:
 *   1. sessionStorage 'cm_graph' — the live Gemini result for the CHOSEN repo
 *      (set by the loading screen), re-validated so a corrupt blob can't crash.
 *   2. CODEMAP seed — neutral placeholder only when /map is opened directly
 *      with no analysis (never another repo's data).
 * Each analyzed repo is independent: the loading screen clears cm_graph before
 * every run, so one repo's map can never leak into the next.
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
      /* ignore — fall through to seed */
    }
  }
  return CODEMAP;
}

export default function MapPage() {
  // SSR-stable initial graph (neutral seed); the live sessionStorage graph for
  // the chosen repo is swapped in after mount to avoid a hydration mismatch.
  const [data, setData] = useState<CodeMapGraph>(CODEMAP);

  const defaultId = useMemo(
    () => data.nodes.find((n) => n.selectedDefault)?.id ?? data.nodes[0]?.id ?? null,
    [data.nodes],
  );

  const [selectedId, setSelectedId] = useState<string | null>(defaultId);
  const [cameraTarget, setCameraTarget] = useState<CameraTarget | null>(null);
  const [repo, setRepo] = useState<RepoMeta>(data.repo);
  const nonce = useRef(0);
  // background-prefetch this graph's node narration so clicks fire instantly
  const { narrate } = useNarration(
    data.nodes.map((n) => ({ id: n.id, narration: n.narration })),
  );

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
