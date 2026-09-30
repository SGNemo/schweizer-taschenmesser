import { addDaysStr, startOfWeekStr } from '@/core/time/dates';
import type { Entry, Project } from './schema';

const MAX_MINUTES = 24 * 60;
/** Byte order mark: Excel needs it to read the CSV as UTF-8. */
const BOM = String.fromCharCode(0xfeff);

/**
 * "1:30", "1,5", "1.5", "8" (hours), "90m", "90 min", "2h", "2h30", "1h 30m" → minutes.
 * A bare number is hours; minutes need an "m". `undefined` for anything else or more than 24 h.
 */
export function parseDuration(text: string): number | undefined {
  const s = text.trim().toLowerCase().replace(/\s+/g, '');
  if (!s) return undefined;
  let minutes: number | undefined;
  let m: RegExpExecArray | null;
  if ((m = /^(\d{1,2}):([0-5]\d)$/.exec(s))) minutes = Number(m[1]) * 60 + Number(m[2]);
  else if ((m = /^(\d+)(?:h|std)(?:(\d{1,2})(?:m|min)?)?$/.exec(s)))
    minutes = Number(m[1]) * 60 + Number(m[2] ?? 0);
  else if ((m = /^(\d+)(?:m|min)$/.exec(s))) minutes = Number(m[1]);
  else if ((m = /^(\d+(?:[.,]\d{1,2})?)h?$/.exec(s)))
    minutes = Math.round(Number(m[1]!.replace(',', '.')) * 60);
  if (minutes === undefined || minutes <= 0 || minutes > MAX_MINUTES) return undefined;
  return minutes;
}

/** 90 → "1:30". */
export const formatMinutes = (minutes: number): string =>
  `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`;

/** 90 → "1,50" (decimal hours, for time sheets). */
export const formatDecimalHours = (minutes: number): string =>
  (Math.round((minutes / 60) * 100) / 100).toFixed(2).replace('.', ',');

/** Whole minutes since `startedAt`, at least 1 (a stopped timer always leaves a trace). */
export const elapsedMinutes = (startedAt: number, nowMs: number): number =>
  Math.max(1, Math.round((nowMs - startedAt) / 60_000));

/** h:mm:ss of a running timer. */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = total % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

export const isRunning = (e: Pick<Entry, 'startedAt'>): boolean => typeof e.startedAt === 'number';

/** Minutes of an entry; a running one counts what has elapsed so far. */
export const minutesOf = (e: Entry, nowMs: number): number =>
  typeof e.startedAt === 'number' ? elapsedMinutes(e.startedAt, nowMs) : e.minutes;

export const runningEntry = <T extends Entry>(entries: readonly T[]): T | undefined =>
  entries.find(isRunning);

export function weekBounds(date: string): { from: string; to: string } {
  const from = startOfWeekStr(date);
  return { from, to: addDaysStr(from, 6) };
}

export interface ProjectTotal {
  projectId: string;
  minutes: number;
}

/** Minutes per project between two dates (inclusive), biggest first. */
export function totalsByProject(
  entries: readonly Entry[],
  from: string,
  to: string,
  nowMs: number,
): ProjectTotal[] {
  const sums = new Map<string, number>();
  for (const e of entries) {
    if (e.date < from || e.date > to) continue;
    sums.set(e.projectId, (sums.get(e.projectId) ?? 0) + minutesOf(e, nowMs));
  }
  return [...sums]
    .map(([projectId, minutes]) => ({ projectId, minutes }))
    .sort((a, b) => b.minutes - a.minutes);
}

/** Entries grouped by day, newest day first; inside a day the newest entry first. */
export function groupByDate<T extends Entry & { createdAt: number }>(
  entries: readonly T[],
): { date: string; entries: T[] }[] {
  const map = new Map<string, T[]>();
  for (const e of entries) map.set(e.date, [...(map.get(e.date) ?? []), e]);
  return [...map]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, list]) => ({ date, entries: list.sort((a, b) => b.createdAt - a.createdAt) }));
}

/**
 * One CSV cell: quoted when needed, and a leading = + - @ is defused so a spreadsheet never runs a
 * note as a formula.
 */
export function csvCell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[;"\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export interface CsvLabels {
  date: string;
  project: string;
  duration: string;
  decimal: string;
  note: string;
  total: string;
}

/** Time sheet of one month as German-Excel CSV (semicolons, decimal comma, BOM). */
export function buildCsv(
  entries: readonly Entry[],
  projects: ReadonlyMap<string, Pick<Project, 'name'>>,
  month: string,
  labels: CsvLabels,
): string {
  const rows = entries
    .filter((e) => e.date.startsWith(month) && !isRunning(e))
    .sort((a, b) => a.date.localeCompare(b.date) || a.projectId.localeCompare(b.projectId));
  const line = (cells: string[]) => cells.map(csvCell).join(';');
  const out = [line([labels.date, labels.project, labels.duration, labels.decimal, labels.note])];
  let total = 0;
  for (const e of rows) {
    total += e.minutes;
    const [y, m, d] = e.date.split('-');
    out.push(
      line([
        `${d}.${m}.${y}`,
        projects.get(e.projectId)?.name ?? '',
        formatMinutes(e.minutes),
        formatDecimalHours(e.minutes),
        e.note ?? '',
      ]),
    );
  }
  out.push(line([labels.total, '', formatMinutes(total), formatDecimalHours(total), '']));
  return `${BOM}${out.join('\r\n')}\r\n`;
}
