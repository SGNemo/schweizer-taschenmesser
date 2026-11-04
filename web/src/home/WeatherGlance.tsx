import { Link } from 'react-router';
import { useWeather } from '@/core/weather/useWeather';
import { tOverview } from '@/strings.overview';
import { tWeather } from '@/strings.weather';
import { Sky, skyKind } from '@/ui/identity/Sky';
import styles from './OverviewHead.module.css';

/**
 * The weather as one short line next to the date: sky swatch, temperature, the word, the rain hint. It only exists when the
 * weather module is on and a place is chosen (`useWeather` is `undefined` otherwise), and it asks nothing the widget does not.
 */
export default function WeatherGlance() {
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
