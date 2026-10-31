import { lazy, Suspense, useState } from 'react';
import { Link } from 'react-router';
import { weatherIcon } from './weatherIcon';
import { settingsPath } from '@/core/settings/registry/paths';
import { dismissHint, isHintDismissed } from '@/core/weather/hint';
import { useWeatherSettings } from '@/core/weather/settings';
import { useWeather } from '@/core/weather/useWeather';
import { dateTimeFormat } from '@/core/i18n/format';
import { tWeather } from '@/strings.weather';
import { Button, Icon } from '@/ui';
import styles from './Home.module.css';

/** The forecast dialog (chart, air quality) loads on the first tap, not with the Overview. */
const WeatherPreview = lazy(() =>
  import('./WeatherPreview').then((m) => ({ default: m.WeatherPreview })),
);

const SETTINGS = settingsPath('verbindungen', 'weather');

/**
 * One calm line under "Jetzt wichtig": place, temperature, a few words and, only when it matters, when
 * rain is expected; "Stand hh:mm" when the values are older than 30 minutes (offline). A tap opens the
 * preview of today and the next days (Dialog). Not there when switched off, not there when nothing was ever fetched (no error text). Without
 * a chosen place a single quiet hint is offered once ("Später nicht mehr" ends it for good).
 */
export function WeatherLine() {
  const [open, setOpen] = useState(false);
  // Mounted from the first tap on (keeps the dialog's close transition), loaded only then.
  const [opened, setOpened] = useState(false);
  const weather = useWeather(open);
  const [settings] = useWeatherSettings();
  const tx = tWeather.use();
  const [hintOff, setHintOff] = useState(isHintDismissed);

  if (weather) {
    const { place, forecast, stale, at } = weather;
    const parts = [
      place.split(',')[0]!,
      `${tx.temp(forecast.temp)} ${tx.codes[forecast.group]}`,
      forecast.rainFrom && !stale ? tx.rainFrom(forecast.rainFrom) : undefined,
      stale
        ? tx.asOf(dateTimeFormat({ hour: '2-digit', minute: '2-digit' }).format(at))
        : undefined,
    ].filter(Boolean);
    return (
      <>
        <button
          type="button"
          className={`${styles.weather} ${styles.weatherButton}`}
          data-testid="weather-line"
          onClick={() => {
            setOpened(true);
            setOpen(true);
          }}
        >
          <Icon name={weatherIcon(forecast.group, forecast.now?.night)} size={16} />
          <span>{parts.join(' · ')}</span>
        </button>
        {opened ? (
          <Suspense fallback={null}>
            <WeatherPreview open={open} onClose={() => setOpen(false)} weather={weather} />
          </Suspense>
        ) : null}
      </>
    );
  }

  if (settings?.enabled && settings.place === '' && !hintOff) {
    return (
      <div className={styles.weather} data-testid="weather-hint">
        <Link to={SETTINGS} className={styles.weatherLink}>
          <Icon name="sun" size={16} />
          <span>{tx.chooseHint}</span>
        </Link>
        <Button
          variant="ghost"
          onClick={() => {
            dismissHint();
            setHintOff(true);
          }}
        >
          {tx.chooseHintDismiss}
        </Button>
      </div>
    );
  }
  return null;
}
