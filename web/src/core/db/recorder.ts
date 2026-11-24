/**
 * Hook for the undo journal (`core/undo`): `createRepo` reports the inverse of every successful
 * write here. It does nothing unless a recorder is installed, which only `undoable()` does for the
 * duration of one user action. No validation, HLC, outbox or schema logic lives here.
 */
export type UndoStep = () => Promise<void>;

let recorder: ((step: UndoStep) => void) | undefined;

export function setWriteRecorder(next: ((step: UndoStep) => void) | undefined): void {
  recorder = next;
}

export function recordWrite(step: UndoStep): void {
  recorder?.(step);
}

/**
 * Runs `fn` without reporting its writes to the undo journal: for an action that records its own, narrower inverse
 * with `recordWrite` (a ToDo's checklist tick flips one line back instead of restoring the whole list – a sync or a
 * second tick in between keeps its change).
 */
export async function withoutRecording<R>(fn: () => Promise<R>): Promise<R> {
  const prev = recorder;
  recorder = undefined;
  try {
    return await fn();
  } finally {
    recorder = prev;
  }
}
