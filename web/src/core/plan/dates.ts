/** Date arithmetic on 'YYYY-MM-DD' without a clock (UTC midnight, so no DST pitfalls). */
const DAY_MS = 86_400_000;
const toDate = (s: string): Date => new Date(`${s}T00:00:00Z`);

export const addDays = (s: string, n: number): string =>
  new Date(toDate(s).getTime() + n * DAY_MS).toISOString().slice(0, 10);

export const daysBetween = (a: string, b: string): number =>
  Math.round((toDate(b).getTime() - toDate(a).getTime()) / DAY_MS);

export const cmp = (a: string | number, b: string | number): number =>
  a < b ? -1 : a > b ? 1 : 0;
