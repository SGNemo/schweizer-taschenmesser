import { dateTimeFormat, numberFormat } from '@/core/i18n/format';
import type { MoonNow } from '@/core/sky/moonDay';
import { tWeather } from '@/strings.weather';
import { tWeatherPage } from '@/strings.weatherPage';
import { MoonGlyph } from '@/ui/weather-scene';
import styles from './MoonCard.module.css';

/**
 * "Mond & Himmel" in the aside (CONCEPT-MOON §6): the phase as a picture with its real tilt, its name and how much
 * is lit; moonrise and moonset of the place's day in clock order (or that there is none); the next full and new moon;
 * supermoon and second full moon when they are.
 */
export function MoonCard({
  moon,
  tz,
  south,
}: {
  moon: MoonNow;
  tz: string | undefined;
  south: boolean;
}) {
  const tx = tWeather.use();
  const tp = tWeatherPage.use();
  const time = dateTimeFormat({ hour: '2-digit', minute: '2-digit', timeZone: tz });
  const date = dateTimeFormat({ weekday: 'short', day: 'numeric', month: 'short', timeZone: tz });
  const pct = numberFormat({ maximumFractionDigits: 0 }).format(Math.round(moon.lit * 100));
  const day = moon.day;
  const events = [
    day.rise != null ? { at: day.rise, text: tp.moonRise(time.format(day.rise)) } : undefined,
    day.set != null ? { at: day.set, text: tp.moonSet(time.format(day.set)) } : undefined,
  ]
    .filter((e): e is { at: number; text: string } => !!e)
    .sort((a, b) => a.at - b.at)
    .map((e) => e.text);
  if (day.rise == null) events.push(tp.moonNoRise);
  if (day.set == null) events.push(tp.moonNoSet);
  const fullToday = day.name === 'full';
  const newToday = day.name === 'new';
  return (
    <section
      className={styles.card}
      data-testid="weather-moon"
      aria-labelledby="weather-moon-title"
    >
      <h3 id="weather-moon-title" className={styles.title}>
        {tp.moonTitle}
      </h3>
      <div className={styles.now}>
        <MoonGlyph
          illum={moon.lit}
          size={64}
          tilt={moon.lit >= 0.03 && moon.lit <= 0.97 ? moon.tilt : undefined}
          waxing={moon.waxing}
          south={south}
        />
        <p className={styles.name}>
          <span className={styles.phase}>{tx.moon[moon.name]}</span>
          <span>{tx.moon.lit(pct)}</span>
        </p>
      </div>
      <p className={styles.line} data-testid="weather-moon-times">
        {events.join(' · ')}
      </p>
      <p className={styles.line} data-testid="weather-moon-next">
        {[
          fullToday ? tp.moonFullToday : tp.moonNextFull(date.format(day.nextFull)),
          newToday ? tp.moonNewToday : tp.moonNextNew(date.format(day.nextNew)),
        ].join(' · ')}
      </p>
      {day.superMoon ? (
        <p className={styles.line}>
          <strong>{tp.moonSuper}</strong> · {tp.moonSuperLine}
        </p>
      ) : null}
      {day.secondFull ? <p className={styles.line}>{tp.moonBlue}</p> : null}
    </section>
  );
}
