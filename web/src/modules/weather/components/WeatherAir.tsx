import { formatNumber } from '@/core/i18n/format';
import {
  aqiBand,
  levelRank,
  LEVEL_ORDER,
  pollenRows,
  rateAir,
  type Air,
  type AirDay,
  type PollenLevel,
} from '@/core/weather/air';
import { DUST_MIN } from '@/core/sky/events';
import { tWeather } from '@/strings.weather';
import { tWeatherPage } from '@/strings.weatherPage';
import { EventGlyph } from '@/ui/weather-scene';
import { RatingChip } from './RatingChip';
import styles from './WeatherAir.module.css';

const dec = (n: number): string => formatNumber(n, { maximumFractionDigits: 1 });

/** Five small steps, filled up to the level; the word is always next to it. */
function Meter({ level }: { level: PollenLevel }) {
  const filled = levelRank(level);
  return (
    <span className={styles.meter} data-level={level} aria-hidden="true">
      {LEVEL_ORDER.slice(1).map((l, i) => (
        <span key={l} className={i < filled ? styles.on : undefined} />
      ))}
    </span>
  );
}

/**
 * "Atemwege & Allergie": the air quality index with its word, the pollutants, and every pollen type with
 * data, strongest first. Without values (the request failed) a calm sentence; pollen outside Europe: one
 * sentence instead of an empty list. Orientation only: the hint says so. Saharan dust (package 3): one row under the
 * pollutants while it is in the air (`dust` only while "Mond und Himmelsereignisse" is on).
 */
export function WeatherAir({
  air,
  dust = false,
  day,
}: {
  air: Air | undefined;
  dust?: boolean;
  /**
   * Another day (round 2, CONCEPT-DAYS §2): its highest index and its pollen; `null` = beyond the five days of the air
   * forecast (one sentence). Absent: now.
   */
  day?: AirDay | null;
}) {
  const tx = tWeather.use();
  const tp = tWeatherPage.use();
  const shown: Air | undefined =
    air && day
      ? { ...air, now: { ...(day.aqi != null ? { aqi: day.aqi } : {}) }, pollen: day.pollen }
      : air;
  const rating = day === null ? undefined : rateAir(shown);
  const rows = shown ? pollenRows(shown.pollen) : [];
  const now = shown?.now;
  const pollutants = now
    ? [
        ...(now.pm25 != null ? [[tx.pm25, now.pm25] as const] : []),
        ...(now.pm10 != null ? [[tx.pm10, now.pm10] as const] : []),
        ...(now.o3 != null ? [[tx.o3, now.o3] as const] : []),
        ...(now.no2 != null ? [[tx.no2, now.no2] as const] : []),
        ...(now.so2 != null ? [[tx.so2, now.so2] as const] : []),
      ]
    : [];
  return (
    <section className={styles.air} data-testid="weather-air" aria-labelledby="weather-air-title">
      <div className={styles.head}>
        <h3 id="weather-air-title" className={styles.title}>
          {tx.airTitle}
        </h3>
        {rating ? <RatingChip rating={rating} /> : null}
      </div>
      {day === null && air ? (
        <p className={styles.note} data-testid="weather-air-missing">
          {tp.airMissing}
        </p>
      ) : !air ? (
        <p className={styles.note}>{tx.airUnavailable}</p>
      ) : (
        <>
          {now?.aqi != null ? (
            <p className={styles.aqi} data-testid="weather-aqi" data-band={aqiBand(now.aqi)}>
              <span className={styles.aqiValue}>{tx.airQuality(now.aqi)}</span>
              <span>{tx.bands[aqiBand(now.aqi)]}</span>
            </p>
          ) : null}
          {pollutants.length > 0 ? (
            <ul className={styles.pollutants}>
              {pollutants.map(([name, value]) => (
                <li key={name}>
                  <span>{name}</span>
                  <span>{tx.micro(dec(value))}</span>
                </li>
              ))}
            </ul>
          ) : null}
          {dust && !day && now?.dust != null && now.dust >= DUST_MIN ? (
            <p className={styles.dust} data-testid="weather-dust">
              <EventGlyph name="dust" />
              <span>{tp.ev.dust(formatNumber(now.dust, { maximumFractionDigits: 0 }))}</span>
            </p>
          ) : null}
          <h4 className={styles.sub}>{tx.pollenTitle}</h4>
          {rows.length > 0 ? (
            <ul className={styles.pollen} data-testid="weather-pollen">
              {rows.map((r) => (
                <li key={r.type} data-level={r.level}>
                  <span className={styles.pollenName}>{tx.pollen[r.type]}</span>
                  <Meter level={r.level} />
                  <span className={styles.pollenLevel}>{tx.levels[r.level]}</span>
                  <span className={styles.pollenGrains}>{tx.pollenValue(r.grains)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.note}>{tx.noPollen}</p>
          )}
        </>
      )}
      <p className={styles.note}>{tx.airHint}</p>
    </section>
  );
}
