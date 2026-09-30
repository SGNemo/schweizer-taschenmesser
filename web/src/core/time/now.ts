/** Injectable clock so date-dependent logic is deterministic in tests. */
let nowFn: () => number = () => Date.now();

export function now(): number {
  return nowFn();
}

/** Override the clock (tests only). Call without args to restore the real clock. */
export function setNow(fn?: () => number): void {
  nowFn = fn ?? (() => Date.now());
}

/** Two-digit zero padding for dates and times ('7' → '07'). */
export function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Local calendar date as 'YYYY-MM-DD'. */
export function toDateString(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Today's local date as 'YYYY-MM-DD'. */
export function today(): string {
  return toDateString(new Date(now()));
}
