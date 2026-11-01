/**
 * Bank statement parsers: bank CSV (any layout described by a `BankCsvLayout`), CAMT.052/.053 XML,
 * OFX (SGML and XML) and QIF; the format is recognised from the content. Pure functions on text;
 * nothing here touches the network or the database.
 */
import { parseMoney } from '@/core/money';
import { parseLooseAmount } from './amount';
import { normalizeHeader, parseCsv, type Delimiter } from './csv';
import { parseDateInput } from './dates';
import { looksLikeOfx, parseOfx } from './ofx';
import { looksLikeQif, parseQif } from './qif';

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
  /** Transaction id of the bank (OFX `FITID`); only used to drop repeats inside one file. */
  fitId?: string;
}

export type BankFormat = 'csv' | 'camt' | 'ofx' | 'qif';

export interface BankParseResult {
  transactions: BankTransaction[];
  /** Rows / entries that could not be read (for the "N Zeilen übersprungen" note). */
  skipped: number;
  format: BankFormat;
}

export class BankFormatError extends Error {
  constructor(readonly code: 'unknown-format' | 'no-columns') {
    super(code);
  }
}

const oneLine = (s: string) => s.replace(/\s+/g, ' ').trim();

/** Normalized header names (see `normalizeHeader`) of the columns we read, with known variants. */
export interface BankColumnNames {
  date: readonly string[];
  amount: readonly string[];
  payee: readonly string[];
  purpose: readonly string[];
  currency?: readonly string[];
  bookingText?: readonly string[];
  account?: readonly string[];
  /** Balance after the booking; read by nothing yet, listed so a preset documents the file. */
  balance?: readonly string[];
  /** Column that says whether a booking is final ("Gebucht") or still pending. */
  status?: readonly string[];
}

/** How to read one CSV layout. Plain data: bank presets and remembered mappings are layouts. */
export interface BankCsvLayout {
  /** Fixed delimiter; unset = try `;` `,` and tab. */
  delimiter?: Delimiter;
  columns: BankColumnNames;
  /** Payee column for money that left / came in, when the file has a column per party. */
  payeeOut?: readonly string[];
  payeeIn?: readonly string[];
  /** Decimal mark of the amounts; unset = the app's region, then any usual notation. */
  decimal?: '.' | ',';
  /** Currency when the file has no currency column. */
  currency?: string;
  /** Booking text that holds the payee and the purpose ("Auftraggeber: … Buchungstext: …"). */
  textSplit?: 'comdirect';
  /** Rows whose `status` column has one of these (normalized) values are not booked yet. */
  pendingValues?: readonly string[];
}

export const GENERIC_LAYOUT: BankCsvLayout = {
  columns: {
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
      // `normalizeHeader` drops the umlaut dots instead of spelling them out: "Empfänger" → "empfanger".
      'begunstigter',
      'empfanger',
      'zahlungsempfanger',
      'auftraggeber empfanger',
      'auftraggeber',
    ],
    purpose: ['verwendungszweck', 'buchungstext verwendungszweck', 'zweck'],
    bookingText: ['buchungstext'],
    account: ['auftragskonto', 'konto', 'iban auftragskonto'],
  },
};

function pick(record: Record<string, string>, names: readonly string[] | undefined): string {
  for (const n of names ?? []) if (record[n] !== undefined && record[n] !== '') return record[n]!;
  return '';
}

function hasColumn(keys: Set<string>, names: readonly string[] | undefined): boolean {
  return (names ?? []).some((n) => keys.has(n));
}

const DELIMITERS: readonly Delimiter[] = [';', ',', '\t'];

/** A CSV file split into rows with the row that holds the column names. */
export interface LocatedHeader {
  rows: string[][];
  delimiter: Delimiter;
  /** Index into `rows`. Banks put account info above the header, so it is not always 0. */
  headerIndex: number;
}

const HEADER_SEARCH_ROWS = 60;

