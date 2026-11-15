import { useEffect, useState } from 'react';

/**
 * How long a view waits at most for its first reads before it shows what it has (a read that hangs): the status lines
 * (`./lines`), and the pages that paint a part only once the read it depends on is back (0b-8: no layout shift).
 */
export const STATUS_WAIT_MS = 1500;

/**
 * How long the module frame holds an entry page with `identity.firstRead` at most (0b-8 follow-up d): on a normal network
 * the reads are back in 0.3–0.5 s (`e2e/seed/open-hold.seed.spec.ts`); a page still waiting after this paints its head
 * in its final form and lets late parts arrive where they push nothing that is already on the screen
 * (`layout/firstReadHold.ts`, `useHeadReady`'s `late`).
 */
export const FIRST_READ_HOLD_MS = 600;

/** `true` once `ready` was true or `STATUS_WAIT_MS` have passed since mount; it never turns back to `false`. */
export function useSettled(ready: boolean, waitMs = STATUS_WAIT_MS): boolean {
  const [waited, setWaited] = useState(false);
  const [settled, setSettled] = useState(ready);
  if (ready && !settled) setSettled(true);
  useEffect(() => {
    if (settled) return;
    const timer = setTimeout(() => setWaited(true), waitMs);
    return () => clearTimeout(timer);
  }, [settled, waitMs]);
  return settled || waited;
}
