import { tWeatherPage } from '@/strings.weatherPage';
import { Card } from '@/ui';
import styles from '../routes/weather.module.css';
import { soonSentence, type RainSoon } from '../rainSoon';

/** Number of quarter hours drawn (the bars keep their place when some have passed). */
const SLOTS = 8;
/** The smallest bar scale, mm per quarter hour: light rain does not fill the block. */
const SCALE_MIN = 0.6;

/**
 * "Regen in den nächsten zwei Stunden" (CONCEPT-INFO §2): one sentence that says it all, eight bars under it
 * (`aria-hidden`), labelled "jetzt · +1 h · +2 h". Only rendered while `rainSoon` returns a value.
 */
export function RainSoonCard({ soon }: { soon: RainSoon }) {
  const tp = tWeatherPage.use();
  const max = Math.max(SCALE_MIN, ...soon.bars);
  const bars = Array.from({ length: SLOTS }, (_, i) => soon.bars[i]);
  return (
    <Card>
      <section
        aria-labelledby="weather-soon-title"
        data-testid="weather-rain-soon"
        data-snow={soon.snow ? 'true' : undefined}
      >
        <h2 id="weather-soon-title" className={styles.sectionTitle}>
          {tp.rainSoonTitle}
        </h2>
        <p className={styles.soonSentence}>{soonSentence(tp, soon)}</p>
        <div className={styles.soonBars} aria-hidden="true">
          {bars.map((v, i) =>
            v != null && v > 0 ? (
              <i key={i} style={{ height: `${Math.max(8, Math.round((v / max) * 100))}%` }} />
            ) : (
              <i key={i} data-zero="true" />
            ),
          )}
        </div>
        <div className={styles.soonTicks} aria-hidden="true">
          {tp.soonTicks.map((t) => (
            <span key={t}>{t}</span>
          ))}
        </div>
      </section>
    </Card>
  );
}
