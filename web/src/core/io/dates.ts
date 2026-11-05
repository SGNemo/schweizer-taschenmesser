/** Date input as people type or paste it: "15.03.2026", "15.3.26", "2026-03-15", "15.03." */
import { pad2, today } from '@/core/time/now';

const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function validDayMonth(day: number, month: number): boolean {
  return month >= 1 && month <= 12 && day >= 1 && day <= DAYS_IN_MONTH[month - 1]!;
}

function isRealDate(year: number, month: number, day: number): boolean {
  const d = new Date(Date.UTC(year, month - 1, day));
  return d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day;
}

/** 'YYYY-MM-DD' for ISO and German full dates (two-digit years mean 20xx); otherwise undefined. */
export function parseDateInput(input: string): string | undefined {
  const s = input.trim();
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  if (iso) {
    const [y, m, d] = [Number(iso[1]), Number(iso[2]), Number(iso[3])] as [number, number, number];
    return isRealDate(y, m, d) ? `${y}-${pad2(m)}-${pad2(d)}` : undefined;
  }
  const de = /^(\d{1,2})\.\s?(\d{1,2})\.\s?(\d{2}|\d{4})$/.exec(s);
  if (de) {
    const [d, m] = [Number(de[1]), Number(de[2])] as [number, number];
    const y = de[3]!.length === 2 ? 2000 + Number(de[3]) : Number(de[3]);
    return isRealDate(y, m, d) ? `${y}-${pad2(m)}-${pad2(d)}` : undefined;
  }
  return undefined;
}

export interface DayMonth {
  day: number;
  month: number;
  year?: number;
}

/**
 * "15.03.", "15.3.1990", "15.03.90". A two-digit year up to this year's is 20xx, a later one 19xx
 * ("3.4.12" → 2012, "1.12.85" → 1985): it is usually a birth year, so never in the future.
 */
export function parseDayMonth(input: string): DayMonth | undefined {
  const m = /^(\d{1,2})\.\s?(\d{1,2})\.?(?:\s?(\d{2}|\d{4}))?$/.exec(input.trim());
  if (!m) return undefined;
  const day = Number(m[1]);
  const month = Number(m[2]);
  if (!validDayMonth(day, month)) return undefined;
  if (m[3] === undefined) return { day, month };
  const yy = Number(m[3]);
  const year = m[3].length === 2 ? (yy > Number(today().slice(2, 4)) ? 1900 : 2000) + yy : yy;
  if (year < 1850 || year > 2200) return undefined;
  return { day, month, year };
}
