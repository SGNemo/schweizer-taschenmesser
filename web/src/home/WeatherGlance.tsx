import { useMemo } from 'react';
import { Link } from 'react-router';
import { moonNow } from '@/core/sky/moonDay';
import { now } from '@/core/time/now';
import { useWeather } from '@/core/weather/useWeather';
import { conditionId, sceneHourOf } from '@/core/weather/scene';
import { placeNowIso } from '@/core/weather/logic';
import { skyOn, useWeatherSettings } from '@/core/weather/settings';
import { tOverview } from '@/strings.overview';
import { tWeather } from '@/strings.weather';
import { ScenePorthole } from '@/ui/weather-scene/ScenePorthole';
import { useSmallScene } from '@/ui/weather-scene/useSmallScene';
import styles from './OverviewHead.module.css';

/**
 * The weather as one short line next to the date: the scene as a 28 px porthole (same state as the weather head, never
 * moving), temperature, the word, the rain hint. It only exists when the weather module is on and a place is chosen
 * (`useWeather` is `undefined` otherwise), and it asks nothing the widget does not. The moon is calculated on the
 * device (`core/sky`) for the main place, only while "Mond und Himmelsereignisse" is on.
 */
export default function WeatherGlance() {
  const tx = tWeather.use();
  const to = tOverview.use();
  const weather = useWeather();
  const [settings] = useWeatherSettings();
  const lat = settings?.lat ?? 0;
  const lon = settings?.lon ?? 0;
  const tz = weather?.forecast.tz;
  const moonOn = !!weather && skyOn(settings);
  const minute = Math.floor(now() / 60_000);
  const moon = useMemo(
    () => (moonOn ? moonNow(minute * 60_000, lat, lon, tz) : undefined),
    [moonOn, minute, lat, lon, tz],
  );
  const scene = useSmallScene(weather, lat, moon);
  if (!weather || !scene) return null;
  const f = weather.forecast;
  const text = [
    tx.temp(f.temp),
    tx.conditions[conditionId(f.code, f.group, sceneHourOf(f, placeNowIso(f, weather.at, now())))],
    f.rainFrom && !weather.stale ? tx.rainFrom(f.rainFrom) : undefined,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <Link to="/weather" className={styles.weather} aria-label={to.weatherAria(text)}>
      <ScenePorthole state={scene} size={28} />
      {text}
    </Link>
  );
}
