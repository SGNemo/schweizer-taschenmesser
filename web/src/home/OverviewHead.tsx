import { Suspense, type ReactNode } from 'react';
import { lazyComponent } from '@/core/modules/lazy';
import { now, today } from '@/core/time/now';
import { formatDay } from '@/core/time/dates';
import { dayPart, tOverview } from '@/strings.overview';
import { t } from '@/strings';
import styles from './OverviewHead.module.css';

/** Loaded only with the weather module on: its texts and the forecast hook stay off the start path. */
const WeatherGlance = lazyComponent(() => import('./WeatherGlance'));

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
          {weather ? (
            <Suspense fallback={null}>
              <WeatherGlance />
            </Suspense>
          ) : null}
        </div>
      </div>
      {tools ? <div className={styles.tools}>{tools}</div> : null}
    </header>
  );
}
