import { dateTimeFormat } from '@/core/i18n/format';
import type { DayRow } from '@/core/weather/api';
import { compassIndex } from '@/core/weather/air';
import { bestWindow, hourRows, placeNowIso, dayRows } from '@/core/weather/logic';
import type { WeatherView } from '@/core/weather/useWeather';
import { now } from '@/core/time/now';
import { tWeather } from '@/strings.weather';
import { tWeatherPage } from '@/strings.weatherPage';
import { Icon, type IconName } from '@/ui';
import { HeroFigure, HeroSlot, Sky, skyKind } from '@/ui/identity';
import styles from '../routes/weather.module.css';
import { dec } from './parts';
import { lineBuilders } from './lines';
import { WarningNotice } from './WarningNotice';
import { weatherWarnings } from '../warnings';

/**
 * The weather's head, built from the module frame's slots: the sky behind (by condition and daytime, night switches the ink),
 * the temperature as thin large numerals with "feels like" and the word, the three facts that matter (rain, wind, UV) as chips
 * in the signature slot, everything else as one muted line. A hint above the head when the forecast days call for one.
 */
export function WeatherHero({ weather }: { weather: WeatherView }) {
  const tx = tWeather.use();
  const tp = tWeatherPage.use();
  const { forecast, stale, at } = weather;
  const nowIso = placeNowIso(forecast, at, now());
  const days = dayRows(forecast, nowIso.slice(0, 10));
  const hours = hourRows(forecast, nowIso);
  const first: DayRow | undefined = days[0];
  const detail = forecast.now;
  const { windParts } = lineBuilders(tx, forecast);
  const best = bestWindow(hours);
  const night = !!detail?.night;
  const hourFmt = dateTimeFormat({ hour: '2-digit', minute: '2-digit' });

  const wind = detail?.wind ?? hours[0]?.wind;
  const compass = detail?.dir != null ? tx.compass[compassIndex(detail.dir)] : undefined;
  const keys: { icon: IconName; text: string; kind?: 'rain' }[] = [
    forecast.rainFrom && !stale
      ? { icon: 'cloudRain', text: tp.keyRain(forecast.rainFrom), kind: 'rain' }
      : { icon: 'sun', text: tp.keyDry },
    ...(wind != null
      ? [
          {
            icon: 'wind' as const,
            text: compass ? `${tp.keyWind(wind)} ${compass}` : tp.keyWind(wind),
          },
        ]
      : []),
    ...(first?.uv != null && first.uv >= 1
      ? [{ icon: 'sun' as const, text: tp.keyUv(dec(first.uv)) }]
      : []),
  ];
  const rest = [
    first ? tx.range(first.min, first.max) : undefined,
    detail?.hum != null ? tx.humidity(detail.hum) : undefined,
    ...windParts(detail?.wind, detail?.gust, detail?.dir)
      .slice(1)
      .map((p) => p.t),
    detail?.cloud != null ? tx.cloud(detail.cloud) : undefined,
    detail?.hpa != null ? tx.pressure(detail.hpa) : undefined,
    first?.sunrise && first.sunset ? tx.sunSpan(first.sunrise, first.sunset) : undefined,
    best ? tx.bestTime(best.from, best.to) : undefined,
  ].filter(Boolean);
  const warnings = weatherWarnings(days);

  return (
    <>
      <HeroSlot area="backdrop">
        <Sky kind={skyKind(forecast.group, night)} />
      </HeroSlot>
      {warnings.length > 0 ? (
        <HeroSlot area="notice">
          <WarningNotice warnings={warnings} today={nowIso.slice(0, 10)} />
        </HeroSlot>
      ) : null}
      <HeroSlot area="figure">
        <div className={styles.heroBlock} data-testid="weather-now">
          <HeroFigure
            type="thin"
            value={tx.temp(forecast.temp)}
            detail={[
              detail?.feels != null ? tp.feelsLike(detail.feels) : undefined,
              tx.codes[forecast.group],
              stale ? tx.asOf(hourFmt.format(at)) : undefined,
            ]
              .filter(Boolean)
              .join(' · ')}
            testId="weather-temp"
          />
          <p className={styles.rest}>{rest.join(' · ')}</p>
        </div>
      </HeroSlot>
      {/* The three facts fill the stage's signature slot: with them there the frame draws no mark of its own. */}
      <HeroSlot area="signature">
        <ul className={styles.keys} data-testid="weather-keys">
          {keys.map((k) => (
            <li key={k.text} className={styles.key} data-kind={k.kind}>
              <Icon name={k.icon} size={16} />
              {k.text}
            </li>
          ))}
        </ul>
      </HeroSlot>
      {/* The same line for the phone, in the page under the head (the stage keeps its height there). */}
      {rest.length > 0 ? (
        <p className={`${styles.rest} ${styles.restBelow}`}>{rest.join(' · ')}</p>
      ) : null}
    </>
  );
}
