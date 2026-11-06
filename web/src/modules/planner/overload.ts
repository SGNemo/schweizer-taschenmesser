/**
 * The overload figure (docs/design/plan/CONCEPT.md §7): „2 h 40 mehr zu tun, als Zeit frei ist“. It always
 * sits in the head of the waiting group; a toast line comes only when a user action takes the overflow from 0
 * to above 0, at most once per ISO week (device-local in `_meta`), and only with `overloadToast` on. Never an
 * attention item, never red, never repeated within the week.
 */
import { getISOWeek, getISOWeekYear } from 'date-fns';
import { getMeta, setMeta } from '@/core/db/metaKv';
import { formatMinutes } from '@/core/i18n/format';
import { parseDate } from '@/core/time/dates';
import { t } from '@/strings';

/** Device-local: the ISO week (`2026-W45`) of the last overload toast line. */
export const OVERLOAD_WEEK_KEY = 'planner.overload.toastWeek';

/** `YYYY-Www` of a date, by ISO week numbering (the week of 2027-01-01 can be 2026-W53). */
export function isoWeekOf(date: string): string {
  const d = parseDate(date);
  return `${getISOWeekYear(d)}-W${String(getISOWeek(d)).padStart(2, '0')}`;
}

/** „2 h 40 mehr zu tun, als Zeit frei ist“ (compact minutes, like the board). */
export const overloadText = (overMin: number): string =>
  t.planner.wait.over(formatMinutes(overMin, { compact: true }));

/** Pure: does this run earn the one toast line of the week? */
export function shouldToastOverload(x: {
  enabled: boolean;
  prevMin: number;
  nextMin: number;
  week: string;
  lastWeek: string | undefined;
}): boolean {
  return x.enabled && x.prevMin <= 0 && x.nextMin > 0 && x.lastWeek !== x.week;
}

/**
 * The toast line after a user run, or `undefined`. Remembers the week when it says something, so the
 * next add in the same overloaded week stays quiet.
 */
export async function overloadLine(x: {
  enabled: boolean;
  prevMin: number | undefined;
  nextMin: number | undefined;
  today: string;
}): Promise<string | undefined> {
  if (x.prevMin === undefined || x.nextMin === undefined) return undefined;
  const week = isoWeekOf(x.today);
  const lastWeek = await getMeta<string>(OVERLOAD_WEEK_KEY);
  if (!shouldToastOverload({ ...x, prevMin: x.prevMin, nextMin: x.nextMin, week, lastWeek }))
    return undefined;
  await setMeta(OVERLOAD_WEEK_KEY, week);
  return overloadText(x.nextMin);
}
