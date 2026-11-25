import { dateTimeFormat } from '@/core/i18n/format';
import { getPlatform } from '@/core/platform';
import { now } from '@/core/time/now';
import { localDate as placeDate } from '@/core/sky/moonDay';
import { DWD_WARNINGS_PAGE, type OfficialWarning } from '@/core/weather/warningsOfficial';
import { tWeather } from '@/strings.weather';
import { tWeatherPage } from '@/strings.weatherPage';
import { Icon, type IconName } from '@/ui';
import styles from '../routes/weather.module.css';
import { localDate } from './parts';
import type { WarningKind, WeatherWarning } from '../warnings';

const ICON: Record<WarningKind, IconName> = {
  storm: 'cloudLightning',
  wind: 'wind',
  ice: 'cloudDrizzle',
  rain: 'cloudRain',
  heat: 'thermometer',
  frost: 'thermometer',
};

/**
 * The hint of the day as a pill: one line per hint, icon + words ("Freitag: Sturmböen bis 70 km/h"), then once
 * "berechnet, keine amtliche Warnung". In the stage under the detail line (`inStage`), or full width under the head
 * when the forecast came late. Opaque, with the theme's own ink whatever the scene behind it.
 */
export function WarningNotice({
  warnings,
  today,
  inStage = false,
}: {
  warnings: WeatherWarning[];
  today: string;
  inStage?: boolean;
}) {
  const tp = tWeatherPage.use();
  const tx = tWeather.use();
  const dayFmt = dateTimeFormat({ weekday: 'long' });
  const dayName = (date: string) => (date === today ? tx.today : dayFmt.format(localDate(date)));
  const line = (w: WeatherWarning): string => {
    const day = dayName(w.date);
    const n = w.value ?? 0;
    switch (w.kind) {
      case 'storm':
        return tp.warn.storm(day);
      case 'wind':
        return tp.warn.wind(day, n);
      case 'ice':
        return tp.warn.ice(day);
      case 'rain':
        return tp.warn.rain(day, n);
      case 'heat':
        return tp.warn.heat(day, n);
      case 'frost':
        return tp.warn.frost(day, n);
    }
  };
  return (
    <div
      className={styles.warn}
      data-in-stage={inStage ? 'true' : undefined}
      role="note"
      aria-label={tp.warnLabel}
      data-testid="weather-warning"
    >
      <ul>
        {warnings.map((w) => (
          <li key={w.kind}>
            <Icon name={ICON[w.kind]} size={16} />
            <span>{line(w)}</span>
          </li>
        ))}
      </ul>
      <span className={styles.sep} aria-hidden="true">
        ·
      </span>
      <span className={styles.computed}>{tp.warnComputed}</span>
    </div>
  );
}

/**
 * The eclipse safety sentence in the hint's place (handoff/03-events "Safety pill"): the hint pill's look, icon `eye`,
 * no "berechnet" suffix; on the day of a visible solar eclipse until its end, above a weather hint if there is one.
 */
export function SafetyNotice({ inStage = false }: { inStage?: boolean }) {
  const tp = tWeatherPage.use();
  return (
    <div
      className={styles.warn}
      data-in-stage={inStage ? 'true' : undefined}
      role="note"
      data-testid="weather-safety"
    >
      <ul>
        <li>
          <Icon name="eye" size={16} />
          <span>{tp.ev.solarSafety}</span>
        </li>
      </ul>
    </div>
  );
}

/** "bis 23:00" today, "bis Do. 06:00" on a later day – the same words in the pill and in "Jetzt wichtig". */
export function officialUntil(ms: number, tz: string | undefined): string {
  const tp = tWeatherPage.get();
  const time = dateTimeFormat({ hour: '2-digit', minute: '2-digit', timeZone: tz }).format(ms);
  return placeDate(ms, tz) === placeDate(now(), tz)
    ? tp.officialUntilToday(time)
    : tp.officialUntil(dateTimeFormat({ weekday: 'short', timeZone: tz }).format(ms), time);
}

/**
 * Official DWD warnings (handoff/03b "Official pill"): filled and framed, visibly more official than a computed hint;
 * per warning "Amtliche (Unwetter)Warnung: {Ereignis}" · "bis …" · "Quelle: DWD" (opens the general DWD page, no
 * place in the link). `more`: rows that went under the head, said at the end of the last row.
 */
export function OfficialNotice({
  warnings,
  tz,
  inStage = false,
  more = 0,
}: {
  warnings: OfficialWarning[];
  tz: string | undefined;
  inStage?: boolean;
  more?: number;
}) {
  const tp = tWeatherPage.use();
  const until = (ms: number) => officialUntil(ms, tz);
  return (
    <div
      className={`${styles.warn} ${styles.official}`}
      data-in-stage={inStage ? 'true' : undefined}
      role="note"
      aria-label={tp.officialLabel}
      data-testid="weather-official"
    >
      <ul>
        {warnings.map((w, i) => (
          <li key={w.event}>
            <Icon name="alert" size={16} />
            <span className={styles.officialRow}>
              <strong>{w.level >= 3 ? tp.officialSevere(w.event) : tp.official(w.event)}</strong>
              <span className={styles.officialMeta}>
                {until(w.expires)} ·{' '}
                <button
                  type="button"
                  className={styles.officialSource}
                  onClick={() => void getPlatform().app.openUrl(DWD_WARNINGS_PAGE)}
                >
                  {tp.officialSource}
                </button>
                {more > 0 && i === warnings.length - 1 ? ` · ${tp.officialMore(more)}` : null}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
