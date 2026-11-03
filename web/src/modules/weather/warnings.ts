import type { DayRow } from '@/core/weather/api';

/**
 * Hints worth a line above the weather: computed from the forecast days, not an official warning (Open-Meteo offers none).
 * Thresholds are deliberately high so the line stays rare; each kind appears once, on its first day.
 */
export type WarningKind = 'storm' | 'wind' | 'rain' | 'heat' | 'frost';

export interface WeatherWarning {
  kind: WarningKind;
  date: string;
  /** km/h (wind), mm (rain), °C (heat, frost); none for a thunderstorm. */
  value?: number;
}

export const GUST_WARN_KMH = 70;
export const RAIN_WARN_MM = 20;
export const HEAT_WARN_C = 32;
export const FROST_WARN_C = -5;
const ORDER: readonly WarningKind[] = ['storm', 'wind', 'rain', 'heat', 'frost'];

export function weatherWarnings(days: readonly DayRow[], limit = 2): WeatherWarning[] {
  const out: WeatherWarning[] = [];
  const seen = new Set<WarningKind>();
  const add = (w: WeatherWarning) => {
    if (seen.has(w.kind)) return;
    seen.add(w.kind);
    out.push(w);
  };
  for (const d of days) {
    if (d.group === 'thunder') add({ kind: 'storm', date: d.date });
    if (d.gust != null && d.gust >= GUST_WARN_KMH)
      add({ kind: 'wind', date: d.date, value: Math.round(d.gust) });
    if (d.mm != null && d.mm >= RAIN_WARN_MM)
      add({ kind: 'rain', date: d.date, value: Math.round(d.mm) });
    if (d.max >= HEAT_WARN_C) add({ kind: 'heat', date: d.date, value: Math.round(d.max) });
    if (d.min <= FROST_WARN_C) add({ kind: 'frost', date: d.date, value: Math.round(d.min) });
  }
  return out
    .sort((a, b) => a.date.localeCompare(b.date) || ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind))
    .slice(0, limit);
}
