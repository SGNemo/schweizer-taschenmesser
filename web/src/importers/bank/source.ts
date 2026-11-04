import { inspectBankCsv, sniffBankFormat } from '@/core/io/bank';
import { best, extOf } from '../helpers';
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
};
