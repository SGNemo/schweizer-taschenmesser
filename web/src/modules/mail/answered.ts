/**
 * „Beantwortet? · Erledigt“ („Wochenende retten“ F5): a planned mail whose newest message is the person's own
 * asks once on its row; the tap asks the todos module over the bus to tick the ToDo off (only its id travels)
 * and the toast carries the undo. Nothing is ticked off without that tap.
 */
import { bus } from '@/core/events';
import { undoable, undoEntry } from '@/core/undo';
import { t } from '@/strings';
import { useUiStore } from '@/stores/ui';
import type { CachedThreadView } from './cache';

/** Rows that ask „Beantwortet?“: newest message mine, an open ToDo from the mail, the setting on. */
export function answeredRows(
  threads: readonly CachedThreadView[],
  open: ReadonlyMap<string, string>,
  show: boolean,
): Map<string, string> {
  const out = new Map<string, string>();
  if (!show) return out;
  for (const th of threads) {
    const todo = open.get(th.id);
    if (todo && th.lastFromMe) out.set(th.id, todo);
  }
  return out;
}

/** One tap: the ToDo is ticked off through the bus; „Erledigt · Rückgängig“. The page offers it only while ToDos are on. */
export async function closeAnswered(todoId: string): Promise<void> {
  const toast = useUiStore.getState().toast;
  try {
    // The bus awaits the handler, so its writes land in this undo entry.
    const { entry } = await undoable(t.mail.answered.closed, () =>
      bus.emit('todo.doneRequested', { id: todoId }),
    );
    // No write: the ToDo was already done or gone (a second tap, a tick synced in); the row goes by itself.
    if (!entry) return;
    toast(t.mail.answered.closed, {
      label: t.ui.undo,
      run: () => void undoEntry(entry.id).then((ok) => toast(ok ? t.ui.undone : t.ui.undoFailed)),
    });
  } catch {
    toast(t.mail.answered.failed);
  }
}
