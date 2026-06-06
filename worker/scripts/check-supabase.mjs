/**
 * check-supabase.mjs — smoke-test Supabase connectivity.
 *
 * Connects with the service-role key (full Postgres access) and runs a
 * COUNT(*) against the `projects` table to confirm:
 *   1. The credentials are valid and reachable.
 *   2. The migration has been applied (table exists).
 *
 * Usage:
 *   npm run check-supabase    (reads .env via --env-file flag)
 */

import { createClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Config / guards
// ---------------------------------------------------------------------------

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const missing = [];
if (!SUPABASE_URL) missing.push('SUPABASE_URL');
if (!SERVICE_ROLE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY');

if (missing.length > 0) {
  console.error('ERROR: Missing required env vars:', missing.join(', '));
  console.error('Set them in .env and re-run.');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Probe
// ---------------------------------------------------------------------------

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

console.log(`Checking Supabase at ${SUPABASE_URL}…`);

const { count, error } = await supabase
  .from('projects')
  .select('*', { count: 'exact', head: true });

if (error) {
  console.error('ERROR: Supabase query failed.');
  console.error('  Code   :', error.code);
  console.error('  Message:', error.message);
  console.error('  Hint   :', error.hint ?? '(none)');
  console.error('\nPossible causes: wrong URL/key, migration not yet applied, or network issue.');
  process.exit(1);
}

console.log(`SUCCESS: Supabase is reachable. projects table row count: ${count ?? 0}`);
