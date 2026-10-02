import { t } from '@/strings';
import { useUiStore } from '@/stores/ui';
import { undoable, undoEntry } from './index';

/**
 * `undoable()` plus the confirmation toast with "Rückgängig": use it for every state-changing
 * action of a list (done, paid, deleted, moved).
 */
export async function undoableWithToast<R>(
  label: string,
  message: string,
  fn: () => Promise<R>,
): Promise<R> {
  const { result, entry } = await undoable(label, fn);
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
