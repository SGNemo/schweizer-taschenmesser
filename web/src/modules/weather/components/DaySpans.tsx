import { dateTimeFormat } from '@/core/i18n/format';
import type { DayRow, Forecast } from '@/core/weather/api';
import { rateDay } from '@/core/weather/logic';
import { tWeather } from '@/strings.weather';
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
export function DaySpans({
  days,
  today,
  forecast,
}: {
  days: readonly DayRow[];
  today: string;
  forecast: Forecast;
}) {
  const tx = tWeather.use();
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
    <ul className={styles.rows} data-testid="weather-days">
      {days.map((d) => (
        <li key={d.date} className={styles.row} data-rating={rateDay(d)}>
          <Icon name={weatherIcon(d.group)} size={20} />
          <div className={styles.rowBody}>
            <p className={styles.rowMain}>
              <span className={styles.dayName}>
                {d.date === today ? tx.today : dayFmt.format(localDate(d.date))}
              </span>
              <span>{tx.codes[d.group]}</span>
              <RatingChip rating={rateDay(d)} />
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
        </li>
      ))}
    </ul>
  );
}
