"use client";
/* ============================================================
   CodeMap — landing (ported from componentsUI/Get Started.html · Screen 1)
   Paste a public GitHub repo URL → parse owner/name → /loading runs the
   live Gemini analysis (POST /api/analyze) and hands off to /map. No auth.
   ============================================================ */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const BRAND_MARK = (
  <svg viewBox="0 0 24 24" fill="none">
    <path d="M12 2 3 6.5v11L12 22l9-4.5v-11L12 2Z" stroke="#06231a" strokeWidth="1.6" strokeLinejoin="round" />
    <path d="M12 2v20M3 6.5 12 11l9-4.5" stroke="#06231a" strokeWidth="1.3" opacity="0.5" strokeLinejoin="round" />
    <circle cx="12" cy="11" r="2" fill="#06231a" />
  </svg>
);

const MNODES = [
  { i: 0, label: "Client", left: 198, top: 56 },
  { i: 3, label: "Auth", left: 78, top: 232 },
  { i: 1, label: "API", left: 228, top: 232 },
  { i: 4, label: "Workers", left: 352, top: 232 },
  { i: 2, label: "Database", left: 170, top: 420 },
  { i: 5, label: "Vector", left: 332, top: 420 },
];
const BASE_ON = new Set([0, 1, 2]);
const WIRES = [
  "M280,86 C 210,150 170,180 150,232",
  "M280,86 C 280,150 280,180 280,232",
  "M280,86 C 350,150 390,180 410,232",
  "M150,292 C 175,350 220,380 250,420",
  "M280,292 C 300,350 350,380 390,420",
];

export default function LandingPage() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [litExtra, setLitExtra] = useState<number | null>(null);

  // ambient mini-map: briefly light a neutral node for life
  useEffect(() => {
    const neutral = [3, 4, 5];
    let t = 0;
    let clearTimer: ReturnType<typeof setTimeout>;
    const id = setInterval(() => {
      const pick = neutral[t % neutral.length];
      t += 1;
      setLitExtra(pick);
      clearTimer = setTimeout(() => setLitExtra(null), 1400);
    }, 2600);
    return () => {
      clearInterval(id);
      clearTimeout(clearTimer);
    };
  }, []);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    // Accept https://github.com/owner/repo, git@github.com:owner/repo, or owner/repo
    const m =
      url.trim().match(/github\.com[/:]([^/\s]+)\/([^/\s#?]+?)(?:\.git)?(?:[/#?].*)?$/i) ||
      url.trim().match(/^([\w.-]+)\/([\w.-]+)$/);
    if (!m) {
      setError("Paste a public GitHub repo URL — e.g. https://github.com/owner/repo");
      return;
    }
    const owner = m[1];
    const name = m[2];
    setError("");
    setLoading(true);
    try {
      localStorage.setItem("cm_repo", JSON.stringify({ owner, name }));
    } catch {
      /* ignore */
    }
    router.push("/loading");
  };

  return (
    <div className="onb landing screen-in">
      <div className="onb-grid" />
      <div className="onb-glow" />

      <div className="land-left">
        <div className="onb-brand land-brand">
          <div className="onb-brand-mark">{BRAND_MARK}</div>
          <div className="onb-brand-name">CodeMap</div>
        </div>

        <h1 className="land-hero">
          See your
          <br />
          codebase
          <br />
          <span className="dim">before you read it.</span>
        </h1>
        <p className="land-sub">
          Paste any public GitHub repo and CodeMap reverse-engineers a live architecture map — then walks you through it
          with an AI audio tour.
        </p>

        <form className="cta-row" onSubmit={submit} style={{ flexDirection: "column", alignItems: "stretch", gap: 10 }}>
          <div style={{ display: "flex", gap: 10, width: "100%", maxWidth: 460 }}>
            <input
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                if (error) setError("");
              }}
              placeholder="https://github.com/owner/repo"
              aria-label="Public GitHub repo URL"
              autoFocus
              style={{
                flex: 1,
                padding: "12px 14px",
                borderRadius: 10,
                border: "1px solid var(--border-2, rgba(255,255,255,0.14))",
                background: "rgba(255,255,255,0.04)",
                color: "inherit",
                font: "inherit",
                outline: "none",
              }}
            />
            <button type="submit" className={"btn-gh" + (loading ? " loading" : "")}>
              <span className="gh-tx">{loading ? "Mapping…" : "Map it"}</span>
              <span className="spinner" />
            </button>
          </div>
          {error && (
            <span style={{ color: "var(--rose, #F2789A)", fontSize: 13 }}>{error}</span>
          )}
        </form>

        <div className="land-foot">
          <span>Public repos · read-only · powered by Gemini</span>
        </div>
      </div>

      <div className="land-right">
        <div className="mini">
          <svg className="wires" viewBox="0 0 560 520">
            {WIRES.map((d, i) => (
              <path key={i} className="wire flow" d={d} />
            ))}
          </svg>
          {MNODES.map((n) => {
            const on = BASE_ON.has(n.i) || litExtra === n.i;
            return (
              <div
                key={n.i}
                className={"mnode" + (on ? " on" : "")}
                style={{ left: n.left, top: n.top }}
              >
                {n.label}
                {on && <span className="blip" />}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
