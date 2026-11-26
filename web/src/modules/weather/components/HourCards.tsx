import { dateTimeFormat } from '@/core/i18n/format';
import type { HourRow, NowDetail } from '@/core/weather/api';
import { RAIN_SHOWN_PERCENT, rateHour } from '@/core/weather/logic';
import { conditionId } from '@/core/weather/scene';
import { tWeather } from '@/strings.weather';
import { tWeatherPage } from '@/strings.weatherPage';
import { Icon } from '@/ui';
import styles from '../routes/weather.module.css';
import { hourLineParts } from './hourLine';
import { dec, localDate, tone } from './parts';
import { weatherIcon } from './weatherIcon';

/** An amount of precipitation (mm, or cm of snow) from which a card names it. */
export const AMOUNT_SHOWN = 0.1;

/**
 * The rain line of a card (mockup `hourCard`): from 30 % the chance, with the amount beside it from 0.1 mm ("60 % · 0,8
 * mm", snow "40 % · 1 cm"); empty below 30 %.
 */
export function cardRain(tp: ReturnType<typeof tWeatherPage.get>, h: HourRow): string {
  if (h.rain < RAIN_SHOWN_PERCENT) return '';
  const snow = h.snow != null && h.snow >= AMOUNT_SHOWN;
  const mm = h.mm != null && h.mm >= AMOUNT_SHOWN;
  if (snow) return tp.hourSnow(h.rain, dec(h.snow!));
  if (mm) return tp.hourRain(h.rain, dec(h.mm!));
  return `${h.rain} %`;
}

/**
 * The next hours as a row of cards you scroll sideways: time ("Jetzt" first), symbol, temperature and a rain bar (the
 * percentage and the amount as text under it, only when it matters). The row is a focusable, labelled region so the
 * keyboard can scroll it. Every card says its word too. Under the row, one line with the values of the first hour.
 */
export function HourCards({ hours, now }: { hours: readonly HourRow[]; now?: NowDetail }) {
  const tx = tWeather.use();
  const tp = tWeatherPage.use();
  const fmt = dateTimeFormat({ hour: '2-digit', minute: '2-digit' });
  const first = hours[0];
  const line = first ? hourLineParts(tp, first, now) : [];
  return (
    <>
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
              aria-current={i === 0 ? 'time' : undefined}
              data-rating={rateHour(h)}
            >
              <span className={styles.hourTime}>
                {i === 0 ? tp.hourNow : fmt.format(localDate(h.time, Number(h.time.slice(11, 13))))}
              </span>
              <Icon name={weatherIcon(h.group, h.night)} size={22} />
              <span className={styles.hourTemp} data-tone={tone(h.temp)}>
                {tx.temp(h.temp)}
              </span>
              <span className={styles.hourWord}>
                {tx.conditions[conditionId(h.code, h.group, h)]}
              </span>
              {h.wind != null ? (
                <span className={styles.hourWind}>{tx.windSpeed(h.wind)}</span>
              ) : null}
              <span className={styles.rainBar} aria-hidden="true">
                <i style={{ width: `${Math.min(100, h.rain)}%` }} />
              </span>
              <span className={styles.hourRain}>{cardRain(tp, h) || ' '}</span>
            </li>
          ))}
        </ul>
      </div>
      {first && line.length > 0 ? (
        <p className={styles.hourLine} data-testid="weather-hour-line">
          <span className="sr-only">{tp.hourLineLabel(first.time.slice(11, 16))}: </span>
          {line.join(' · ')}
        </p>
      ) : null}
    </>
  );
}
