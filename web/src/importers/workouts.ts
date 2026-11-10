/**
 * Shared shape of training and food exports (Strong, Hevy, Cronometer): the parsers return these plain
 * rows, the fitness runtime (`modules/fitness/importer.ts`) turns them into sessions and meals. Pure.
 */
import { parseCsv } from '@/core/io/csv';

/** One set of one exercise, as the app wrote it. */
export interface ParsedSet {
  exercise: string;
  weightKg?: number;
  reps?: number;
  seconds?: number;
}

/** One workout: everything the export lists under one start time and name. */
export interface ParsedWorkout {
  date: string;
  time?: string;
  title: string;
  durationMin?: number;
  sets: ParsedSet[];
}

/** One food line of a diary export. */
export interface ParsedMeal {
  date: string;
  time?: string;
  text: string;
  kcal: number;
  proteinG?: number;
  carbsG?: number;
  fatG?: number;
}

/** Rows of a CSV with a header, as objects keyed by the lower-cased column name. */
export function csvRecords(text: string): Record<string, string>[] {
  const rows = parseCsv(text.replace(/^\uFEFF/, ''));
  const [header, ...body] = rows;
  if (!header) return [];
  const keys = header.map((h) => h.trim().toLowerCase());
  return body
    .filter((r) => r.some((c) => c.trim()))
    .map((r) => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? '').trim()])));
}

/** The header line of a CSV, lower-cased (for detection; cheap). */
export const csvHeader = (text: string): string =>
  (text.replace(/^\uFEFF/, '').split(/\r?\n/, 1)[0] ?? '').toLowerCase();

/** A number in either notation („62,5“, „62.5“); undefined for empty or invalid. */
export function num(s: string | undefined): number | undefined {
  if (!s?.trim()) return undefined;
  const t = s.trim();
  // „1,234.5“ / „1.234,5“: the earlier mark separates thousands and goes.
  const both = t.includes(',') && t.includes('.');
  const clean = both
    ? t.lastIndexOf(',') > t.lastIndexOf('.')
      ? t.replace(/\./g, '').replace(',', '.')
      : t.replace(/,/g, '')
    : t.replace(',', '.');
  const v = Number(clean);
  return Number.isFinite(v) ? v : undefined;
}

export const LB_TO_KG = 0.45359237;
const pad = (n: number) => String(n).padStart(2, '0');

/** „2026-10-15 08:30:00“ / „2026-10-15T08:30“ → date + time. */
export function isoDateTime(s: string): { date: string; time?: string } | undefined {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2}))?/.exec(s.trim());
  if (!m) return undefined;
  return {
    date: `${m[1]}-${m[2]}-${m[3]}`,
    ...(m[4] ? { time: `${pad(Number(m[4]))}:${m[5]}` } : {}),
  };
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/** „15 Oct 2026, 08:30“ (Hevy) → date + time; ISO also accepted. */
export function englishDateTime(s: string): { date: string; time?: string } | undefined {
  const iso = isoDateTime(s);
  if (iso) return iso;
  const m = /^(\d{1,2}) ([A-Za-z]{3})[a-z]* (\d{4}),? ?(?:(\d{1,2}):(\d{2}))?/.exec(s.trim());
  if (!m) return undefined;
  const month = MONTHS.indexOf(m[2]!.toLowerCase()) + 1;
  if (!month) return undefined;
  return {
    date: `${m[3]}-${pad(month)}-${pad(Number(m[1]))}`,
    ...(m[4] ? { time: `${pad(Number(m[4]))}:${m[5]}` } : {}),
  };
}

/** „1h 5m“, „45m“, „3600s“, „1:05:00“ → minutes (rounded); undefined when unreadable. */
export function durationMinutes(s: string | undefined): number | undefined {
  if (!s?.trim()) return undefined;
  // Only h:mm:ss is a clock duration; two parts are ambiguous (h:mm or mm:ss) and left unread.
  const clock = /^(\d+):(\d{2}):(\d{2})$/.exec(s.trim());
  if (clock) return Number(clock[1]) * 60 + Number(clock[2]) + Math.round(Number(clock[3]) / 60);
  if (/^\d+:\d{2}$/.test(s.trim())) return undefined;
  let sec = 0;
  let any = false;
  for (const m of s.matchAll(/(\d+(?:[.,]\d+)?)\s*(h|m|s)/gi)) {
    any = true;
    const v = Number(m[1]!.replace(',', '.'));
    sec += m[2]!.toLowerCase() === 'h' ? v * 3600 : m[2]!.toLowerCase() === 'm' ? v * 60 : v;
  }
  if (!any) return undefined;
  const min = Math.round(sec / 60);
  return min > 0 ? min : undefined;
}
