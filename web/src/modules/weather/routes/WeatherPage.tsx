import { Link, useSearchParams } from 'react-router';
import { now } from '@/core/time/now';
import { settingsPath } from '@/core/settings/registry/paths';
import { useHeadReady } from '@/core/shell/heroContext';
import { dayRows, hourRows, placeNowIso } from '@/core/weather/logic';
import { isWeatherActive, officialOn, skyOn, useWeatherSettings } from '@/core/weather/settings';
import { withoutReplaced } from '@/core/weather/warningsOfficial';
import { tWeather } from '@/strings.weather';
import { tWeatherPage } from '@/strings.weatherPage';
import { Button, Card, EmptyState, PageTitle, PHONE_QUERY, useMediaQuery } from '@/ui';
import { DaySpans } from '../components/DaySpans';
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
import { WeatherHero, WeatherHeroPending, WeatherSceneDefault } from '../components/WeatherHero';
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
  const phone = useMediaQuery(PHONE_QUERY);
  const sunLine = useSunLine(weather?.forecast, weather?.at, lat, lon);

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

  const nowIso = weather ? placeNowIso(weather.forecast, weather.at, now()) : '';
  const hours = weather ? hourRows(weather.forecast, nowIso) : [];
  const days = weather ? dayRows(weather.forecast, nowIso.slice(0, 10)) : [];
  const ready = !!weather?.forecast.hours && !!weather.forecast.days;
  const soon = weather && !weather.stale ? rainSoon(weather.forecast, nowIso) : null;
  const more =
    weather && ready && days[0] ? moreGroups(tp, weather.forecast, days[0], nowIso, true) : [];
  // An official warning replaces today's computed hint of its kind (CONCEPT-SOURCES §3).
  const warnings = weather
    ? withoutReplaced(weatherWarnings(days), official, nowIso.slice(0, 10))
    : [];
  const officialAll = official ?? [];
  // At most two hint rows in the stage, in this order: the eclipse safety sentence, official warnings, computed hints;
  // the rest under the head. On the phone the safety sentence alone takes two lines: nothing else beside it there.
  const budget = late ? 0 : events?.safety ? (phone ? 0 : 1) : 2;
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
          events={late && events ? { ...events, safety: false } : events}
        />
      ) : loading ? (
        <WeatherHeroPending />
      ) : null}
      <PlaceChips index={index} places={places} />
      {/* A hint that came after the frame stopped waiting sits where the loading line was, under the head: nothing
          painted is below it yet, so it pushes nothing, and it stays in sight on the phone. */}
      <div aria-live="polite" data-testid="weather-late-warning">
        {late && events?.safety ? <SafetyNotice /> : null}
        {officialBelow.length > 0 ? (
          <OfficialNotice warnings={officialBelow} tz={weather?.forecast.tz} />
        ) : null}
        {belowWarnings.length > 0 ? (
          <WarningNotice warnings={belowWarnings} today={nowIso.slice(0, 10)} />
        ) : null}
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
                  <h2 id="weather-hours-title" className={styles.sectionTitle}>
                    {tp.hoursTitle}
                  </h2>
                  <HourCards hours={hours.slice(0, 24)} now={weather.forecast.now} />
                </section>
                <Card>
                  <WeatherChart
                    hours={hours}
                    air={weather.forecast.air}
                    all={weather.forecast.hours}
                    title={tp.chartTitle}
                  />
                </Card>
                <Card>
                  <h2 className={styles.sectionTitle}>{tp.daysTitle}</h2>
                  <DaySpans
                    days={days}
                    today={nowIso.slice(0, 10)}
                    forecast={weather.forecast}
                    moon={moon ? { lat, lon, tz: weather.forecast.tz } : undefined}
                  />
                </Card>
                <MoreValues groups={more} />
              </>
            ) : (
              <p className={styles.loading}>{tx.previewLoading}</p>
            )}
          </div>
          <aside className={styles.aside} aria-label={moon ? tp.asideLabel : tx.airTitle}>
            <WeatherAir air={weather.forecast.air} dust={!!events} />
            {moon ? (
              <MoonCard
                moon={moon}
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
