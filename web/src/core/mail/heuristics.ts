/**
 * Local recognition of invoices, subscriptions, appointments and contracts in mail text.
 * Input is sender, subject, date and a text excerpt (the preview line for the onboarding scan, the
 * opened mail for "create from this mail"); this file is pure and deliberately has no access to
 * anything else – no AI, no database.
 */
import { addDaysStr, pad2 } from '@/core/time/dates';
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

function validDate(y: number, m: number, d: number): string | undefined {
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d)
    return undefined;
  return `${y}-${pad2(m)}-${pad2(d)}`;
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
  return m ? `${pad2(Number(m[1]))}:${m[2]}` : undefined;
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

/** „Mahnung“, „2. Mahnung“, „Zahlungserinnerung“, „Zahlungsaufforderung“ (the words of the parser). */
const DUNNING =
  /(?<![\p{L}\p{N}])(?:([1-3])\.\s*)?(mahnung|zahlungserinnerung|zahlungsaufforderung)(?![\p{L}\p{N}])/iu;
/** The level of a payment reminder named in the text („2. Mahnung“ → 2, „Zahlungserinnerung“ → 1). */
export function dunningOf(text: string): number | undefined {
  const m = DUNNING.exec(text);
  return m ? (m[1] ? Number(m[1]) : 1) : undefined;
}

/** The amount is collected by the payee: nothing to pay or plan. */
const DEBIT = /(abgebucht|abbuchung|lastschrift|wird eingezogen|direct debit)/i;
/** A reminder names its new deadline mostly with „bis“. */
const DEADLINE = /(fällig|zahlbar|zahlungsziel|spätestens|\bbis\b|due)/i;

/** An invoice mail as one row of the mail list can show it (sender, subject and preview line only). */
export interface InvoiceRead {
  payee: string;
  amountMinor?: number;
  /** Due day; for a reminder its new deadline, for a debit the day of the debit. 'YYYY-MM-DD'. */
  date?: string;
  /** A payment reminder and its level (1–3). */
  dunning?: number;
  /** „wird abgebucht“: shown as text, nothing to create. */
  debit: boolean;
  /** Exactly one amount, a date and a payee name: the values can be written in one tap. */
  sure: boolean;
  /** 'YYYY-MM-DD' of the mail. */
  mailDate: string;
}

/**
 * Reads an invoice or payment reminder from what a list row holds. Pure and local, like `analyzeMessage`
 * (whose invoice rule it uses). `sure` only with one amount, one date and a payee that is a name (never
 * an address): anything less opens the preview sheet instead of writing.
 */
export function readInvoiceMail(m: MailMeta): InvoiceRead | undefined {
  const found = analyzeMessage(m);
  if (found?.kind !== 'invoice') return undefined;
  const text = `${cleanSubject(m.subject)}. ${m.snippet}`;
  const dun = dunningOf(text);
  const debit = !dun && DEBIT.test(text);
  const date =
    found.date ??
    (dun ? dateNear(text, DEADLINE, found.mailDate) : undefined) ??
    (debit ? findDates(text, found.mailDate)[0]?.date : undefined);
  const amounts = new Set(
    [...text.matchAll(AMOUNT)].map((x) => parseMoney(x[1] ?? x[2] ?? '')).filter(Boolean),
  );
  const payee = found.title.trim();
  return {
    payee,
    ...(found.amountMinor !== undefined ? { amountMinor: found.amountMinor } : {}),
    ...(date ? { date } : {}),
    ...(dun ? { dunning: dun } : {}),
    debit,
    sure:
      found.amountMinor !== undefined &&
      !!date &&
      amounts.size === 1 &&
      !!payee &&
      !payee.includes('@'),
    mailDate: found.mailDate,
  };
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

/** Gmail's bulk categories: mail there is not from a person. */
const BULK_LABELS = [
  'CATEGORY_PROMOTIONS',
  'CATEGORY_SOCIAL',
  'CATEGORY_UPDATES',
  'CATEGORY_FORUMS',
];

/**
 * „Persönlich“: the sender is a person, read from headers only (no model): no `List-Unsubscribe`, no
 * `Precedence: bulk|list|junk`, no Gmail bulk category. Only this boolean is kept, never the headers.
 * Broader than the scan's `bulk` (List-Unsubscribe only) on purpose: the filter leaves out more.
 */
export function isPersonalMail(m: {
  listUnsubscribe?: string;
  precedence?: string;
  labelIds: readonly string[];
}): boolean {
  if ((m.listUnsubscribe ?? '').trim()) return false;
  if (/^\s*(bulk|list|junk)\b/i.test(m.precedence ?? '')) return false;
  return !m.labelIds.some((l) => BULK_LABELS.includes(l));
}
