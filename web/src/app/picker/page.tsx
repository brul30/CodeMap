"use client";
/* ============================================================
   CodeMap — repo picker (ported from Get Started.html · Screen 2)
   Fetches the signed-in user's real public repos from GET /api/repos.
   All existing card markup, filter box, selection state, and genbar
   are preserved exactly — only the data source changes.
   ============================================================ */
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";

interface Repo {
  name: string;
  owner: string;
  vis: "public" | "private";
  desc: string;
  lang: string;
  dot: string;
  stars: string;
  forks: string;
  ago: string;
}

const LockIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="5" y="11" width="14" height="9" rx="2" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </svg>
);

export default function PickerPage() {
  const router = useRouter();
  const { isSignedIn, isLoaded } = useAuth();

  const [repos, setRepos] = useState<Repo[]>([]);
  const [fetchState, setFetchState] = useState<"loading" | "ok" | "error">("loading");
  const [fetchError, setFetchError] = useState("");
  const [selected, setSelected] = useState(0);
  const [filter, setFilter] = useState("");

  // Redirect unauthenticated users back to the landing.
  // Log before redirecting so we can distinguish "session never activated"
  // from "user genuinely not signed in" when debugging OAuth failures.
  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      console.warn(
        "[picker] isLoaded=true but isSignedIn=false — session not active. " +
        "Possible causes: (1) OAuth callback did not finalise the session " +
        "(sso-callback page error), (2) Clerk JS not yet propagated the session. " +
        "Redirecting to landing."
      );
      router.replace("/");
    }
  }, [isLoaded, isSignedIn, router]);

  // Fetch the real repo list from our server route on mount.
  useEffect(() => {
    if (!isSignedIn) return;

    let cancelled = false;

    async function fetchRepos() {
      try {
        const res = await fetch("/api/repos");
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          const errMsg = (body as { error?: string }).error ?? `HTTP ${res.status}`;
          // Log status code so 401 (session not seen server-side),
          // 400 (no GitHub token / social connection not enabled in Clerk dashboard),
          // and 502 (GitHub API error) are distinguishable without opening DevTools.
          console.error(`[picker] /api/repos responded HTTP ${res.status}:`, errMsg);
          if (!cancelled) {
            setFetchError(`[${res.status}] ${errMsg}`);
            setFetchState("error");
          }
          return;
        }
        const data: Repo[] = await res.json();
        if (!cancelled) {
          setRepos(data);
          setSelected(0);
          setFetchState("ok");
        }
      } catch (err) {
        if (!cancelled) {
          setFetchError(err instanceof Error ? err.message : "Network error");
          setFetchState("error");
        }
      }
    }

    fetchRepos();
    return () => {
      cancelled = true;
    };
  }, [isSignedIn]);

  const f = filter.trim().toLowerCase();
  const visible = repos
    .map((r, i) => ({ r, i }))
    .filter(
      ({ r }) =>
        !f ||
        r.name.toLowerCase().includes(f) ||
        r.desc.toLowerCase().includes(f) ||
        r.lang.toLowerCase().includes(f),
    );

  const sel = repos[selected];

  const generate = () => {
    if (!sel) return;
    try {
      localStorage.setItem(
        "cm_repo",
        JSON.stringify({ owner: sel.owner, name: sel.name, lang: sel.lang }),
      );
    } catch {
      /* ignore — storage may be blocked */
    }
    // TODO(step2): enqueue analysis job via POST /api/projects before routing
    router.push("/loading");
  };

  return (
    <div className="onb picker screen-in">
      <div className="onb-grid" />
      <div className="onb-glow" />

      <div className="topbar">
        <div className="onb-brand">
          <div className="onb-brand-mark">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M12 2 3 6.5v11L12 22l9-4.5v-11L12 2Z" stroke="#06231a" strokeWidth="1.6" strokeLinejoin="round" />
              <path d="M12 2v20M3 6.5 12 11l9-4.5" stroke="#06231a" strokeWidth="1.3" opacity="0.5" strokeLinejoin="round" />
              <circle cx="12" cy="11" r="2" fill="#06231a" />
            </svg>
          </div>
          <div className="onb-brand-name">CodeMap</div>
        </div>
        <div className="conn-pill">
          <span className="conn-dot" />
          Connected
        </div>
        {/* Avatar placeholder — real user initials could be pulled from useUser() in a later pass */}
        <div className="onb-avatar">GH</div>
      </div>

      <div className="picker-inner">
        <div className="eyebrow">Step 1 · Select a repository</div>
        <h1 className="picker-h1">Your repositories</h1>
        <p className="picker-sub">Pick the codebase you want to map. We&apos;ll analyze structure, not contents.</p>

        <label className="filter">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            placeholder="Filter repositories…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </label>

        {/* ── Loading state ── */}
        {fetchState === "loading" && (
          <div className="repo-grid">
            <p className="picker-sub" style={{ gridColumn: "1/-1", opacity: 0.5 }}>
              Loading your repositories…
            </p>
          </div>
        )}

        {/* ── Error state ── */}
        {fetchState === "error" && (
          <div className="repo-grid">
            <p className="picker-sub" style={{ gridColumn: "1/-1", color: "var(--clr-error, #c94040)" }}>
              Could not load repositories: {fetchError}
            </p>
          </div>
        )}

        {/* ── Empty state (authenticated but no public repos) ── */}
        {fetchState === "ok" && repos.length === 0 && (
          <div className="repo-grid">
            <p className="picker-sub" style={{ gridColumn: "1/-1", opacity: 0.5 }}>
              No public repositories found on your account.
            </p>
          </div>
        )}

        {/* ── Repo grid ── */}
        {fetchState === "ok" && repos.length > 0 && (
          <div className="repo-grid">
            {visible.map(({ r, i }) => (
              <button
                key={r.name}
                className={"repo-card" + (i === selected ? " is-sel" : "")}
                onClick={() => setSelected(i)}
              >
                <div className="rc-top">
                  <span className="rc-name">{r.name}</span>
                  <span className="rc-badge">
                    {r.vis === "private" ? LockIcon : null}
                    {r.vis === "private" ? "Private" : "Public"}
                  </span>
                  <span className="rc-check">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  </span>
                </div>
                <div className="rc-desc">{r.desc}</div>
                <div className="rc-meta">
                  <span className="lang">
                    <i style={{ background: r.dot }} />
                    {r.lang}
                  </span>
                  <span className="m">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M12 2 15 9l7 .5-5.5 4.5L18.5 21 12 17l-6.5 4 2-7L2 9.5 9 9z" />
                    </svg>
                    {r.stars}
                  </span>
                  <span className="m">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <circle cx="6" cy="6" r="2.5" />
                      <circle cx="6" cy="18" r="2.5" />
                      <circle cx="18" cy="8" r="2.5" />
                      <path d="M6 8.5v7M18 10.5c0 3-4 2.5-6 4.5" />
                    </svg>
                    {r.forks}
                  </span>
                  <span className="ago">{r.ago}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="genbar">
        <div className="genbar-inner">
          <div className="gen-sel">
            <span className="p">$</span>Selected{" "}
            <b>
              {sel ? `${sel.owner}/${sel.name}` : "—"}
            </b>
          </div>
          <button className="btn-gen" onClick={generate} disabled={!sel || fetchState !== "ok"}>
            Generate Visual Map
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
