import { dateTimeFormat } from '@/core/i18n/format';
import { DATE_RE, TIME_RE, isCalendarDate, pad2, parseDate, today } from '@/core/time/dates';

/**
 * Reading and writing dates and times the way the app's region writes them (`DayField`, `TimeField`): the value
 * stays `YYYY-MM-DD` / `HH:mm`, the text in the field follows the format setting, never the system's locale.
 */
type Part = 'day' | 'month' | 'year';

/** Order of day, month and year and the sign between them in the app's region ("31.12.2026", "12/31/2026"). */
export function dateShape(): { order: Part[]; separator: string } {
  const parts = dateTimeFormat({ day: '2-digit', month: '2-digit', year: 'numeric' }).formatToParts(
    new Date(2026, 11, 31),
  );
  const order = parts
    .map((p) => p.type)
    .filter((type): type is Part => type === 'day' || type === 'month' || type === 'year');
  const separator = parts.find((p) => p.type === 'literal')?.value.trim() || '.';
  return { order, separator };
}

/** "TT.MM.JJJJ" for the region: the placeholder of an empty date field. */
export function datePlaceholder(letters: { day: string; month: string; year: string }): string {
  const { order, separator } = dateShape();
  return order
    .map((p) => (p === 'year' ? letters.year.repeat(4) : letters[p].repeat(2)))
    .join(separator);
}

/** `YYYY-MM-DD` as the region writes it; anything else comes back unchanged. */
export function formatDateInput(value: string): string {
  if (!DATE_RE.test(value)) return value;
  return dateTimeFormat({ day: '2-digit', month: '2-digit', year: 'numeric' }).format(
    parseDate(value),
  );
}

/**
 * What someone typed as a date → `YYYY-MM-DD`, or `undefined` while it is no date. Reads the ISO form, the region's
 * order with any separator ("3.9.26", "03/09/2026", "3 9") and digits without one ("03092026"); a missing year is
 * the current one, a two-digit year lies in this century.
 */
export function parseDateInput(text: string, ref: string = today()): string | undefined {
  const raw = text.trim();
  if (raw === '') return undefined;
  if (DATE_RE.test(raw)) return isCalendarDate(raw) ? raw : undefined;
  const { order } = dateShape();
  let pieces = raw.split(/\D+/).filter(Boolean);
  if (pieces.length === 1 && /^\d{6}$|^\d{8}$/.test(pieces[0]!)) {
    // Digits only: two each for day and month, the rest is the year, in the region's order.
    const digits = pieces[0]!;
    const yearLen = digits.length - 4;
    pieces = [];
    let at = 0;
    for (const p of order) {
      const len = p === 'year' ? yearLen : 2;
      pieces.push(digits.slice(at, at + len));
      at += len;
    }
  }
  const withoutYear = order.filter((p) => p !== 'year');
  const names = pieces.length === 2 ? withoutYear : pieces.length === 3 ? order : undefined;
  if (!names) return undefined;
  const got: Partial<Record<Part, number>> = {};
  names.forEach((p, i) => (got[p] = Number(pieces[i])));
  const yearText = pieces[names.indexOf('year')] ?? '';
  const year =
    got.year === undefined
      ? Number(ref.slice(0, 4))
      : yearText.length <= 2
        ? 2000 + got.year
        : got.year;
  if (yearText.length === 3 || yearText.length > 4) return undefined;
  const iso = `${String(year).padStart(4, '0')}-${pad2(got.month ?? 0)}-${pad2(got.day ?? 0)}`;
  return DATE_RE.test(iso) && isCalendarDate(iso) ? iso : undefined;
}

/** `HH:mm` as the region writes it ("14:30", "2:30 PM"). */
export function formatTimeInput(value: string): string {
  if (!TIME_RE.test(value)) return value;
  const [h, m] = value.split(':').map(Number) as [number, number];
  return dateTimeFormat({ hour: '2-digit', minute: '2-digit' }).format(new Date(2026, 0, 1, h, m));
}

/** What someone typed as a time → `HH:mm`: "9", "930", "9:30", "9.30", "9:30 pm", "14 Uhr". */
export function parseTimeInput(text: string): string | undefined {
  const raw = text.trim().toLowerCase();
  if (raw === '') return undefined;
  const pm = /p\.?\s*m\.?/.test(raw);
  const am = /a\.?\s*m\.?/.test(raw);
  let pieces = raw.split(/\D+/).filter(Boolean);
  if (pieces.length === 1 && pieces[0]!.length >= 3 && pieces[0]!.length <= 4)
    pieces = [pieces[0]!.slice(0, -2), pieces[0]!.slice(-2)];
  if (pieces.length < 1 || pieces.length > 2) return undefined;
  let hour = Number(pieces[0]);
  const minute = Number(pieces[1] ?? 0);
  if (pm && hour < 12) hour += 12;
  if (am && hour === 12) hour = 0;
  const value = `${pad2(hour)}:${pad2(minute)}`;
  return TIME_RE.test(value) ? value : undefined;
}
