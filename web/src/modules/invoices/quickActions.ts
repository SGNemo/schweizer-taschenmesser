import { t } from '@/strings';
import { useUiStore } from '@/stores/ui';
import { markOpen, markPaid } from './actions';

/** Marks an invoice as paid today and offers "Rückgängig" (reopens it and removes the booking). Used by the list, the swipe and the home widget. */
export async function payWithUndo(id: string): Promise<void> {
  await markPaid(id);
  useUiStore.getState().toast(t.invoices.markedPaid, {
    label: t.invoices.undo,
    run: () => void markOpen(id),
  });
}
