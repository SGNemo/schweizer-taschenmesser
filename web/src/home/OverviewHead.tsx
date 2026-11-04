import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { now, today } from '@/core/time/now';
import { formatDay } from '@/core/time/dates';
import { useWeather } from '@/core/weather/useWeather';
import { dayPart, tOverview } from '@/strings.overview';
import { t } from '@/strings';
import { tWeather } from '@/strings.weather';
import { Sky, skyKind } from '@/ui/identity';
import styles from './OverviewHead.module.css';

/**
 * The weather as one short line next to the date: sky swatch, temperature, the word, the rain hint. It only exists when the
 * weather module is on and a place is chosen (`useWeather` is `undefined` otherwise), and it asks nothing the widget does not.
 */
function WeatherGlance() {
  const tx = tWeather.use();
  const to = tOverview.use();
  const weather = useWeather();
  if (!weather) return null;
  const f = weather.forecast;
  const text = [
    tx.temp(f.temp),
    tx.codes[f.group],
    f.rainFrom && !weather.stale ? tx.rainFrom(f.rainFrom) : undefined,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <Link to="/weather" className={styles.weather} aria-label={to.weatherAria(text)}>
      <span className={styles.swatch} aria-hidden="true">
        <Sky kind={skyKind(f.group, !!f.now?.night)} compact />
      </span>
      {text}
    </Link>
  );
}

/**
 * Head of the overview (identity v3): a greeting by the time of day, the date with the weather, and the calm tools on the right.
 * The h1 keeps the page's name for screen readers ("Übersicht: Guten Morgen"); the greeting carries no name and no exclamation.
 */
export function OverviewHead({
  weather = false,
  tools,
}: {
  /** The weather module is on: show the short weather line. */
  weather?: boolean;
  tools?: ReactNode;
}) {
  const to = tOverview.use();
  const day = today();
  return (
    <header className={styles.head} data-testid="overview-head">
      <div className={styles.lead}>
        <h1 className={styles.greeting}>
          <span className="sr-only">{t.home.title}:</span>{' '}
          {to.greeting[dayPart(new Date(now()).getHours())]}
        </h1>
        <div className={styles.meta}>
          <time dateTime={day} className={styles.date}>
            {formatDay(day, 'EEEE, d. MMMM')}
          </time>
          {weather ? <WeatherGlance /> : null}
        </div>
      </div>
      {tools ? <div className={styles.tools}>{tools}</div> : null}
    </header>
  );
}
