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
