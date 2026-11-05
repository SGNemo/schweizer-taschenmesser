import { Link, useSearchParams } from 'react-router';
import { now } from '@/core/time/now';
import { settingsPath } from '@/core/settings/registry/paths';
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
import { WeatherHero } from '../components/WeatherHero';
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

  return (
    <>
      <PageTitle title={title} />
      {weather ? <WeatherHero weather={weather} /> : null}
      <PlaceChips index={index} places={places} />
      {!weather ? (
        <p className={styles.loading} role="status">
          {loading ? tx.previewLoading : tp.offline}
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
  );
}
