import { inspectBankCsv, sniffBankFormat } from '@/core/io/bank';
import { best, countAll, extOf } from '../helpers';
import type { SourceDef } from '../types';

const DATE = ['buchungstag', 'buchungsdatum', 'datum', 'date', 'valuta', 'wertstellung'];
const AMOUNT = ['betrag', 'amount', 'umsatz', 'betrag eur', 'betrag in eur'];

/** A CSV with a date and an amount column (Sparkasse, DKB, ING, comdirect, N26 …), or OFX/QIF/CAMT. */
export const source: SourceDef = {
  id: 'bank',
  targets: [{ moduleId: 'finance', importerId: 'bank' }],
  extensions: ['csv', 'xml', 'ofx', 'qif'],
  detect: (files) =>
    best(files, (f) => {
      const ext = extOf(f.name);
      if (!['csv', 'xml', 'ofx', 'qif', 'sta', 'txt'].includes(ext)) return 0;
      if (sniffBankFormat(f.text) !== 'csv')
        return /<(?:Document|OFX)|OFXHEADER|^!Type/i.test(f.text.slice(0, 2000)) ? 0.9 : 0;
      if (ext !== 'csv') return 0;
      const keys = inspectBankCsv(f.text)?.keys ?? [];
      const has = (list: string[]) =>
        keys.some((k) => list.some((n) => k === n || k.startsWith(`${n} `)));
      return has(DATE) && has(AMOUNT) ? 0.7 : 0;
    }),
  summarize(files) {
    let transactions = 0;
    for (const f of files) {
      const format = sniffBankFormat(f.text);
      if (format !== 'csv') {
        transactions += countAll([f], /<STMTTRN>|<Ntry>|^\^/gim);
        continue;
      }
      const table = inspectBankCsv(f.text);
      if (!table) continue;
      const rows = f.text.split(/\r?\n/).filter((l) => l.trim());
      const at = rows.findIndex((l) => l.includes(table.header[0] ?? '\u0000'));
      transactions += Math.max(0, rows.length - at - 1);
    }
    return { transactions };
  },
};
