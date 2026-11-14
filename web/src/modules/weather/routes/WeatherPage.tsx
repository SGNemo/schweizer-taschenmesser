import { Link, useSearchParams } from 'react-router';
import { now } from '@/core/time/now';
import { settingsPath } from '@/core/settings/registry/paths';
import { useHeadReady } from '@/core/shell/heroContext';
import { dayRows, hourRows, placeNowIso } from '@/core/weather/logic';
import { useWeatherSettings } from '@/core/weather/settings';
import { tWeather } from '@/strings.weather';
import { tWeatherPage } from '@/strings.weatherPage';
import { Button, Card, EmptyState, PageTitle } from '@/ui';
import { DaySpans } from '../components/DaySpans';
import { HourCards } from '../components/HourCards';
import { PlaceChips } from '../components/PlaceChips';
import { WeatherAir } from '../components/WeatherAir';
import { WeatherChart } from '../components/WeatherChart';
import { WarningNotice } from '../components/WarningNotice';
import { WeatherHero, WeatherHeroPending } from '../components/WeatherHero';
import { weatherWarnings } from '../warnings';
import { HeroSlot, SignatureMark, Sky } from '@/ui/identity';
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
  // `loading` is false (no place, fetching off, offline, the request failed): no forecast will come.
  // `late`: the frame stopped waiting first (a slow network); a hint that comes later goes under the head instead.
  const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
  const late = useHeadReady(!!settings && (!!weather || !loading));

  if (!settings) return null;
  const title = (weather?.place ?? settings.place ?? '').split(',')[0] || tx.title;

  if (!settings.place) {
    return (
      <>
        <PageTitle title={tx.title} />
        {/* C26: the sky stays in the head without a place (a calm day sky); the next step sits in the body. */}
        <HeroSlot area="backdrop">
          <Sky kind="clear" />
        </HeroSlot>
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
  const warnings = weather ? weatherWarnings(days) : [];

  return (
    <>
      <PageTitle title={title} />
      {weather ? (
        <WeatherHero weather={weather} warnings={late ? [] : warnings} />
      ) : loading ? (
        <WeatherHeroPending />
      ) : null}
      <PlaceChips index={index} places={places} />
      {/* A hint that came after the frame stopped waiting sits where the loading line was, under the head: nothing
          painted is below it yet, so it pushes nothing, and it stays in sight on the phone. */}
      <div aria-live="polite" data-testid="weather-late-warning">
        {late && warnings.length > 0 ? (
          <WarningNotice warnings={warnings} today={nowIso.slice(0, 10)} />
        ) : null}
      </div>
      {!weather ? (
        <p className={styles.loading} role="status">
          {/* Nothing is coming: offline says so; online the request failed (it is asked again later). */}
          {loading ? tx.previewLoading : offline ? tp.offline : tx.unavailable}
        </p>
      ) : (
        <div className={styles.layout} data-testid="weather-preview">
          <div className={styles.main}>
            {ready ? (
              <>
                <section aria-labelledby="weather-hours-title">
                  <h2 id="weather-hours-title" className={styles.sectionTitle}>
                    {tp.hoursTitle}
                  </h2>
                  <HourCards hours={hours.slice(0, 24)} />
                </section>
                <Card>
                  <h2 className={styles.sectionTitle}>{tp.chartTitle}</h2>
                  <WeatherChart hours={hours} large />
                </Card>
                <Card>
                  <h2 className={styles.sectionTitle}>{tp.daysTitle}</h2>
                  <DaySpans days={days} today={nowIso.slice(0, 10)} forecast={weather.forecast} />
                </Card>
              </>
            ) : (
              <p className={styles.loading}>{tx.previewLoading}</p>
            )}
          </div>
          <aside className={styles.aside} aria-label={tx.airTitle}>
            <WeatherAir air={weather.forecast.air} />
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
