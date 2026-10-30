import { useCallback, useState } from 'react';
import { now } from '@/core/time/now';

/** How long a closed form's draft is kept (memory only; nothing is stored, synced or written to disk). */
export const FORM_DRAFT_TTL_MS = 30 * 60_000;

const drafts = new Map<string, { values: Record<string, unknown>; at: number }>();

/**
 * Text fields of a form that survive an accidental close (Esc, a tap beside the dialog): reopening
 * the same form (same `key`) within 30 minutes brings the typed values back. The draft only lives
 * in memory and is dropped on `clear()` (saved, or "Abbrechen"), on `discard()` and after the TTL.
 * Files and other non-text state stay out of it.
 */
export function useFormDraft<T extends Record<string, unknown>>(key: string, initial: T) {
  const [start] = useState(() => {
    const saved = drafts.get(key);
    const fresh = saved !== undefined && now() - saved.at < FORM_DRAFT_TTL_MS;
    if (!fresh) drafts.delete(key);
    return { values: fresh ? ({ ...initial, ...saved.values } as T) : initial, restored: fresh };
  });
  const [values, setValues] = useState<T>(start.values);
  const [restored, setRestored] = useState(start.restored);

  const set = useCallback(
    <K extends keyof T>(field: K, value: T[K]) => {
      setValues((prev) => {
        const next = { ...prev, [field]: value };
        drafts.set(key, { values: next, at: now() });
        return next;
      });
    },
    [key],
  );
  const clear = useCallback(() => {
    drafts.delete(key);
  }, [key]);
  /** Back to the stored values; hides the "restored" note. */
  const discard = useCallback(() => {
    drafts.delete(key);
    setValues(initial);
    setRestored(false);
    // `initial` is the form's own starting point and does not change while it is open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return { values, set, clear, discard, restored } as const;
}

/** Test helper: forget every draft. */
export const clearAllFormDrafts = (): void => drafts.clear();
