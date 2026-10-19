import { useWeather } from '@/core/weather/useWeather';
import { tWeather } from '@/core/weather/strings';
import styles from './Home.module.css';

/**
 * One calm line under "Jetzt wichtig": place, temperature, a few words and, only when it matters, when
 * rain is expected. Not there without a chosen place (nothing requested), not there when the weather
 * cannot be reached (no error text).
 */
export function WeatherLine() {
  const weather = useWeather();
  const tx = tWeather.use();
  if (!weather) return null;
  const { place, forecast } = weather;
  const parts = [
    place.split(',')[0]!,
    `${tx.temp(forecast.temp)} ${tx.codes[forecast.group]}`,
    forecast.rainFrom ? tx.rainFrom(forecast.rainFrom) : undefined,
  ].filter(Boolean);
  return (
    <p className={styles.weather} data-testid="weather-line" aria-label={tx.line}>
      {parts.join(' · ')}
    </p>
  );
}
