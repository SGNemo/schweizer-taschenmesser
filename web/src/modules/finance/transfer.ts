/** Transfers between own accounts: two linked bookings that keep the balances right and the evaluations clean. */
import type { Transaction } from './schema';

export interface TransferDraft {
  fromAccountId: string;
  toAccountId: string;
  amountMinor: number;
  date: string;
  note?: string;
}

/**
 * The two bookings of a transfer: an expense on the source and an income on the target, both with
 * the same `transferId`. Neither has a category or a payee, so rules and budgets never see them.
 */
export function buildTransfer(
  draft: TransferDraft,
  transferId: string,
): { out: Transaction; in: Transaction } {
  const shared = { amountMinor: draft.amountMinor, date: draft.date, note: draft.note, transferId };
  return {
    out: { ...shared, accountId: draft.fromAccountId, kind: 'expense' },
    in: { ...shared, accountId: draft.toAccountId, kind: 'income' },
  };
}

export const transferValid = (d: TransferDraft): boolean =>
  d.amountMinor > 0 && d.fromAccountId !== '' && d.toAccountId !== '' && d.fromAccountId !== d.toAccountId;
