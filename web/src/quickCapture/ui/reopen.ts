import { useUiStore } from '@/stores/ui';

/**
 * "Ändern" after several entries were saved at once: the entries are taken back and their text
 * goes into the quick-capture sheet again, so the user changes the rows instead of retyping.
 * Kept only until the next form mounts.
 */
let draft: string | undefined;

export function reopenCapture(text: string): void {
  draft = text;
  useUiStore.getState().setQuickAddOpen(true);
}

/** Read in the form's initial state (no side effect, safe under StrictMode). */
export function peekReopenDraft(): string | undefined {
  return draft;
}

/** Called once the form has mounted. */
export function clearReopenDraft(): void {
  draft = undefined;
}
