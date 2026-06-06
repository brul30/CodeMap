/**
 * GET /api/repos
 *
 * Server-only route. Returns the signed-in user's public GitHub repos,
 * trimmed to the fields the picker card needs.
 *
 * Security:
 *  - auth() from @clerk/nextjs/server enforces authentication server-side.
 *  - The GitHub OAuth token is fetched and used here only; it is NEVER
 *    included in the response sent to the browser.
 *  - All GitHub API payloads are validated with zod before use.
 *
 * Note on Clerk provider string:
 *  getUserOauthAccessToken(userId, 'github') — no 'oauth_' prefix.
 *  The 'oauth_github' form is deprecated as of @clerk/backend v7+.
 *
 * Note on clerkClient:
 *  In @clerk/nextjs v7+ clerkClient is async: `await clerkClient()`.
 */
import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";

// ── Zod schema for a single GitHub repo item from the REST API ────────────────
const GitHubRepoSchema = z.object({
  name: z.string(),
  private: z.boolean(),
  description: z.string().nullable(),
  language: z.string().nullable(),
  stargazers_count: z.number(),
  forks_count: z.number(),
  updated_at: z.string(),
  owner: z.object({
    login: z.string(),
  }),
});

const GitHubReposArraySchema = z.array(GitHubRepoSchema);

// ── Language → CSS variable mapping (matches the picker's onboarding.css) ────
function langDot(lang: string | null): string {
  switch (lang?.toLowerCase()) {
    case "typescript":
      return "var(--onb-ts)";
    case "javascript":
      return "var(--onb-js)";
    case "python":
      return "var(--onb-py)";
    case "rust":
      return "var(--onb-rust)";
    case "go":
      return "var(--onb-go)";
    default:
      return "var(--onb-default, #888)";
  }
}

// ── "Xd ago" / "Xh ago" formatter ────────────────────────────────────────────
function relativeTime(isoDate: string): string {
  const diffMs = Date.now() - new Date(isoDate).getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  return `${diffDays}d ago`;
}

// ── Route handler ─────────────────────────────────────────────────────────────
export async function GET() {
  // 1. Enforce authentication server-side — rejects unauthenticated requests.
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Get the user's GitHub username from Clerk (stored on the external account,
  //    available even with Clerk's SHARED dev OAuth credentials — no provider
  //    token required). We list PUBLIC repos via GitHub's public endpoint.
  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  const githubAccount = user.externalAccounts.find((a) =>
    a.provider.includes("github"),
  );
  const username = githubAccount?.username;
  if (!username) {
    return NextResponse.json(
      {
        error:
          "No GitHub account linked. Sign in with GitHub (Clerk → SSO connections → GitHub must be enabled).",
      },
      { status: 400 },
    );
  }

  // 3. Fetch the user's PUBLIC repos from GitHub's public REST endpoint.
  //    Unauthenticated (public data only) — matches our public-repos-only demo
  //    constraint and avoids needing a provider OAuth token. Hard 10s timeout.
  let rawRepos: unknown;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    const ghResponse = await fetch(
      `https://api.github.com/users/${encodeURIComponent(username)}/repos?per_page=100&sort=updated&type=owner`,
      {
        headers: {
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        signal: controller.signal,
      },
    );

    clearTimeout(timeout);

    if (!ghResponse.ok) {
      return NextResponse.json(
        { error: `GitHub API error: ${ghResponse.status}` },
        { status: 502 },
      );
    }

    rawRepos = await ghResponse.json();
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `GitHub request failed: ${msg}` },
      { status: 502 },
    );
  }

  // 4. Validate the GitHub payload with zod before use.
  const parsed = GitHubReposArraySchema.safeParse(rawRepos);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Unexpected GitHub API response shape" },
      { status: 502 },
    );
  }

  // 5. Filter to public repos only (demo constraint; never expose private).
  const publicRepos = parsed.data.filter((r) => !r.private);

  // 6. Map to the trimmed shape the picker card expects.
  //    Token is NOT included in this response.
  const repos = publicRepos.map((r) => ({
    name: r.name,
    owner: r.owner.login,
    vis: "public" as const,
    desc: r.description ?? "",
    lang: r.language ?? "Unknown",
    dot: langDot(r.language),
    stars: r.stargazers_count.toLocaleString(),
    forks: r.forks_count.toLocaleString(),
    ago: relativeTime(r.updated_at),
  }));

  return NextResponse.json(repos);
}
