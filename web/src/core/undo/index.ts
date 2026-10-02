/**
 * Undo journal: the last 10 user actions that opted in with `undoable()`, in memory only.
 *
 * Inside `undoable(label, fn)` every `createRepo` write reports its inverse (see
 * `core/db/recorder.ts`): create → tombstone, update → previous field values, remove → restore,
 * restore → remove. `undoLast()` (Ctrl+Z) and the toast action replay them in reverse order.
 *
 * Limits, on purpose: writes that happen after `fn` has resolved are not part of the action
 * (e.g. the finance booking an event-bus handler makes when an invoice is paid); writes outside
 * `undoable` (imports, seeds, settings, sync) are never undoable; there is no redo.
 */
import { setWriteRecorder, type UndoStep } from '@/core/db/recorder';

export const UNDO_LIMIT = 10;

export interface UndoEntry {
  id: number;
  label: string;
  steps: UndoStep[];
}

let journal: UndoEntry[] = [];
let nextId = 0;
let active: UndoStep[] | null = null;

/** Runs `fn` and remembers the writes it made as one undoable action. Returns the entry (if any write happened) and the result. */
export async function undoable<R>(
  label: string,
  fn: () => Promise<R>,
): Promise<{ result: R; entry?: UndoEntry }> {
  if (active) return { result: await fn() }; // nested: part of the outer action
  const steps: UndoStep[] = [];
  active = steps;
  setWriteRecorder((s) => steps.push(s));
  let result: R;
  try {
    result = await fn();
  } finally {
    setWriteRecorder(undefined);
    active = null;
  }
  if (steps.length === 0) return { result };
  const entry: UndoEntry = { id: ++nextId, label, steps };
  journal = [entry, ...journal].slice(0, UNDO_LIMIT);
  return { result, entry };
}

/** Undoes one journal entry (newest steps first). Returns false when it was gone or a step failed. */
export async function undoEntry(id: number): Promise<boolean> {
  const entry = journal.find((e) => e.id === id);
  if (!entry) return false;
  journal = journal.filter((e) => e.id !== id);
  let ok = true;
  for (const step of [...entry.steps].reverse()) {
    try {
      await step();
    } catch {
      ok = false; // e.g. the record was deleted meanwhile; keep undoing the rest
    }
  }
  return ok;
}

/** Undoes the newest action; resolves to its label, or undefined when there is nothing to undo. */
export async function undoLast(): Promise<string | undefined> {
  const entry = journal[0];
  if (!entry) return undefined;
  await undoEntry(entry.id);
  return entry.label;
}

export const undoDepth = (): number => journal.length;

/** Tests only. */
export function resetUndoJournal(): void {
  journal = [];
  active = null;
  setWriteRecorder(undefined);
}
