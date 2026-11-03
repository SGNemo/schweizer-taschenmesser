import {
  addDaysStr,
  endOfMonthStr,
  startOfMonthStr,
  startOfWeekStr,
  toEpoch,
} from '@/core/time/dates';
import type { Client, Job, Session } from './schema';

const pad = (n: number) => String(n).padStart(2, '0');
export const hhmm = (ms: number): string => {
  const d = new Date(ms);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

type S = Pick<
  Session,
  'date' | 'startTime' | 'endDate' | 'endTime' | 'breakMin' | 'pausedDate' | 'pausedAt'
>;

export const runningSession = <T extends Pick<Session, 'endTime'>>(
  sessions: readonly T[],
): T | undefined => sessions.find((s) => !s.endTime);

export const startEpoch = (s: S): number => toEpoch(s.date, s.startTime);

/** End of a finished session; a running one ends "now" (a paused one where the pause began). */
export function endEpoch(s: S, nowMs: number): number {
  if (s.endTime) return toEpoch(s.endDate ?? s.date, s.endTime);
  if (s.pausedAt && s.pausedDate) return toEpoch(s.pausedDate, s.pausedAt);
  return nowMs;
}

/** Whole minutes since a pause began (0 when not paused). */
export function elapsedBreak(s: Pick<S, 'pausedDate' | 'pausedAt'>, nowMs: number): number {
  if (!s.pausedAt || !s.pausedDate) return 0;
  return Math.max(0, Math.floor((nowMs - toEpoch(s.pausedDate, s.pausedAt)) / 60_000));
}

/** Worked minutes: end − start − break, never below zero. */
export function sessionMinutes(s: S, nowMs: number): number {
  const gross = Math.floor((endEpoch(s, nowMs) - startEpoch(s)) / 60_000);
  return Math.max(0, gross - s.breakMin);
}

/** Seconds since the start of a running session, minus its breaks, for the stopwatch digits. */
export function runningSeconds(s: S, nowMs: number): number {
  const gross = Math.floor((endEpoch(s, nowMs) - startEpoch(s)) / 1000);
  return Math.max(0, gross - s.breakMin * 60);
}

/** `1:05:09` (hours without a leading zero); minutes only (`1:05`) when `seconds` is off. */
export function stopwatch(totalSeconds: number, seconds = true): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return seconds ? `${h}:${pad(m)}:${pad(s)}` : `${h}:${pad(m)}`;
}

/** Amount of one session in cents: minutes × hourly rate, **rounded per session** (so a report adds whole cents). */
export const amountCents = (minutes: number, rateCents: number): number =>
  Math.round((minutes * rateCents) / 60);

export type Period = 'week' | 'month';
export function rangeOf(
  period: Period,
  date: string,
  weekStart: 1 | 7 = 1,
): { from: string; to: string } {
  if (period === 'week') {
    const from = startOfWeekStr(date, weekStart);
    return { from, to: addDaysStr(from, 6) };
  }
  return { from: startOfMonthStr(date), to: endOfMonthStr(date) };
}

export function shiftPeriod(period: Period, date: string, dir: 1 | -1): string {
  return period === 'week'
    ? addDaysStr(date, 7 * dir)
    : addDaysStr(startOfMonthStr(date), dir < 0 ? -1 : 32);
}

export interface Line {
  key: string;
  name: string;
  minutes: number;
  cents: number;
}
export interface Report {
  minutes: number;
  billableMinutes: number;
  cents: number;
  byJob: Line[];
  byClient: Line[];
  byDay: Map<string, number>;
}

/**
 * Sums the sessions that **started** in [from, to] (a night shift stays on its first day).
 * Amounts use the job's rate for billable jobs only; sessions without a job count as time, not money.
 */
export function report(
  sessions: readonly Pick<Session, 'jobId' | keyof S>[],
  jobs: ReadonlyMap<string, Pick<Job, 'name' | 'rateCents' | 'billable' | 'clientId'>>,
  clients: ReadonlyMap<string, Pick<Client, 'name'>>,
  from: string,
  to: string,
  nowMs: number,
  labels: { noJob: string; noClient: string },
): Report {
  const byJob = new Map<string, Line>();
  const byClient = new Map<string, Line>();
  const byDay = new Map<string, number>();
  let minutes = 0;
  let billableMinutes = 0;
  let cents = 0;
  const add = (map: Map<string, Line>, key: string, name: string, m: number, c: number) => {
    const line = map.get(key) ?? { key, name, minutes: 0, cents: 0 };
    line.minutes += m;
    line.cents += c;
    map.set(key, line);
  };
  for (const s of sessions) {
    if (s.date < from || s.date > to) continue;
    const m = sessionMinutes(s, nowMs);
    const job = s.jobId ? jobs.get(s.jobId) : undefined;
    const c = job && job.billable && job.rateCents ? amountCents(m, job.rateCents) : 0;
    minutes += m;
    cents += c;
    if (job?.billable !== false) billableMinutes += m;
    byDay.set(s.date, (byDay.get(s.date) ?? 0) + m);
    add(byJob, s.jobId ?? '', job?.name ?? labels.noJob, m, c);
    const clientId = job?.clientId;
    add(
      byClient,
      clientId ?? '',
      clientId ? (clients.get(clientId)?.name ?? labels.noClient) : labels.noClient,
      m,
      c,
    );
  }
  const sort = (lines: Map<string, Line>) =>
    [...lines.values()].sort((a, b) => b.minutes - a.minutes || a.name.localeCompare(b.name));
  return { minutes, billableMinutes, cents, byJob: sort(byJob), byClient: sort(byClient), byDay };
}

/** Idle: whole minutes between the last input and `nowMs`. */
export const idleMinutes = (lastInputMs: number, nowMs: number): number =>
  Math.max(0, Math.floor((nowMs - lastInputMs) / 60_000));

const cell = (v: string | number): string => {
  const s = String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export interface CsvRow {
  date: string;
  start: string;
  end: string;
  breakMin: number;
  minutes: number;
  project: string;
  client: string;
  billable: boolean;
  ratePerHour: number | undefined;
  cents: number;
  note: string;
}

/** CSV with fixed English headers (the file is for other programs), `.` as the decimal mark, one row per session. */
export function toCsv(rows: readonly CsvRow[]): string {
  const head = 'date,start,end,break_min,minutes,project,client,billable,rate_per_hour,amount,note';
  const lines = rows.map((r) =>
    [
      r.date,
      r.start,
      r.end,
      r.breakMin,
      r.minutes,
      r.project,
      r.client,
      r.billable ? 'yes' : 'no',
      r.ratePerHour === undefined ? '' : (r.ratePerHour / 100).toFixed(2),
      (r.cents / 100).toFixed(2),
      r.note,
    ]
      .map(cell)
      .join(','),
  );
  return [head, ...lines].join('\n') + '\n';
}