/** The first row (within the first rows of the file) whose normalized names satisfy `accept`. */
export function locateHeader(
  text: string,
  accept: (keys: Set<string>) => boolean,
  only?: Delimiter,
): LocatedHeader | undefined {
  for (const delimiter of only ? [only] : DELIMITERS) {
    const rows = parseCsv(text, { delimiter });
    const limit = Math.min(rows.length, HEADER_SEARCH_ROWS);
    for (let i = 0; i < limit; i++) {
      const keys = new Set(rows[i]!.map(normalizeHeader).filter(Boolean));
      if (accept(keys)) return { rows, delimiter, headerIndex: i };
    }
  }
  return undefined;
}

/** Does the header row satisfy the layout's date and amount columns? */
const acceptsLayout =
  (layout: BankCsvLayout) =>
  (keys: Set<string>): boolean =>
    hasColumn(keys, layout.columns.date) && hasColumn(keys, layout.columns.amount);

/** Splits comdirect's "Auftraggeber: X Buchungstext: Y Ref. Z" and drops the reference. */
function splitComdirect(text: string): { payee: string; purpose: string } {
  const party =
    /(?:Auftraggeber|Empf(?:ä|ae|a)nger):\s*(.*?)\s*(?=Kto\/IBAN:|BLZ\/BIC:|Buchungstext:|$)/i.exec(
      text,
    );
  const purpose = /Buchungstext:\s*(.*?)\s*(?:Ref\.\s*\S+)?\s*$/i.exec(text);
  return { payee: party?.[1] ?? '', purpose: purpose?.[1] ?? (party ? '' : text) };
}

/** Parses bank CSV with an explicit layout (a bank preset, a remembered mapping or the generic one). */
export function parseBankCsvWith(text: string, layout: BankCsvLayout): BankParseResult {
  const located = locateHeader(text, acceptsLayout(layout), layout.delimiter);
  if (!located) throw new BankFormatError('no-columns');
  const keys = located.rows[located.headerIndex]!.map(normalizeHeader);
  const c = layout.columns;
  const pending = new Set(layout.pendingValues ?? []);
  const transactions: BankTransaction[] = [];
  let skipped = 0;
  for (const cells of located.rows.slice(located.headerIndex + 1)) {
    const rec: Record<string, string> = {};
    keys.forEach((key, i) => {
      if (key && !(key in rec)) rec[key] = (cells[i] ?? '').trim();
    });
    const date = parseDateInput(pick(rec, c.date));
    const raw = pick(rec, c.amount);
    const amountMinor =
      parseMoney(raw, {
        allowNegative: true,
        ...(layout.decimal ? { decimal: layout.decimal } : {}),
      }) ?? parseLooseAmount(raw);
    if (!date || amountMinor === undefined || amountMinor === 0) {
      skipped += 1;
      continue;
    }
    if (pending.size > 0 && pending.has(normalizeHeader(pick(rec, c.status)))) {
      skipped += 1;
      continue;
    }
    const accountIban = pick(rec, c.account).replace(/\s/g, '');
    let payee = pick(rec, amountMinor < 0 ? layout.payeeOut : layout.payeeIn) || pick(rec, c.payee);
    let purpose = pick(rec, c.purpose) || pick(rec, c.bookingText);
    if (layout.textSplit === 'comdirect') {
      const split = splitComdirect(pick(rec, c.bookingText));
      payee = payee || split.payee;
      purpose = split.purpose || purpose;
    }
    transactions.push({
      date,
      amountMinor,
      currency: (pick(rec, c.currency) || layout.currency || 'EUR').toUpperCase(),
      payee: oneLine(payee),
      purpose: oneLine(purpose),
      ...(accountIban ? { accountIban } : {}),
    });
  }
  return { transactions, skipped, format: 'csv' };
}

