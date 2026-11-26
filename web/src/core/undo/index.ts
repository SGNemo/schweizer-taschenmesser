/**
 * Undo journal: the last 10 user actions that opted in with `undoable()`, in memory only.
 *
 * Inside `undoable(label, fn)` every `createRepo` write reports its inverse (see
 * `core/db/recorder.ts`): create → tombstone, update → previous field values, remove → restore,
 * restore → remove. `undoLast()` (Ctrl+Z) and the toast action replay them in reverse order.
 *
 * When `fn` throws, the writes it made so far are taken back at once (newest first) and the error is
 * rethrown: a failed action leaves nothing behind and no journal entry. A step of that rollback that
 * fails is not swallowed: the error becomes an `UndoReplayError` (original as `cause`).
 *
 * The recorder is global: a write that runs concurrently with `fn` (a background run, a second action that
 * starts meanwhile and so counts as nested) joins this action – its undo, and its rollback when `fn` throws.
 * Keep background work that can fail outside `undoable`, or have it catch its own failure (finance bookings).
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
  /** Who owns the entry (a module id): `forgetUndo` drops a module's entries when it is switched off. */
  scope?: string;
}

/**
 * `fn` of an `undoable` threw and taking back its writes failed for at least one step: some of them stay
 * stored. `cause` is the error of `fn`, `failures` the errors of the failed steps. The message carries
 * no label or data (labels can hold titles; diagnostics must not see them).
 */
export class UndoReplayError extends Error {
  constructor(
    cause: unknown,
    readonly failures: readonly unknown[],
  ) {
    super(`undo replay failed for ${failures.length} step(s)`, { cause });
    this.name = 'UndoReplayError';
  }
}

let journal: UndoEntry[] = [];
let nextId = 0;
let active: UndoStep[] | null = null;

/**
 * Runs `fn` and remembers the writes it made as one undoable action. Returns the entry (if any write happened) and the
 * result. `inverse`: an action whose recorded inverse would be too wide (a ToDo's checklist is one field – restoring it
 * would also undo a line a sync changed since) names its own narrower one; it replaces this action's recorded steps
 * once `fn` wrote anything, so it must undo everything `fn` writes. A nested call stays part of the outer action and
 * its recorded steps (its `inverse` is not used); a nested throw the outer `fn` catches rolls nothing back, only the
 * outermost call does. When `fn` throws, the recorded steps (never `inverse`: it covers a finished action) are
 * replayed newest first, then the error is rethrown – or an `UndoReplayError` when a step failed.
 */
export async function undoable<R>(
  label: string,
  fn: () => Promise<R>,
  scope?: string,
  inverse?: UndoStep,
): Promise<{ result: R; entry?: UndoEntry }> {
  if (active) return { result: await fn() }; // nested: part of the outer action
  const steps: UndoStep[] = [];
  active = steps;
  setWriteRecorder((s) => steps.push(s));
  const stop = () => {
    setWriteRecorder(undefined);
    active = null;
  };
  let result: R;
  try {
    result = await fn();
  } catch (error) {
    // Stopped once, before the rollback (its own writes are not recorded); no second stop after it, which would
    // end an action that started meanwhile.
    stop();
    const failures = await replay(steps);
    if (failures.length > 0) throw new UndoReplayError(error, failures);
    throw error;
  }
  stop();
  if (steps.length === 0) return { result };
  const entry: UndoEntry = {
    id: ++nextId,
    label,
    steps: inverse ? [inverse] : steps,
    ...(scope ? { scope } : {}),
  };
  journal = [entry, ...journal].slice(0, UNDO_LIMIT);
  return { result, entry };
}

/** Undoes one journal entry (newest steps first). Returns false when it was gone or a step failed. */
export async function undoEntry(id: number): Promise<boolean> {
  const entry = journal.find((e) => e.id === id);
  if (!entry) return false;
  journal = journal.filter((e) => e.id !== id);
  return (await replay(entry.steps)).length === 0;
}

/** Runs `steps` newest first; a failing step (e.g. the record was deleted meanwhile) does not stop the rest. Returns the failures. */
async function replay(steps: readonly UndoStep[]): Promise<unknown[]> {
  const failures: unknown[] = [];
  for (const step of [...steps].reverse()) {
    try {
      await step();
    } catch (e) {
      failures.push(e);
    }
  }
  return failures;
}

/** Undoes the newest action; resolves to its label, or undefined when there is nothing to undo. */
export async function undoLast(): Promise<string | undefined> {
  const entry = journal[0];
  if (!entry) return undefined;
  await undoEntry(entry.id);
  return entry.label;
}

export const undoDepth = (): number => journal.length;

/**
 * Drops every entry of `scope` (a module that is switched off must not be replayed into). An entry
 * goes as a whole: writes it made in other modules (a ToDo created from the planner's field) are not
 * undoable any more either; entries recorded without a scope stay.
 */
export function forgetUndo(scope: string): void {
  journal = journal.filter((e) => e.scope !== scope);
}

/** Tests only. */
export function resetUndoJournal(): void {
  journal = [];
  active = null;
  setWriteRecorder(undefined);
}
