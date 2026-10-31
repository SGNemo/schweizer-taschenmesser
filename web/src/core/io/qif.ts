/**
 * QIF bank statements (`!Type:Bank`, `!Type:CCard`, …): one record per `^`, lines `D` date, `T` (or
 * `U`) amount, `P` payee, `M` memo. Dates come as `DD.MM.YYYY`, `MM/DD'YY`, `MM/DD/YYYY`,
 * `DD/MM/YYYY` or `YYYY-MM-DD`. Pure function on text.
 */
import { parseLooseAmount } from './amount';
import type { BankParseResult, BankTransaction } from './bank';

const oneLine = (s: string) => s.replace(/\s+/g, ' ').trim();

export function looksLikeQif(text: string): boolean {
  return /^\s*!Type:\s*\w+/im.test(text.slice(0, 2000));
}

type Order = 'dmy' | 'mdy';

function real(y: number, m: number, d: number): string | undefined {
  const probe = new Date(Date.UTC(y, m - 1, d));
  if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== m - 1 || probe.getUTCDate() !== d)
    return undefined;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Quicken writes an apostrophe before a year of the 2000s ("3/ 9'26"); two digits otherwise mean 20xx. */
const fullYear = (y: string): number => (y.length === 2 ? 2000 + Number(y) : Number(y));

function qifDate(value: string, slashOrder: Order): string | undefined {
  const s = value.replace(/\s+/g, '').trim();
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  if (m) return real(Number(m[1]), Number(m[2]), Number(m[3]));
  m = /^(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})$/.exec(s);
  if (m) return real(fullYear(m[3]!), Number(m[2]), Number(m[1]));
  m = /^(\d{1,2})\/(\d{1,2})(?:'|\/)(\d{2}|\d{4})$/.exec(s);
  if (m) {
    const apostrophe = s.includes("'");
    const [a, b] = [Number(m[1]), Number(m[2])];
    const order: Order = apostrophe ? 'mdy' : slashOrder;
    return order === 'mdy' ? real(fullYear(m[3]!), a, b) : real(fullYear(m[3]!), b, a);
  }
  return undefined;
}

export function parseQif(text: string): BankParseResult {
  const lines = text
    .replace(/^﻿/, '')
    .split(/\r\n|\n|\r/)
    .map((l) => l.trimEnd());
  if (!lines.some((l) => /^!Type:/i.test(l.trim()))) throw new Error('not-qif');
  // Slash dates are US order (month first) unless a first part above 12 proves day first.
  const slashFirst = lines
    .filter((l) => l.startsWith('D'))
    .map((l) => /^(\d{1,2})\s*\/\s*\d{1,2}\s*\/\s*\d{2,4}/.exec(l.slice(1).trim()))
    .filter((m): m is RegExpExecArray => m !== null)
    .map((m) => Number(m[1]));
  const slashOrder: Order = slashFirst.some((n) => n > 12) ? 'dmy' : 'mdy';

  const transactions: BankTransaction[] = [];
  let skipped = 0;
  let rec: { d?: string; t?: string; p?: string; m?: string; n?: string } = {};
  // `!Account` and `!Option` blocks also use `N`/`T` lines; only `!Type:` sections hold transactions.
  let ignore = false;
  const flush = () => {
    const has = !ignore && (rec.d !== undefined || rec.t !== undefined || rec.p !== undefined);
    if (has) {
      const date = rec.d !== undefined ? qifDate(rec.d, slashOrder) : undefined;
      const amountMinor = rec.t !== undefined ? parseLooseAmount(rec.t) : undefined;
      if (!date || amountMinor === undefined || amountMinor === 0) skipped += 1;
      else {
        transactions.push({
          date,
          amountMinor,
          // A QIF file carries no currency: left to the target account.
          currency: '',
          payee: oneLine(rec.p ?? ''),
          purpose: oneLine(rec.m ?? ''),
        });
      }
    }
    rec = {};
  };
  for (const line of lines) {
    if (!line) continue;
    const tag = line[0]!;
    const value = line.slice(1);
    if (tag === '!') {
      flush();
      ignore = !/^!Type:/i.test(line.trim());
    } else if (tag === '^') flush();
    else if (tag === 'D') rec.d = value;
    else if (tag === 'T' || (tag === 'U' && rec.t === undefined)) rec.t = value;
    else if (tag === 'P') rec.p = value;
    else if (tag === 'M') rec.m = value;
    else if (tag === 'N') rec.n = value;
  }
  flush();
  return { transactions, skipped, format: 'qif' };
}
