"use client";
/**
 * /sso-callback — Clerk v7 OAuth round-trip landing page.
 *
 * Uses <AuthenticateWithRedirectCallback> (the component-based v7 API that is
 * actually exported at runtime) instead of calling handleRedirectCallback() in
 * a useEffect.
 *
 * Why this matters for new users (sign-up path):
 *   handleRedirectCallback() in a useEffect fires asynchronously and may
 *   resolve before ClerkProvider has propagated the newly created session to
 *   useAuth().  The result is isSignedIn stays false on /picker, which bounces
 *   the user back to landing.  The <AuthenticateWithRedirectCallback> component
 *   integrates directly with ClerkProvider's internal state machine and only
 *   navigates once the session is genuinely active, fixing the bounce for
 *   first-time OAuth users (sign-up transfer path).
 *
 * Export evidence (installed runtime, not just .d.ts):
 *   node_modules/@clerk/nextjs/dist/esm/index.js line 63 —
 *     export { AuthenticateWithRedirectCallback, ... }
 *
 * Type evidence (from @clerk/react/dist/useAuth-DFYP0feq.d.ts):
 *   declare const AuthenticateWithRedirectCallback: {
 *     (props: Without<WithClerkProp<HandleOAuthCallbackParams>, "clerk">): JSX.Element | null;
 *   }
 *   where HandleOAuthCallbackParams = TransferableOption
 *     & SignInForceRedirectUrl   { signInForceRedirectUrl?: string | null }
 *     & SignInFallbackRedirectUrl { signInFallbackRedirectUrl?: string | null }
 *     & SignUpForceRedirectUrl   { signUpForceRedirectUrl?: string | null }
 *     & SignUpFallbackRedirectUrl { signUpFallbackRedirectUrl?: string | null }
 *     & { signInUrl?, signUpUrl?, firstFactorUrl?, ... }
 *
 * Note: HandleSSOCallback IS in the .d.ts types but NOT in the ESM runtime
 * bundle — Turbopack's static analysis catches this mismatch at build time.
 */
import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";

export default function SSOCallbackPage() {
  return (
    <div className="onb landing screen-in">
      <div className="onb-grid" />
      <div className="onb-glow" />
      <div className="land-left" style={{ justifyContent: "center" }}>
        <p className="land-sub">Connecting your GitHub account…</p>

        {/*
         * signInForceRedirectUrl and signUpForceRedirectUrl both point to
         * /picker so that:
         *  - returning users (sign-in path)     → /picker
         *  - brand-new users (sign-up path)     → /picker
         *
         * ForceRedirect overrides any redirect_url already in the URL,
         * ensuring we always land on /picker after OAuth regardless of
         * how Clerk assembled the callback URL.
         */}
        <AuthenticateWithRedirectCallback
          signInForceRedirectUrl="/picker"
          signUpForceRedirectUrl="/picker"
        />
      </div>
    </div>
  );
}
