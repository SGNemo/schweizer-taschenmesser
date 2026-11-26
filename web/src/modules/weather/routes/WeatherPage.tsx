import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { now } from '@/core/time/now';
import { settingsPath } from '@/core/settings/registry/paths';
import { useHeadReady } from '@/core/shell/heroContext';
import { dayRows, hourRows, hoursOf, placeNowIso } from '@/core/weather/logic';
import { dateTimeFormat } from '@/core/i18n/format';
import { moonNow } from '@/core/sky/moonDay';
import { conditionId } from '@/core/weather/scene';
import type { DayRow, Forecast, HourRow } from '@/core/weather/api';
import { isWeatherActive, officialOn, skyOn, useWeatherSettings } from '@/core/weather/settings';
import { withoutReplaced } from '@/core/weather/warningsOfficial';
import { tWeather } from '@/strings.weather';
import { tWeatherPage } from '@/strings.weatherPage';
import { Button, Card, EmptyState, PageTitle, PHONE_QUERY, useMediaQuery } from '@/ui';
import { DaySpans } from '../components/DaySpans';
import { DayStepper } from '../components/DayStepper';
import { localDate } from '../components/parts';
import {
  dayHints,
  instantOf,
  liveSentence,
  momentHour,
  officialOfDay,
  type ViewMoment,
} from '../dayView';
import { useStageSwipe } from '../useStageSwipe';
import { useViewMoment } from '../useViewMoment';
import { HourCards } from '../components/HourCards';
import { MoreValues } from '../components/MoreValues';
import { RainSoonCard } from '../components/RainSoonCard';
import { moreGroups } from '../moreValues';
import { rainSoon } from '../rainSoon';
import { useSunLine } from '../useSunLine';
import { PlaceChips } from '../components/PlaceChips';
import { MoonCard } from '../components/MoonCard';
import { WeatherAir } from '../components/WeatherAir';
import { WeatherChart } from '../components/WeatherChart';
import { OfficialNotice, SafetyNotice, WarningNotice } from '../components/WarningNotice';
import {
  WeatherHero,
  WeatherHeroPending,
  WeatherSceneDefault,
  type HeroView,
} from '../components/WeatherHero';
import { weatherWarnings } from '../warnings';
import { SignatureMark } from '@/ui/identity';
import { useMoon } from '../useMoon';
import { useAurora } from '../useAurora';
import { useOfficial } from '../useOfficial';
import { useSkyEvents } from '../useSkyEvents';
import { useViewedForecast } from '../useViewedForecast';
import styles from './weather.module.css';

const SETTINGS = settingsPath('verbindungen', 'weather');

/**
 * The weather module's page, a full page in the module frame (not a dialog): the head carries the sky, the temperature and the
 * three facts that matter; below it the places, the next hours as cards, the 24-hour picture with rain, wind and night, the seven
 * days as range bars; air quality and pollen sit in the aside. Without a place: one calm next step.
 */
