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

export interface ExportOptions {
  /** Decimal mark of the amounts (default "."); the app passes the region's, so Excel reads numbers. */
  decimal?: '.' | ',';
  /** Start with a UTF-8 BOM: Excel otherwise opens the file as Windows-1252 and breaks umlauts. */
  bom?: boolean;
}

/**
 * Columns: date, account, payee, category, kind, amount (signed, no group marks), note. The
 * delimiter is ';' (what German Excel expects); the decimal mark and the BOM come from `opts`.
 */
export function bookingsCsv(
  rows: readonly Row[],
  accountName: (id: string) => string,
  categoryName: (id: string | undefined) => string,
  labels: ExportLabels,
  opts: ExportOptions = {},
): string {
  const mark = opts.decimal ?? '.';
  const dec = (minor: number) => {
    const sign = minor < 0 ? '-' : '';
    const abs = Math.abs(minor);
    return `${sign}${Math.floor(abs / 100)}${mark}${String(abs % 100).padStart(2, '0')}`;
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
  return (opts.bom ? '\uFEFF' : '') + toCsv(out, ';');
}
