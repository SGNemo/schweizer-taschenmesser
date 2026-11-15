import { t } from '@/strings';
import { useUiStore } from '@/stores/ui';
import { markOpen, markPaid } from './actions';

/** Marks an invoice as paid (today, or on the given day) and offers "Rückgängig" (reopens it and removes the booking). Used by the list, the swipe and the home widget. */
export async function payWithUndo(id: string, paidAt?: string): Promise<void> {
  await markPaid(id, paidAt);
  useUiStore.getState().toast(t.invoices.markedPaid, {
    label: t.invoices.undo,
    run: () => void markOpen(id),
  });
}
