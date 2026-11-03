/** CSV export of bookings (RFC 4180 via `core/io/csv`), one row per split part so category sums stay checkable. */
import { toCsv } from '@/core/io/csv';
import { categoryParts, signed } from './logic';
import type { Transaction } from './schema';

export interface ExportLabels {
  header: readonly string[];
  /** Words for the kind column and the transfer marker. */
  expense: string;
  income: string;
  transfer: string;
}

type Row = Pick<Transaction, 'accountId' | 'categoryId' | 'kind' | 'amountMinor' | 'date'> &
  Partial<Pick<Transaction, 'payee' | 'note' | 'transferId' | 'splits'>>;

/**
 * Columns: date, account, payee, category, kind, amount (signed, always "12.50", independent of the app language), note.
 * The amount uses a dot so spreadsheets in any locale read it after import settings; the delimiter is ';'.
 */
export function bookingsCsv(
  rows: readonly Row[],
  accountName: (id: string) => string,
  categoryName: (id: string | undefined) => string,
  labels: ExportLabels,
): string {
  const dec = (minor: number) => {
    const sign = minor < 0 ? '-' : '';
    const abs = Math.abs(minor);
    return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
  };
  const out: string[][] = [[...labels.header]];
  const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date));
  for (const r of sorted) {
    const parts = r.transferId
      ? [{ categoryId: undefined, amountMinor: r.amountMinor }]
      : categoryParts(r);
    for (const p of parts) {
      const signedAmount = signed({ kind: r.kind, amountMinor: p.amountMinor });
      out.push([
        r.date,
        accountName(r.accountId),
        r.payee ?? '',
        r.transferId ? labels.transfer : categoryName(p.categoryId),
        r.transferId ? labels.transfer : r.kind === 'income' ? labels.income : labels.expense,
        dec(signedAmount),
        r.note ?? '',
      ]);
    }
  }
  return toCsv(out, ';');
}