/** Bank CSV in the usual layouts of the German banks (generic column names). */
export function parseBankCsv(text: string): BankParseResult {
  return parseBankCsvWith(text, GENERIC_LAYOUT);
}

/** Stable short id of a header row: remembered column mappings are stored under it. */
export function bankHeaderSignature(header: readonly string[]): string {
  const keys = header.map(normalizeHeader).filter(Boolean);
  const joined = keys.join('|');
  let h = 5381;
  for (let i = 0; i < joined.length; i++) h = ((h * 33) ^ joined.charCodeAt(i)) >>> 0;
  return `${keys.length}-${h.toString(36)}`;
}

/** What the column dialog needs for a CSV nobody knows: the header, a few rows, the delimiter. */
export interface BankCsvInspection {
  header: string[];
  /** Normalized names, same order as `header` (what a mapping refers to). */
  keys: string[];
  sample: string[][];
  delimiter: Delimiter;
  signature: string;
}

/** Best guess of the header row of an unknown CSV: the first row as wide as the widest rows. */
export function inspectBankCsv(text: string): BankCsvInspection | undefined {
  let best: { rows: string[][]; delimiter: Delimiter; width: number } | undefined;
  for (const delimiter of DELIMITERS) {
    const rows = parseCsv(text, { delimiter });
    const width = Math.max(0, ...rows.slice(0, HEADER_SEARCH_ROWS).map((r) => r.length));
    if (width >= 2 && (!best || width > best.width)) best = { rows, delimiter, width };
  }
  if (!best) return undefined;
  const index = best.rows.findIndex((r) => r.length === best!.width);
  const header = best.rows[index]!;
  const sample = best.rows.slice(index + 1, index + 4);
  if (sample.length === 0) return undefined;
  return {
    header,
    keys: header.map(normalizeHeader),
    sample,
    delimiter: best.delimiter,
    signature: bankHeaderSignature(header),
  };
}

/** A user's answer to "which column is the date / amount / …": normalized header names. */
export interface BankColumnMapping {
  date: string;
  amount: string;
  payee?: string;
  purpose?: string;
  decimal?: '.' | ',';
}

export function layoutFromMapping(m: BankColumnMapping, delimiter?: Delimiter): BankCsvLayout {
  return {
    ...(delimiter ? { delimiter } : {}),
    ...(m.decimal ? { decimal: m.decimal } : {}),
    columns: {
      date: [m.date],
      amount: [m.amount],
      payee: m.payee ? [m.payee] : [],
      purpose: m.purpose ? [m.purpose] : [],
    },
  };
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

/** The format of a file, decided by its content (OFX is checked before CAMT). */
export function sniffBankFormat(text: string): BankFormat {
  const body = text.replace(/^\uFEFF/, '').trimStart();
  if (looksLikeOfx(body)) return 'ofx';
  if (looksLikeQif(body)) return 'qif';
  return body.startsWith('<') ? 'camt' : 'csv';
}

/** OFX, QIF, CAMT (XML) or bank CSV, decided by the content (OFX is checked before CAMT). */
export function parseBankFile(
  text: string,
  opts: { layout?: BankCsvLayout } = {},
): BankParseResult {
  const body = text.replace(/^\uFEFF/, '').trimStart();
  try {
    if (looksLikeOfx(body)) return parseOfx(body);
    if (looksLikeQif(body)) return parseQif(body);
  } catch (e) {
    if (e instanceof BankFormatError) throw e;
    throw new BankFormatError('unknown-format');
  }
  if (body.startsWith('<')) return parseCamt(body);
  return parseBankCsvWith(body, opts.layout ?? GENERIC_LAYOUT);
}

/** Stable key for duplicate detection: the same booking imported twice must collide. */
export function bankDedupeKey(t: BankTransaction): string {
  return [t.date, t.amountMinor, t.payee.toLowerCase(), t.purpose.toLowerCase().slice(0, 40)].join(
    '|',
  );
}
