/**
 * withTimeout — wraps any Promise with a hard deadline.
 *
 * This is a core invariant for CodeMap: every external call (Gemini, GitHub,
 * Pinecone, Supabase) MUST be wrapped so a hung network request can never
 * stall the worker indefinitely. On timeout the worker sets project.status=error.
 *
 * @param promise - The async operation to race.
 * @param ms      - Maximum milliseconds to wait.
 * @param label   - Human-readable name shown in the timeout error message.
 *
 * @example
 *   const result = await withTimeout(gemini.generate(prompt), 30_000, 'gemini.generate');
 */
export function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`[timeout] "${label}" did not settle within ${ms}ms`));
    }, ms);
  });

  return Promise.race([promise, timeout]).finally(() => {
    if (timer !== undefined) clearTimeout(timer);
  });
}
