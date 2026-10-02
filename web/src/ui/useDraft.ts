import { useCallback, useState } from 'react';
import { now } from '@/core/time/now';

/** How long a closed form's draft survives (in memory only; nothing is stored or synced). */
export const DRAFT_TTL_MS = 30_000;

const drafts = new Map<string, { value: unknown; at: number }>();

/**
 * Form state that survives an accidental close: reopening the same form (same `key`) within
 * 30 seconds brings the fields back. Call `clear()` after a successful save.
 * Returns `[value, setValue, clear, restored]`.
 */
export function useDraft<T>(key: string, initial: T) {
  const [state] = useState(() => {
    const saved = drafts.get(key);
    const fresh = saved !== undefined && now() - saved.at < DRAFT_TTL_MS;
    if (!fresh) drafts.delete(key);
    return { value: fresh ? (saved.value as T) : initial, restored: fresh };
  });
  const [value, setValue] = useState<T>(state.value);

  const set = useCallback(
    (next: T) => {
      setValue(next);
      drafts.set(key, { value: next, at: now() });
    },
    [key],
  );
  const clear = useCallback(() => {
    drafts.delete(key);
  }, [key]);
  return [value, set, clear, state.restored] as const;
}
