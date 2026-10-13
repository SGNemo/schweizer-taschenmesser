/** "timer 10m", "timer 1,5 h", "timer 90 s": minutes of a countdown typed into the search bar. */
const PATTERN =
  /^(?:timer|stoppuhr)\s+(\d+(?:[.,]\d+)?)\s*(h|std|stunden?|hours?|m|min|minuten?|minutes?|s|sek|sekunden?|seconds?)?$/i;

const MIN_MINUTES = 1;
const MAX_MINUTES = 24 * 60;

/** Length in minutes (1 … 1440), or `undefined` when the line is not a timer request. */
export function parseTimerQuery(query: string): number | undefined {
  const m = PATTERN.exec(query.trim());
  if (!m) return undefined;
  const value = Number(m[1]!.replace(',', '.'));
  const unit = (m[2] ?? 'm').toLowerCase();
  const minutes =
    unit.startsWith('h') || unit === 'std' || unit.startsWith('stunde')
      ? value * 60
      : unit.startsWith('s')
        ? value / 60
        : value;
  if (!Number.isFinite(minutes) || minutes < MIN_MINUTES || minutes > MAX_MINUTES) return undefined;
  return Math.round(minutes * 100) / 100;
}
