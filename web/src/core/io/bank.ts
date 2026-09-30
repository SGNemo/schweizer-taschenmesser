/**
 * Bank statement parsers: the CSV export of German savings banks ("CSV-CAMT") and CAMT.052/.053 XML.
 * Pure functions on text; nothing here touches the network or the database.
 */
import { parseMoney } from '@/core/money';
import { csvTable, normalizeHeader } from './csv';
import { parseDateInput } from './dates';

export interface BankTransaction {
  /** 'YYYY-MM-DD' (booking date). */
  date: string;
  /** Signed cents: negative = money left the account. */
  amountMinor: number;
  currency: string;
  /** Beneficiary / payer as the bank prints it. */
  payee: string;
  /** Purpose / remittance information, single line. */
  purpose: string;
  /** IBAN of the account the statement belongs to, when the file says so. */
  accountIban?: string;
}

export interface BankParseResult {
  transactions: BankTransaction[];
  /** Rows / entries that could not be read (for the "N Zeilen übersprungen" note). */
  skipped: number;
  format: 'csv' | 'camt';
}

export class BankFormatError extends Error {
  constructor(readonly code: 'unknown-format' | 'no-columns') {
    super(code);
  }
}

const oneLine = (s: string) => s.replace(/\s+/g, ' ').trim();

/** Normalized header names (see `normalizeHeader`) of the columns we read, with known variants. */
const COLUMNS = {
  date: ['buchungstag', 'buchungsdatum', 'datum', 'booking date'],
  amount: ['betrag', 'umsatz', 'amount'],
  currency: ['wahrung', 'waehrung', 'currency'],
  payee: [
    'beguenstigter zahlungspflichtiger',
    'begunstigter zahlungspflichtiger',
    'beguenstigter',
    'name zahlungsbeteiligter',
    'empfaenger',
    'auftraggeber empfaenger',
  ],
  purpose: ['verwendungszweck', 'buchungstext verwendungszweck', 'zweck'],
  bookingText: ['buchungstext'],
  account: ['auftragskonto', 'konto', 'iban auftragskonto'],
} as const;

function pick(record: Record<string, string>, names: readonly string[]): string {
  for (const n of names) if (record[n] !== undefined && record[n] !== '') return record[n]!;
  return '';
}

/** Header names get their umlauts stripped by `normalizeHeader` ("Währung" → "wahrung"). */
function hasColumn(keys: Set<string>, names: readonly string[]): boolean {
  return names.some((n) => keys.has(n));
}

export function parseBankCsv(text: string): BankParseResult {
  const table = csvTable(text);
  const keys = new Set(table.records[0] ? Object.keys(table.records[0]) : []);
  // The header row alone is enough to recognise the layout even with zero data rows.
  const headerKeys = new Set(table.header.map(normalizeHeader));
  const all = new Set([...keys, ...headerKeys]);
  if (!hasColumn(all, COLUMNS.date) || !hasColumn(all, COLUMNS.amount))
    throw new BankFormatError('no-columns');

  const transactions: BankTransaction[] = [];
  let skipped = 0;
  for (const rec of table.records) {
    const date = parseDateInput(pick(rec, COLUMNS.date));
    const amountMinor = parseMoney(pick(rec, COLUMNS.amount), { allowNegative: true });
    if (!date || amountMinor === undefined || amountMinor === 0) {
      skipped += 1;
      continue;
    }
    const accountIban = pick(rec, COLUMNS.account).replace(/\s/g, '');
    transactions.push({
      date,
      amountMinor,
      currency: (pick(rec, COLUMNS.currency) || 'EUR').toUpperCase(),
      payee: oneLine(pick(rec, COLUMNS.payee)),
      purpose: oneLine(pick(rec, COLUMNS.purpose) || pick(rec, COLUMNS.bookingText)),
      ...(accountIban ? { accountIban } : {}),
    });
  }
  return { transactions, skipped, format: 'csv' };
}

/** First descendant with this local name (namespace-agnostic: CAMT versions differ in the URI). */
function child(el: Element, name: string): Element | undefined {
  for (const c of Array.from(el.children)) if (c.localName === name) return c;
  return undefined;
}

function path(el: Element | undefined, ...names: string[]): Element | undefined {
  let cur = el;
  for (const n of names) {
    if (!cur) return undefined;
    cur = child(cur, n);
  }
  return cur;
}

function descendants(el: Element, name: string): Element[] {
  return Array.from(el.getElementsByTagName('*')).filter((e) => e.localName === name);
}

export function parseCamt(xml: string): BankParseResult {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length > 0 || !doc.documentElement)
    throw new BankFormatError('unknown-format');
  const entries = descendants(doc.documentElement, 'Ntry');
  if (entries.length === 0 && !descendants(doc.documentElement, 'Stmt').length)
    if (!descendants(doc.documentElement, 'Rpt').length)
      throw new BankFormatError('unknown-format');

  const transactions: BankTransaction[] = [];
  let skipped = 0;
  for (const ntry of entries) {
    const stmt = ntry.parentElement;
    const iban = path(stmt ?? undefined, 'Acct', 'Id', 'IBAN')?.textContent?.trim();
    const amt = child(ntry, 'Amt');
    const bookDate =
      path(ntry, 'BookgDt', 'Dt')?.textContent ?? path(ntry, 'ValDt', 'Dt')?.textContent;
    const date = bookDate ? parseDateInput(bookDate.slice(0, 10)) : undefined;
    const value = amt?.textContent ? parseMoney(amt.textContent.trim()) : undefined;
    const debit = child(ntry, 'CdtDbtInd')?.textContent?.trim() === 'DBIT';
    if (!date || value === undefined || value === 0) {
      skipped += 1;
      continue;
    }
    const details = path(ntry, 'NtryDtls', 'TxDtls');
    // For a debit the interesting party is the creditor, for a credit the debtor.
    const party = path(details, 'RltdPties', debit ? 'Cdtr' : 'Dbtr');
    const name = path(party, 'Nm')?.textContent ?? path(party, 'Pty', 'Nm')?.textContent ?? '';
    const remittance = details
      ? descendants(details, 'Ustrd')
          .map((e) => e.textContent ?? '')
          .join(' ')
      : '';
    transactions.push({
      date,
      amountMinor: debit ? -value : value,
      currency: (amt?.getAttribute('Ccy') ?? 'EUR').toUpperCase(),
      payee: oneLine(name),
      purpose: oneLine(remittance || child(ntry, 'AddtlNtryInf')?.textContent || ''),
      ...(iban ? { accountIban: iban } : {}),
    });
  }
  return { transactions, skipped, format: 'camt' };
}

/** CAMT (XML) or bank CSV, decided by the content. */
export function parseBankFile(text: string): BankParseResult {
  const body = text.replace(/^\uFEFF/, '').trimStart();
  return body.startsWith('<') ? parseCamt(body) : parseBankCsv(body);
}

/** Stable key for duplicate detection: the same booking imported twice must collide. */
export function bankDedupeKey(t: BankTransaction): string {
  return [t.date, t.amountMinor, t.payee.toLowerCase(), t.purpose.toLowerCase().slice(0, 40)].join(
    '|',
  );
}
