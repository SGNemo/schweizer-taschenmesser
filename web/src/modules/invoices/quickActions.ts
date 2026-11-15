import { t } from '@/strings';
import { useUiStore } from '@/stores/ui';
import { markOpen, markPaid } from './actions';
import { invoiceRepo } from './repo';

/** Marks an invoice as paid (today, or on the given day) and offers "Rückgängig" (reopens it and removes the booking). Used by the list, the swipe and the home widget. */
export async function payWithUndo(id: string, paidAt?: string): Promise<void> {
  await markPaid(id, paidAt);
  useUiStore.getState().toast(t.invoices.markedPaid, {
    label: t.invoices.undo,
    run: () => void markOpen(id),
  });
}

/**
 * Marks several open invoices as paid (today) in one go – the selection bar's "Als bezahlt markieren". One toast
 * names how many; its "Rückgängig" reopens all of them (and removes their bookings and the next invoices of a
 * series, like the single undo).
 */
export async function payManyWithUndo(ids: readonly string[]): Promise<void> {
  const paid: string[] = [];
  for (const id of ids) {
    const invoice = await invoiceRepo.get(id);
    if (!invoice || invoice.status !== 'open') continue;
    await markPaid(id);
    paid.push(id);
  }
  if (paid.length === 0) return;
  useUiStore.getState().toast(t.invoices.ext.batch.paid(paid.length), {
    label: t.invoices.undo,
    run: () =>
      void (async () => {
        // In the order they were paid (the list's order: oldest due first). Reopening an invoice removes the open
        // next one of its series, so the earlier one must be reopened while a later, also ticked one is still
        // paid – it then survives (pinned in listTools.test.tsx).
        for (const id of paid) await markOpen(id);
      })(),
  });
}
