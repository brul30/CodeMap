export function checkEnv(): { ok: boolean; present: string[]; missing: string[] } {
  const requiredKeys = [
    "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
    "CLERK_SECRET_KEY",
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "GEMINI_API_KEY",
    "PINECONE_API_KEY",
  ];

  const present: string[] = [];
  const missing: string[] = [];

  for (const key of requiredKeys) {
    if (process.env[key]) {
      present.push(key);
    } else {
      missing.push(key);
    }
  }

  return {
    ok: missing.length === 0,
    present,
    missing,
  };
}
