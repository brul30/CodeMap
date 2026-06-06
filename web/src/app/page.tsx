"use client";
/* ============================================================
   CodeMap — landing (ported from componentsUI/Get Started.html · Screen 1)
   "Connect GitHub" triggers Clerk GitHub OAuth via the v7 useSignIn API.
   Clerk v7 changed useSignIn() return type to SignInSignalValue (no isLoaded);
   OAuth is initiated via signIn.sso({ strategy, redirectUrl, redirectCallbackUrl }).
   ============================================================ */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSignIn, useAuth } from "@clerk/nextjs";

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
  const { isSignedIn } = useAuth();
  // Clerk v7: useSignIn() returns SignInSignalValue — no isLoaded discriminant.
  // signIn is always a SignInFutureResource (never undefined).
  const { signIn } = useSignIn();
  const [loading, setLoading] = useState(false);
  const [litExtra, setLitExtra] = useState<number | null>(null);

  // If already authenticated, skip the landing and go straight to the picker.
  useEffect(() => {
    if (isSignedIn) {
      router.replace("/picker");
    }
  }, [isSignedIn, router]);

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

  const connect = async () => {
    setLoading(true);
    try {
      // Clerk v7 SSO API: signIn.sso() initiates the OAuth redirect.
      // redirectUrl      = the intermediate page Clerk calls on return from GitHub.
      // redirectCallbackUrl = final destination after Clerk finalises the session.
      await signIn.sso({
        strategy: "oauth_github",        // OAuthStrategy — must use 'oauth_' prefix here
        redirectUrl: "/sso-callback",    // our /sso-callback page calls handleRedirectCallback
        redirectCallbackUrl: "/picker",  // where Clerk lands the user after auth completes
      });
    } catch {
      // OAuth redirect failed (e.g. popup blocked, GitHub connection not enabled
      // in Clerk dashboard). Reset loading so the user can retry.
      setLoading(false);
    }
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
          Connect a repository and CodeMap reverse-engineers a live architecture map — then walks you through it with an
          AI audio tour.
        </p>

        <div className="cta-row">
          <button className={"btn-gh" + (loading ? " loading" : "")} onClick={connect}>
            <span className="gh-ic">
              <svg viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
              </svg>
            </span>
            <span className="gh-tx">Connect GitHub</span>
            <span className="spinner" />
          </button>
        </div>

        <div className="land-foot">
          <span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="5" y="11" width="14" height="9" rx="2" />
              <path d="M8 11V8a4 4 0 0 1 8 0v3" />
            </svg>
            Secured by Clerk
          </span>
          <span className="sep" />
          <span>Read-only access</span>
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
