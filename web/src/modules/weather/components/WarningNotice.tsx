import { dateTimeFormat } from '@/core/i18n/format';
import { tWeather } from '@/strings.weather';
import { tWeatherPage } from '@/strings.weatherPage';
import { Icon, type IconName } from '@/ui';
import styles from '../routes/weather.module.css';
import { localDate } from './parts';
import type { WarningKind, WeatherWarning } from '../warnings';

const ICON: Record<WarningKind, IconName> = {
  storm: 'cloudLightning',
  wind: 'wind',
  ice: 'cloudDrizzle',
  rain: 'cloudRain',
  heat: 'thermometer',
  frost: 'thermometer',
};

/**
 * The hint of the day as a pill: one line per hint, icon + words ("Freitag: Sturmböen bis 70 km/h"), then once
 * "berechnet, keine amtliche Warnung". In the stage under the detail line (`inStage`), or full width under the head
 * when the forecast came late. Opaque, with the theme's own ink whatever the scene behind it.
 */
export function WarningNotice({
  warnings,
  today,
  inStage = false,
}: {
  warnings: WeatherWarning[];
  today: string;
  inStage?: boolean;
}) {
  const tp = tWeatherPage.use();
  const tx = tWeather.use();
  const dayFmt = dateTimeFormat({ weekday: 'long' });
  const dayName = (date: string) => (date === today ? tx.today : dayFmt.format(localDate(date)));
  const line = (w: WeatherWarning): string => {
    const day = dayName(w.date);
    const n = w.value ?? 0;
    switch (w.kind) {
      case 'storm':
        return tp.warn.storm(day);
      case 'wind':
        return tp.warn.wind(day, n);
      case 'ice':
        return tp.warn.ice(day);
      case 'rain':
        return tp.warn.rain(day, n);
      case 'heat':
        return tp.warn.heat(day, n);
      case 'frost':
        return tp.warn.frost(day, n);
    }
  };
  return (
    <div
      className={styles.warn}
      data-in-stage={inStage ? 'true' : undefined}
      role="note"
      aria-label={tp.warnLabel}
      data-testid="weather-warning"
    >
      <ul>
        {warnings.map((w) => (
          <li key={w.kind}>
            <Icon name={ICON[w.kind]} size={16} />
            <span>{line(w)}</span>
          </li>
        ))}
      </ul>
      <span className={styles.sep} aria-hidden="true">
        ·
      </span>
      <span className={styles.computed}>{tp.warnComputed}</span>
    </div>
  );
}
