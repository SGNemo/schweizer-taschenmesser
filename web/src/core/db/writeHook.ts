/**
 * After-write signal for `core/automation`: `createRepo` reports every successful local write here
 * (what changed, never more than the stored row). It does nothing unless a listener is installed, the
 * listener must not throw into the writer, and sync-applied writes do not pass through `createRepo`,
 * so a remote change never triggers a rule on this device. Like `recorder.ts` it holds no logic.
 */
export type WriteKind = 'created' | 'updated' | 'deleted' | 'restored';

export interface WriteSignal {
  /** Dexie table name, `<moduleId>_<collection>`. */
  table: string;
  kind: WriteKind;
  id: string;
  /** The stored data fields after the write (envelope fields removed). */
  data?: Record<string, unknown>;
  /** `updated`: names of the fields that changed, with their previous values. */
  before?: Record<string, unknown>;
}

let listener: ((signal: WriteSignal) => void) | undefined;

export function setWriteListener(next: ((signal: WriteSignal) => void) | undefined): void {
  listener = next;
}

/** Cheap check so a writer can skip building the signal (copying a row) when nobody listens. */
export const hasWriteListener = (): boolean => listener !== undefined;

export function signalWrite(signal: WriteSignal): void {
  if (!listener) return;
  try {
    listener(signal);
  } catch {
    // a rule problem must never break a write
  }
}
