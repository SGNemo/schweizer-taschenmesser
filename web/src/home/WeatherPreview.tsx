import { Link } from 'react-router';
import { dateTimeFormat, formatNumber } from '@/core/i18n/format';
import { settingsPath } from '@/core/settings/registry/paths';
import { now } from '@/core/time/now';
import type { DayRow, HourRow } from '@/core/weather/api';
import {
  bestWindow,
  dayRows,
  hourRows,
  placeNowIso,
  rateDay,
  rateHour,
  rateNow,
  RAIN_SHOWN_PERCENT,
  type Rating,
} from '@/core/weather/logic';
import type { WeatherView } from '@/core/weather/useWeather';
import { tWeather } from '@/strings.weather';
import { Dialog, GroupedList, Icon, type IconName } from '@/ui';
import { WeatherChart } from './WeatherChart';
import { weatherIcon } from './weatherIcon';
import styles from './WeatherPreview.module.css';

const SETTINGS = settingsPath('verbindungen', 'weather');

const RATING_ICON: Record<Rating, IconName> = { good: 'ok', fair: 'circleMinus', poor: 'alert' };

const localDate = (iso: string, hour = 0): Date =>
  new Date(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)), hour);

const dec = (n: number): string => formatNumber(n, { maximumFractionDigits: 1 });

/** Rating as word + icon + colour: the colour is never alone. */
function RatingChip({ rating }: { rating: Rating }) {
  const tx = tWeather.use();
  return (
    <span className={styles.chip} data-rating={rating}>
      <Icon name={RATING_ICON[rating]} size={14} />
      {tx.ratings[rating]}
    </span>
  );
}

/**
 * The weather behind the line: now with its details, the next 24 hours as a picture and hour by hour,
 * and the next days with their range, rain, wind and sun. Every number sits next to its word; the colour
 * of the rating (good / so-so / unpleasant) always comes with its text and icon. "Stand hh:mm" when the
 * values are older than 30 minutes; a link to the settings and the Open-Meteo credit at the bottom.
 */
