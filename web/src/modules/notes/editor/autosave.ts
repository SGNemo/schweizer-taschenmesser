/**
 * Debounced autosave. The caller hands over a *getter*, so the (possibly large) document is only
 * serialised when the timer fires, not on every keystroke. `flush()` runs on blur, hide and unmount.
 */
export interface Autosaver<T> {
  schedule(read: () => T): void;
  /** Saves now if something is pending; resolves when the write is done. */
  flush(): Promise<void>;
  pending(): boolean;
  cancel(): void;
  /** Replaces the write function (the owner's callbacks change between renders). */
  setSave(save: (value: T) => Promise<void>): void;
}

export function createAutosaver<T>(
  initialSave: (value: T) => Promise<void>,
  delayMs = 600,
): Autosaver<T> {
  let save = initialSave;
  let read: (() => T) | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let chain: Promise<void> = Promise.resolve();

  const run = (): Promise<void> => {
    clearTimeout(timer);
    timer = undefined;
    const r = read;
    read = null;
    if (!r) return chain;
    const value = r();
    chain = chain.then(() => save(value)).catch(() => undefined);
    return chain;
  };

  return {
    schedule(next) {
      read = next;
      clearTimeout(timer);
      timer = setTimeout(() => void run(), delayMs);
    },
    flush: run,
    pending: () => read !== null,
    setSave(next) {
      save = next;
    },
    cancel() {
      clearTimeout(timer);
      timer = undefined;
      read = null;
    },
  };
}
