/**
 * Known bank CSV layouts as plain data: delimiter, encoding, column names. Taken from the banks'
 * publicly described export formats; names are normalized (`normalizeHeader`: lower case, no umlaut
 * dots, punctuation = one space). A preset is recognised from the header row alone; the file's own
 * order of rows and the lines above the header do not matter.
 */
import { locateHeader, type BankCsvLayout } from '@/core/io/bank';
import type { Delimiter } from '@/core/io/csv';

export interface BankPreset {
  id: string;
  /** Bank name as the banks print it (not translated). */
  name: string;
  /** Usual encoding of the export. The app reads UTF-8 first and falls back to Windows-1252. */
  encoding: 'utf-8' | 'windows-1252';
  layout: BankCsvLayout & { delimiter: Delimiter };
  /** Normalized header names that must all be present for the preset to be recognised. */
  signature: readonly string[];
}

const WAEHRUNG = ['waehrung', 'wahrung'] as const;

/** Most specific first: the first preset whose signature fits wins. */
export const BANK_PRESETS: readonly BankPreset[] = [
  {
    id: 'volksbank',
    name: 'Volksbank / GLS',
    encoding: 'windows-1252',
    signature: ['name zahlungsbeteiligter', 'saldo nach buchung', 'buchungstag'],
    layout: {
      delimiter: ';',
      decimal: ',',
      columns: {
        date: ['buchungstag'],
        amount: ['betrag'],
        currency: WAEHRUNG,
        payee: ['name zahlungsbeteiligter'],
        purpose: ['verwendungszweck'],
        bookingText: ['buchungstext'],
        account: ['iban auftragskonto'],
        balance: ['saldo nach buchung'],
      },
    },
  },
  {
    id: 'dkb-neu',
    name: 'DKB',
    encoding: 'utf-8',
    signature: ['buchungsdatum', 'status', 'zahlungspflichtige r', 'zahlungsempfanger in'],
    layout: {
      delimiter: ';',
      decimal: ',',
      pendingValues: ['vorgemerkt'],
      // One column per party: the other side of the booking is the payee, whatever the direction.
      payeeOut: ['zahlungsempfanger in'],
      payeeIn: ['zahlungspflichtige r'],
      columns: {
        date: ['buchungsdatum'],
        amount: ['betrag'],
        payee: ['zahlungsempfanger in', 'zahlungspflichtige r'],
        purpose: ['verwendungszweck'],
        bookingText: ['umsatztyp'],
        status: ['status'],
      },
    },
  },
  {
    id: 'dkb-alt',
    name: 'DKB (alt)',
    encoding: 'windows-1252',
    signature: ['buchungstag', 'auftraggeber begunstigter', 'betrag eur'],
    layout: {
      delimiter: ';',
      decimal: ',',
      columns: {
        date: ['buchungstag'],
        amount: ['betrag eur'],
        payee: ['auftraggeber begunstigter'],
        purpose: ['verwendungszweck'],
        bookingText: ['buchungstext'],
      },
    },
  },
  {
    id: 'ing',
    name: 'ING',
    encoding: 'windows-1252',
    signature: ['buchung', 'valuta', 'auftraggeber empfanger', 'saldo'],
    layout: {
      delimiter: ';',
      decimal: ',',
      columns: {
        date: ['buchung'],
        amount: ['betrag'],
        currency: ['wahrung'],
        payee: ['auftraggeber empfanger'],
        purpose: ['verwendungszweck'],
        bookingText: ['buchungstext'],
        balance: ['saldo'],
      },
    },
  },
  {
    id: 'comdirect',
    name: 'comdirect',
    encoding: 'windows-1252',
    signature: ['buchungstag', 'vorgang', 'buchungstext', 'umsatz in eur'],
    layout: {
      delimiter: ';',
      decimal: ',',
      // The payee and the purpose are both inside the booking text.
      textSplit: 'comdirect',
      columns: {
        date: ['buchungstag'],
        amount: ['umsatz in eur'],
        payee: [],
        purpose: [],
        bookingText: ['buchungstext'],
      },
    },
  },
  {
    id: 'n26',
    name: 'N26',
    encoding: 'utf-8',
    signature: ['booking date', 'partner name', 'payment reference', 'amount eur'],
    layout: {
      delimiter: ',',
      decimal: '.',
      currency: 'EUR',
      columns: {
        date: ['booking date'],
        amount: ['amount eur'],
        payee: ['partner name'],
        purpose: ['payment reference'],
        bookingText: ['type'],
      },
    },
  },
  {
    id: 'n26-de',
    name: 'N26',
    encoding: 'utf-8',
    signature: ['datum', 'empfanger', 'transaktionstyp', 'betrag eur'],
    layout: {
      delimiter: ',',
      decimal: '.',
      currency: 'EUR',
      columns: {
        date: ['datum'],
        amount: ['betrag eur'],
        payee: ['empfanger'],
        purpose: ['verwendungszweck'],
        bookingText: ['transaktionstyp'],
      },
    },
  },
  {
    id: 'sparkasse-camt',
    name: 'Sparkasse (CSV-CAMT)',
    encoding: 'windows-1252',
    signature: ['buchungstext', 'beguenstigter zahlungspflichtiger', 'kontonummer iban'],
    layout: {
      delimiter: ';',
      decimal: ',',
      columns: {
        date: ['buchungstag'],
        amount: ['betrag'],
        currency: WAEHRUNG,
        payee: ['beguenstigter zahlungspflichtiger'],
        purpose: ['verwendungszweck'],
        bookingText: ['buchungstext'],
        account: ['auftragskonto'],
      },
    },
  },
  {
    id: 'sparkasse-mt940',
    name: 'Sparkasse (MT940-CSV)',
    encoding: 'windows-1252',
    signature: ['beguenstigter zahlungspflichtiger', 'blz', 'buchungstag'],
    layout: {
      delimiter: ';',
      decimal: ',',
      columns: {
        date: ['buchungstag'],
        amount: ['betrag'],
        currency: WAEHRUNG,
        payee: ['beguenstigter zahlungspflichtiger'],
        purpose: ['verwendungszweck'],
        bookingText: ['buchungstext'],
        account: ['auftragskonto'],
      },
    },
  },
];

/** The preset whose header is in the file, or undefined for an unknown layout. */
export function detectBankPreset(text: string): BankPreset | undefined {
  const body = text.replace(/^\uFEFF/, '');
  for (const preset of BANK_PRESETS) {
    const hit = locateHeader(
      body,
      (keys) =>
        preset.signature.every((k) => keys.has(k)) &&
        preset.layout.columns.date.some((k) => keys.has(k)) &&
        preset.layout.columns.amount.some((k) => keys.has(k)),
      preset.layout.delimiter,
    );
    if (hit) return preset;
  }
  return undefined;
}
