"use client";
/* ============================================================
   CodeMap — Agent Insights sidebar (the right "Inspector" panel)

   styles.css ships the full design for this (.side / .tour / .deps …) but
   the JSX was never written — only the behavior existed in CodeMap.html's
   inline <script>. Ported here against the data.js contract.

   The Voice Tour widget fakes pre-rendered TTS playback (timed transcript
   reveal). Step 3-wire: point it at node.audio_url (an <audio> element) so
   click = real zero-latency narration. Hook left in place via `narration`.
   ============================================================ */
import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "./Icon";
import type { CodeMapGraph, GraphNode, NodeDep } from "@/lib/data";

function fmt(s: number) {
  return Math.floor(s / 60) + ":" + String(Math.floor(s % 60)).padStart(2, "0");
}

// deterministic waveform geometry (no Math.random → no hydration mismatch)
const WAVE_BARS = Array.from({ length: 30 }, (_, i) => ({
  h: 28 + Math.round(60 * Math.abs(Math.sin(i * 1.37 + 0.6))),
  delay: ((i * 97) % 11) * 0.08,
}));

function deriveDeps(data: CodeMapGraph, node: GraphNode): NodeDep[] {
  if (node.deps && node.deps.length) return node.deps;
  const byId = (id: string) => data.nodes.find((n) => n.id === id)?.label ?? id;
  const out: NodeDep[] = [];
  data.edges.forEach((e) => {
    if (e.from === node.id) out.push({ from: byId(e.to), rel: e.label, dir: "out" });
    else if (e.to === node.id) out.push({ from: byId(e.from), rel: e.label, dir: "in" });
  });
  return out;
}

export function Sidebar({
  data,
  node,
  onAskAbout,
}: {
  data: CodeMapGraph;
  node: GraphNode;
  onAskAbout?: (node: GraphNode) => void;
}) {
  const kind = data.kinds[node.kind];
  const deps = useMemo(() => deriveDeps(data, node), [data, node]);

  // ---- voice tour (faux TTS playback) ----
  const total = useMemo(() => {
    const words = node.narration.trim().split(/\s+/).length;
    return Math.max(8, Math.round(words / 2.8));
  }, [node.narration]);

  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const transcriptRef = useRef<HTMLDivElement>(null);

  // reset when the selected node changes
  useEffect(() => {
    setPlaying(false);
    setElapsed(0);
  }, [node.id]);

  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => {
      setElapsed((e) => {
        if (e + 1 >= total) {
          setPlaying(false);
          return total;
        }
        return e + 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [playing, total]);

  // keep the spoken text in view as it reveals
  useEffect(() => {
    if (transcriptRef.current) transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
  }, [elapsed]);

  const spokenChars = Math.round(node.narration.length * (total ? elapsed / total : 0));
  const said = node.narration.slice(0, spokenChars);
  const rest = node.narration.slice(spokenChars);

  const replay = () => {
    setElapsed(0);
    setPlaying(true);
  };

  return (
    <aside className="side">
      <div className="side-scroll">
        <div className="side-pad">
          <div className="side-eyebrow">
            <span className="dot-live" />
            Agent Insights
          </div>

          <div className="side-title">
            <span className="ti">
              <Icon n={node.icon} />
            </span>
            {node.label}
          </div>
          <div className="side-sub">{node.sub}</div>

          <div className="chips">
            <span className="chip">
              <span className="sw" style={{ background: kind.sw }} />
              {kind.label}
            </span>
            <span className="chip">
              <b>{node.tech}</b>
            </span>
            <span className="chip">
              <span className="sw" style={{ background: "var(--acc)" }} />
              synced
            </span>
          </div>

          {/* ---- Summary ---- */}
          <div className="sec">
            <div className="sec-h">
              <Icon n="info" />
              Summary
            </div>
            <p className="summary" dangerouslySetInnerHTML={{ __html: node.summary }} />
          </div>

          {/* ---- Voice Tour ---- */}
          <div className="sec">
            <div className="sec-h">
              <Icon n="wave" />
              Voice Tour
            </div>
            <div className={"tour" + (playing ? " playing" : "")}>
              <div className="tour-top">
                <button className="tour-play" onClick={() => setPlaying((p) => !p)} title={playing ? "Pause" : "Play"}>
                  <Icon n={playing ? "pause" : "play"} />
                </button>
                <div className="tour-info">
                  <div className="tour-label">Gemini TTS · Aria</div>
                  <div className="tour-name">{node.label} — guided walkthrough</div>
                  <div className="tour-time">
                    {fmt(elapsed)} / {fmt(total)}
                  </div>
                </div>
                <div className="wave">
                  {WAVE_BARS.map((b, i) => (
                    <i key={i} style={{ height: `${b.h}%`, animationDelay: `${b.delay}s` }} />
                  ))}
                </div>
              </div>

              <div className="tour-transcript">
                <div className="transcript-h">
                  <Icon n="quote" style={{ width: 11, height: 11 }} />
                  Transcript
                </div>
                <div className="transcript-body" ref={transcriptRef}>
                  <span className="said">{said}</span>
                  {rest}
                  {playing && <span className="cursor" />}
                </div>
              </div>

              <div className="tour-actions">
                <button className="tour-act" onClick={replay}>
                  <Icon n="replay" />
                  Replay
                </button>
                <button className="tour-act" onClick={() => onAskAbout?.(node)}>
                  <Icon n="message" />
                  Ask about this
                </button>
              </div>
            </div>
          </div>

          {/* ---- Files ---- */}
          <div className="sec">
            <div className="sec-h">
              <Icon n="folder" />
              Files
              <span className="count">{node.files.length} files</span>
            </div>
            <div className="files">
              {node.files.map((f, i) => (
                <div className="file" key={i}>
                  <Icon n={f.name.endsWith("/") ? "folder" : "file"} className="file-ico" />
                  <span className="file-name">{f.name}</span>
                  <span className="file-loc">{f.loc}</span>
                  <span className="file-bar">
                    <i style={{ width: `${Math.round(f.cov * 100)}%` }} />
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* ---- Connections ---- */}
          {deps.length > 0 && (
            <div className="sec">
              <div className="sec-h">
                <Icon n="link" />
                Connections
                <span className="count">{deps.length}</span>
              </div>
              <div className="deps">
                {deps.map((d, i) => (
                  <div className="dep" key={i}>
                    <span className="dep-arrow">{d.dir === "in" ? "←" : "→"}</span>
                    <b>{d.from}</b>
                    <span className="dep-pill">{d.rel}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;
