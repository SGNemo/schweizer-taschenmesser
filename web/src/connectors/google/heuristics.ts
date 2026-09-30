/**
 * Local recognition of invoices, subscriptions, appointments and contracts in mail metadata.
 * Input is only what the connector reads (sender, subject, date, preview line); this file is pure
 * and deliberately has no access to anything else – no AI, no database.
 */
import { addDaysStr } from '@/core/time/dates';
import { parseMoney } from '@/core/money';
import type { MailFinding } from '@/core/connectors/types';

export interface MailMeta {
  id: string;
  from: string;
  subject: string;
  snippet: string;
  /** Epoch ms (Gmail `internalDate`). */
  dateMs: number;
  /** A `List-Unsubscribe` header is present (newsletters, marketing). */
  bulk: boolean;
}

const MONTHS: Record<string, number> = {
  januar: 1,
  jänner: 1,
  jan: 1,
  februar: 2,
  feb: 2,
  märz: 3,
  maerz: 3,
  mär: 3,
  april: 4,
  apr: 4,
  mai: 5,
  juni: 6,
  jun: 6,
  juli: 7,
  jul: 7,
  august: 8,
  aug: 8,
  september: 9,
  sep: 9,
  sept: 9,
  oktober: 10,
  okt: 10,
  november: 11,
  nov: 11,
  dezember: 12,
  dez: 12,
};

const pad = (n: number) => String(n).padStart(2, '0');

function validDate(y: number, m: number, d: number): string | undefined {
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d)
    return undefined;
  return `${y}-${pad(m)}-${pad(d)}`;
}

/** A year-less date means "the next time it occurs after the mail". */
function resolveYear(mailDate: string, m: number, d: number): string | undefined {
  const year = Number(mailDate.slice(0, 4));
  const first = validDate(year, m, d);
  if (first && first >= addDaysStr(mailDate, -30)) return first;
  return validDate(year + 1, m, d);
}

const DATE_PATTERNS = [
  // 15.10.2026 · 15.10.26 · 15.10.
  /\b(\d{1,2})\.\s?(\d{1,2})\.(?:\s?(\d{4}|\d{2})\b)?/g,
  // 2026-10-15
  /\b(\d{4})-(\d{2})-(\d{2})\b/g,
  // 15. Oktober 2026 · 15 Okt
  /\b(\d{1,2})\.?\s+(januar|jänner|februar|märz|maerz|april|mai|juni|juli|august|september|oktober|november|dezember|jan|feb|mär|apr|jun|jul|aug|sept|sep|okt|nov|dez)\.?(?:\s+(\d{4}))?/gi,
];

export interface FoundDate {
  date: string;
  index: number;
}

/** All dates in the text, in order of appearance. */
export function findDates(text: string, mailDate: string): FoundDate[] {
  const found: FoundDate[] = [];
  for (const m of text.matchAll(DATE_PATTERNS[1]!)) {
    const d = validDate(Number(m[1]), Number(m[2]), Number(m[3]));
    if (d) found.push({ date: d, index: m.index ?? 0 });
  }
  for (const m of text.matchAll(DATE_PATTERNS[0]!)) {
    const day = Number(m[1]);
    const month = Number(m[2]);
    let d: string | undefined;
    if (m[3]) {
      const year = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
      d = validDate(year, month, day);
    } else d = resolveYear(mailDate, month, day);
    if (d) found.push({ date: d, index: m.index ?? 0 });
  }
  for (const m of text.matchAll(DATE_PATTERNS[2]!)) {
    const month = MONTHS[m[2]!.toLowerCase()];
    if (!month) continue;
    const day = Number(m[1]);
    const d = m[3] ? validDate(Number(m[3]), month, day) : resolveYear(mailDate, month, day);
    if (d) found.push({ date: d, index: m.index ?? 0 });
  }
  return found.sort((a, b) => a.index - b.index);
}

const AMOUNT =
  /(?:(?:€|eur(?:o)?)\s?(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})|(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})\s?(?:€|eur(?:o)?\b))/gi;
const TOTAL_HINT = /(gesamt|summe|betrag|total|zu zahlen|zahlbetrag|rechnungsbetrag)/i;

/** The amount (cents) that most likely is "what has to be paid". */
export function findAmount(text: string): number | undefined {
  const all = [...text.matchAll(AMOUNT)]
    .map((m) => ({
      cents: parseMoney(m[1] ?? m[2] ?? ''),
      near: TOTAL_HINT.test(text.slice(Math.max(0, (m.index ?? 0) - 30), m.index ?? 0)),
    }))
    .filter((a): a is { cents: number; near: boolean } => a.cents !== undefined && a.cents > 0);
  return (all.find((a) => a.near) ?? all[0])?.cents;
}

function dateNear(text: string, hint: RegExp, mailDate: string): string | undefined {
  const m = hint.exec(text);
  if (!m) return undefined;
  const after = text.slice(m.index, m.index + 70);
  return findDates(after, mailDate)[0]?.date;
}

