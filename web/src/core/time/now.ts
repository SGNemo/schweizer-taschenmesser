/** Injectable clock so date-dependent logic is deterministic in tests. */
let nowFn: () => number = () => Date.now();

export function now(): number {
  return nowFn();
}

/** Override the clock (tests only). Call without args to restore the real clock. */
export function setNow(fn?: () => number): void {
  nowFn = fn ?? (() => Date.now());
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** Local calendar date as 'YYYY-MM-DD'. */
export function toDateString(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Today's local date as 'YYYY-MM-DD'. */
export function today(): string {
  return toDateString(new Date(now()));
}
