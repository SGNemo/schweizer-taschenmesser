import { useMemo, type ReactNode } from 'react';
import type { MoonNow } from '@/core/sky/moonDay';
import { dateTimeFormat } from '@/core/i18n/format';
import type { DayRow } from '@/core/weather/api';
import { compassIndex } from '@/core/weather/air';
import { bestWindow, hourRows, placeNowIso, dayRows, rainsNow } from '@/core/weather/logic';
import {
  conditionId,
  defaultScene,
  sceneAddition,
  sceneOf,
  type SceneAddition,
  type SceneState,
} from '@/core/weather/scene';
import { sceneModeOf, useWeatherSettings } from '@/core/weather/settings';
import type { WeatherView } from '@/core/weather/useWeather';
import { now } from '@/core/time/now';
import { useKeepHeadRoom } from '@/core/shell/heroContext';
import { tWeather } from '@/strings.weather';
import { tWeatherPage } from '@/strings.weatherPage';
import { Icon, PHONE_QUERY, useMediaQuery, type IconName } from '@/ui';
import { HeroFigure, HeroSlot, skyKind } from '@/ui/identity';
import { MoonGlyph, useSceneEnv, WeatherScene } from '@/ui/weather-scene';
import styles from '../routes/weather.module.css';
import { dec } from './parts';
import { lineBuilders } from './lines';
import { WarningNotice } from './WarningNotice';
import type { WeatherWarning } from '../warnings';

/** The scene's mode from the setting "Bild im Wetter-Kopf" (`motion`, `still`, `plain`). */
function useSceneMode() {
  const [settings] = useWeatherSettings();
  const mode = sceneModeOf(settings);
  return {
    level: mode === 'plain' ? ('plain' as const) : ('full' as const),
    motion: mode === 'motion',
  };
}

/**
 * The scene behind a stage without a forecast (no place yet, or the forecast still on its way): a calm clear day of
 * the device's season, no body (handoff 01b "States").
 */
export function WeatherSceneDefault() {
  const env = useSceneEnv();
  const { level } = useSceneMode();
  const phone = useMediaQuery(PHONE_QUERY);
  const month = new Date(now()).getMonth() + 1;
  const state = useMemo<SceneState>(
    () => ({ ...defaultScene(env.theme, month, env.calm), level }),
    [env.theme, env.calm, month, level],
  );
  return (
    <HeroSlot area="backdrop">
      <WeatherScene state={state} phone={phone} legacyKind="clear" />
    </HeroSlot>
  );
}

/**
 * The weather's head, built from the module frame's slots: the scene behind (weather, time of day, wind, frost and
 * season of the place; the scene sets the ink), the temperature as thin large numerals with "feels like" and the
 * word, the hint of the day as a pill under it, the facts that matter as chips, everything else as one line.
 */
