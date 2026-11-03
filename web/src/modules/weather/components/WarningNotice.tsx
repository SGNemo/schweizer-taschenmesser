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
  rain: 'cloudRain',
  heat: 'thermometer',
  frost: 'cloudSnow',
};

/** One line per hint above the head: icon + words ("Freitag: Sturmböen bis 70 km/h"), and what the hint is based on. */
export function WarningNotice({ warnings, today }: { warnings: WeatherWarning[]; today: string }) {
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
      role="note"
      aria-label={tp.warnLabel}
      data-testid="weather-warning"
    >
      <ul>
        {warnings.map((w) => (
          <li key={w.kind}>
            <Icon name={ICON[w.kind]} size={18} />
            <span>{line(w)}</span>
          </li>
        ))}
      </ul>
      <p>{tp.warnSource}</p>
    </div>
  );
}
