/**
 * check-env.mjs — dependency-free env-var validator.
 *
 * Reports PRESENT vs MISSING for every key the worker needs.
 * Never prints values — only key names, so this is safe to run in CI logs.
 *
 * Exit 0  → all keys present.
 * Exit 1  → one or more keys missing (list printed to stderr).
 *
 * Usage:
 *   npm run check-env            (reads .env via --env-file flag in npm script)
 *   node scripts/check-env.mjs  (reads process.env as-is)
 */

const REQUIRED_KEYS = [
  'GEMINI_API_KEY',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'PINECONE_API_KEY',
  'PINECONE_INDEX',
];

const missing = [];
const present = [];

for (const key of REQUIRED_KEYS) {
  if (process.env[key]) {
    present.push(key);
  } else {
    missing.push(key);
  }
}

if (present.length > 0) {
  console.log('PRESENT:');
  for (const key of present) {
    console.log(`  ✓ ${key}`);
  }
}

if (missing.length > 0) {
  console.error('\nMISSING (copy from .env.example and fill in):');
  for (const key of missing) {
    console.error(`  ✗ ${key}`);
  }
  console.error(`\n${missing.length} of ${REQUIRED_KEYS.length} required variable(s) are not set.`);
  process.exit(1);
} else {
  console.log(`\nAll ${REQUIRED_KEYS.length} required environment variables are present.`);
}