export function WeatherHero({
  weather,
  warnings,
  lat,
  moon,
}: {
  weather: WeatherView;
  /** The hints for the stage (`weatherWarnings`); empty when they came late and sit in the page instead. */
  warnings: WeatherWarning[];
  /** Latitude of the place (season and hemisphere of the scene). */
  lat: number;
  /** The moon now at the place; absent while "Mond und Himmelsereignisse" is off (then no moon anywhere). */
  moon?: MoonNow;
}) {
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
  const env = useSceneEnv();
  const { level, motion } = useSceneMode();
  const phone = useMediaQuery(PHONE_QUERY);
  // One state per minute and input: the scene is drawn again only when something it shows can have changed.
  const minute = Math.floor(now() / 60_000);
  const scene = useMemo(
    () =>
      sceneOf({
        forecast,
        at,
        nowMs: minute * 60_000,
        lat,
        theme: env.theme,
        calm: env.calm,
        level,
        motion,
        moon: moon
          ? {
              lit: moon.lit,
              tilt: moon.tilt,
              alt: moon.alt,
              az: moon.az,
              full: moon.name === 'full',
              superMoon: moon.day.superMoon,
            }
          : undefined,
      }),
    [forecast, at, minute, lat, env.theme, env.calm, level, motion, moon],
  );

  // UV only while the sun is up at the place (the day's maximum read at 02:50 said "UV 1,5" with a sun); otherwise the
  // third chip is the moon (its name and how much is lit), or the next sunrise while the moon is switched off.
  // Without sunrise and sunset `is_day` decides.
  const clockNow = nowIso.slice(11, 16);
  const sunUp =
    first?.sunrise && first.sunset ? clockNow >= first.sunrise && clockNow < first.sunset : !night;
  const nextSunrise = sunUp
    ? undefined
    : first?.sunrise && clockNow < first.sunrise
      ? first.sunrise
      : days[1]?.sunrise;
  const word = conditionId(forecast.code, forecast.group);
  const addition = sceneAddition({
    id: word,
    temp: forecast.temp,
    wind: detail?.wind,
    gust: detail?.gust,
    snowDepth: detail?.snowDepth,
    night,
  });
  const additionWord: Record<SceneAddition, string> = {
    storm: tp.sceneStorm,
    windy: tp.sceneWindy,
    snowLies: tp.sceneSnowLies,
    frost: tp.sceneFrost,
    heat: tp.sceneHeat,
  };

  const wind = detail?.wind ?? hours[0]?.wind;
  const compass = detail?.dir != null ? tx.compass[compassIndex(detail.dir)] : undefined;
  type Key = { icon: IconName; text: string; kind?: 'rain'; glyph?: ReactNode };
  // While it rains the first chip says so (never "no rain in sight" next to the word "rain"); with old values it stays out.
  const rainKey: Key[] = rainsNow(forecast.code, forecast.group)
    ? stale
      ? []
      : [{ icon: 'cloudRain', text: tp.keyRainNow, kind: 'rain' }]
    : forecast.rainFrom && !stale
      ? [{ icon: 'cloudRain', text: tp.keyRain(forecast.rainFrom), kind: 'rain' }]
      : [{ icon: 'umbrella', text: tp.keyDry }];
  const keys: Key[] = [
    ...rainKey,
    ...(wind != null
      ? [
          {
            icon: 'wind' as const,
            text: compass ? `${tp.keyWind(wind)} ${compass}` : tp.keyWind(wind),
          },
        ]
      : []),
    ...(sunUp
      ? first?.uv != null && first.uv >= 1
        ? [{ icon: 'sun' as const, text: tp.keyUv(dec(first.uv)) }]
        : []
      : moon
        ? [
            {
              icon: 'moon' as const,
              text: tp.keyMoon(tx.moon[moon.name], String(Math.round(moon.lit * 100))),
              glyph: (
                <MoonGlyph illum={moon.lit} size={16} mono waxing={moon.waxing} south={lat < 0} />
              ),
            },
          ]
        : nextSunrise
          ? [{ icon: 'sunrise' as const, text: tp.keySunrise(nextSunrise) }]
          : []),
  ];
  // Phone: two chips in the stage (rain / dry and wind); the third chip's fact opens the line under the stage.
  const stageKeys = phone ? keys.slice(0, 2) : keys;
  const moved = phone ? keys.slice(2).map((k) => k.text) : [];
  const rest = [
    ...moved,
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

  return (
    <>
      <HeroSlot area="backdrop">
        <WeatherScene state={scene} phone={phone} legacyKind={skyKind(forecast.group, night)} />
      </HeroSlot>
      <HeroSlot area="figure">
        <div className={styles.heroBlock} data-testid="weather-now" data-scene-text="">
          <HeroFigure
            type="thin"
            value={tx.temp(forecast.temp)}
            detail={[
              detail?.feels != null ? tp.feelsLike(detail.feels) : undefined,
              tx.conditions[word],
              addition ? additionWord[addition] : undefined,
              stale ? tx.asOf(hourFmt.format(at)) : undefined,
            ]
              .filter(Boolean)
              .join(' · ')}
            testId="weather-temp"
          />
          {warnings.length > 0 ? (
            <div data-scene-avoid="">
              <WarningNotice warnings={warnings} today={nowIso.slice(0, 10)} inStage />
            </div>
          ) : null}
        </div>
      </HeroSlot>
      {/* The three facts and the line of further values fill the stage's signature slot: with them there the frame
          draws no mark of its own, and they start right after the short temperature block. */}
      <HeroSlot area="signature">
        <div className={styles.heroFacts} data-testid="weather-facts" data-scene-text="">
          <ul className={styles.keys} data-testid="weather-keys" data-scene-avoid="">
            {stageKeys.map((k) => (
              <li key={k.text} className={styles.key} data-kind={k.kind}>
                {k.glyph ?? <Icon name={k.icon} size={16} />}
                {k.text}
              </li>
            ))}
          </ul>
          <p className={styles.rest}>{rest.join(' · ')}</p>
        </div>
      </HeroSlot>
      {/* The same line for the phone, in the page under the head (the stage keeps its height there). */}
      {rest.length > 0 ? (
        <p className={`${styles.rest} ${styles.restBelow}`}>{rest.join(' · ')}</p>
      ) : null}
    </>
  );
}

/**
 * The head while the first forecast is still on its way after the frame stopped waiting (a slow network, 0b-8): the
 * same blocks as `WeatherHero` – the figure with its line, the row of chips and the line of further values – with
 * dashes, in the stage's room of the last visit, so the head keeps its height when the forecast arrives. Behind it
 * the calm default scene (a clear day), as without a place.
 */
export function WeatherHeroPending() {
  // The stage keeps the room of the last visit (U01) until the forecast fills it: on the phone the chips wrap.
  useKeepHeadRoom(true);
  return (
    <>
      <WeatherSceneDefault />
      <HeroSlot area="figure">
        <div className={styles.heroBlock} data-testid="weather-now-pending" aria-hidden="true">
          {/* The line under the figure keeps its place; "Wird geladen" is said once, in the page. */}
          <HeroFigure type="thin" value="–" detail={'\u00a0'} />
        </div>
      </HeroSlot>
      <HeroSlot area="signature">
        <div className={styles.heroFacts} aria-hidden="true">
          <ul className={styles.keys}>
            <li className={styles.key}>–</li>
          </ul>
          <p className={styles.rest}>–</p>
        </div>
      </HeroSlot>
      <p className={`${styles.rest} ${styles.restBelow}`} aria-hidden="true">
        –
      </p>
    </>
  );
}
