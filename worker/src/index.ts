/**
 * CodeMap Worker — entry point.
 *
 * Phase 0 scaffold: starts up, validates the timeout utility,
 * runs a poll stub, and shuts down cleanly on SIGINT/SIGTERM.
 * Actual analysis pipeline lands in Step 2.
 */

import { withTimeout } from './lib/timeout.js';

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

console.log('CodeMap worker online');

// Self-test: verify withTimeout is wired and resolves correctly.
// Uses a trivially fast promise — just proves the helper is importable and works.
withTimeout(Promise.resolve('self-test'), 5_000, 'startup-self-test')
  .then((val) => console.log(`[withTimeout] self-test passed (resolved: "${val}")`))
  .catch((err: unknown) => {
    console.error('[withTimeout] self-test FAILED — this should never happen:', err);
    process.exit(1);
  });

// ---------------------------------------------------------------------------
// Poll loop stub
// Every 5 s log a heartbeat. Replaced in Step 2 with real Supabase polling.
// ---------------------------------------------------------------------------

const POLL_INTERVAL_MS = 5_000;

const pollInterval = setInterval(() => {
  console.log('polling for queued projects… (stub — pipeline lands in Step 2)');
}, POLL_INTERVAL_MS);

// ---------------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------------

function shutdown(signal: string): void {
  console.log(`\nReceived ${signal} — worker shutting down`);
  clearInterval(pollInterval);
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
