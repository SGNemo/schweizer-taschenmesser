import { dateTimeFormat } from '@/core/i18n/format';
import type { HourRow } from '@/core/weather/api';
import { RAIN_SHOWN_PERCENT, rateHour } from '@/core/weather/logic';
import { tWeather } from '@/strings.weather';
import { Icon } from '@/ui';
import styles from '../routes/weather.module.css';
import { localDate, tone } from './parts';
import { weatherIcon } from './weatherIcon';

/**
 * The next hours as a row of cards you scroll sideways: time, symbol, temperature and a rain bar (the percentage as text under it,
 * only when it matters). The row is a focusable, labelled region so the keyboard can scroll it. Every card says its word too.
 */
export function HourCards({ hours }: { hours: readonly HourRow[] }) {
  const tx = tWeather.use();
  const fmt = dateTimeFormat({ hour: '2-digit', minute: '2-digit' });
  return (
    <div
      className={styles.hourScroll}
      role="region"
      aria-label={tx.hourly}
      tabIndex={0}
      data-testid="weather-hour-cards"
    >
      <ul className={styles.hourCards} data-testid="weather-hours">
        {hours.map((h, i) => (
          <li
            key={h.time}
            className={styles.hourCard}
            data-now={i === 0 ? 'true' : undefined}
            data-rating={rateHour(h)}
          >
            <span className={styles.hourTime}>
              {fmt.format(localDate(h.time, Number(h.time.slice(11, 13))))}
            </span>
            <Icon name={weatherIcon(h.group, h.night)} size={22} />
            <span className={styles.hourTemp} data-tone={tone(h.temp)}>
              {tx.temp(h.temp)}
            </span>
            <span className={styles.hourWord}>{tx.codes[h.group]}</span>
            {h.wind != null ? (
              <span className={styles.hourWind}>{tx.windSpeed(h.wind)}</span>
            ) : null}
            <span className={styles.rainBar} aria-hidden="true">
              <i style={{ width: `${Math.min(100, h.rain)}%` }} />
            </span>
            <span className={styles.hourRain}>
              {h.rain >= RAIN_SHOWN_PERCENT ? `${h.rain} %` : ' '}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
