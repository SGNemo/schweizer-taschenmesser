/** Time until the next appointment: pure helpers for the "Als Nächstes" widget. */

const toMinutes = (hhmm: string): number =>
  Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

/** Minutes from `nowHhmm` to `timeHhmm` (both local 'HH:mm', same day); negative = already past. */
export const minutesUntil = (nowHhmm: string, timeHhmm: string): number =>
  toMinutes(timeHhmm) - toMinutes(nowHhmm);

/** "in 20 Min", "in 1 Std", "in 1 Std 20", "jetzt" (under a minute). */
export function untilLabel(minutes: number): string {
  if (minutes <= 0) return 'jetzt';
  if (minutes < 60) return `in ${minutes} Min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `in ${h} Std` : `in ${h} Std ${m}`;
}

export interface NextItem {
  title: string;
  time?: string;
  allDay: boolean;
  done?: boolean;
  kind: string;
}

/** The first timed, open item that has not started yet; `undefined` when the day is through. */
export function nextToday<T extends NextItem>(items: readonly T[], nowHhmm: string): T | undefined {
  return items
    .filter((i) => !i.allDay && i.time !== undefined && !i.done && i.time > nowHhmm)
    .sort((a, b) => a.time!.localeCompare(b.time!))[0];
}
