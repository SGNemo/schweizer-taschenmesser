import { useEffect, useState } from 'react';

/**
 * How long a view waits at most for its first reads before it shows what it has (a read that hangs): the status lines
 * (`./lines`), and the pages that paint a part only once the read it depends on is back (0b-8: no layout shift).
 */
export const STATUS_WAIT_MS = 1500;

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
