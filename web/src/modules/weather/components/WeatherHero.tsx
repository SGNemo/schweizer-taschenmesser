import { useMemo, type ReactNode } from 'react';
import type { SkyEvents } from '@/core/sky/events';
import type { OfficialWarning } from '@/core/weather/warningsOfficial';
import type { MoonNow } from '@/core/sky/moonDay';
import { dateTimeFormat, numberFormat } from '@/core/i18n/format';
import type { DayRow, HourRow } from '@/core/weather/api';
import { compassIndex } from '@/core/weather/air';
import { bestWindow, hourRows, placeNowIso, dayRows, rainsNow } from '@/core/weather/logic';
import {
  conditionId,
  defaultScene,
  sceneAddition,
  sceneHourOf,
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
import { rainSoon, soonChip } from '../rainSoon';
import { dayChips, dayRest, hourChips } from '../dayView';
import { Icon, PHONE_QUERY, useMediaQuery, type IconName } from '@/ui';
import { HeroFigure, HeroSlot } from '@/ui/identity';
import { EventGlyph, MoonGlyph, useSceneEnv, WeatherScene } from '@/ui/weather-scene';
import styles from '../routes/weather.module.css';
import { dec } from './parts';
import { lineBuilders } from './lines';
import { OfficialNotice, SafetyNotice, WarningNotice } from './WarningNotice';
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
      <WeatherScene state={state} phone={phone} />
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
  events,
  official = [],
  officialMore = 0,
  view,
}: {
  weather: WeatherView;
  /**
   * Another moment than now (round 2, CONCEPT-DAYS §2): the head, the chips, the line of values and the picture follow
   * it; the picture changes with a cross-fade and never plays the opening motion.
   */
  view?: HeroView;
  /** The hints for the stage (`weatherWarnings`); empty when they came late and sit in the page instead. */
  warnings: WeatherWarning[];
  /** Latitude of the place (season and hemisphere of the scene). */
  lat: number;
  /** The moon now at the place; absent while "Mond und Himmelsereignisse" is off (then no moon anywhere). */
  moon?: MoonNow;
  /** The sky events now (package 3); absent while "Mond und Himmelsereignisse" is off. */
  events?: SkyEvents;
  /** Official DWD warnings for the stage (package 3b) and how many more went under the head. */
  official?: OfficialWarning[];
  officialMore?: number;
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
  const placeTime = dateTimeFormat({ hour: '2-digit', minute: '2-digit', timeZone: forecast.tz });
  const env = useSceneEnv();
  const { level, motion } = useSceneMode();
  const phone = useMediaQuery(PHONE_QUERY);
  // One state per minute and input: the scene is drawn again only when something it shows can have changed.
  const minute = Math.floor(now() / 60_000);
  const sky = view ? view.moon : moon;
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
        // The five seconds of motion belong to opening the page on "now" only (CONCEPT-DAYS §3).
        motion: motion && !view,
        moon: sky
          ? {
              lit: sky.lit,
              tilt: sky.tilt,
              alt: sky.alt,
              az: sky.az,
              full: sky.name === 'full',
              superMoon: sky.day.superMoon,
            }
          : undefined,
        event: view ? undefined : events?.scene,
        ...(view ? { hour: view.row } : {}),
      }),
    [forecast, at, minute, lat, env.theme, env.calm, level, motion, sky, events?.scene, view],
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
  const word = conditionId(forecast.code, forecast.group, sceneHourOf(forecast, nowIso));
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
  // Within two hours the 15-minute values say it to the minute (round 2, `rainSoon.ts`); otherwise as before.
  const soon = stale ? null : rainSoon(forecast, nowIso);
  const rainKey: Key[] = soon
    ? [{ icon: 'cloudRain', text: soonChip(tp, soon), kind: 'rain' }]
    : rainsNow(forecast.code, forecast.group)
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
              text: tp.keyMoon(
                tx.moon[moon.name],
                numberFormat({ maximumFractionDigits: 0 }).format(Math.round(moon.lit * 100)),
              ),
              glyph: (
                <MoonGlyph illum={moon.lit} size={16} mono waxing={moon.waxing} south={lat < 0} />
              ),
            },
          ]
        : nextSunrise
          ? [{ icon: 'sunrise' as const, text: tp.keySunrise(nextSunrise) }]
          : []),
  ];
  // A sky event takes the third chip's place (CONCEPT-EVENTS §2); on the phone it takes the wind chip's place and the
  // wind goes to the line of values under the picture.
  const chip = events?.chip;
  const eventKey = ((): Key | undefined => {
    if (!chip) return undefined;
    switch (chip.kind) {
      case 'solar':
      case 'lunar':
        return {
          icon: 'sun',
          text: `${chip.kind === 'solar' ? tp.ev.solarShort : tp.ev.lunarShort} ${placeTime.format(chip.from)}–${placeTime.format(chip.to)}`,
          glyph: <EventGlyph name={chip.kind === 'solar' ? 'eclipse' : 'lunar'} />,
        };
      case 'aurora':
        return { icon: 'sun', text: tp.ev.auroraChip, glyph: <EventGlyph name="aurora" /> };
      case 'rainbow':
        return { icon: 'sun', text: tp.ev.rainbowChip, glyph: <EventGlyph name="rainbow" /> };
      case 'meteors':
        return {
          icon: 'sun',
          text: tp.ev.meteorsChip(tp.ev.shower[chip.night.shower.id]),
          glyph: <EventGlyph name="meteor" />,
        };
    }
  })();
  const withEvent: Key[] = eventKey
    ? phone
      ? [...rainKey, eventKey, ...keys.slice(rainKey.length)]
      : [...keys.slice(0, rainKey.length + (wind != null ? 1 : 0)), eventKey]
    : keys;
  // Phone: two chips under the picture (rain / dry and wind or the event); the rest opens the line of values.
  const stageKeys = phone ? withEvent.slice(0, 2) : withEvent;
  const moved = phone ? withEvent.slice(2, eventKey ? 3 : undefined).map((k) => k.text) : [];
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

  // Another moment (CONCEPT-DAYS §2): its own figure, chips and line; the hints come from the page, already of that day.
  const moonChip = (m: MoonNow | undefined): Key[] =>
    m
      ? [
          {
            icon: 'moon',
            text: tp.keyMoon(
              tx.moon[m.name],
              numberFormat({ maximumFractionDigits: 0 }).format(Math.round(m.lit * 100)),
            ),
            glyph: <MoonGlyph illum={m.lit} size={16} mono waxing={m.waxing} south={lat < 0} />,
          },
        ]
      : [];
  const nowFigure = {
    value: tx.temp(forecast.temp),
    label: undefined as string | undefined,
    detail: [
      detail?.feels != null ? tp.feelsLike(detail.feels) : undefined,
      tx.conditions[word],
      addition ? additionWord[addition] : undefined,
    ]
      .filter(Boolean)
      .join(' · '),
  };
  const figure = view ? viewFigure(tp, tx, view) : nowFigure;
  let viewKeys: Key[] | undefined;
  let viewRest: string[] | undefined;
  if (view?.day) {
    const own: Key[] = view.chosen
      ? hourChips(tp, tx, view.row)
      : dayChips(tp, tx, forecast, view.day);
    viewKeys =
      own.length < 3 && !own.some((k) => k.icon === 'sun') ? [...own, ...moonChip(view.moon)] : own;
    viewRest = dayRest(tp, tx, forecast, view.day, view.chosen);
  }
  const shownKeys = viewKeys ? (phone ? viewKeys.slice(0, 2) : viewKeys) : stageKeys;
  const shownRest = viewRest
    ? [...(phone ? viewKeys!.slice(2).map((k) => k.text) : []), ...viewRest]
    : rest;

  const pills =
    events?.safety || official.length > 0 || warnings.length > 0 ? (
      <div className={styles.pills}>
        {events?.safety ? <SafetyNotice inStage /> : null}
        {official.length > 0 ? (
          <OfficialNotice warnings={official} tz={forecast.tz} inStage more={officialMore} />
        ) : null}
        {warnings.length > 0 ? (
          <WarningNotice warnings={warnings} today={nowIso.slice(0, 10)} inStage />
        ) : null}
      </div>
    ) : null;
  const chips = (
    <ul className={styles.keys} data-testid="weather-keys">
      {shownKeys.map((k) => (
        <li key={k.text} className={styles.key} data-kind={k.kind}>
          {k.glyph ?? <Icon name={k.icon} size={16} />}
          {k.text}
        </li>
      ))}
    </ul>
  );

  return (
    <>
      <HeroSlot area="backdrop">
        <WeatherScene
          state={scene}
          phone={phone}
          fadeKey={view ? view.row.time : 'now'}
          // The fade is motion too: only while the picture may move ("Bild im Wetter-Kopf": Bewegt).
          fade={motion}
        />
      </HeroSlot>
      <HeroSlot area="figure">
        <div className={styles.heroBlock} data-testid="weather-now" data-scene-text="">
          <HeroFigure
            type="thin"
            value={figure.value}
            valueLabel={figure.label}
            detail={[figure.detail, stale ? tx.asOf(hourFmt.format(at)) : undefined]
              .filter(Boolean)
              .join(' · ')}
            testId="weather-temp"
          />
          {phone ? null : pills}
        </div>
      </HeroSlot>
      {phone ? (
        <>
          {/* Phone (round 2, CONCEPT §5): the picture carries only the temperature and the word; the hint, two
              chips and the line of further values are the first block of the page, directly under it. The empty
              signature keeps the frame from drawing a mark of its own on the picture. */}
          <HeroSlot area="signature">
            <span className={styles.sigNone} />
          </HeroSlot>
          <div className={styles.below} data-testid="weather-facts">
            {pills}
            {chips}
            {shownRest.length > 0 ? (
              <p className={styles.restBelow}>{shownRest.join(' · ')}</p>
            ) : null}
          </div>
        </>
      ) : (
        // The chips and the line of further values fill the stage's signature slot: with them there the frame draws
        // no mark of its own, and they start right after the short temperature block.
        <HeroSlot area="signature">
          <div className={styles.heroFacts} data-testid="weather-facts" data-scene-text="">
            {chips}
            <p className={styles.rest}>{shownRest.join(' · ')}</p>
          </div>
        </HeroSlot>
      )}
    </>
  );
}