export default function WeatherPage() {
  const tx = tWeather.use();
  const tp = tWeatherPage.use();
  const [params] = useSearchParams();
  const requested = Number(params.get('place') ?? 0) || 0;
  const [settings] = useWeatherSettings();
  const { index, places, weather, loading } = useViewedForecast(requested);
  // The hint above the head comes with the forecast: the frame paints head and page once the first read is back
  // (`identity.firstRead`, at most 0.6 s), so the hint never pushes them down (0b-8). Nothing to wait for when
  // `loading` is false (no place, switched off, offline, or the request answered or failed): no forecast will come.
  // `late`: the frame stopped waiting first (a slow network); a hint that comes later goes under the head instead.
  const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
  const late = useHeadReady(!!settings && (!!weather || !loading));
  // The viewed place (main or an extra one): its position feeds the scene's season and the moon.
  const viewed = index > 0 ? settings?.extra[index - 1] : settings;
  const lat = viewed?.lat ?? 0;
  const lon = viewed?.lon ?? 0;
  const moon = useMoon(lat, lon, weather?.forecast.tz, !!settings?.place);
  // Aurora and official warnings belong to the main place only (CONCEPT-SOURCES §1); an extra place shows neither.
  const main = index === 0 && !!settings?.place && isWeatherActive(settings);
  const aurora = useAurora(lat, lon, main && skyOn(settings));
  const official = useOfficial(lat, lon, weather?.forecast.tz, main && officialOn(settings));
  const events = useSkyEvents(
    lat,
    lon,
    weather?.forecast,
    !!settings?.place,
    !!weather?.stale,
    aurora,
  );
  // The view moment (round 2, CONCEPT-DAYS): the address says which day and hour the page shows; now by default.
  const forecast = weather?.forecast;
  const nowIso = weather ? placeNowIso(weather.forecast, weather.at, now()) : '';
  const today = nowIso.slice(0, 10);
  const days = forecast ? dayRows(forecast, today) : [];
  const offered = days.map((d) => d.date);
  const { moment, isNow, show, step } = useViewMoment(forecast ? today : undefined, offered);
  const isToday = moment.date === today;
  const shown = useMemo(
    () => (forecast && !isNow ? momentHour(forecast, moment) : undefined),
    // `moment` is rebuilt every render; its two fields decide.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [forecast, isNow, moment.date, moment.hour],
  );
  const tz = forecast?.tz;
  const shownTime = shown?.row.time;
  const viewMoon = useMemo(
    () => (moon && shownTime ? moonNow(instantOf(shownTime, tz), lat, lon, tz) : undefined),
    [moon, shownTime, tz, lat, lon],
  );
  const shownDay = days.find((d) => d.date === moment.date);
  const heroView = useMemo<HeroView | undefined>(
    () =>
      shown ? { row: shown.row, chosen: shown.chosen, day: shownDay, moon: viewMoon } : undefined,
    // `shownDay` follows the forecast and the date.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [shown, viewMoon, forecast, moment.date],
  );
  const sunLine = useSunLine(
    weather?.forecast,
    weather?.at,
    lat,
    lon,
    !!moon,
    moment.date || undefined,
  );
  const phone = useMediaQuery(PHONE_QUERY);
  useStageSwipe(phone && offered.length > 1, step);

  // One polite sentence per change of the moment, never on the first render (CONCEPT-DAYS §3).
  const momentKey = `${moment.date}|${moment.hour ?? ''}`;
  const [live, setLive] = useState('');
  // An hour picked from today's list of the next 24 hours keeps that list, also past midnight (CONCEPT-DAYS §2).
  const [fromNext, setFromNext] = useState(false);
  const lastKey = useRef<string | null>(null);
  const sentence = forecast ? liveOf(tp, tx, forecast, moment, shownDay, shown?.row) : '';
  useEffect(() => {
    // The moment the page opens on (once the forecast is there) is not announced; every change after it is.
    if (!forecast) return;
    const first = lastKey.current === null;
    if (lastKey.current === momentKey) return;
    lastKey.current = momentKey;
    if (!first) setLive(sentence);
    // Only a new moment is announced; the sentence is read at that render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [momentKey, !!forecast]);

  if (!settings) return null;
  const title = (weather?.place ?? settings.place ?? '').split(',')[0] || tx.title;

  if (!settings.place) {
    return (
      <>
        <PageTitle title={tx.title} />
        {/* C26: the scene stays in the head without a place (a calm day); the next step sits in the body. */}
        <WeatherSceneDefault />
        <div className={styles.empty} data-testid="weather-empty">
          <EmptyState title={tp.emptyTitle} motif={<SignatureMark id="sky" size={64} />}>
            <p>{tp.emptyText}</p>
            <Link to={SETTINGS}>
              <Button variant="primary">{tp.emptyAction}</Button>
            </Link>
          </EmptyState>
        </div>
      </>
    );
  }

  const hours = weather ? hourRows(weather.forecast, nowIso) : [];
  const ready = !!weather?.forecast.hours && !!weather.forecast.days;
  const soon = weather && !weather.stale && isNow ? rainSoon(weather.forecast, nowIso) : null;
  const more =
    weather && ready && shownDay
      ? moreGroups(tp, weather.forecast, shownDay, shown?.row.time ?? nowIso, isNow)
      : [];
  // Hints: now = the week's; another moment = that day's computed hints and the official warnings that touch it.
  // An official warning replaces the computed hint of its kind (CONCEPT-SOURCES §3).
  const officialAll = isNow
    ? (official ?? [])
    : officialOfDay(official ?? [], moment.date, weather?.forecast.tz);
  const warnings = weather
    ? withoutReplaced(
        isNow ? weatherWarnings(days) : dayHints(shownDay),
        isNow ? official : officialAll,
        isNow ? today : moment.date,
      )
    : [];
  const shownEvents = isNow ? events : undefined;
  // The hour cards: the next 24 hours on today, 00–23 of another day (CONCEPT-DAYS §2).
  const next24 = hours.slice(0, 24);
  const nextList =
    isToday || (fromNext && !!shown?.chosen && next24.some((h) => h.time === shown.row.time));
  const cards = !weather ? [] : nextList ? next24 : hoursOf(weather.forecast, moment.date);
  const checkedCard = isNow
    ? 0
    : shown?.chosen
      ? cards.findIndex((h) => h.time === shown.row.time)
      : -1;
  const lineHour = isNow ? cards[0] : shown?.chosen ? shown.row : undefined;
  const chartHours = nextList ? hours : cards;
  const weekday = dateTimeFormat({ weekday: 'long' });
  // Another day: its air values, or one sentence where the air forecast (five days) ends.
  const airDay = isToday
    ? undefined
    : (weather?.forecast.air?.days.find((d) => d.date === moment.date) ?? null);
  const pick = (m: ViewMoment, fromList = false) => {
    setFromNext(fromList);
    show(m);
  };
  // At most two hint rows with the head, in this order: the eclipse safety sentence, official warnings, computed hints;
  // the rest under the head. On the phone they stand directly under the picture (round 2, CONCEPT §5).
  const budget = late ? 0 : shownEvents?.safety ? 1 : 2;
  const officialStage = officialAll.slice(0, budget);
  const stageWarnings = warnings.slice(0, budget - officialStage.length);
  const officialBelow = officialAll.slice(officialStage.length);
  const belowWarnings = warnings.slice(stageWarnings.length);

  return (
    <>
      <PageTitle title={title} />
      {weather ? (
        <WeatherHero
          weather={weather}
          warnings={stageWarnings}
          official={officialStage}
          officialMore={officialBelow.length}
          lat={lat}
          moon={moon}
          // A forecast that came late puts the safety pill under the head only (never twice, never into a painted stage).
          events={late && shownEvents ? { ...shownEvents, safety: false } : shownEvents}
          view={heroView}
        />
      ) : loading ? (
        <WeatherHeroPending />
      ) : null}
      <div className={styles.placeRow}>
        <PlaceChips index={index} places={places} />
        {weather && offered.length > 0 ? (
          <DayStepper
            days={offered}
            date={moment.date}
            today={today}
            onStep={step}
            onToday={() => pick({ date: today, hour: null })}
          />
        ) : null}
      </div>
      <p className="sr-only" aria-live="polite" data-testid="weather-live">
        {live}
      </p>
      {/* A hint that came after the frame stopped waiting sits where the loading line was, under the head: nothing
          painted is below it yet, so it pushes nothing, and it stays in sight on the phone. */}
      <div aria-live="polite" data-testid="weather-late-warning">
        {late && shownEvents?.safety ? <SafetyNotice /> : null}
        {officialBelow.length > 0 ? (
          <OfficialNotice warnings={officialBelow} tz={weather?.forecast.tz} />
        ) : null}
        {belowWarnings.length > 0 ? <WarningNotice warnings={belowWarnings} today={today} /> : null}
      </div>
      {!weather ? (
        <p className={styles.loading} role="status">
          {/* Nothing is coming: switched off or offline says so (the settings link is in the foot); otherwise
              the request failed (it is asked again later). */}
          {loading
            ? tx.previewLoading
            : !isWeatherActive(settings)
              ? tp.switchedOff
              : offline
                ? tp.offline
                : tx.unavailable}
        </p>
      ) : (
        <div className={styles.layout} data-testid="weather-preview">
          <div className={styles.main}>
            {ready ? (
              <>
                {soon ? <RainSoonCard soon={soon} /> : null}
                <section aria-labelledby="weather-hours-title">
                  <div className={styles.secHead}>
                    <h2 id="weather-hours-title" className={styles.sectionTitle}>
                      {nextList ? tp.hoursTitle : tp.hoursTitleDay}
                    </h2>
                    {moment.hour != null ? (
                      <Button
                        size="sm"
                        onClick={() => pick({ date: nextList ? today : moment.date, hour: null })}
                        data-testid="weather-hour-back"
                      >
                        {nextList ? tp.hourBack : tp.hourBackDay}
                      </Button>
                    ) : null}
                  </div>
                  {cards.length > 0 ? (
                    <HourCards
                      hours={cards}
                      now={isNow ? weather.forecast.now : undefined}
                      firstIsNow={nextList}
                      checked={checkedCard}
                      lineHour={lineHour}
                      onPick={(h, i) =>
                        pick(
                          nextList && i === 0
                            ? { date: today, hour: null }
                            : { date: h.time.slice(0, 10), hour: Number(h.time.slice(11, 13)) },
                          nextList,
                        )
                      }
                    />
                  ) : (
                    <p className={styles.missing} data-testid="weather-hours-missing">
                      {tp.hourMissing}
                    </p>
                  )}
                </section>
                {chartHours.length >= 2 ? (
                  <Card>
                    <WeatherChart
                      hours={chartHours}
                      air={weather.forecast.air}
                      all={weather.forecast.hours}
                      title={
                        nextList
                          ? tp.chartTitle
                          : tp.chartTitleDay(weekday.format(localDate(moment.date, 12)))
                      }
                      marker={shown?.chosen ? shown.row.time : undefined}
                    />
                  </Card>
                ) : null}
                <Card>
                  <h2 className={styles.sectionTitle}>{tp.daysTitle}</h2>
                  <DaySpans
                    days={days}
                    today={today}
                    forecast={weather.forecast}
                    moon={moon ? { lat, lon, tz: weather.forecast.tz } : undefined}
                    checked={moment.date}
                    onPick={(date) => pick({ date, hour: null })}
                  />
                </Card>
                <MoreValues groups={more} />
              </>
            ) : (
              <p className={styles.loading}>{tx.previewLoading}</p>
            )}
          </div>
          <aside className={styles.aside} aria-label={moon ? tp.asideLabel : tx.airTitle}>
            <WeatherAir air={weather.forecast.air} dust={!!shownEvents} day={airDay} />
            {moon ? (
              <MoonCard
                moon={viewMoon ?? moon}
                tz={weather.forecast.tz}
                lat={lat}
                next={events?.card}
                sun={sunLine}
              />
            ) : null}
          </aside>
        </div>
      )}
      {/* The foot comes with the forecast: under a loading line it would be pushed down when the forecast arrives. */}
      {weather || !loading ? (
        <>
          <p className={styles.foot}>{tx.ratingHint}</p>
          <p className={styles.foot}>
            <Link to={SETTINGS}>{tx.settings}</Link>
          </p>
          <p className={styles.foot} data-testid="weather-preview-credit">
            {tx.attribution}{' '}
            <a href="https://open-meteo.com/" target="_blank" rel="noreferrer noopener">
              {tx.attributionLink}
            </a>
          </p>
        </>
      ) : null}
    </>
  );
}

/** The live region's sentence for a moment (COPY §4). */
function liveOf(
  tp: ReturnType<typeof tWeatherPage.get>,
  tx: ReturnType<typeof tWeather.get>,
  forecast: Forecast,
  moment: ViewMoment,
  day: DayRow | undefined,
  row: HourRow | undefined,
): string {
  const noon = localDate(moment.date, moment.hour ?? 12);
  const names = {
    date: dateTimeFormat({ weekday: 'long', day: 'numeric', month: 'long' }).format(noon),
    weekday: dateTimeFormat({ weekday: 'long' }).format(noon),
    time: row?.time.slice(11, 16) ?? '',
  };
  const word =
    moment.hour != null && row
      ? tx.conditions[conditionId(row.code, row.group, row)]
      : day
        ? tx.conditions[conditionId(day.code, day.group, { gust: day.gust })]
        : tx.conditions[conditionId(forecast.code, forecast.group, {})];
  return liveSentence(tp, moment, names, word, day, moment.hour != null ? row?.temp : undefined);
}