const RE = {
  invoice:
    /(rechnung|invoice|zahlungserinnerung|mahnung|zahlungsaufforderung|payment due|offener betrag)/i,
  subscription:
    /(\babo\b|abonnement|subscription|mitgliedschaft|membership|verlängert sich|verlängerung|renewal|auto-?renew|abbuchung)/i,
  contract:
    /(kündigungsfrist|vertragslaufzeit|vertragsende|vertragsbestätigung|versicherungsschein|versicherungspolice|\bpolice\b|auftragsbestätigung|laufzeit)/i,
  event:
    /(ticket|buchungsbestätigung|buchung|reservierung|reservation|boarding|\bflug\b|einladung|termin|check-?in|veranstaltung|konzert|zugfahrt|fahrkarte)/i,
  due: /(fällig|zahlbar|zahlungsziel|zahlung bis|spätestens|due)/i,
  end: /(vertragsende|läuft bis|laufzeit bis|gültig bis|endet am|bis zum|ende der laufzeit)/i,
  next: /(nächste abbuchung|nächste zahlung|verlängert sich am|verlängerung am|renews on|abgebucht am|am)/i,
};

function frequency(text: string): MailFinding['freq'] {
  if (/(vierteljähr|quartal|quarter)/i.test(text)) return 'quarterly';
  if (/(jähr|annual|yearly|per year|pro jahr)/i.test(text)) return 'yearly';
  if (/(wöchentlich|weekly|pro woche)/i.test(text)) return 'weekly';
  return 'monthly';
}

function noticeDays(text: string): number | undefined {
  const m = /kündigungsfrist[^.\d]{0,30}(\d{1,3})\s*(tage|wochen|monate|monat)/i.exec(text);
  if (!m) return undefined;
  const n = Number(m[1]);
  const unit = m[2]!.toLowerCase();
  return unit.startsWith('woche') ? n * 7 : unit.startsWith('monat') ? n * 30 : n;
}

function timeOf(text: string): string | undefined {
  const m = /\b([01]?\d|2[0-3]):([0-5]\d)\b(?:\s?uhr)?/i.exec(text);
  return m ? `${pad(Number(m[1]))}:${m[2]}` : undefined;
}

function placeOf(text: string): string | undefined {
  const m = /\b(?:ort|location|treffpunkt)\s*:\s*([^\n.;|]{3,60})/i.exec(text);
  return m?.[1]?.trim();
}

/** "Anna Muster <anna@example.test>" → "Anna Muster"; a bare address stays as is. */
export function senderName(from: string): string {
  const named = /^\s*"?([^"<]+?)"?\s*<[^>]+>\s*$/.exec(from);
  return (named?.[1] ?? from.replace(/[<>]/g, '')).trim();
}

const cleanSubject = (s: string) => s.replace(/^\s*((re|aw|fwd|wg):\s*)+/i, '').trim();

export function analyzeMessage(m: MailMeta): MailFinding | undefined {
  const mailDate = new Date(m.dateMs).toISOString().slice(0, 10);
  const subject = cleanSubject(m.subject);
  const text = `${subject}. ${m.snippet}`;
  const amountMinor = findAmount(text);
  const base = {
    ref: `gmail:${m.id}`,
    url: `https://mail.google.com/mail/u/0/#all/${m.id}`,
    mailDate,
  };
  const sender = senderName(m.from) || subject;

  // Newsletters are only interesting when they really carry a bill.
  const marketing = m.bulk;

  if (RE.invoice.test(text)) {
    const date = dateNear(text, RE.due, mailDate);
    if (amountMinor === undefined && !date) return undefined;
    // Marketing mails love the word "Rechnung"; they only count with amount AND due date.
    if (marketing && (amountMinor === undefined || !date)) return undefined;
    return { ...base, kind: 'invoice', title: sender, amountMinor, date };
  }
  if (marketing) return undefined;

  if (RE.subscription.test(text) && amountMinor !== undefined) {
    return {
      ...base,
      kind: 'subscription',
      title: sender,
      amountMinor,
      freq: frequency(text),
      date: dateNear(text, RE.next, mailDate),
    };
  }
  if (RE.contract.test(text)) {
    return {
      ...base,
      kind: 'contract',
      title: sender === subject ? subject : `${sender}: ${subject}`,
      date: dateNear(text, RE.end, mailDate),
      noticeDays: noticeDays(text),
      amountMinor,
    };
  }
  if (RE.event.test(text)) {
    const dates = findDates(text, mailDate).filter((d) => d.date >= mailDate);
    const first = dates[0];
    if (!first) return undefined;
    return {
      ...base,
      kind: 'event',
      title: subject || sender,
      date: first.date,
      time: timeOf(text.slice(Math.max(0, first.index - 20), first.index + 60)) ?? timeOf(text),
      place: placeOf(text),
    };
  }
  return undefined;
}

/** Keeps the newest suggestion per (kind, title, amount): monthly bills would otherwise repeat. */
export function dedupeFindings(findings: MailFinding[]): MailFinding[] {
  const best = new Map<string, MailFinding>();
  for (const f of findings) {
    const key = [
      f.kind,
      f.title.toLowerCase(),
      f.amountMinor ?? '',
      f.kind === 'event' ? f.date : '',
    ].join('|');
    const current = best.get(key);
    if (!current || f.mailDate > current.mailDate) best.set(key, f);
  }
  return [...best.values()].sort((a, b) => b.mailDate.localeCompare(a.mailDate));
}
