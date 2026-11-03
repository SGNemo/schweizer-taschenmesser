import { dateTimeFormat } from '@/core/i18n/format';
import type { AttentionItem, AttentionSource } from '@/core/modules/types';
import { tWeather } from '@/strings.weather';
import { tWeatherPage } from '@/strings.weatherPage';
import type { IconName } from '@/ui/icons';
import { localDate } from './components/parts';
import type { WarningKind, WeatherWarning } from './warnings';
import { warningsNow } from './warningsToday';

const ICON: Record<WarningKind, IconName> = {
  storm: 'cloudLightning',
  wind: 'wind',
  rain: 'cloudRain',
  heat: 'thermometer',
  frost: 'cloudSnow',
};

/** The words of one warning ("Freitag: Sturmböen bis 70 km/h"), shared by "Jetzt wichtig" and the notification. */
export function warningLine(w: WeatherWarning, today: string): string {
  const tp = tWeatherPage.get();
  const day =
    w.date === today
      ? tWeather.get().today
      : dateTimeFormat({ weekday: 'long' }).format(localDate(w.date));
  const n = w.value ?? 0;
  switch (w.kind) {
    case 'storm':
      return tp.warn.storm(day);
    case 'wind':
      return tp.warn.wind(day, n);
    case 'rain':
      return tp.warn.rain(day, n);
    case 'heat':
      return tp.warn.heat(day, n);
    case 'frost':
      return tp.warn.frost(day, n);
  }
}

/** Severe-weather hints for today and tomorrow (from the cached forecast); a hint, never red (`warning`). */
const source: AttentionSource = async ({ today }) =>
  (await warningsNow(today)).map((w, i): AttentionItem => ({
    id: `weather:${w.kind}:${w.date}`,
    tone: 'warning',
    icon: ICON[w.kind],
    title: warningLine(w, today),
    to: '/weather',
    rank: 10 + i,
  }));

export default source;
