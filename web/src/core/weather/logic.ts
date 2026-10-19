/** Pure parts of the weather line: weather code → words, rain hint, one-line text. */
import type { tWeather } from './strings';

export type CodeGroup = keyof typeof tWeather.de.codes;

/** WMO weather interpretation codes (Open-Meteo) grouped into nine calm words. */
export function codeGroup(code: number): CodeGroup {
  if (code === 0) return 'clear';
  if (code <= 2) return 'partly';
  if (code === 3) return 'cloudy';
  if (code === 45 || code === 48) return 'fog';
  if (code >= 51 && code <= 57) return 'drizzle';
  if (code >= 61 && code <= 67) return 'rain';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
  if (code >= 80 && code <= 82) return 'showers';
  if (code >= 95) return 'thunder';
  return 'cloudy';
}

/** Chance of rain (percent) from which a coming hour counts as "rain". */
export const RAIN_PERCENT = 60;
/** How far ahead the hint looks. */
export const RAIN_LOOKAHEAD_HOURS = 12;

const hourOf = (iso: string): number => Number(iso.slice(11, 13));
const dayOf = (iso: string): string => iso.slice(0, 10);

/**
 * "HH" of the first coming hour (after the current one, same day, within 12 h) with a chance of rain
 * of at least 60 %; `undefined` when there is none or it already rains. `times` are the place's local
 * `YYYY-MM-DDTHH:mm`.
 */
export function rainFrom(
  times: readonly string[],
  probabilities: readonly (number | null)[],
  nowIso: string,
  currentGroup: CodeGroup,
): string | undefined {
  if (['drizzle', 'rain', 'showers', 'thunder'].includes(currentGroup)) return undefined;
  const day = dayOf(nowIso);
  const hour = hourOf(nowIso);
  for (let i = 0; i < times.length; i++) {
    const t = times[i]!;
    const h = hourOf(t);
    if (dayOf(t) !== day || h <= hour || h > hour + RAIN_LOOKAHEAD_HOURS) continue;
    if ((probabilities[i] ?? 0) >= RAIN_PERCENT) return String(h).padStart(2, '0');
  }
  return undefined;
}