export function WeatherPreview({
  open,
  onClose,
  weather,
}: {
  open: boolean;
  onClose: () => void;
  weather: WeatherView;
}) {
  const tx = tWeather.use();
  const { forecast, place, stale, at } = weather;
  const nowIso = placeNowIso(forecast, at, now());
  const today = nowIso.slice(0, 10);
  const hours = hourRows(forecast, nowIso);
  const days = dayRows(forecast, today);
  const ready = !!forecast.hours && !!forecast.days;
  const hourFmt = dateTimeFormat({ hour: '2-digit', minute: '2-digit' });
  const dayFmt = dateTimeFormat({ weekday: 'short', day: 'numeric', month: 'numeric' });
  const best = bestWindow(hours);
  const first = days[0];
  const detail = forecast.now;

  const rain = (n: number, mm?: number) =>
    n >= RAIN_SHOWN_PERCENT
      ? [tx.rainChance(n) + (mm && mm >= 0.1 ? ` (${tx.rainMm(dec(mm))})` : '')]
      : [];
  const windParts = (wind?: number, gust?: number) => [
    ...(wind != null ? [tx.windSpeed(wind)] : []),
    ...(gust != null && wind != null && gust - wind >= 10 ? [tx.gustSpeed(gust)] : []),
  ];

  const hourLine = (h: HourRow) => [
    ...(h.feels != null && h.feels !== h.temp ? [tx.feels(h.feels)] : []),
    ...rain(h.rain, h.mm),
    ...windParts(h.wind, h.gust),
    ...(h.hum != null ? [tx.humidity(h.hum)] : []),
    ...(h.uv != null && h.uv >= 1 ? [tx.uvIndex(dec(h.uv))] : []),
  ];
  const dayLine = (d: DayRow) => [
    ...rain(d.rain, d.mm),
    ...windParts(d.wind, d.gust),
    ...(d.uv != null && d.uv >= 1 ? [tx.uvIndex(dec(d.uv))] : []),
    ...(d.sunrise && d.sunset ? [tx.sunSpan(d.sunrise, d.sunset)] : []),
    ...(d.sunMin != null && d.sunMin > 0 ? [tx.sunshine(dec(d.sunMin / 60))] : []),
  ];

  const lo = Math.min(...days.map((d) => d.min));
  const hi = Math.max(...days.map((d) => d.max));
  const span = hi - lo || 1;

  return (
    <Dialog open={open} onClose={onClose} title={place.split(',')[0]!} size="wide">
      <div className={styles.preview} data-testid="weather-preview">
        {stale ? <p className={styles.asOf}>{tx.asOf(hourFmt.format(at))}</p> : null}
        <section className={styles.now} data-testid="weather-now" aria-label={tx.now}>
          <div className={styles.nowMain}>
            <Icon name={weatherIcon(forecast.group, detail?.night)} size={40} />
            <div>
              <p className={styles.temp}>{tx.temp(forecast.temp)}</p>
              <p className={styles.word}>{tx.codes[forecast.group]}</p>
            </div>
            <RatingChip rating={rateNow(forecast)} />
          </div>
          <ul className={styles.facts}>
            {[
              ...(detail?.feels != null ? [tx.feels(detail.feels)] : []),
              ...(first ? [tx.range(first.min, first.max)] : []),
              ...windParts(detail?.wind, detail?.gust),
              ...(detail?.hum != null ? [tx.humidity(detail.hum)] : []),
              ...(first?.sunrise && first.sunset ? [tx.sunSpan(first.sunrise, first.sunset)] : []),
              ...(first?.uv != null && first.uv >= 1 ? [tx.uvIndex(dec(first.uv))] : []),
            ].map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </section>
        {ready ? (
          <GroupedList
            listId="weather"
            groups={[
              {
                id: 'today',
                label: tx.today,
                count: hours.length,
                children: (
                  <>
                    <p className={styles.best} data-testid="weather-best">
                      {best ? tx.bestTime(best.from, best.to) : tx.noBestTime}
                    </p>
                    <WeatherChart hours={hours} />
                    <h3 className={styles.sub}>{tx.hourly}</h3>
                    <ul className={styles.rows} data-testid="weather-hours">
                      {hours.map((h) => (
                        <li key={h.time} className={styles.row}>
                          <Icon name={weatherIcon(h.group, h.night)} size={20} />
                          <div className={styles.rowBody}>
                            <p className={styles.rowMain}>
                              <span className={styles.time}>
                                {hourFmt.format(localDate(h.time, Number(h.time.slice(11, 13))))}
                              </span>
                              <span className={styles.big}>{tx.temp(h.temp)}</span>
                              <span>{tx.codes[h.group]}</span>
                              <RatingChip rating={rateHour(h)} />
                            </p>
                            <p className={styles.rowMeta}>{hourLine(h).join(' · ')}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </>
                ),
              },
              {
                id: 'days',
                label: tx.nextDays,
                count: days.length,
                children: (
                  <ul className={styles.rows} data-testid="weather-days">
                    {days.map((d) => (
                      <li key={d.date} className={styles.row}>
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
                            <span className={styles.rangeLabel}>{tx.temp(d.min)}</span>
                            <span className={styles.track} aria-hidden="true">
                              <span
                                className={styles.fill}
                                style={{
                                  left: `${((d.min - lo) / span) * 100}%`,
                                  width: `${Math.max(3, ((d.max - d.min) / span) * 100)}%`,
                                }}
                              />
                            </span>
                            <span className={styles.rangeLabel}>{tx.temp(d.max)}</span>
                            <span className={styles.srOnly}>{tx.range(d.min, d.max)}</span>
                          </div>
                          <p className={styles.rowMeta}>{dayLine(d).join(' · ')}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                ),
              },
            ]}
          />
        ) : (
          <p className={styles.loading}>{tx.previewLoading}</p>
        )}
        <p className={styles.foot}>{tx.ratingHint}</p>
        <p className={styles.foot}>
          <Link to={SETTINGS} onClick={onClose}>
            {tx.settings}
          </Link>
        </p>
        <p className={styles.foot} data-testid="weather-preview-credit">
          {tx.attribution}{' '}
          <a href="https://open-meteo.com/" target="_blank" rel="noreferrer noopener">
            {tx.attributionLink}
          </a>
        </p>
      </div>
    </Dialog>
  );
}
