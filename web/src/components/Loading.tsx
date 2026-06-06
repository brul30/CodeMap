"use client";
/* ============================================================
   CodeMap — analysis / loading screen (ported from Get Started.html · Screen 3)
   Scripted progress for now. Step 3-wire: drive `idx`/`stat` off the
   Supabase realtime subscription on projects.status instead of a timer,
   and navigate to /map when status flips to `ready`.
   ============================================================ */
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const STEPS = [
  "Cloning repository",
  "Resolving dependency graph",
  "Parsing 2,418 files across 6 layers",
  "Detecting service boundaries",
  "Building architecture map",
  "Pre-rendering Gemini audio guides",
  "Finalizing",
];
const STATS = [
  "Cloning…",
  "Resolving deps…",
  "Parsing source…",
  "Mapping services…",
  "Drawing graph…",
  "Rendering audio…",
  "Almost there…",
];

const CheckIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

export function Loading() {
  const router = useRouter();
  const [idx, setIdx] = useState(0);
  const [repoLabel, setRepoLabel] = useState("northwind/atlas-platform");
  // tracks the live /api/analyze call: "pending" | "done" (graph stored) | "failed"
  const analyzeRef = useRef<"pending" | "done" | "failed">("pending");

  useEffect(() => {
    try {
      const raw = localStorage.getItem("cm_repo");
      if (raw) {
        const r = JSON.parse(raw);
        if (r && r.owner && r.name) setRepoLabel(`${r.owner}/${r.name}`);
      }
    } catch {
      /* ignore */
    }
  }, []);

  // Kick off the REAL analysis in the background. The animated steps below run
  // independently; navigation waits until this resolves (or fails) so we never
  // route to /map before the graph is ready. On any failure we mark "failed"
  // and let /map fall back to precached → seed (never dead-end).
  useEffect(() => {
    let cancelled = false;

    async function run() {
      let owner = "";
      let name = "";
      try {
        const raw = localStorage.getItem("cm_repo");
        if (raw) {
          const r = JSON.parse(raw);
          owner = r?.owner ?? "";
          name = r?.name ?? "";
        }
      } catch {
        /* ignore */
      }

      if (!owner || !name) {
        analyzeRef.current = "failed";
        return;
      }

      try {
        const res = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ owner, name }),
        });
        if (!res.ok) throw new Error(`analyze HTTP ${res.status}`);
        const graph = await res.json();
        if (cancelled) return;
        try {
          sessionStorage.setItem("cm_graph", JSON.stringify(graph));
          analyzeRef.current = "done";
        } catch {
          // storage blocked → treat as failure so /map uses the fallback
          analyzeRef.current = "failed";
        }
      } catch {
        if (!cancelled) analyzeRef.current = "failed";
      }
    }

    // make sure a stale graph from a previous run doesn't leak in
    try {
      sessionStorage.removeItem("cm_graph");
    } catch {
      /* ignore */
    }
    run();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (idx >= STEPS.length) {
      // Steps finished animating. Wait for the live analysis to settle before
      // navigating; poll lightly so we don't route on a half-loaded graph.
      let tries = 0;
      const MAX_TRIES = 90; // ~45s safety cap, then fall back regardless
      let timer = 0;
      const tick = () => {
        if (analyzeRef.current !== "pending" || tries >= MAX_TRIES) {
          router.push("/map");
          return;
        }
        tries += 1;
        timer = window.setTimeout(tick, 500);
      };
      timer = window.setTimeout(tick, 500);
      return () => clearTimeout(timer);
    }
    const t = setTimeout(() => setIdx((i) => i + 1), 460 + Math.random() * 340);
    return () => clearTimeout(t);
  }, [idx, router]);

  const finished = idx >= STEPS.length;
  const pct = finished ? 100 : Math.round(((idx + 1) / STEPS.length) * 100);
  const stat = finished ? "Map ready" : STATS[idx];

  return (
    <div className="onb loading screen-in">
      <div className="onb-grid" />
      <div className="onb-glow" />

      <div className="load-card">
        <div className="load-orbit">
          <div className="ring" />
          <div className="ring r2" />
          <div className="ring r3" />
          <div className="arc" />
          <div className="arc a2" />
          <div className="core">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M12 2 3 6.5v11L12 22l9-4.5v-11L12 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
              <circle cx="12" cy="11" r="2.1" fill="currentColor" />
            </svg>
          </div>
        </div>

        <div className="load-eyebrow">Step 2 · Building your map</div>
        <h2 className="load-title">
          Reverse-engineering <b>the architecture</b>
        </h2>
        <div className="load-repo">{repoLabel}</div>

        <div className="load-bar">
          <i style={{ width: `${pct}%` }} />
        </div>
        <div className="load-pct">
          <span>{stat}</span>
          <span>{pct}%</span>
        </div>

        <div className="load-steps">
          {STEPS.map((label, j) => {
            const cls = j < idx ? "done" : j === idx ? "run" : "pending";
            return (
              <div className={"lstep " + cls} key={j}>
                <span className="ic">
                  <span className="sp" />
                  <span className="ck">{CheckIcon}</span>
                </span>
                <span className="tx">{label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default Loading;
