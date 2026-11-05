/**
 * Birthdays from a vCard (.vcf, contacts export) or an iCalendar file (.ics, a birthday calendar).
 * Plain text in, plain records out: nothing is sent anywhere, nothing is kept besides what the reader confirms.
 */

export interface ParsedPerson {
  name: string;
  month: number;
  day: number;
  year?: number;
  phone?: string;
  email?: string;
}

/** Joins folded lines (a continuation starts with a space or tab) and splits into logical lines. */
function unfold(text: string): string[] {
  return text
    .replace(/\r\n|\r/g, '\n')
    .replace(/\n[ \t]/g, '')
    .split('\n');
}

/** "BDAY" and "DTSTART" values: 19850315, 1985-03-15, --0315, --03-15. */
export function parseDateValue(
  raw: string,
): { month: number; day: number; year?: number } | undefined {
  const v = raw.trim().replace(/T.*$/, '');
  const full = /^(\d{4})-?(\d{2})-?(\d{2})$/.exec(v);
  const short = /^--(\d{2})-?(\d{2})$/.exec(v);
  const [year, month, day] = full
    ? [Number(full[1]), Number(full[2]), Number(full[3])]
    : short
      ? [undefined, Number(short[1]), Number(short[2])]
      : [undefined, 0, 0];
  if (!month || !day || month > 12 || day > 31) return undefined;
  // Many exports use 1604 or 1900 for "year unknown".
  return { month, day, ...(year && year > 1900 ? { year } : {}) };
}

const valueOf = (line: string): string => line.slice(line.indexOf(':') + 1).trim();

/** vCard 2.1 (Android exports): `FN;CHARSET=UTF-8;ENCODING=QUOTED-PRINTABLE:J=C3=BCrgen`. */
const isQuotedPrintable = (line: string): boolean =>
  /(?:^|;)(?:ENCODING=)?QUOTED-PRINTABLE(?:;|$)/i.test(
    line.slice(0, Math.max(0, line.indexOf(':'))),
  );

/** "J=C3=BCrgen" → "Jürgen", in the property's CHARSET (UTF-8 when none or unknown). */
function decodeQuotedPrintable(value: string, charset: string | undefined): string {
  const bytes: number[] = [];
  const encoder = new TextEncoder();
  for (const m of value.matchAll(/=([0-9A-Fa-f]{2})|[\s\S]/gu)) {
    if (m[1]) bytes.push(parseInt(m[1], 16));
    else bytes.push(...encoder.encode(m[0]));
  }
  try {
    return new TextDecoder(charset ?? 'utf-8').decode(new Uint8Array(bytes));
  } catch {
    return new TextDecoder().decode(new Uint8Array(bytes));
  }
}

/** The value of a text property, quoted-printable decoded where the line says so (X35). */
function textOf(line: string): string {
  const value = valueOf(line);
  if (!isQuotedPrintable(line)) return value;
  const charset = /;CHARSET=([^;:]+)/i.exec(line.slice(0, line.indexOf(':')))?.[1];
  return decodeQuotedPrintable(value, charset).trim();
}

/** Lines of a vCard: quoted-printable soft breaks (a line ending in "=") joined, then unfolded. */
function vcfLines(text: string): string[] {
  const raw = text.replace(/\r\n|\r/g, '\n').split('\n');
  const joined: string[] = [];
  for (let i = 0; i < raw.length; i++) {
    let line = raw[i]!;
    if (isQuotedPrintable(line))
      while (line.endsWith('=') && i + 1 < raw.length) line = line.slice(0, -1) + raw[++i]!;
    joined.push(line);
  }
  return unfold(joined.join('\n'));
}

const propOf = (line: string): string => line.split(/[;:]/)[0]!.toUpperCase();
const unescapeText = (s: string): string =>
  s
    .replace(/\\n/gi, ' ')
    .replace(/\\([,;\\])/g, '$1')
    .trim();

export function parseVcf(text: string): ParsedPerson[] {
  const out: ParsedPerson[] = [];
  let cur: Partial<ParsedPerson> & { n?: string } = {};
  let inCard = false;
  for (const line of vcfLines(text)) {
    const p = propOf(line);
    if (p === 'BEGIN' && /VCARD/i.test(line)) {
      inCard = true;
      cur = {};
    } else if (p === 'END' && /VCARD/i.test(line)) {
      const name = cur.name || cur.n;
      if (inCard && name && cur.month && cur.day)
        out.push({
          name,
          month: cur.month,
          day: cur.day,
          ...(cur.year ? { year: cur.year } : {}),
          ...(cur.phone ? { phone: cur.phone } : {}),
          ...(cur.email ? { email: cur.email } : {}),
        });
      inCard = false;
    } else if (inCard) {
      if (p === 'FN') cur.name = unescapeText(textOf(line));
      else if (p === 'N') {
        const [family, given] = textOf(line).split(';');
        cur.n = [given, family].filter(Boolean).join(' ').trim() || undefined;
      } else if (p === 'BDAY') {
        const d = parseDateValue(valueOf(line));
        if (d) Object.assign(cur, d);
      } else if (p === 'TEL' && !cur.phone) cur.phone = valueOf(line).replace(/^tel:/i, '');
      else if (p === 'EMAIL' && !cur.email) cur.email = valueOf(line);
    }
  }
  return out;
}

/** Words that name the event kind in birthday calendars; removed to get the name. */
const BIRTHDAY_WORDS =
  /\b(birthday|geburtstag(?: von)?|cumplea[ñn]os(?: de)?|anniversaire(?: de)?|anivers[áa]rio(?: de)?)\b/gi;

/** Yearly all-day events (a birthday calendar) become people; the year is not taken (it is often a placeholder). */
export function parseIcs(text: string): ParsedPerson[] {
  const out: ParsedPerson[] = [];
  let ev: { summary?: string; start?: string; yearly?: boolean } | undefined;
  for (const line of unfold(text)) {
    const p = propOf(line);
    if (p === 'BEGIN' && /VEVENT/i.test(line)) ev = {};
    else if (p === 'END' && /VEVENT/i.test(line)) {
      const d = ev?.start && ev.yearly ? parseDateValue(ev.start) : undefined;
      const name = ev?.summary
        ?.replace(BIRTHDAY_WORDS, ' ')
        .replace(/['’]s\b/gi, ' ')
        .replace(/[:–-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (d && name) out.push({ name, month: d.month, day: d.day });
      ev = undefined;
    } else if (ev) {
      if (p === 'SUMMARY') ev.summary = unescapeText(valueOf(line));
      else if (p === 'DTSTART' && /^\d{8}$/.test(valueOf(line))) ev.start = valueOf(line);
      else if (p === 'RRULE' && /FREQ=YEARLY/i.test(line)) ev.yearly = true;
    }
  }
  return out;
}

export const parseContactsFile = (fileName: string, text: string): ParsedPerson[] =>
  /\.ics$/i.test(fileName) || /BEGIN:VCALENDAR/i.test(text) ? parseIcs(text) : parseVcf(text);
