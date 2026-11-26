import { useId } from 'react';
import { edgeKey } from './edgeKey';
import { dateTimeFormat } from '@/core/i18n/format';
import type { DayRow, Forecast } from '@/core/weather/api';
import { rateDay } from '@/core/weather/logic';
import { conditionId } from '@/core/weather/scene';
import { moonOfDay } from '@/core/sky/moonDay';
import { tWeather } from '@/strings.weather';
import { tWeatherPage } from '@/strings.weatherPage';
import { MoonGlyph } from '@/ui/weather-scene';
import { Icon } from '@/ui';
import styles from '../routes/weather.module.css';
import { lineBuilders } from './lines';
import { localDate, Meta, tone } from './parts';
import { RatingChip } from './RatingChip';
import { weatherIcon } from './weatherIcon';

/**
 * The next days as range bars: each day's bar sits where its minimum and maximum lie within the week, the gradient (cool → warm)
 * spans the whole week. Word, rating chip and the detail line carry every number.
 */
/** The moon of a forecast day: glyph and name; one accessible name "Mond: {Phase}" for the pair. */
function DayMoon({
  date,
  lat,
  lon,
  tz,
}: {
  date: string;
  lat: number;
  lon: number;
  tz: string | undefined;
}) {
  const tx = tWeather.use();
  const tp = tWeatherPage.use();
  const m = moonOfDay(date, lat, lon, tz);
  const name = tx.moon[m.name];
  return (
    <span
      className={styles.dayMoon}
      role="img"
      aria-label={tp.moonDayAria(name)}
      data-testid="weather-day-moon"
    >
      <MoonGlyph illum={m.lit} size={18} mono waxing={m.waxing} south={lat < 0} />
      <span aria-hidden="true">{name}</span>
    </span>
  );
}

export function DaySpans({
  days,
  today,
  forecast,
  moon,
  checked,
  onPick,
}: {
  days: readonly DayRow[];
  today: string;
  /** The shown day (round 2: the rows are one radio group "Tag wählen", CONCEPT-DAYS §1). */
  checked: string;
  onPick: (date: string) => void;
  /** The place of the moon glyphs (absent while "Mond und Himmelsereignisse" is off). */
  moon?: { lat: number; lon: number; tz: string | undefined };
  forecast: Forecast;
}) {
  const tx = tWeather.use();
  const tp = tWeatherPage.use();
  const name = useId();
  const { dayLine } = lineBuilders(tx, forecast);
  const dayFmt = dateTimeFormat({ weekday: 'short', day: 'numeric', month: 'numeric' });
  const lo = Math.min(...days.map((d) => d.min));
  const hi = Math.max(...days.map((d) => d.max));
  const span = hi - lo || 1;
  const fillStyle = (d: DayRow) => {
    const left = ((d.min - lo) / span) * 100;
    const width = Math.max(3, ((d.max - d.min) / span) * 100);
    return {
      left: `${left}%`,
      width: `${width}%`,
      backgroundSize: `${10000 / width}% 100%`,
      backgroundPosition: `${width >= 100 ? 0 : (left / (100 - width)) * 100}% 0`,
    };
  };
  return (
    <div
      className={styles.rows}
      role="radiogroup"
      aria-label={tp.day.group}
      data-testid="weather-days"
      onKeyDown={(e) => {
        const to = edgeKey(e, days);
        if (to) onPick(to.date);
      }}
    >
      {days.map((d) => {
        const on = d.date === checked;
        return (
          <label
            key={d.date}
            className={styles.row}
            data-rating={rateDay(d)}
            data-checked={on ? 'true' : undefined}
            data-date={d.date}
          >
            <input
              type="radio"
              className="sr-only"
              name={name}
              checked={on}
              onChange={() => onPick(d.date)}
            />
            <Icon name={weatherIcon(d.group)} size={20} />
            <div className={styles.rowBody}>
              <p className={styles.rowMain}>
                <span className={styles.dayName}>
                  {d.date === today ? tx.today : dayFmt.format(localDate(d.date))}
                </span>
                <span>{tx.conditions[conditionId(d.code, d.group, { gust: d.gust })]}</span>
                <RatingChip rating={rateDay(d)} />
                {moon ? <DayMoon date={d.date} {...moon} /> : null}
              </p>
              <div className={styles.range}>
                <span className={styles.rangeLabel} data-tone={tone(d.min)}>
                  {tx.temp(d.min)}
                </span>
                <span className={styles.track} aria-hidden="true">
                  <span className={styles.fill} style={fillStyle(d)} />
                </span>
                <span className={styles.rangeLabel} data-tone={tone(d.max)}>
                  {tx.temp(d.max)}
                </span>
                <span className={styles.srOnly}>{tx.range(d.min, d.max)}</span>
              </div>
              <Meta className={styles.rowMeta} parts={dayLine(d)} />
            </div>
            <span className={styles.tickCol} aria-hidden="true">
              {on ? (
                <span className={styles.tick}>
                  <Icon name="check" size={12} />
                </span>
              ) : null}
            </span>
          </label>
        );
      })}
    </div>
  );
}