/** The moment of the head when it is not now (CONCEPT-DAYS §2). */
export interface HeroView {
  /** The hour the picture draws: the chosen one, else the day's middle hour (or the day as one hour). */
  row: HourRow;
  /** An hour is chosen: the big number is its temperature. */
  chosen: boolean;
  day: DayRow | undefined;
  /** The moon at that instant; absent while "Mond und Himmelsereignisse" is off. */
  moon?: MoonNow;
}

/** Big number and detail line of a day ("4° / −3°", "Freitag, 27. November · Regen") or of a chosen hour. */
function viewFigure(
  tp: ReturnType<typeof tWeatherPage.get>,
  tx: ReturnType<typeof tWeather.get>,
  view: HeroView,
): { value: string; label?: string; detail: string } {
  const { row, day } = view;
  const date = row.time.slice(0, 10);
  const noon = new Date(
    Number(date.slice(0, 4)),
    Number(date.slice(5, 7)) - 1,
    Number(date.slice(8, 10)),
    Number(row.time.slice(11, 13)),
  );
  if (view.chosen || !day) {
    const word = tx.conditions[conditionId(row.code, row.group, row)];
    const wd = dateTimeFormat({ weekday: 'short' }).format(noon);
    const time = row.time.slice(11, 16);
    return {
      value: tx.temp(row.temp),
      detail:
        row.feels != null
          ? tp.day.detailHour(wd, time, row.feels, word)
          : tp.day.detailHourNoFeels(wd, time, word),
    };
  }
  const word = tx.conditions[conditionId(day.code, day.group, { gust: day.gust })];
  const long = dateTimeFormat({ weekday: 'long', day: 'numeric', month: 'long' }).format(noon);
  return {
    value: tp.day.big(day.max, day.min),
    label: tp.day.bigAria(day.max, day.min),
    detail: tp.day.detail(long, word),
  };
}

