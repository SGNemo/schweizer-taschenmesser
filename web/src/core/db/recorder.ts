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
 * Runs `fn` with `inverse` as its only undo step: the field-level inverse its writes would record is too wide (a ToDo's
 * checklist or a routine's progress is one field – restoring it would also undo a line changed elsewhere since). Every
 * undo path then takes back only this one change. Outside an undoable action it only runs `fn`. `fn` must be the one
 * write `inverse` fully covers: any other write inside it (also a concurrent one – the recorder is global, as in
 * `undoable`) would not be recorded.
 */
export async function recordAs<R>(inverse: UndoStep, fn: () => Promise<R>): Promise<R> {
  const outer = recorder;
  if (!outer) return fn();
  let wrote = false;
  recorder = () => {
    wrote = true;
  };
  try {
    const result = await fn();
    if (wrote) outer(inverse);
    return result;
  } finally {
    recorder = outer;
  }
}
