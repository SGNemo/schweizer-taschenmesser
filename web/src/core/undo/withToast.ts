import { t } from '@/strings';
import { useUiStore } from '@/stores/ui';
import type { UndoStep } from '@/core/db/recorder';
import { undoable, undoEntry } from './index';

/**
 * `undoable()` plus the confirmation toast with "Rückgängig": use it for every state-changing
 * action of a list (done, paid, deleted, moved).
 */
export async function undoableWithToast<R>(
  label: string,
  message: string,
  fn: () => Promise<R>,
  /** The action's own, narrower inverse (`undoable`). */
  inverse?: UndoStep,
): Promise<R> {
  const { result, entry } = await undoable(label, fn, undefined, inverse);
  const { toast } = useUiStore.getState();
  toast(
    message,
    entry
      ? {
          label: t.ui.undo,
          run: () => {
            void undoEntry(entry.id).then((ok) => toast(ok ? t.ui.undone : t.ui.undoFailed));
          },
        }
      : undefined,
  );
  return result;
}

/** Delete (or any removal) with the standard "Gelöscht" toast and "Rückgängig"; use it for every delete in a module UI. */
export function deleteWithUndo<R>(
  fn: () => Promise<R>,
  message: string = t.ui.deleted,
): Promise<R> {
  return undoableWithToast(message, message, fn);
}

/** A non-destructive single change (pause, count ±) with the "Geändert" toast and "Rückgängig". */
export function changeWithUndo<R>(
  fn: () => Promise<R>,
  message: string = t.ui.changed,
): Promise<R> {
  return undoableWithToast(message, message, fn);
}
