/**
 * Copies a secret and clears the clipboard after 30 s – but only if it still holds that secret
 * (the user may have copied something else meanwhile). The actual clipboard access is injected;
 * in the extension it lives in an offscreen document (`offscreen/offscreen.ts`).
 */
export const CLEAR_AFTER_MS = 30_000;

export interface ClipboardAdapter {
  write(text: string): Promise<void>;
  /** The current clipboard text, or null when it cannot be read. */
  read(): Promise<string | null>;
}

export function createSecretClipboard(
  adapter: ClipboardAdapter,
  timers: {
    set(fn: () => void, ms: number): unknown;
    clear(id: unknown): void;
  } = { set: (fn, ms) => setTimeout(fn, ms), clear: (id) => clearTimeout(id as number) },
) {
  let timer: unknown;
  let held: string | null = null;

  const clearIfUnchanged = async () => {
    const value = held;
    held = null;
    timer = undefined;
    if (value === null) return;
    const current = await adapter.read().catch(() => null);
    // Unreadable = unknown: leave it alone rather than wipe something the user copied.
    if (current === value) await adapter.write('').catch(() => undefined);
  };

  return {
    async copy(text: string): Promise<void> {
      if (timer !== undefined) timers.clear(timer);
      await adapter.write(text);
      held = text;
      timer = timers.set(() => void clearIfUnchanged(), CLEAR_AFTER_MS);
    },
    /** For tests and for "service worker is going away": clear right now if still ours. */
    flush: clearIfUnchanged,
  };
}
