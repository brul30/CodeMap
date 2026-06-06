"use client";
/* ============================================================
   CodeMap — floating voice command bar.

   Audio-agnostic by design (architecture §6.B): one matcher drives navigation
   from THREE inputs, all funneling through onNavigate():
     1. Text box  — type "how does the database work?" (always reliable)
     2. Mic       — real Web Speech recognition; on unsupported/denied/error
                    it falls back to the scripted demo so the stage never dies
     3. Chips     — quick-fill suggestions from the graph's voiceScript
   matchCommand() maps free text → node id; the map page speaks the narration.
   ============================================================ */
import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";
import { matchCommand } from "@/lib/voiceCommand";
import type { CodeMapGraph, VoiceScriptItem } from "@/lib/data";

// deterministic bar heights (no Math.random → no hydration mismatch)
const VB_BARS = Array.from({ length: 16 }, (_, i) => ({
  h: 22 + Math.round(60 * Math.abs(Math.sin(i * 1.7 + 1))),
  delay: ((i * 53) % 9) * 0.07,
}));

type Phase = "idle" | "listening" | "navigating";

// Minimal Web Speech typings (not in lib.dom across all targets).
interface SRResult {
  0: { transcript: string };
  isFinal: boolean;
}
interface SREvent {
  results: ArrayLike<SRResult>;
}
interface SRInstance {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: SREvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}
type SRCtor = new () => SRInstance;

export function VoiceBar({
  data,
  onNavigate,
}: {
  data: CodeMapGraph;
  onNavigate: (nodeId: string, query?: string) => void;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [line, setLine] = useState("");
  const [typed, setTyped] = useState(0);
  const [draft, setDraft] = useState("");

  const cycle = useRef(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const typeTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const recRef = useRef<SRInstance | null>(null);

  const clearAll = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    if (typeTimer.current) clearInterval(typeTimer.current);
    typeTimer.current = null;
    if (recRef.current) {
      try {
        recRef.current.stop();
      } catch {
        /* ignore */
      }
      recRef.current = null;
    }
  }, []);

  useEffect(() => () => clearAll(), [clearAll]);

  const stop = useCallback(() => {
    clearAll();
    setPhase("idle");
    setLine("");
    setTyped(0);
  }, [clearAll]);

  // Scripted query (typing animation) — used by chips and as the mic fallback.
  const runQuery = useCallback(
    (item: VoiceScriptItem) => {
      clearAll();
      setPhase("listening");
      setLine(item.query);
      setTyped(0);
      let i = 0;
      typeTimer.current = setInterval(() => {
        i += 1;
        setTyped(i);
        if (i >= item.query.length) {
          if (typeTimer.current) clearInterval(typeTimer.current);
          typeTimer.current = null;
          timers.current.push(
            setTimeout(() => {
              setPhase("navigating");
              onNavigate(item.node, item.query);
              timers.current.push(setTimeout(stop, 1600));
            }, 400),
          );
        }
      }, 32);
    },
    [clearAll, onNavigate, stop],
  );

  const runScripted = useCallback(() => {
    const item = data.voiceScript[cycle.current % data.voiceScript.length];
    cycle.current += 1;
    if (item) runQuery(item);
  }, [data.voiceScript, runQuery]);

  // Resolve any free-text query (text box OR mic transcript) to a node.
  const resolve = useCallback(
    (raw: string) => {
      const query = raw.trim();
      if (!query) return;
      const r = matchCommand(query, data.nodes);
      setPhase("navigating");
      setLine(query);
      setTyped(query.length);
      if (r.nodeId) {
        onNavigate(r.nodeId, query);
        timers.current.push(setTimeout(stop, 1600));
      } else {
        setLine("Try naming a layer — “database”, “auth”, “API”, “Gemini”…");
        timers.current.push(setTimeout(stop, 2200));
      }
    },
    [data.nodes, onNavigate, stop],
  );

  // Real mic via Web Speech recognition; graceful fallback to the scripted demo.
  const startMic = useCallback(() => {
    const w = window as unknown as { SpeechRecognition?: SRCtor; webkitSpeechRecognition?: SRCtor };
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) {
      runScripted();
      return;
    }
    let rec: SRInstance;
    try {
      rec = new SR();
    } catch {
      runScripted();
      return;
    }
    rec.lang = "en-US";
    rec.interimResults = true;
    rec.continuous = false;
    setPhase("listening");
    setLine("");
    setTyped(0);
    let got = false;
    rec.onresult = (e: SREvent) => {
      const arr = Array.from(e.results);
      const txt = arr.map((r) => r[0].transcript).join("");
      setLine(txt);
      setTyped(txt.length);
      const last = arr[arr.length - 1];
      if (last && last.isFinal) {
        got = true;
        resolve(txt);
      }
    };
    rec.onerror = () => {
      if (!got) runScripted();
    };
    rec.onend = () => {
      if (!got && !timers.current.length) stop();
    };
    try {
      rec.start();
      recRef.current = rec;
    } catch {
      runScripted();
    }
  }, [resolve, runScripted, stop]);

  const onMic = () => {
    if (phase !== "idle") {
      stop();
      return;
    }
    startMic();
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim()) return;
    const q = draft;
    setDraft("");
    resolve(q);
  };

  const live = phase !== "idle";
  const said = line.slice(0, typed);
  const stateText =
    phase === "navigating"
      ? "CodeMap · navigating"
      : phase === "listening"
        ? "CodeMap · listening"
        : "CodeMap · ask anything";

  return (
    <div className="voicebar-anchor">
      <div
        className="voice-suggest"
        style={{ opacity: live ? 0 : 1, transform: live ? "translateY(6px)" : "none" }}
      >
        {data.voiceScript.slice(0, 3).map((v) => (
          <button key={v.query} className="vchip" onClick={() => runQuery(v)} disabled={live}>
            {v.query}
          </button>
        ))}
      </div>

      <div className={"voicebar" + (live ? " live" : "")}>
        <button className={"mic" + (live ? " on" : "")} onClick={onMic} title="Voice command (speak)">
          <Icon n="mic" />
        </button>

        <div className="vb-status">
          <div className={"vb-state" + (live ? " on" : "")}>
            <span className="ring" />
            {stateText}
          </div>
          {phase === "idle" ? (
            <form onSubmit={onSubmit} style={{ display: "flex", width: "100%" }}>
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Ask CodeMap anything — or tap the mic…"
                aria-label="Ask CodeMap"
                style={{
                  flex: 1,
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  color: "inherit",
                  font: "inherit",
                  padding: 0,
                }}
              />
            </form>
          ) : (
            <div className="vb-line">
              “<span className="said">{said}</span>
              {said.length < line.length ? "" : "”"}
              {phase === "listening" && <span className="cursor" />}
            </div>
          )}
        </div>

        <div className="vb-wave">
          {VB_BARS.map((b, i) => (
            <i key={i} style={{ height: `${b.h}%`, animationDelay: `${b.delay}s` }} />
          ))}
        </div>

        <button className="vb-x" onClick={stop} title="Reset">
          <Icon n="x" />
        </button>
      </div>
    </div>
  );
}

export default VoiceBar;