/**
 * The head while the first forecast is still on its way after the frame stopped waiting (a slow network, 0b-8): the
 * same blocks as `WeatherHero` – the figure with its line, the row of chips and the line of further values – with
 * dashes, in the stage's room of the last visit, so the head keeps its height when the forecast arrives. Behind it
 * the calm default scene (a clear day), as without a place.
 */
export function WeatherHeroPending() {
  // The stage keeps the room of the last visit (U01) until the forecast fills it.
  useKeepHeadRoom(true);
  const phone = useMediaQuery(PHONE_QUERY);
  const facts = (
    <ul className={styles.keys}>
      <li className={styles.key}>–</li>
    </ul>
  );
  return (
    <>
      <WeatherSceneDefault />
      <HeroSlot area="figure">
        <div className={styles.heroBlock} data-testid="weather-now-pending" aria-hidden="true">
          {/* The line under the figure keeps its place; "Wird geladen" is said once, in the page. */}
          <HeroFigure type="thin" value="–" detail={'\u00a0'} />
        </div>
      </HeroSlot>
      {phone ? (
        <>
          <HeroSlot area="signature">
            <span className={styles.sigNone} />
          </HeroSlot>
          <div className={styles.below} aria-hidden="true">
            {facts}
            <p className={styles.restBelow}>–</p>
          </div>
        </>
      ) : (
        <HeroSlot area="signature">
          <div className={styles.heroFacts} aria-hidden="true">
            {facts}
            <p className={styles.rest}>–</p>
          </div>
        </HeroSlot>
      )}
    </>
  );
}
