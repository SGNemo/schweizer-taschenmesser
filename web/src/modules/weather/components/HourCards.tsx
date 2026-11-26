import { useId } from 'react';
import { edgeKey } from './edgeKey';
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
 * The hours as a row of cards you scroll sideways (round 2: one radio group "Stunde wählen", CONCEPT-DAYS §1): time
 * ("Jetzt" first on today), symbol, temperature and a rain bar (the percentage and the amount as text under it, only
 * when it matters). Each card is the label of a visually hidden radio, so the group is one tab stop and the arrow keys
 * move and choose. The checked card carries the picked look (tint, frame, check mark). Under the row, one line with the
 * values of the checked hour (or of now).
 */
export function HourCards({
  hours,
  now,
  firstIsNow,
  checked,
  lineHour,
  onPick,
}: {
  hours: readonly HourRow[];
  /** The current values: the hour line of "Jetzt" repeats nothing the head says. */
  now?: NowDetail;
  /** True on today: the first card is "Jetzt". */
  firstIsNow: boolean;
  /** Index of the checked card; -1 = none (another day before an hour is chosen). */
  checked: number;
  /** The hour the line under the cards names; `undefined` = no line. */
  lineHour?: HourRow;
  onPick: (h: HourRow, index: number) => void;
}) {
  const tx = tWeather.use();
  const tp = tWeatherPage.use();
  const name = useId();
  const fmt = dateTimeFormat({ hour: '2-digit', minute: '2-digit' });
  const timeOf = (h: HourRow) => fmt.format(localDate(h.time, Number(h.time.slice(11, 13))));
  const line = lineHour ? hourLineParts(tp, lineHour, now) : [];
  return (
    <>
      <div
        className={styles.hourScroll}
        role="region"
        aria-label={tx.hourly}
        data-testid="weather-hour-cards"
      >
        <div
          className={styles.hourCards}
          role="radiogroup"
          aria-label={tp.hourGroup}
          data-testid="weather-hours"
          onKeyDown={(e) => {
            const to = edgeKey(e, hours);
            if (to) onPick(to, hours.indexOf(to));
          }}
        >
          {hours.map((h, i) => {
            const on = i === checked;
            return (
              <label
                key={h.time}
                className={styles.hourCard}
                data-checked={on ? 'true' : undefined}
                data-rating={rateHour(h)}
                data-time={h.time}
              >
                <input
                  type="radio"
                  className="sr-only"
                  name={name}
                  checked={on}
                  onChange={() => onPick(h, i)}
                />
                {on ? (
                  <span className={styles.tick} aria-hidden="true">
                    <Icon name="check" size={12} />
                  </span>
                ) : null}
                <span className={styles.hourTime}>
                  {i === 0 && firstIsNow ? tp.hourNow : timeOf(h)}
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
              </label>
            );
          })}
        </div>
      </div>
      {lineHour && line.length > 0 ? (
        <p className={styles.hourLine} data-testid="weather-hour-line">
          <span className="sr-only">{tp.hourLineLabel(lineHour.time.slice(11, 16))}: </span>
          {line.join(' · ')}
        </p>
      ) : null}
    </>
  );
}
